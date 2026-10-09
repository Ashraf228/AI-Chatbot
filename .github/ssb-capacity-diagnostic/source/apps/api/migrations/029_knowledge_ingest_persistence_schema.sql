ALTER TABLE knowledge_sources
ADD COLUMN IF NOT EXISTS ingest_status TEXT NOT NULL DEFAULT 'created',
ADD COLUMN IF NOT EXISTS index_status TEXT NOT NULL DEFAULT 'not_requested',
ADD COLUMN IF NOT EXISTS runtime_readiness TEXT NOT NULL DEFAULT 'not_ready',
ADD COLUMN IF NOT EXISTS ingest_error_code TEXT,
ADD COLUMN IF NOT EXISTS ingest_error_message_sanitized TEXT,
ADD COLUMN IF NOT EXISTS last_ingest_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS normalized_source_url TEXT,
ADD COLUMN IF NOT EXISTS source_domain TEXT;

UPDATE knowledge_sources
SET normalized_source_url = COALESCE(
      normalized_source_url,
      NULLIF(BTRIM(source_url), '')
    ),
    source_domain = COALESCE(
      source_domain,
      NULLIF(
        regexp_replace(
          lower(split_part(regexp_replace(COALESCE(source_url, ''), '^https?://', ''), '/', 1)),
          ':\d+$',
          '',
          'g'
        ),
        ''
      )
    ),
    ingest_status = CASE
      WHEN sync_status = 'ready' THEN 'extracted'
      WHEN sync_status = 'processing' THEN 'processing'
      WHEN sync_status = 'failed' THEN 'failed'
      WHEN sync_status = 'disabled' AND last_synced_at IS NOT NULL THEN 'extracted'
      WHEN sync_status = 'disabled' THEN 'created'
      WHEN sync_status = 'pending' THEN 'created'
      ELSE COALESCE(ingest_status, 'created')
    END,
    index_status = CASE
      WHEN sync_status = 'ready' THEN 'indexed'
      WHEN sync_status = 'processing' THEN 'pending'
      WHEN sync_status = 'failed' THEN 'failed'
      WHEN sync_status = 'disabled' AND last_synced_at IS NOT NULL THEN 'indexed'
      WHEN sync_status = 'disabled' THEN 'not_requested'
      WHEN sync_status = 'pending' THEN 'not_requested'
      ELSE COALESCE(index_status, 'not_requested')
    END,
    runtime_readiness = CASE
      WHEN sync_status = 'ready' THEN 'ready'
      WHEN sync_status = 'failed' THEN 'failed'
      WHEN sync_status = 'disabled' AND last_synced_at IS NOT NULL THEN 'ready'
      ELSE COALESCE(runtime_readiness, 'not_ready')
    END,
    ingest_error_code = CASE
      WHEN sync_status = 'failed' THEN COALESCE(ingest_error_code, 'ingest_failed')
      ELSE ingest_error_code
    END,
    ingest_error_message_sanitized = CASE
      WHEN sync_status = 'failed' THEN LEFT(COALESCE(error_message, ingest_error_message_sanitized, ''), 1000)
      ELSE ingest_error_message_sanitized
    END,
    last_ingest_at = CASE
      WHEN sync_status IN ('ready', 'failed', 'disabled') THEN COALESCE(last_ingest_at, last_synced_at, updated_at, created_at)
      WHEN sync_status = 'processing' THEN COALESCE(last_ingest_at, updated_at, created_at)
      ELSE COALESCE(last_ingest_at, created_at)
    END;

CREATE INDEX IF NOT EXISTS knowledge_sources_runtime_ready_active_idx
ON knowledge_sources(site_id, runtime_readiness, is_active);

CREATE INDEX IF NOT EXISTS knowledge_sources_ingest_status_idx
ON knowledge_sources(site_id, ingest_status, created_at DESC);
