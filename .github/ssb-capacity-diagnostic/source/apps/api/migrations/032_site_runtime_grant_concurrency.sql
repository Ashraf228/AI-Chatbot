-- Site-runtime grants are runtime query-embedding permissions only.
-- This migration validates existing rows before installing database invariants.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  invalid_count BIGINT;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM provider_approval_grants
  WHERE expires_at <= valid_from;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'provider approval grant migration blocked: invalid validity windows (% rows)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM provider_approval_grants
  WHERE scope_kind = 'site_runtime'
    AND purpose IS DISTINCT FROM 'query_embedding';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'provider approval grant migration blocked: invalid site_runtime purposes (% rows)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM provider_approval_grants
  WHERE scope_kind = 'site_runtime'
    AND (
      source_id IS NOT NULL
      OR source_types IS DISTINCT FROM '[]'::jsonb
      OR usage_contexts IS DISTINCT FROM '["query_embedding"]'::jsonb
    );
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'provider approval grant migration blocked: invalid site_runtime source or usage scope (% rows)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM provider_approval_grants
  WHERE scope_kind = 'site_runtime'
    AND (
      tenant_id IS NULL
      OR site_id IS NULL
      OR provider_key IS NULL
      OR model IS NULL
      OR environment IS NULL
      OR BTRIM(tenant_id) = ''
      OR BTRIM(site_id) = ''
      OR BTRIM(provider_key) = ''
      OR BTRIM(model) = ''
      OR BTRIM(environment) = ''
    );
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'provider approval grant migration blocked: missing site_runtime conflict keys (% rows)', invalid_count;
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
    AND left_grant.purpose = 'query_embedding'
    AND right_grant.purpose = 'query_embedding'
    AND left_grant.revoked_at IS NULL
    AND right_grant.revoked_at IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'provider approval grant migration blocked: overlapping active site_runtime grants (% pairs)', invalid_count;
  END IF;
END
$$;

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_site_runtime_purpose_check
  CHECK (
    (scope_kind <> 'site_runtime' OR purpose = 'query_embedding') IS TRUE
  );

ALTER TABLE provider_approval_grants
  ADD CONSTRAINT provider_approval_grants_site_runtime_no_overlap
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
    AND purpose = 'query_embedding'
  );
