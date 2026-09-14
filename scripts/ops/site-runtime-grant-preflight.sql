-- Read-only technical counts for site-runtime grant migrations 032 and 033.
-- Run with a read-only transaction; this output intentionally contains no IDs or grant content.

WITH invalid_windows AS (
  SELECT *
  FROM provider_approval_grants
  WHERE expires_at <= valid_from
), valid_site_runtime_windows AS (
  SELECT *
  FROM provider_approval_grants
  WHERE scope_kind = 'site_runtime'
    AND revoked_at IS NULL
    AND expires_at > valid_from
)
SELECT 'invalid_site_runtime_purpose' AS check_name, count(*)::bigint AS row_count
FROM provider_approval_grants
WHERE scope_kind = 'site_runtime'
  AND purpose NOT IN ('query_embedding', 'llm_generation')
UNION ALL
SELECT 'invalid_site_runtime_source_or_usage_scope', count(*)::bigint
FROM provider_approval_grants
WHERE scope_kind = 'site_runtime'
  AND (
    source_id IS NOT NULL
    OR source_types IS DISTINCT FROM '[]'::jsonb
    OR NOT (
      (purpose = 'query_embedding' AND usage_contexts = '["query_embedding"]'::jsonb)
      OR (purpose = 'llm_generation' AND usage_contexts = '["llm_generation"]'::jsonb)
    )
  )
UNION ALL
SELECT 'missing_site_runtime_conflict_keys', count(*)::bigint
FROM provider_approval_grants
WHERE scope_kind = 'site_runtime'
  AND (
    tenant_id IS NULL OR site_id IS NULL OR provider_key IS NULL OR model IS NULL OR environment IS NULL
    OR BTRIM(tenant_id) = '' OR BTRIM(site_id) = '' OR BTRIM(provider_key) = '' OR BTRIM(model) = '' OR BTRIM(environment) = ''
  )
UNION ALL
SELECT 'invalid_validity_windows', count(*)::bigint
FROM invalid_windows
UNION ALL
SELECT 'overlapping_active_site_runtime_grant_pairs', count(*)::bigint
FROM valid_site_runtime_windows AS left_grant
JOIN valid_site_runtime_windows AS right_grant
  ON left_grant.id < right_grant.id
 AND left_grant.tenant_id = right_grant.tenant_id
 AND left_grant.site_id = right_grant.site_id
 AND left_grant.provider_key = right_grant.provider_key
 AND left_grant.model = right_grant.model
 AND left_grant.environment = right_grant.environment
 AND left_grant.purpose = right_grant.purpose
 AND tstzrange(left_grant.valid_from, left_grant.expires_at, '[)')
     && tstzrange(right_grant.valid_from, right_grant.expires_at, '[)')
ORDER BY check_name;
