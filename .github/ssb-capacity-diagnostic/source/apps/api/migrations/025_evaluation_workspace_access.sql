ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS is_evaluation_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE tenant_users
  ADD COLUMN IF NOT EXISTS evaluation_site_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_users_evaluation_site_fk'
  ) THEN
    ALTER TABLE tenant_users
      ADD CONSTRAINT tenant_users_evaluation_site_fk
      FOREIGN KEY (evaluation_site_id)
      REFERENCES sites(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tenant_users_evaluation_site
  ON tenant_users(evaluation_site_id)
  WHERE evaluation_site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sites_evaluation_demo
  ON sites(id, tenant_id)
  WHERE is_evaluation_demo = true;

CREATE TABLE IF NOT EXISTS evaluation_chat_sessions (
  id TEXT PRIMARY KEY,
  tenant_user_id TEXT NOT NULL REFERENCES tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON UPDATE CASCADE ON DELETE CASCADE,
  conversation_session_id TEXT NOT NULL,
  conversation_id TEXT REFERENCES conversations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_chat_sessions_owner
  ON evaluation_chat_sessions(tenant_user_id, site_id, expires_at);
