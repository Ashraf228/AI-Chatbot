CREATE TABLE IF NOT EXISTS site_modules (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, module_key)
);

CREATE INDEX IF NOT EXISTS site_modules_enabled_idx
ON site_modules(site_id, is_enabled);
