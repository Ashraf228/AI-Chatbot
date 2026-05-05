CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'queued',
  input_summary TEXT,
  output_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tool_invocations (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tool_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_runs_site_created_idx
ON agent_runs(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tool_invocations_run_created_idx
ON tool_invocations(agent_run_id, created_at DESC);
