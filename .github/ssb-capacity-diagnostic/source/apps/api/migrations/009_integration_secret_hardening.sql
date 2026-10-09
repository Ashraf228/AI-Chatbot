ALTER TABLE integration_connections
ADD COLUMN IF NOT EXISTS secrets_encrypted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS integration_connections_secret_state_idx
ON integration_connections(site_id, secrets_encrypted);
