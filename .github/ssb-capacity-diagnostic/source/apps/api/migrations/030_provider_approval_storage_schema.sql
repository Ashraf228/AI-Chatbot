-- Provider approval overlaps remain deferred to later service-layer validation.
-- This schema adds durable storage and audit support only; it does not grant
-- runtime approval, execute provider calls, or create any live approval rows.

CREATE TABLE IF NOT EXISTS provider_approval_grants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON UPDATE CASCADE ON DELETE CASCADE,
  source_id TEXT REFERENCES knowledge_sources(id) ON UPDATE CASCADE ON DELETE SET NULL,
  source_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage_contexts JSONB NOT NULL DEFAULT '[]'::jsonb,
  environment TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  model TEXT NOT NULL,
  embedding_dimension INTEGER,
  provider_region TEXT,
  data_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_data_approved BOOLEAN NOT NULL DEFAULT false,
  production_approved BOOLEAN NOT NULL DEFAULT false,
  provider_dpa_approved BOOLEAN NOT NULL DEFAULT false,
  purpose TEXT NOT NULL,
  retention_policy TEXT NOT NULL,
  redaction_policy TEXT NOT NULL,
  logging_policy TEXT NOT NULL,
  deletion_policy TEXT NOT NULL,
  reindex_policy TEXT,
  rate_limit TEXT NOT NULL,
  cost_limit TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  revocation_reason TEXT,
  approved_by TEXT NOT NULL,
  approval_evidence_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_approval_grants_source_types_check CHECK (
    jsonb_typeof(source_types) = 'array'
    AND jsonb_array_length(source_types) > 0
  ),
  CONSTRAINT provider_approval_grants_usage_contexts_check CHECK (
    jsonb_typeof(usage_contexts) = 'array'
    AND jsonb_array_length(usage_contexts) > 0
  ),
  CONSTRAINT provider_approval_grants_data_categories_check CHECK (
    jsonb_typeof(data_categories) = 'array'
    AND jsonb_array_length(data_categories) > 0
  ),
  CONSTRAINT provider_approval_grants_environment_check CHECK (
    environment IN ('production', 'non_production')
  ),
  CONSTRAINT provider_approval_grants_text_scope_check CHECK (
    BTRIM(id) <> ''
    AND BTRIM(tenant_id) <> ''
    AND BTRIM(site_id) <> ''
    AND BTRIM(provider_key) <> ''
    AND BTRIM(model) <> ''
    AND BTRIM(purpose) <> ''
    AND BTRIM(retention_policy) <> ''
    AND BTRIM(redaction_policy) <> ''
    AND BTRIM(logging_policy) <> ''
    AND BTRIM(deletion_policy) <> ''
    AND BTRIM(rate_limit) <> ''
    AND BTRIM(cost_limit) <> ''
    AND BTRIM(approved_by) <> ''
    AND BTRIM(approval_evidence_ref) <> ''
  ),
  CONSTRAINT provider_approval_grants_embedding_dimension_check CHECK (
    embedding_dimension IS NULL OR embedding_dimension > 0
  ),
  CONSTRAINT provider_approval_grants_valid_window_check CHECK (
    expires_at > valid_from
  ),
  CONSTRAINT provider_approval_grants_revocation_check CHECK (
    (
      revoked_at IS NULL
      AND revoked_by IS NULL
      AND revocation_reason IS NULL
    )
    OR (
      revoked_at IS NOT NULL
      AND revoked_by IS NOT NULL
      AND BTRIM(revoked_by) <> ''
      AND revocation_reason IS NOT NULL
      AND BTRIM(revocation_reason) <> ''
    )
  )
);

CREATE INDEX IF NOT EXISTS provider_approval_grants_tenant_site_idx
  ON provider_approval_grants(tenant_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS provider_approval_grants_tenant_site_source_idx
  ON provider_approval_grants(tenant_id, site_id, source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS provider_approval_grants_active_lookup_idx
  ON provider_approval_grants(tenant_id, site_id, provider_key, model, environment, valid_from, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS provider_approval_grants_revoked_lookup_idx
  ON provider_approval_grants(tenant_id, site_id, revoked_at DESC)
  WHERE revoked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_approval_grants_expiry_lookup_idx
  ON provider_approval_grants(tenant_id, site_id, expires_at);

CREATE INDEX IF NOT EXISTS provider_approval_grants_provider_model_idx
  ON provider_approval_grants(tenant_id, site_id, provider_key, model);

CREATE INDEX IF NOT EXISTS provider_approval_grants_evidence_ref_idx
  ON provider_approval_grants(tenant_id, site_id, approval_evidence_ref);

CREATE TABLE IF NOT EXISTS provider_approval_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON UPDATE CASCADE ON DELETE CASCADE,
  source_id TEXT REFERENCES knowledge_sources(id) ON UPDATE CASCADE ON DELETE SET NULL,
  approval_grant_id TEXT REFERENCES provider_approval_grants(id) ON UPDATE CASCADE ON DELETE SET NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  event_type TEXT NOT NULL,
  decision_code TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  model TEXT NOT NULL,
  usage_context TEXT NOT NULL,
  sanitized_reason TEXT NOT NULL,
  request_id TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_approval_audit_events_text_check CHECK (
    BTRIM(id) <> ''
    AND BTRIM(tenant_id) <> ''
    AND BTRIM(site_id) <> ''
    AND BTRIM(actor_id) <> ''
    AND BTRIM(actor_role) <> ''
    AND BTRIM(event_type) <> ''
    AND BTRIM(decision_code) <> ''
    AND BTRIM(provider_key) <> ''
    AND BTRIM(model) <> ''
    AND BTRIM(usage_context) <> ''
    AND BTRIM(sanitized_reason) <> ''
  ),
  CONSTRAINT provider_approval_audit_events_type_check CHECK (
    event_type IN (
      'approval_created',
      'approval_updated',
      'approval_revoked',
      'approval_expired',
      'approval_checked',
      'approval_denied',
      'provider_call_blocked',
      'embedding_job_requested',
      'embedding_job_started',
      'embedding_job_blocked',
      'embedding_job_completed',
      'embedding_job_failed'
    )
  )
);

CREATE INDEX IF NOT EXISTS provider_approval_audit_events_tenant_site_time_idx
  ON provider_approval_audit_events(tenant_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS provider_approval_audit_events_grant_idx
  ON provider_approval_audit_events(approval_grant_id, created_at DESC)
  WHERE approval_grant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_approval_audit_events_type_idx
  ON provider_approval_audit_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS provider_approval_audit_events_request_idx
  ON provider_approval_audit_events(request_id, created_at DESC)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_approval_audit_events_correlation_idx
  ON provider_approval_audit_events(correlation_id, created_at DESC)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_approval_audit_events_source_idx
  ON provider_approval_audit_events(source_id, created_at DESC)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_approval_audit_events_provider_model_idx
  ON provider_approval_audit_events(tenant_id, site_id, provider_key, model, created_at DESC);
