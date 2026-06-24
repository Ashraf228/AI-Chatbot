ALTER TABLE integration_connections
ADD COLUMN IF NOT EXISTS signing_mode TEXT;

UPDATE integration_connections
SET signing_mode = 'legacy_secret_header'
WHERE signing_mode IS NULL
  AND provider_key IN ('webhook', 'crm-webhook', 'ticket-webhook');

UPDATE integration_connections
SET signing_mode = 'hmac_sha256'
WHERE signing_mode IS NULL;

ALTER TABLE integration_connections
ALTER COLUMN signing_mode SET DEFAULT 'hmac_sha256';

ALTER TABLE integration_connections
ALTER COLUMN signing_mode SET NOT NULL;

ALTER TABLE integration_connections
DROP CONSTRAINT IF EXISTS integration_connections_signing_mode_check;

ALTER TABLE integration_connections
ADD CONSTRAINT integration_connections_signing_mode_check
CHECK (signing_mode IN ('hmac_sha256', 'legacy_secret_header'));

ALTER TABLE webhook_jobs
ADD COLUMN IF NOT EXISTS signing_mode TEXT,
ADD COLUMN IF NOT EXISTS event_id TEXT,
ADD COLUMN IF NOT EXISTS last_delivery_id TEXT,
ADD COLUMN IF NOT EXISTS payload_body TEXT,
ADD COLUMN IF NOT EXISTS signing_secret JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS signing_secret_encrypted BOOLEAN NOT NULL DEFAULT false;

UPDATE webhook_jobs
SET signing_mode = 'legacy_secret_header'
WHERE signing_mode IS NULL;

UPDATE webhook_jobs
SET event_id = 'evt_' || id
WHERE event_id IS NULL;

UPDATE webhook_jobs
SET payload_body = payload::text
WHERE payload_body IS NULL;

ALTER TABLE webhook_jobs
ALTER COLUMN signing_mode SET DEFAULT 'legacy_secret_header';

ALTER TABLE webhook_jobs
ALTER COLUMN signing_mode SET NOT NULL;

ALTER TABLE webhook_jobs
ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE webhook_jobs
ALTER COLUMN payload_body SET NOT NULL;

ALTER TABLE webhook_jobs
DROP CONSTRAINT IF EXISTS webhook_jobs_signing_mode_check;

ALTER TABLE webhook_jobs
ADD CONSTRAINT webhook_jobs_signing_mode_check
CHECK (signing_mode IN ('hmac_sha256', 'legacy_secret_header'));

CREATE UNIQUE INDEX IF NOT EXISTS webhook_jobs_event_id_unique_idx
ON webhook_jobs(event_id);
