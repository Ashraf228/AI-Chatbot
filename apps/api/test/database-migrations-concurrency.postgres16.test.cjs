const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_MIGRATION_CONCURRENCY_TEST === '1';

async function docker(...args) {
  return execFileAsync('docker', args, { timeout: 30_000 });
}

async function waitForPostgres(databaseUrl) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch (error) {
      lastError = error;
      await pool.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function eventually(callback) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await callback();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('timed out waiting for PostgreSQL activity');
}

function normalizedSql(sql) {
  let normalized = '';

  for (let index = 0; index < sql.length;) {
    if (sql.startsWith('--', index)) {
      const end = sql.slice(index).search(/[\n\r]/);
      index = end === -1 ? sql.length : index + end;
      normalized += ' ';
      continue;
    }
    if (sql.startsWith('/*', index)) {
      let depth = 1;
      index += 2;
      while (index < sql.length && depth > 0) {
        if (sql.startsWith('/*', index)) {
          depth += 1;
          index += 2;
        } else if (sql.startsWith('*/', index)) {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      if (depth !== 0) return null;
      normalized += ' ';
      continue;
    }
    if (sql[index] === "'") {
      const start = index;
      const isEscapeString = index > 0 && /[Ee]/.test(sql[index - 1]);
      let closed = false;
      index += 1;
      while (index < sql.length) {
        if (isEscapeString && sql[index] === '\\' && index + 1 < sql.length) {
          index += 2;
        } else if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
        } else if (sql[index] === "'") {
          index += 1;
          closed = true;
          break;
        } else {
          index += 1;
        }
      }
      if (!closed) return null;
      normalized += sql.slice(start, index);
      continue;
    }

    const dollarQuote = sql.slice(index).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
    if (dollarQuote) {
      const start = index;
      const end = sql.indexOf(dollarQuote, index + dollarQuote.length);
      if (end === -1) return null;
      index = end + dollarQuote.length;
      normalized += sql.slice(start, index);
      continue;
    }

    normalized += sql[index];
    index += 1;
  }

  return normalized.replace(/\s+/g, ' ').trim().replace(/;$/, '').toLowerCase();
}

function queryDetails(args) {
  const [first, second] = args;
  if (typeof first === 'string') {
    return { text: first, values: Array.isArray(second) ? second : [] };
  }
  if (first && typeof first === 'object' && typeof first.text === 'string') {
    return { text: first.text, values: Array.isArray(first.values) ? first.values : [] };
  }
  throw new Error('runner query has no SQL text');
}

function isExpectedLockQuery(query) {
  const normalized = normalizedSql(query.text);
  return query.values.length === 2
    && query.values[0] === 1397965313
    && query.values[1] === 1
    && normalized !== null
    && /^select pg_try_advisory_lock\(\$1(?:::[a-z_]+)?, \$2(?:::[a-z_]+)?\) as acquired$/
      .test(normalized);
}

test('runner lock query classifier accepts only the exact advisory lock poll', () => {
  const valid = {
    text: 'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired;',
    values: [1397965313, 1],
  };
  assert.equal(isExpectedLockQuery(valid), true);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT 1 /* pg_try_advisory_lock($1, $2) */',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: "SELECT 'pg_try_advisory_lock($1, $2)'",
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2) AS acquired; SELECT 1',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2) AS acquired',
    values: [1, 1397965313],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT TRUE AS acquired',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT 1 AS pg_try_advisory_lock',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2) AS acquired',
    values: [1397965313, 1, 999],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2, $3) AS acquired',
    values: [1397965313, 1, 999],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'CREATE TABLE IF NOT EXISTS schema_migrations(version text) -- SELECT pg_try_advisory_lock($1, $2) AS acquired',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'CREATE TABLE IF NOT EXISTS schema_migrations(version text) /* SELECT pg_try_advisory_lock($1, $2) AS acquired */',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT version FROM schema_migrations /* SELECT pg_try_advisory_lock($1, $2) AS acquired */',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: "SELECT '-- pg_try_advisory_lock($1, $2)' AS acquired",
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: "SELECT '/* pg_try_advisory_lock($1, $2) */' AS acquired",
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT $$/* pg_try_advisory_lock($1, $2) */$$ AS acquired',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT $payload$-- pg_try_advisory_lock($1, $2)$payload$ AS acquired',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: "SELECT 'text '' /* pg_try_advisory_lock($1, $2) */ '' text' AS acquired",
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: String.raw`SELECT E'escaped \' -- pg_try_advisory_lock($1, $2) /* literal */' AS acquired`,
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: String.raw`SELECT E'unclosed \' -- pg_try_advisory_lock($1, $2)`,
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: "SELECT 'unclosed -- pg_try_advisory_lock($1, $2)",
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: "SELECT 'doubled quote at end ''",
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2) AS acquired /*',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2) AS acquired /* unclosed',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2) AS acquired /* outer /* inner */',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'CREATE TABLE schema_migrations(version text) /* SELECT pg_try_advisory_lock($1, $2) AS acquired',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: '/*',
    values: [1397965313, 1],
  }), false);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT pg_try_advisory_lock($1, $2) AS acquired /* closed */',
    values: [1397965313, 1],
  }), true);
  assert.equal(isExpectedLockQuery({
    text: 'SELECT $payload$/* pg_try_advisory_lock($1, $2) */$other$ AS acquired',
    values: [1397965313, 1],
  }), false);
});

test('PostgreSQL 16 migration session lock serializes success, retry, and connection loss', { skip: !enabled }, async () => {
  await docker('image', 'inspect', 'pgvector/pgvector:pg16');
  const container = `migration-lock-${process.pid}-${Date.now()}`;
  const tempRoot = await mkdtemp(join(tmpdir(), 'migration-lock-pg16-'));
  const originalCwd = process.cwd();
  const databases = [];
  let control;

  try {
    await docker('run', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=temporary-test-password', '-e', 'POSTGRES_DB=migration_test', '-p', '127.0.0.1::5432', 'pgvector/pgvector:pg16');
    const { stdout } = await docker('port', container, '5432/tcp');
    const port = Number(stdout.trim().split(':').at(-1));
    const databaseUrl = `postgres://postgres:temporary-test-password@127.0.0.1:${port}/migration_test`;
    await waitForPostgres(databaseUrl);

    const { DatabaseService } = require('../dist/db/database.service.js');
    const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service.js');
    await mkdir(join(tempRoot, 'migrations'));
    process.chdir(tempRoot);

    const createRunner = (applicationName) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = `${databaseUrl}?application_name=${applicationName}`;
      const service = new DatabaseService();
      if (previous === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previous;
      }
      service.pool = new Pool({ connectionString: `${databaseUrl}?application_name=${applicationName}`, max: 1 });
      service.pool.on('error', () => {});
      const observedQueries = [];
      const originalConnect = service.pool.connect.bind(service.pool);
      service.pool.connect = async () => {
        const client = await originalConnect();
        const originalQuery = client.query.bind(client);
        client.query = async (...args) => {
          const details = queryDetails(args);
          const observed = {
            sequence: observedQueries.length,
            ...details,
            settled: false,
            result: undefined,
            acquired: undefined,
          };
          observedQueries.push(observed);
          try {
            const result = await originalQuery(...args);
            observed.settled = true;
            observed.result = result;
            observed.acquired = result?.rows?.[0]?.acquired;
            return result;
          } catch (error) {
            observed.settled = true;
            throw error;
          }
        };
        return client;
      };
      databases.push(service);
      return { database: service, migrations: new DatabaseMigrationsService(service), observedQueries };
    };
    control = new Pool({ connectionString: databaseUrl, max: 1 });

    await control.query('CREATE TABLE migration_barrier(released boolean NOT NULL)');
    await control.query('INSERT INTO migration_barrier(released) VALUES (false)');
    await control.query(`
      CREATE FUNCTION wait_for_migration_barrier() RETURNS void AS $$
      BEGIN
        WHILE NOT (SELECT released FROM migration_barrier LIMIT 1) LOOP
          PERFORM pg_sleep(0.01);
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await writeFile(join(tempRoot, 'migrations', '001_success.sql'), 'CREATE TABLE migration_success(id integer); SELECT wait_for_migration_barrier();');
    const first = createRunner('migration-lock-a');
    const second = createRunner('migration-lock-b');
    const firstRun = first.migrations.runPendingMigrations();
    await eventually(async () => {
      const result = await control.query("SELECT 1 FROM pg_stat_activity WHERE application_name = 'migration-lock-a' AND query LIKE '%wait_for_migration_barrier%'");
      return result.rowCount === 1;
    });
    const secondRun = second.migrations.runPendingMigrations();
    await eventually(() => second.observedQueries.some(
      (query) => isExpectedLockQuery(query) && query.settled && query.acquired === false,
    ));
    assert.equal(second.observedQueries.every(isExpectedLockQuery), true);
    await control.query('UPDATE migration_barrier SET released = true');
    await Promise.all([firstRun, secondRun]);
    const firstSuccessfulLock = second.observedQueries.findIndex(
      (query) => isExpectedLockQuery(query) && query.acquired === true,
    );
    const appliedRead = second.observedQueries.findIndex(
      (query) => /select version from schema_migrations/.test(normalizedSql(query.text)),
    );
    assert.ok(firstSuccessfulLock >= 0);
    assert.ok(appliedRead > firstSuccessfulLock);
    assert.equal(second.observedQueries.some(
      (query) => /begin|migration_success|insert into schema_migrations/.test(normalizedSql(query.text)),
    ), false);
    assert.equal((await control.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '001_success.sql'")).rows[0].count, 1);

    await control.query('CREATE SEQUENCE migration_fail_once');
    await control.query(`
      CREATE FUNCTION fail_first_migration_attempt() RETURNS void AS $$
      BEGIN
        IF nextval('migration_fail_once') = 1 THEN
          RAISE EXCEPTION 'controlled migration failure';
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await writeFile(join(tempRoot, 'migrations', '002_retry.sql'), 'SELECT fail_first_migration_attempt(); CREATE TABLE migration_retry(id integer);');
    await assert.rejects(() => createRunner('migration-lock-fail').migrations.runPendingMigrations());
    await createRunner('migration-lock-retry').migrations.runPendingMigrations();
    assert.equal((await control.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '002_retry.sql'")).rows[0].count, 1);
    assert.equal((await control.query("SELECT to_regclass('migration_retry') IS NOT NULL AS exists")).rows[0].exists, true);

    await writeFile(join(tempRoot, 'migrations', '003_connection.sql'), 'CREATE TABLE migration_connection(id integer); SELECT pg_sleep(5);');
    const disconnected = createRunner('migration-lock-disconnect');
    const disconnectedRun = disconnected.migrations.runPendingMigrations();
    const backend = await eventually(async () => {
      const result = await control.query("SELECT pid FROM pg_stat_activity WHERE application_name = 'migration-lock-disconnect' AND query LIKE '%pg_sleep%'");
      return result.rows[0];
    });
    await control.query('SELECT pg_terminate_backend($1)', [backend.pid]);
    await assert.rejects(() => disconnectedRun);
    await createRunner('migration-lock-recover').migrations.runPendingMigrations();
    assert.equal((await control.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '003_connection.sql'")).rows[0].count, 1);
    assert.equal((await control.query('SELECT count(*)::int AS count FROM pg_locks WHERE locktype = $1 AND classid = $2 AND objid = $3', ['advisory', 1397965313, 1])).rows[0].count, 0);

  } finally {
    await Promise.all([
      ...databases.map((database) => database.pool.end().catch(() => {})),
      control?.end().catch(() => {}),
    ]);
    process.chdir(originalCwd);
    await rm(tempRoot, { recursive: true, force: true });
    await docker('rm', '-f', container).catch(() => {});
  }
});

test('PostgreSQL 16 migration runner commits atomically and retries cleanly', { skip: !enabled }, async (t) => {
  await docker('image', 'inspect', 'pgvector/pgvector:pg16');
  const container = `migration-atomic-${process.pid}-${Date.now()}`;
  const tempRoot = await mkdtemp(join(tmpdir(), 'migration-atomic-pg16-'));
  const originalCwd = process.cwd();
  let database;
  let control;

  try {
    await docker('run', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=temporary-test-password', '-e', 'POSTGRES_DB=migration_test', '-p', '127.0.0.1::5432', 'pgvector/pgvector:pg16');
    const { stdout } = await docker('port', container, '5432/tcp');
    const port = Number(stdout.trim().split(':').at(-1));
    const databaseUrl = `postgres://postgres:temporary-test-password@127.0.0.1:${port}/migration_test`;
    await waitForPostgres(databaseUrl);

    const { DatabaseService } = require('../dist/db/database.service.js');
    const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service.js');
    await mkdir(join(tempRoot, 'migrations'));
    await writeFile(join(tempRoot, 'migrations', '001_atomic_success.sql'), 'CREATE TABLE atomic_success(id integer);');
    await writeFile(join(tempRoot, 'migrations', '002_atomic_retry.sql'), 'CREATE TABLE atomic_retry(id integer); CREATE TABLE atomic_retry_markers(marker text); INSERT INTO atomic_retry_markers(marker) VALUES (\'retry\'); SELECT missing_atomic_test_function();');
    process.chdir(tempRoot);

    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = databaseUrl;
    database = new DatabaseService();
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
    control = new Pool({ connectionString: databaseUrl, max: 1 });
    const migrations = new DatabaseMigrationsService(database);

    await t.test('successful migration persists its schema change', async () => {
      await assert.rejects(() => migrations.runPendingMigrations(), /missing_atomic_test_function/);
      assert.equal((await control.query("SELECT to_regclass('atomic_success') IS NOT NULL AS exists")).rows[0].exists, true);
    });

    await t.test('successful migration persists exactly one tracking row', async () => {
      const result = await control.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '001_atomic_success.sql'");
      assert.equal(result.rows[0].count, 1);
    });

    await t.test('failed migration rolls back its schema change', async () => {
      assert.equal((await control.query("SELECT to_regclass('atomic_retry') IS NULL AS absent")).rows[0].absent, true);
      assert.equal((await control.query("SELECT to_regclass('atomic_retry_markers') IS NULL AS absent")).rows[0].absent, true);
    });

    await t.test('failed migration creates no tracking row', async () => {
      const result = await control.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '002_atomic_retry.sql'");
      assert.equal(result.rows[0].count, 0);
    });

    await t.test('corrected migration retries once and remains applied once', async () => {
      await writeFile(join(tempRoot, 'migrations', '002_atomic_retry.sql'), 'CREATE TABLE atomic_retry(id integer); CREATE TABLE atomic_retry_markers(marker text); INSERT INTO atomic_retry_markers(marker) VALUES (\'retry\');');
      await migrations.runPendingMigrations();
      assert.equal((await control.query("SELECT to_regclass('atomic_retry') IS NOT NULL AS exists")).rows[0].exists, true);
      assert.equal((await control.query('SELECT count(*)::int AS count FROM atomic_retry_markers')).rows[0].count, 1);
      assert.equal((await control.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '002_atomic_retry.sql'")).rows[0].count, 1);
      await migrations.runPendingMigrations();
      assert.equal((await control.query('SELECT count(*)::int AS count FROM atomic_retry_markers')).rows[0].count, 1);
      assert.equal((await control.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '002_atomic_retry.sql'")).rows[0].count, 1);
    });
  } finally {
    await Promise.all([
      database?.pool.end().catch(() => {}),
      control?.end().catch(() => {}),
    ]);
    process.chdir(originalCwd);
    await rm(tempRoot, { recursive: true, force: true });
    await docker('rm', '-f', container).catch(() => {});
  }
});
