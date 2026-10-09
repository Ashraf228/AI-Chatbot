CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_site_created_idx
ON audit_logs(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
ON audit_logs(action, created_at DESC);
