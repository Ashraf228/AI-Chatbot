import fs from "node:fs";
import path from "node:path";
import { repoPath } from "./authorization-inventory.mjs";

const databaseUrl = process.env.SECURITY_POSTGRES_DATABASE_URL;
const execute = process.env.SECURITY_POSTGRES_EXECUTE === "1";
const required = process.env.SECURITY_POSTGRES_REQUIRED === "1";

if (!databaseUrl || !execute) {
  if (required) {
    console.error(
      "[security-postgres] FAIL: SECURITY_POSTGRES_REQUIRED=1 requires SECURITY_POSTGRES_DATABASE_URL and SECURITY_POSTGRES_EXECUTE=1",
    );
    process.exit(1);
  }
  console.log(
    "[security-postgres] SKIP: set SECURITY_POSTGRES_DATABASE_URL and SECURITY_POSTGRES_EXECUTE=1 to run isolated PostgreSQL checks",
  );
  process.exit(0);
}

const parsedUrl = new URL(databaseUrl);
const safeHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const databaseName = parsedUrl.pathname.replace(/^\//, "");
if (!safeHosts.has(parsedUrl.hostname) || databaseName !== "security_boundary_test") {
  console.error("[security-postgres] FAIL: refusing to run outside the isolated security_boundary_test database");
  process.exit(1);
}

const { Client } = await import("pg");
const client = new Client({ connectionString: databaseUrl });
await client.connect();

async function query(sql, params = []) {
  return client.query(sql, params);
}

async function hasColumn(table, column) {
  const result = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return result.rowCount === 1;
}

async function hasIndex(indexName) {
  const result = await query(`SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`, [indexName]);
  return result.rowCount === 1;
}

async function hasConstraint(table, constraintName) {
  const result = await query(
    `SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = $1 AND constraint_name = $2`,
    [table, constraintName],
  );
  return result.rowCount === 1;
}

async function expectConstraintViolation(name, sql, params = []) {
  try {
    await query(sql, params);
  } catch (error) {
    if (error && ["23505", "23503", "23514"].includes(error.code)) {
      return;
    }
    throw error;
  }
  throw new Error(`${name} did not raise a PostgreSQL constraint violation`);
}

try {
  await query(`CREATE EXTENSION IF NOT EXISTS vector`);
  const migrationDir = repoPath("apps/api/migrations");
  const migrations = fs
    .readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(migrationDir, migration), "utf8");
    await query(sql);
  }

  const checks = [
    ["tenant_users.expires_at exists", await hasColumn("tenant_users", "expires_at")],
    ["tenant_users.evaluation_site_id exists", await hasColumn("tenant_users", "evaluation_site_id")],
    ["tenant_users_evaluation_site_fk exists", await hasConstraint("tenant_users", "tenant_users_evaluation_site_fk")],
    ["evaluation_chat_sessions exists", await hasColumn("evaluation_chat_sessions", "tenant_user_id")],
    ["evaluation_ticket_previews unique token exists", await hasConstraint("evaluation_ticket_previews", "evaluation_ticket_previews_preview_token_hash_key")],
    ["agent_tickets confirmation unique index exists", await hasIndex("agent_tickets_confirmation_id_unique")],
    ["evaluation_handoff_events event unique exists", await hasConstraint("evaluation_handoff_events", "evaluation_handoff_events_event_id_key")],
    ["evaluation_handoff_events ticket unique exists", await hasConstraint("evaluation_handoff_events", "evaluation_handoff_events_ticket_unique")],
    ["evaluation_handoff_deliveries delivery unique exists", await hasConstraint("evaluation_handoff_deliveries", "evaluation_handoff_deliveries_delivery_id_key")],
    ["evaluation_handoff_deliveries attempt unique exists", await hasConstraint("evaluation_handoff_deliveries", "evaluation_handoff_deliveries_attempt_unique")],
    ["evaluation_mock_handoff_receipts event unique exists", await hasConstraint("evaluation_mock_handoff_receipts", "evaluation_mock_handoff_receipts_event_id_key")],
    ["integration_connections signing_mode exists", await hasColumn("integration_connections", "signing_mode")],
    ["integration_connections signing mode check exists", await hasConstraint("integration_connections", "integration_connections_signing_mode_check")],
    ["webhook_jobs signing_mode exists", await hasColumn("webhook_jobs", "signing_mode")],
    ["webhook_jobs event id unique exists", await hasIndex("webhook_jobs_event_id_unique_idx")],
  ];

  await query(`
    INSERT INTO tenants(id, name)
    VALUES ('security_tenant_a', 'Security Tenant A'), ('security_tenant_b', 'Security Tenant B')
    ON CONFLICT (id) DO NOTHING
  `);
  await query(`
    INSERT INTO sites(id, tenant_id, name, is_evaluation_demo)
    VALUES
      ('security_site_a', 'security_tenant_a', 'Security Site A', true),
      ('security_site_b', 'security_tenant_b', 'Security Site B', true)
    ON CONFLICT (id) DO NOTHING
  `);
  await query(`
    INSERT INTO tenant_users(id, tenant_id, email, display_name, role, is_active, evaluation_site_id, expires_at)
    VALUES
      ('security_viewer_a', 'security_tenant_a', 'viewer-a@example.invalid', 'Viewer A', 'viewer', true, 'security_site_a', now() + interval '1 day'),
      ('security_viewer_b', 'security_tenant_b', 'viewer-b@example.invalid', 'Viewer B', 'viewer', true, 'security_site_b', now() + interval '1 day')
    ON CONFLICT (id) DO NOTHING
  `);
  await query(`
    INSERT INTO evaluation_chat_sessions(id, tenant_user_id, tenant_id, site_id, conversation_session_id, expires_at)
    VALUES
      ('security_session_a', 'security_viewer_a', 'security_tenant_a', 'security_site_a', 'security_conv_session_a', now() + interval '1 hour'),
      ('security_session_b', 'security_viewer_b', 'security_tenant_b', 'security_site_b', 'security_conv_session_b', now() + interval '1 hour')
    ON CONFLICT (id) DO NOTHING
  `);
  await query(`
    INSERT INTO agent_tickets(
      id, tenant_id, site_id, agent_run_id, title, description, confirmation_status,
      demo, synthetic, evaluation_chat_session_id, confirmation_id
    )
    VALUES
      ('security_ticket_a', 'security_tenant_a', 'security_site_a', 'run-a', 'Ticket A', 'Synthetic A', 'confirmed', true, true, 'security_session_a', 'confirm-security-a'),
      ('security_ticket_b', 'security_tenant_b', 'security_site_b', 'run-b', 'Ticket B', 'Synthetic B', 'confirmed', true, true, 'security_session_b', 'confirm-security-b')
    ON CONFLICT (id) DO NOTHING
  `);
  await expectConstraintViolation(
    "confirmation id unique index",
    `INSERT INTO agent_tickets(
      id, tenant_id, site_id, agent_run_id, title, description, confirmation_status,
      demo, synthetic, evaluation_chat_session_id, confirmation_id
    )
    VALUES ('security_ticket_dup', 'security_tenant_a', 'security_site_a', 'run-dup', 'Ticket Dup', 'Synthetic Dup', 'confirmed', true, true, 'security_session_a', 'confirm-security-a')`,
  );
  await query(`
    INSERT INTO agent_tickets(
      id, tenant_id, site_id, agent_run_id, title, description, confirmation_status,
      demo, synthetic, evaluation_chat_session_id, confirmation_id
    )
    VALUES ('security_ticket_event_dup', 'security_tenant_a', 'security_site_a', 'run-event-dup', 'Ticket Event Dup', 'Synthetic Event Dup', 'confirmed', true, true, 'security_session_a', 'confirm-security-event-dup')
    ON CONFLICT (id) DO NOTHING
  `);

  await query(`
    INSERT INTO evaluation_handoff_events(
      id, event_id, event_type, tenant_id, site_id, tenant_user_id, evaluation_chat_session_id,
      conversation_id, evaluation_ticket_id, payload_body, payload_hash, status
    )
    VALUES
      ('security_event_a', 'evt-security-a', 'ticket.created', 'security_tenant_a', 'security_site_a', 'security_viewer_a', 'security_session_a', 'security_conversation_a', 'security_ticket_a', '{"ticket":"a"}', 'hash-a', 'delivered'),
      ('security_event_b', 'evt-security-b', 'ticket.created', 'security_tenant_b', 'security_site_b', 'security_viewer_b', 'security_session_b', 'security_conversation_b', 'security_ticket_b', '{"ticket":"b"}', 'hash-b', 'delivered')
    ON CONFLICT (id) DO NOTHING
  `);
  await expectConstraintViolation(
    "event id unique constraint",
    `INSERT INTO evaluation_handoff_events(
      id, event_id, event_type, tenant_id, site_id, tenant_user_id, evaluation_chat_session_id,
      conversation_id, evaluation_ticket_id, payload_body, payload_hash, status
    )
    VALUES ('security_event_dup', 'evt-security-a', 'ticket.created', 'security_tenant_a', 'security_site_a', 'security_viewer_a', 'security_session_a', 'security_conversation_dup', 'security_ticket_event_dup', '{"ticket":"dup"}', 'hash-dup', 'delivered')`,
  );

  await query(`
    INSERT INTO evaluation_handoff_deliveries(id, delivery_id, event_id, attempt_number, status)
    VALUES
      ('security_delivery_a1', 'del-security-a1', 'evt-security-a', 1, 'delivered'),
      ('security_delivery_b1', 'del-security-b1', 'evt-security-b', 1, 'delivered')
    ON CONFLICT (id) DO NOTHING
  `);
  await expectConstraintViolation(
    "delivery id unique constraint",
    `INSERT INTO evaluation_handoff_deliveries(id, delivery_id, event_id, attempt_number, status)
     VALUES ('security_delivery_dup', 'del-security-a1', 'evt-security-a', 2, 'delivered')`,
  );
  await expectConstraintViolation(
    "delivery attempt unique constraint",
    `INSERT INTO evaluation_handoff_deliveries(id, delivery_id, event_id, attempt_number, status)
     VALUES ('security_delivery_attempt_dup', 'del-security-a2', 'evt-security-a', 1, 'delivered')`,
  );

  await query(`
    DELETE FROM evaluation_handoff_deliveries
    WHERE event_id IN (
      SELECT event_id FROM evaluation_handoff_events
      WHERE tenant_id = 'security_tenant_a' AND site_id = 'security_site_a'
    )
  `);
  await query(`
    DELETE FROM evaluation_handoff_events
    WHERE tenant_id = 'security_tenant_a' AND site_id = 'security_site_a'
  `);
  await query(`
    DELETE FROM evaluation_chat_sessions
    WHERE tenant_id = 'security_tenant_a' AND site_id = 'security_site_a'
  `);
  const remainingOtherTenant = await query(`
    SELECT
      (SELECT count(*)::int FROM evaluation_handoff_events WHERE tenant_id = 'security_tenant_b' AND site_id = 'security_site_b') AS events,
      (SELECT count(*)::int FROM evaluation_handoff_deliveries WHERE event_id = 'evt-security-b') AS deliveries,
      (SELECT count(*)::int FROM evaluation_chat_sessions WHERE tenant_id = 'security_tenant_b' AND site_id = 'security_site_b') AS sessions
  `);
  checks.push([
    "scoped reset leaves other tenant and site untouched",
    remainingOtherTenant.rows[0].events === 1 &&
      remainingOtherTenant.rows[0].deliveries === 1 &&
      remainingOtherTenant.rows[0].sessions === 1,
  ]);

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length > 0) {
    for (const [name] of failed) {
      console.error(`[security-postgres] FAIL: ${name}`);
    }
    process.exit(1);
  }
  console.log(`[security-postgres] PASS: ${checks.length} isolated schema checks passed after ${migrations.length} migrations`);
} finally {
  await client.end();
}
