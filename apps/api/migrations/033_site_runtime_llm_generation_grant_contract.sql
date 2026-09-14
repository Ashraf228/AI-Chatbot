-- Admit a separate site-runtime grant for LLM generation without reinterpreting
-- or creating any historical provider approval row.

DO $$
DECLARE
  invalid_count BIGINT;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM provider_approval_grants
  WHERE scope_kind = 'site_runtime'
    AND NOT (
      (purpose = 'query_embedding' AND usage_contexts = '["query_embedding"]'::jsonb)
      OR (purpose = 'llm_generation' AND usage_contexts = '["llm_generation"]'::jsonb)
    );
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'provider approval grant migration blocked: invalid site_runtime purpose or usage pairs (% rows)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM provider_approval_grants AS left_grant
  JOIN provider_approval_grants AS right_grant
    ON left_grant.id < right_grant.id
   AND left_grant.tenant_id = right_grant.tenant_id
   AND left_grant.site_id = right_grant.site_id
   AND left_grant.provider_key = right_grant.provider_key
   AND left_grant.model = right_grant.model
   AND left_grant.environment = right_grant.environment
   AND tstzrange(left_grant.valid_from, left_grant.expires_at, '[)')
       && tstzrange(right_grant.valid_from, right_grant.expires_at, '[)')
  WHERE left_grant.scope_kind = 'site_runtime'
    AND right_grant.scope_kind = 'site_runtime'
    AND left_grant.purpose = 'llm_generation'
    AND right_grant.purpose = 'llm_generation'
    AND left_grant.revoked_at IS NULL
    AND right_grant.revoked_at IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'provider approval grant migration blocked: overlapping active site_runtime LLM grants (% pairs)', invalid_count;
  END IF;
END
$$;

ALTER TABLE provider_approval_grants
  DROP CONSTRAINT provider_approval_grants_site_runtime_usage_check;

ALTER TABLE provider_approval_grants
  DROP CONSTRAINT provider_approval_grants_site_runtime_purpose_check;

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_site_runtime_purpose_check
  CHECK (
    scope_kind <> 'site_runtime'
    OR purpose IN ('query_embedding', 'llm_generation')
  );

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_site_runtime_usage_check
  CHECK (
    scope_kind <> 'site_runtime'
    OR (purpose = 'query_embedding' AND usage_contexts = '["query_embedding"]'::jsonb)
    OR (purpose = 'llm_generation' AND usage_contexts = '["llm_generation"]'::jsonb)
  );

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_site_runtime_llm_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    site_id WITH =,
    provider_key WITH =,
    model WITH =,
    environment WITH =,
    tstzrange(valid_from, expires_at, '[)') WITH &&
  )
  WHERE (
    revoked_at IS NULL
    AND scope_kind = 'site_runtime'
    AND purpose = 'llm_generation'
  );
