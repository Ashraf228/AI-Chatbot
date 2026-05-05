CREATE TABLE IF NOT EXISTS agent_contact_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  agent_run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  preferred_channel TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  agent_run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  provider_key TEXT NOT NULL,
  connection_key TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_contact_requests_site_created_idx
ON agent_contact_requests(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_jobs_available_idx
ON webhook_jobs(status, available_at, created_at);
