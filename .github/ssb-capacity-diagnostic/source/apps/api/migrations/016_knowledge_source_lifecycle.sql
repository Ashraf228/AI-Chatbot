ALTER TABLE knowledge_sources
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS knowledge_sources_ready_active_idx
ON knowledge_sources(site_id, is_active, sync_status);
