CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  label TEXT NOT NULL,
  source_url TEXT,
  sync_status TEXT NOT NULL DEFAULT 'ready',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS source_id TEXT REFERENCES knowledge_sources(id) ON DELETE SET NULL;

INSERT INTO knowledge_sources (
  id,
  tenant_id,
  site_id,
  source_type,
  label,
  source_url,
  sync_status,
  config,
  created_at,
  updated_at
)
SELECT
  CONCAT('source_', d.id) AS id,
  d.tenant_id,
  d.site_id,
  CASE
    WHEN d.type = 'faq' THEN 'faq_manual'
    WHEN d.type = 'pdf' THEN 'pdf_upload'
    ELSE 'document'
  END AS source_type,
  COALESCE(NULLIF(d.title, ''), UPPER(d.type)) AS label,
  NULLIF(d.source_url, '') AS source_url,
  'ready' AS sync_status,
  jsonb_build_object('documentType', d.type) AS config,
  d.created_at,
  d.created_at
FROM documents d
WHERE d.source_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM knowledge_sources ks
    WHERE ks.id = CONCAT('source_', d.id)
  );

UPDATE documents d
SET source_id = CONCAT('source_', d.id)
WHERE d.source_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM knowledge_sources ks
    WHERE ks.id = CONCAT('source_', d.id)
  );

CREATE INDEX IF NOT EXISTS knowledge_sources_site_idx
ON knowledge_sources(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_source_idx
ON documents(source_id);
