ALTER TABLE tenant_users
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenant_users_expires_at
  ON tenant_users(expires_at)
  WHERE expires_at IS NOT NULL;
