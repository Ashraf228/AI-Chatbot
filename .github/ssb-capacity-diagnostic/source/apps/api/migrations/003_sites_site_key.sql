ALTER TABLE sites
ADD COLUMN IF NOT EXISTS site_key TEXT;

UPDATE sites
SET site_key = COALESCE(
  NULLIF(BTRIM(site_key), ''),
  NULLIF(BTRIM(config->>'siteKey'), ''),
  id
)
WHERE site_key IS NULL
   OR BTRIM(site_key) = '';

UPDATE sites
SET config = config - 'siteKey'
WHERE config ? 'siteKey';

ALTER TABLE sites
ALTER COLUMN site_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sites_site_key_unique_idx
ON sites(site_key);
