CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants(id, name)
SELECT DISTINCT tenant_id, tenant_id
FROM (
  SELECT tenant_id FROM sites
  UNION
  SELECT tenant_id FROM documents
  UNION
  SELECT tenant_id FROM chunks
  UNION
  SELECT tenant_id FROM conversations
  UNION
  SELECT tenant_id FROM usage_events
  UNION
  SELECT tenant_id FROM usage_daily
) known_tenants
WHERE tenant_id IS NOT NULL
  AND BTRIM(tenant_id) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants(id, name)
VALUES ('t_default', 'Standard')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS sites_tenant_idx ON sites(tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sites_tenant_fk'
  ) THEN
    ALTER TABLE sites
    ADD CONSTRAINT sites_tenant_fk
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
  END IF;
END$$;
