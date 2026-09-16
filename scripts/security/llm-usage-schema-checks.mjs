import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Called only by the opt-in, loopback-only security_boundary_test harness.
// The actual 001 table definitions and 034 SQL are supplied without rewriting.
export async function checkLlmUsageSchema(query, { initialSql, migrationSql, pipelineSource }) {
  const server = (await query(
    "SELECT current_database() AS database, current_setting('server_version_num')::int AS version",
  )).rows[0];
  assert.equal(server.database, "security_boundary_test");
  assert.ok(server.version >= 160000 && server.version < 170000, "PostgreSQL 16 required");

  const checks = [];
  async function check(name, run) {
    await run();
    checks.push([`034: ${name}`, true]);
    console.log(`[usage-schema] PASS: ${name}`);
  }
  const tableSql = ["usage_events", "usage_daily"].map((table) => {
    const statement = initialSql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`));
    assert.ok(statement, `001 definition missing: ${table}`);
    return statement[0];
  });
  function writerSql(table) {
    const statement = pipelineSource.match(new RegExp("`(INSERT INTO " + table + " \\([\\s\\S]*?)`"));
    assert.ok(statement, `baseline writer missing: ${table}`);
    return statement[1];
  }
  const legacyInsert = writerSql("usage_events");
  const legacyDaily = writerSql("usage_daily");
  const schema = `usage_schema_${randomUUID().replaceAll("-", "")}`;
  const metadata = (schemaName) => query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'usage_events' ORDER BY ordinal_position`,
    [schemaName],
  );
  const readEvents = () => query("SELECT * FROM usage_events ORDER BY id");
  const oldWrite = (id, tokens = [11, 7, 18]) => query(legacyInsert, [
    id, "usage_tenant_a", "usage_site_a", "usage_conversation_a", "usage_session_a",
    "synthetic-model", ...tokens, 0, 1, true,
  ]);
  const measuredWrite = (id, overrides = {}) => {
    const row = {
      status: "confirmed", provider: "openai", outcome: "success",
      input: 11, output: 7, total: 18, cost: 0.001, ...overrides,
    };
    return query(
      `INSERT INTO usage_events (
         id, tenant_id, site_id, conversation_id, session_id, model,
         usage_status, provider_key, call_outcome, input_tokens, output_tokens, total_tokens, estimated_cost
       ) VALUES ($1, 'usage_tenant_b', 'usage_site_b', 'usage_conversation_b', 'usage_session_b',
                 'synthetic-model', $2, $3, $4, $5, $6, $7, $8)`,
      [id, row.status, row.provider, row.outcome, row.input, row.output, row.total, row.cost],
    );
  };
  async function rejected(run, expectedCode) {
    await query("SAVEPOINT usage_expected_failure");
    let error;
    try { await run(); } catch (caught) { error = caught; }
    await query("ROLLBACK TO SAVEPOINT usage_expected_failure");
    await query("RELEASE SAVEPOINT usage_expected_failure");
    assert.ok(error, "statement unexpectedly succeeded");
    assert.equal(error.code, expectedCode);
  }

  let begun = false;
  let primaryError;
  try {
    await query("BEGIN");
    begun = true;
    await query("SET LOCAL statement_timeout = '10s'");
    await query("SET LOCAL lock_timeout = '3s'");
    await query(`CREATE SCHEMA ${schema}`);
    await query(`SET LOCAL search_path TO ${schema}, pg_catalog`);
    for (const sql of tableSql) await query(sql);
    await oldWrite("legacy-before");
    await oldWrite("legacy-zero", [0, 0, 0]);
    const before = (await readEvents()).rows;
    const oldColumns = (await metadata(schema)).rows;
    await query(legacyDaily, ["usage_tenant_a", "usage_site_a", 1, 1, 1, 11, 7, 18, 0, 1, 0, 1]);
    const dailyBefore = (await query("SELECT * FROM usage_daily")).rows;

    await check("late DDL transaction failure rolls back; retry remains possible", async () => {
      await rejected(async () => {
        await query(migrationSql);
        await query("SELECT 1 / 0");
      }, "22012");
      assert.deepEqual((await metadata(schema)).rows, oldColumns);
      assert.deepEqual((await readEvents()).rows, before);
      await query(migrationSql);
    });

    await check("historical values stay legacy and daily aggregates stay untouched", async () => {
      const rows = (await readEvents()).rows;
      assert.deepEqual(rows.map(({ usage_status, provider_key, call_outcome, ...row }) => {
        assert.equal(usage_status, "legacy");
        assert.equal(provider_key, null);
        assert.equal(call_outcome, null);
        return row;
      }), before);
      assert.deepEqual((await query("SELECT * FROM usage_daily")).rows, dailyBefore);
    });

    await check("unchanged pipeline event and daily SQL still writes successfully", async () => {
      await oldWrite("legacy-after");
      await query(legacyDaily, ["usage_tenant_a", "usage_site_a", 1, 1, 1, 11, 7, 18, 0, 1, 0, 1]);
      const row = (await query("SELECT * FROM usage_events WHERE id = 'legacy-after'")).rows[0];
      assert.equal(row.usage_status, "legacy");
      assert.equal(row.total_tokens, 18);
      assert.equal(row.provider_key, null);
      assert.equal(row.call_outcome, null);
      const daily = (await query("SELECT * FROM usage_daily")).rows[0];
      assert.equal(daily.total_tokens, 36);
      assert.equal(daily.request_count, 2);
    });

    await check("confirmed zero, missing and incomplete measurements remain distinct", async () => {
      await measuredWrite("confirmed");
      await measuredWrite("zero", { input: 0, output: 0, total: 0, cost: 0 });
      await measuredWrite("missing", { status: "missing", input: null, output: null, total: null, cost: null, outcome: "aborted" });
      await measuredWrite("incomplete", { status: "incomplete", output: null, total: null, cost: null, outcome: "error" });
      const rows = (await query(
        "SELECT id, usage_status, input_tokens, total_tokens, estimated_cost FROM usage_events WHERE id IN ('zero', 'missing', 'incomplete') ORDER BY id",
      )).rows;
      assert.deepEqual(rows, [
        { id: "incomplete", usage_status: "incomplete", input_tokens: 11, total_tokens: null, estimated_cost: null },
        { id: "missing", usage_status: "missing", input_tokens: null, total_tokens: null, estimated_cost: null },
        { id: "zero", usage_status: "confirmed", input_tokens: 0, total_tokens: 0, estimated_cost: 0 },
      ]);
    });

    await check("invalid metadata and false confirmation fail real CHECK constraints", async () => {
      const invalid = [
        { status: "unknown" }, { provider: null }, { provider: "other" },
        { outcome: null }, { outcome: "other" }, { status: "legacy" },
        { input: null }, { output: null }, { total: null }, { total: 999 },
        { input: -1 }, { output: -1 }, { total: -1 },
        { input: 2147483647, output: 2147483647, total: 2147483647 },
        { status: "missing", cost: null },
        { status: "missing", input: null, output: null, total: null, cost: 0 },
        { status: "incomplete", output: null, total: null, cost: 0 },
      ];
      for (const [index, row] of invalid.entries()) {
        await rejected(() => measuredWrite(`invalid-${index}`, row), "23514");
      }
      await rejected(() => measuredWrite("null-status", { status: null }), "23502");
      await rejected(() => measuredWrite("overflow", { total: 2147483648 }), "22003");
    });

    await check("measurement status is independent from success, error and abort", async () => {
      for (const outcome of ["success", "error", "aborted"]) {
        await measuredWrite(`confirmed-${outcome}`, { outcome });
        await measuredWrite(`missing-${outcome}`, {
          outcome, status: "missing", input: null, output: null, total: null, cost: null,
        });
      }
      const rows = (await query("SELECT call_outcome, total_tokens FROM usage_events WHERE id LIKE 'confirmed-%' ORDER BY call_outcome")).rows;
      assert.deepEqual(rows, ["aborted", "error", "success"].map((call_outcome) => ({ call_outcome, total_tokens: 18 })));
    });

    await check("existing event primary key and UPDATE validation remain effective", async () => {
      await rejected(() => measuredWrite("confirmed"), "23505");
      await rejected(() => query("UPDATE usage_events SET total_tokens = 999 WHERE id = 'confirmed'"), "23514");
      assert.equal((await query("SELECT total_tokens FROM usage_events WHERE id = 'confirmed'")).rows[0].total_tokens, 18);
    });

    await check("NOT NULL restoration fails without destroying unknown measurement evidence", async () => {
      for (const column of ["input_tokens", "output_tokens", "total_tokens", "estimated_cost"]) {
        await rejected(() => query(`ALTER TABLE usage_events ALTER COLUMN ${column} SET NOT NULL`), "23502");
      }
      const row = (await query("SELECT input_tokens, output_tokens, total_tokens, estimated_cost FROM usage_events WHERE id = 'missing'")).rows[0];
      assert.deepEqual(row, { input_tokens: null, output_tokens: null, total_tokens: null, estimated_cost: null });
    });

    await check("repeated migration preserves mixed rows and the validated constraint", async () => {
      const events = (await readEvents()).rows;
      const daily = (await query("SELECT * FROM usage_daily")).rows;
      await query(migrationSql);
      await query(migrationSql);
      assert.deepEqual((await readEvents()).rows, events);
      assert.deepEqual((await query("SELECT * FROM usage_daily")).rows, daily);
      const constraints = (await query(
        "SELECT convalidated FROM pg_constraint WHERE conrelid = 'usage_events'::regclass AND conname = 'usage_events_llm_measurement_check'",
      )).rows;
      assert.deepEqual(constraints, [{ convalidated: true }]);
    });

    await check("full 001-034 CI schema matches the isolated usage upgrade", async () => {
      assert.deepEqual((await metadata("public")).rows, (await metadata(schema)).rows);
      const publicCheck = (await query(
        "SELECT convalidated FROM pg_constraint WHERE conrelid = 'public.usage_events'::regclass AND conname = 'usage_events_llm_measurement_check'",
      )).rows;
      assert.deepEqual(publicCheck, [{ convalidated: true }]);
    });
  } catch (error) {
    primaryError = error;
  } finally {
    if (begun) {
      try { await query("ROLLBACK"); } catch (cleanupError) {
        if (primaryError) throw new AggregateError([primaryError, cleanupError], "Usage schema test and rollback failed", { cause: primaryError });
        throw cleanupError;
      }
    }
  }
  if (primaryError) throw primaryError;
  assert.equal((await query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [schema])).rowCount, 0);
  return checks;
}
