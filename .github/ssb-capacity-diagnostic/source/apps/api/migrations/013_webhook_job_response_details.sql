ALTER TABLE webhook_jobs
ADD COLUMN IF NOT EXISTS last_response_status INTEGER,
ADD COLUMN IF NOT EXISTS last_response_body TEXT;
