-- Dedicated application database only. Operator/migrator applies this in a closed,
-- drained window; never API startup. NOLOGIN until separately bound credentials exist.
BEGIN;
-- Refuse schema drift before any authority or ownership change.
DO $inventory$
DECLARE actual text[]; expected text[] := ARRAY[
  'agent_contact_requests','agent_runs','agent_tickets','audit_logs','chunks','conversations',
  'documents','email_jobs','evaluation_chat_sessions','evaluation_handoff_deliveries',
  'evaluation_handoff_events','evaluation_mock_handoff_receipts','evaluation_ticket_previews',
  'integration_connections','knowledge_sources','messages','plans','provider_approval_audit_events',
  'provider_approval_grants','report_runs','report_subscriptions','schema_migrations','site_modules',
  'sites','tenant_subscriptions','tenant_users','tenants','tool_invocations','usage_daily','usage_events',
  'webhook_jobs','widget_events','widget_leads','widget_sessions'];
BEGIN
  SELECT array_agg(c.relname::text ORDER BY c.relname) INTO actual FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S');
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Reviewed schema-034 inventory required'; END IF;
  IF (SELECT count(*) FROM schema_migrations) <> 34
    OR EXISTS (SELECT 1 FROM schema_migrations WHERE version !~ '^(00[1-9]|0[12][0-9]|03[0-4])_[a-z0-9_]+[.]sql$')
    OR (SELECT count(DISTINCT left(version,3)) FROM schema_migrations) <> 34 THEN
    RAISE EXCEPTION 'Exact migration-034 tracking required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='maintenance_admin') THEN
    RAISE EXCEPTION 'Receipt schema already exists: reconcile, never overwrite';
  END IF;
END
$inventory$;
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
    ('ssb_runtime','ssb_admin_writer','ssb_reporter','ssb_migrator')) THEN
    RAISE EXCEPTION 'Role names already exist: inspect before applying, never overwrite';
  END IF;
  CREATE ROLE ssb_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
  CREATE ROLE ssb_admin_writer NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
  CREATE ROLE ssb_reporter NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
  CREATE ROLE ssb_migrator NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
END
$roles$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ssb_runtime, ssb_admin_writer;
GRANT USAGE, CREATE ON SCHEMA public TO ssb_migrator;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Reviewed schema-034 inventory. Future tables get no runtime privileges implicitly.
GRANT SELECT ON sites, tenants, documents, chunks, conversations, messages,
  widget_sessions, widget_events, widget_leads, report_subscriptions, report_runs,
  usage_events, usage_daily, email_jobs, site_modules, integration_connections,
  agent_runs, tool_invocations, agent_contact_requests, webhook_jobs,
  knowledge_sources, tenant_users, agent_tickets, audit_logs, plans,
  tenant_subscriptions, evaluation_chat_sessions, evaluation_ticket_previews,
  evaluation_handoff_events, evaluation_handoff_deliveries, evaluation_mock_handoff_receipts,
  provider_approval_grants, provider_approval_audit_events
  TO ssb_runtime, ssb_admin_writer;

GRANT INSERT, UPDATE, DELETE ON documents, chunks, conversations, messages,
  widget_sessions, widget_events, widget_leads, report_subscriptions, report_runs,
  usage_events, usage_daily, email_jobs, site_modules, integration_connections,
  agent_runs, tool_invocations, agent_contact_requests, webhook_jobs, agent_tickets,
  evaluation_chat_sessions, evaluation_ticket_previews, evaluation_handoff_events,
  evaluation_handoff_deliveries, evaluation_mock_handoff_receipts TO ssb_runtime;
GRANT INSERT ON audit_logs, knowledge_sources TO ssb_runtime;
GRANT UPDATE (site_key, name, allowed_domains, public_key, config, is_evaluation_demo)
  ON sites TO ssb_runtime;
GRANT UPDATE (label, description, source_url, sync_status, is_active, last_synced_at,
  last_ingest_at, error_message, ingest_status, index_status, runtime_readiness,
  ingest_error_code, ingest_error_message_sanitized, normalized_source_url,
  source_domain, config, updated_at) ON knowledge_sources TO ssb_runtime;

-- Parent DELETE and identity/rebinding UPDATE belong exclusively to the fixed writer.
-- No DELETE tenants, no UPDATE primary/foreign identity columns for any login here.
GRANT INSERT ON tenants, sites, tenant_users, tenant_subscriptions, audit_logs,
  provider_approval_grants, provider_approval_audit_events TO ssb_admin_writer;
GRANT UPDATE (name) ON tenants TO ssb_admin_writer;
GRANT UPDATE (site_key, tenant_id, name, allowed_domains, public_key, config, is_evaluation_demo)
  ON sites TO ssb_admin_writer;
GRANT UPDATE (display_name, role, is_active, metadata, expires_at, evaluation_site_id, updated_at)
  ON tenant_users TO ssb_admin_writer;
GRANT UPDATE (status, updated_at) ON tenant_subscriptions TO ssb_admin_writer;
GRANT UPDATE (revoked_at, revoked_by, revocation_reason, updated_at)
  ON provider_approval_grants TO ssb_admin_writer;
-- Only the fixed Site-DELETE writer operation uses this; equivalent to Site CASCADE.
GRANT DELETE ON provider_approval_grants TO ssb_admin_writer;
GRANT UPDATE (label) ON knowledge_sources TO ssb_admin_writer;
GRANT UPDATE (title) ON documents TO ssb_admin_writer;
GRANT DELETE ON sites, knowledge_sources, documents, chunks, conversations, messages,
  widget_sessions, widget_events, widget_leads, report_subscriptions, report_runs,
  usage_events, usage_daily, email_jobs, site_modules, integration_connections,
  agent_runs, tool_invocations, agent_contact_requests, webhook_jobs, agent_tickets,
  evaluation_chat_sessions, evaluation_ticket_previews, evaluation_handoff_events,
  evaluation_handoff_deliveries, evaluation_mock_handoff_receipts TO ssb_admin_writer;
GRANT UPDATE (content) ON messages TO ssb_admin_writer;
GRANT UPDATE (metadata) ON conversations TO ssb_admin_writer;
GRANT UPDATE (name, email, phone, message) ON widget_leads TO ssb_admin_writer;
GRANT UPDATE (name, email, phone, note) ON agent_contact_requests TO ssb_admin_writer;
GRANT UPDATE (reporter_name, reporter_email, description) ON agent_tickets TO ssb_admin_writer;

-- Protected replay ledger: no payload, cookie, password, SQL or provider content.
CREATE SCHEMA maintenance_admin AUTHORIZATION ssb_migrator;
REVOKE ALL ON SCHEMA maintenance_admin FROM PUBLIC;
CREATE TABLE maintenance_admin.writer_receipts (
  id UUID PRIMARY KEY,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE maintenance_admin.writer_receipts OWNER TO ssb_migrator;
GRANT USAGE ON SCHEMA maintenance_admin TO ssb_admin_writer;
GRANT SELECT, INSERT ON maintenance_admin.writer_receipts TO ssb_admin_writer;

-- Ownership is deliberately unavailable to runtime, writer and reporter.
DO $owners$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO ssb_migrator', r.tablename);
  END LOOP;
  -- Schema 034 has no sequences. A future sequence needs its own reviewed binding.
END
$owners$;
COMMIT;
