-- Add an explicit scope discriminator for provider approval grants.
-- Existing grants remain semantically stable:
-- - source_id IS NOT NULL -> source
-- - source_id IS NULL -> source_type
-- No historical row is upgraded to site_runtime by this migration.

ALTER TABLE provider_approval_grants
  ADD COLUMN scope_kind TEXT;

UPDATE provider_approval_grants
SET scope_kind = CASE
  WHEN source_id IS NOT NULL THEN 'source'
  ELSE 'source_type'
END
WHERE scope_kind IS NULL;

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_scope_kind_check
  CHECK (scope_kind IN ('source', 'source_type', 'site_runtime')) NOT VALID;

ALTER TABLE provider_approval_grants
  VALIDATE CONSTRAINT provider_approval_grants_scope_kind_check;

ALTER TABLE provider_approval_grants
  DROP CONSTRAINT provider_approval_grants_source_types_check;

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_source_scope_check
  CHECK (
    jsonb_typeof(source_types) = 'array'
    AND (
      (
        scope_kind = 'source'
        AND source_id IS NOT NULL
        AND jsonb_array_length(source_types) > 0
      )
      OR (
        scope_kind = 'source_type'
        AND source_id IS NULL
        AND jsonb_array_length(source_types) > 0
      )
      OR (
        scope_kind = 'site_runtime'
        AND source_id IS NULL
        AND source_types = '[]'::jsonb
      )
    )
  ) NOT VALID;

ALTER TABLE provider_approval_grants
  VALIDATE CONSTRAINT provider_approval_grants_source_scope_check;

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_site_runtime_usage_check
  CHECK (
    scope_kind <> 'site_runtime'
    OR usage_contexts = '["query_embedding"]'::jsonb
  ) NOT VALID;

ALTER TABLE provider_approval_grants
  VALIDATE CONSTRAINT provider_approval_grants_site_runtime_usage_check;

ALTER TABLE provider_approval_grants
  ALTER COLUMN scope_kind SET NOT NULL;

CREATE INDEX IF NOT EXISTS provider_approval_grants_site_runtime_lookup_idx
  ON provider_approval_grants(
    tenant_id,
    site_id,
    provider_key,
    model,
    environment,
    valid_from,
    expires_at,
    created_at DESC
  )
  WHERE revoked_at IS NULL
    AND scope_kind = 'site_runtime';
