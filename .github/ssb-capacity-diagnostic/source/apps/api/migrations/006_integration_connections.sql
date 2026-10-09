CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  connection_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  secrets JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, provider_key, connection_key)
);

CREATE INDEX IF NOT EXISTS integration_connections_site_idx
ON integration_connections(site_id, provider_key);
