import type {
  ProviderEmbeddingEnvironment,
  ProviderEmbeddingUsageContext,
} from './provider-embedding-gate';

export type ProviderApprovalScopeKind = 'source' | 'source_type' | 'site_runtime';
export type ProviderApprovalUsageContext = ProviderEmbeddingUsageContext | 'llm_generation';

export type ProviderApprovalPolicyDecisionCode =
  | 'allowed'
  | 'missing_policy'
  | 'not_granted'
  | 'revoked'
  | 'expired'
  | 'not_yet_valid'
  | 'tenant_mismatch'
  | 'site_mismatch'
  | 'source_type_not_allowed'
  | 'usage_context_not_allowed'
  | 'provider_not_allowed'
  | 'model_not_allowed'
  | 'customer_data_not_approved'
  | 'production_not_approved'
  | 'dpa_not_approved'
  | 'retention_policy_missing'
  | 'logging_policy_missing'
  | 'redaction_policy_missing'
  | 'cost_limit_missing'
  | 'rate_limit_missing';

export type ProviderApprovalPolicy = {
  approvalId: string;
  scopeKind: ProviderApprovalScopeKind;
  tenantId: string;
  siteId: string;
  sourceId?: string | null;
  sourceTypes: string[];
  usageContexts: ProviderApprovalUsageContext[];
  environment: ProviderEmbeddingEnvironment;
  provider: string;
  model: string;
  embeddingDimension?: number | null;
  providerRegion?: string | null;
  dataCategories: string[];
  customerDataApproved: boolean;
  productionApproved: boolean;
  providerDpaApproved: boolean;
  purpose: string;
  retentionPolicy: string;
  redactionPolicy: string;
  loggingPolicy: string;
  deletionPolicy: string;
  reindexPolicy?: string | null;
  rateLimit: string;
  costLimit: string;
  validFrom: string;
  expiresAt: string;
  revokedAt?: string | null;
  approvedBy: string;
  approvalEvidenceRef: string;
};

export type ProviderApprovalPolicyDecision = {
  allowed: boolean;
  decisionCode: ProviderApprovalPolicyDecisionCode;
  reason: string;
  sanitizedMessage: string;
};

export type ProviderApprovalPolicyValidationInput = {
  policy?: ProviderApprovalPolicy | null;
  environment?: ProviderEmbeddingEnvironment | null;
  now?: Date | string | number | null;
};

export type ProviderApprovalPolicyEvaluationInput = {
  policy?: ProviderApprovalPolicy | null;
  tenantId?: string | null;
  siteId?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  usageContext?: string | null;
  environment?: ProviderEmbeddingEnvironment | null;
  provider?: string | null;
  model?: string | null;
  now?: Date | string | number | null;
  requiredScopeKinds?: ProviderApprovalScopeKind[] | null;
};

function deny(
  decisionCode: ProviderApprovalPolicyDecisionCode,
  reason: string,
  sanitizedMessage: string,
): ProviderApprovalPolicyDecision {
  return {
    allowed: false,
    decisionCode,
    reason,
    sanitizedMessage,
  };
}

function allow(reason: string, sanitizedMessage: string): ProviderApprovalPolicyDecision {
  return {
    allowed: true,
    decisionCode: 'allowed',
    reason,
    sanitizedMessage,
  };
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasListValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

function isValidTimestamp(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function isProviderApprovalScopeKind(value: unknown): value is ProviderApprovalScopeKind {
  return value === 'source' || value === 'source_type' || value === 'site_runtime';
}

function resolvePolicyNowMs(now?: Date | string | number | null): number {
  if (now instanceof Date && Number.isFinite(now.getTime())) {
    return now.getTime();
  }

  if (typeof now === 'string') {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof now === 'number' && Number.isFinite(now)) {
    return now;
  }

  return Date.now();
}

function validateSharedPolicyFields(policy: ProviderApprovalPolicy): ProviderApprovalPolicyDecision | null {
  if (!hasText(policy.approvalId)) {
    return deny('not_granted', 'approval_id_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!hasText(policy.tenantId)) {
    return deny('tenant_mismatch', 'policy_tenant_missing', 'Die technische Approval-Policy deckt diesen Tenant nicht ab.');
  }

  if (!hasText(policy.siteId)) {
    return deny('site_mismatch', 'policy_site_missing', 'Die technische Approval-Policy deckt diese Site nicht ab.');
  }

  if (!isProviderApprovalScopeKind(policy.scopeKind)) {
    return deny('not_granted', 'policy_scope_kind_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!hasStringArray(policy.sourceTypes)) {
    return deny(
      'source_type_not_allowed',
      'policy_source_types_missing',
      'Der Quelltyp ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if (!hasListValue(policy.usageContexts)) {
    return deny(
      'usage_context_not_allowed',
      'policy_usage_contexts_missing',
      'Der Provider-/Embedding-Kontext ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if (!hasText(policy.environment)) {
    return deny('not_granted', 'policy_environment_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!hasText(policy.provider)) {
    return deny(
      'provider_not_allowed',
      'policy_provider_missing',
      'Der Provider ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if (!hasText(policy.model)) {
    return deny(
      'model_not_allowed',
      'policy_model_missing',
      'Das Modell ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if (!hasListValue(policy.dataCategories)) {
    return deny('not_granted', 'policy_data_categories_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!hasText(policy.purpose)) {
    return deny('not_granted', 'policy_purpose_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!hasText(policy.deletionPolicy)) {
    return deny('not_granted', 'policy_deletion_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!hasText(policy.approvedBy)) {
    return deny('not_granted', 'policy_approved_by_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!hasText(policy.approvalEvidenceRef)) {
    return deny('not_granted', 'policy_evidence_missing', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  return null;
}

function validateScopeSpecificPolicyFields(policy: ProviderApprovalPolicy): ProviderApprovalPolicyDecision | null {
  const sourceTypes = normalizeStringArray(policy.sourceTypes);
  const sourceTypeCount = sourceTypes?.length ?? 0;
  const hasSourceId = hasText(policy.sourceId);
  const usageContexts = normalizeStringArray(policy.usageContexts) ?? [];

  if (policy.scopeKind === 'source') {
    if (!hasSourceId) {
      return deny('not_granted', 'policy_source_id_missing', 'Die technische Approval-Policy ist unvollstaendig.');
    }

    if (sourceTypeCount === 0) {
      return deny(
        'source_type_not_allowed',
        'policy_source_types_missing',
        'Der Quelltyp ist durch die technische Approval-Policy nicht erlaubt.',
      );
    }

    return null;
  }

  if (policy.scopeKind === 'source_type') {
    if (hasSourceId) {
      return deny('not_granted', 'policy_source_type_has_source_id', 'Die technische Approval-Policy ist unvollstaendig.');
    }

    if (sourceTypeCount === 0) {
      return deny(
        'source_type_not_allowed',
        'policy_source_types_missing',
        'Der Quelltyp ist durch die technische Approval-Policy nicht erlaubt.',
      );
    }

    return null;
  }

  if (hasSourceId) {
    return deny('not_granted', 'policy_site_runtime_has_source_id', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (sourceTypeCount !== 0) {
    return deny(
      'source_type_not_allowed',
      'policy_site_runtime_source_types_invalid',
      'Der Quelltyp ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  const purpose = policy.purpose.trim();
  const hasValidRuntimePurposeUsagePair =
    (purpose === 'query_embedding' && usageContexts.length === 1 && usageContexts[0] === 'query_embedding') ||
    (purpose === 'llm_generation' && usageContexts.length === 1 && usageContexts[0] === 'llm_generation');

  if (!hasValidRuntimePurposeUsagePair) {
    return deny(
      'usage_context_not_allowed',
      'policy_site_runtime_usage_context_invalid',
      'Der Provider-/Embedding-Kontext ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  return null;
}

export function validateProviderApprovalPolicy(
  input: ProviderApprovalPolicyValidationInput,
): ProviderApprovalPolicyDecision {
  const policy = input.policy;
  if (!policy) {
    return deny(
      'missing_policy',
      'provider_approval_policy_missing',
      'Ohne gueltige technische Approval-Policy bleibt der Provider-/Embedding-Pfad gesperrt.',
    );
  }

  const sharedError = validateSharedPolicyFields(policy);
  if (sharedError) {
    return sharedError;
  }

  const scopeError = validateScopeSpecificPolicyFields(policy);
  if (scopeError) {
    return scopeError;
  }

  if (policy.providerDpaApproved !== true) {
    return deny(
      'dpa_not_approved',
      'provider_dpa_not_approved',
      'Ohne dokumentierte Provider-DPA bleibt der Provider-/Embedding-Pfad gesperrt.',
    );
  }

  if (policy.customerDataApproved !== true) {
    return deny(
      'customer_data_not_approved',
      'customer_data_not_approved',
      'Ohne Datenfreigabe bleibt der Provider-/Embedding-Pfad gesperrt.',
    );
  }

  if (!hasText(policy.retentionPolicy)) {
    return deny(
      'retention_policy_missing',
      'retention_policy_missing',
      'Die technische Approval-Policy braucht eine Retention-Regel.',
    );
  }

  if (!hasText(policy.redactionPolicy)) {
    return deny(
      'redaction_policy_missing',
      'redaction_policy_missing',
      'Die technische Approval-Policy braucht eine Redaction-Regel.',
    );
  }

  if (!hasText(policy.loggingPolicy)) {
    return deny(
      'logging_policy_missing',
      'logging_policy_missing',
      'Die technische Approval-Policy braucht eine Logging-Regel.',
    );
  }

  if (!hasText(policy.rateLimit)) {
    return deny(
      'rate_limit_missing',
      'rate_limit_missing',
      'Die technische Approval-Policy braucht ein Rate-Limit.',
    );
  }

  if (!hasText(policy.costLimit)) {
    return deny(
      'cost_limit_missing',
      'cost_limit_missing',
      'Die technische Approval-Policy braucht ein Kostenlimit.',
    );
  }

  if (!isValidTimestamp(policy.validFrom)) {
    return deny('not_granted', 'valid_from_missing_or_invalid', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  if (!isValidTimestamp(policy.expiresAt)) {
    return deny('not_granted', 'expires_at_missing_or_invalid', 'Die technische Approval-Policy ist unvollstaendig.');
  }

  const now = resolvePolicyNowMs(input.now);
  if (isValidTimestamp(policy.revokedAt) && Date.parse(policy.revokedAt) <= now) {
    return deny('revoked', 'approval_policy_revoked', 'Die technische Approval-Policy wurde widerrufen.');
  }

  if (Date.parse(policy.validFrom) > now) {
    return deny(
      'not_yet_valid',
      'approval_policy_not_yet_valid',
      'Die technische Approval-Policy ist noch nicht gueltig.',
    );
  }

  if (Date.parse(policy.expiresAt) <= now) {
    return deny('expired', 'approval_policy_expired', 'Die technische Approval-Policy ist abgelaufen.');
  }

  if ((input.environment || 'non_production') === 'production' && policy.productionApproved !== true) {
    return deny(
      'production_not_approved',
      'production_not_approved',
      'Provider-/Embedding-Nutzung ist in Production ohne separate Freigabe gesperrt.',
    );
  }

  return allow(
    'provider_approval_policy_validated',
    'Die technische Approval-Policy ist formal vollstaendig.',
  );
}

export function evaluateProviderApprovalPolicy(
  input: ProviderApprovalPolicyEvaluationInput,
): ProviderApprovalPolicyDecision {
  const policyDecision = validateProviderApprovalPolicy({
    policy: input.policy,
    environment: input.environment,
    now: input.now,
  });
  if (!policyDecision.allowed) {
    return policyDecision;
  }

  const policy = input.policy as ProviderApprovalPolicy;
  const tenantId = (input.tenantId || '').trim();
  const siteId = (input.siteId || '').trim();
  const sourceId = (input.sourceId || '').trim();
  const sourceType = (input.sourceType || '').trim();
  const usageContext = (input.usageContext || '').trim();
  const environment = (input.environment || 'non_production').trim();
  const provider = (input.provider || '').trim();
  const model = (input.model || '').trim();
  const requiredScopeKinds =
    input.requiredScopeKinds && input.requiredScopeKinds.length > 0
      ? input.requiredScopeKinds
      : (['source', 'source_type'] as ProviderApprovalScopeKind[]);

  if (!requiredScopeKinds.includes(policy.scopeKind)) {
    return deny('not_granted', 'scope_kind_not_allowed', 'Die technische Approval-Policy deckt diesen Kontext nicht ab.');
  }

  if (!tenantId || tenantId !== policy.tenantId.trim()) {
    return deny('tenant_mismatch', 'tenant_mismatch', 'Die technische Approval-Policy deckt diesen Tenant nicht ab.');
  }

  if (!siteId || siteId !== policy.siteId.trim()) {
    return deny('site_mismatch', 'site_mismatch', 'Die technische Approval-Policy deckt diese Site nicht ab.');
  }

  if (policy.scopeKind === 'source') {
    if (!sourceId || sourceId !== policy.sourceId?.trim()) {
      return deny(
        'not_granted',
        'source_id_mismatch',
        'Die technische Approval-Policy deckt diese Quelle nicht ab.',
      );
    }
  } else if (policy.scopeKind === 'site_runtime') {
    if (sourceId) {
      return deny(
        'not_granted',
        'site_runtime_source_id_not_allowed',
        'Die technische Approval-Policy deckt diese Quelle nicht ab.',
      );
    }

    if (sourceType) {
      return deny(
        'source_type_not_allowed',
        'site_runtime_source_type_not_allowed',
        'Der Quelltyp ist durch die technische Approval-Policy nicht erlaubt.',
      );
    }
  }

  const normalizedSourceTypes = normalizeStringArray(policy.sourceTypes) ?? [];
  const normalizedUsageContexts = normalizeStringArray(policy.usageContexts) ?? [];

  if (policy.scopeKind !== 'site_runtime' && (!sourceType || !normalizedSourceTypes.includes(sourceType))) {
    return deny(
      'source_type_not_allowed',
      'source_type_not_allowed',
      'Der Quelltyp ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if ((usageContext === 'knowledge_ingest' || usageContext === 'knowledge_reindex')
    && (policy.purpose.trim() !== usageContext || normalizedUsageContexts.length !== 1)) {
    return deny('usage_context_not_allowed', 'ingestion_purpose_mismatch',
      'Die technische Approval-Policy deckt diesen Kontext nicht ab.');
  }

  if (!usageContext || !normalizedUsageContexts.includes(usageContext)) {
    return deny(
      'usage_context_not_allowed',
      'usage_context_not_allowed',
      'Der Provider-/Embedding-Kontext ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if (environment !== policy.environment.trim()) {
    return deny(
      environment === 'production' ? 'production_not_approved' : 'not_granted',
      'environment_mismatch',
      'Die technische Approval-Policy gilt nicht fuer diese Umgebung.',
    );
  }

  if (!provider || provider !== policy.provider.trim()) {
    return deny(
      'provider_not_allowed',
      'provider_not_allowed',
      'Der Provider ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if (!model || model !== policy.model.trim()) {
    return deny(
      'model_not_allowed',
      'model_not_allowed',
      'Das Modell ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  return allow(
    'provider_approval_policy_scope_matched',
    'Die technische Approval-Policy deckt diesen Provider-/Embedding-Kontext formal ab.',
  );
}
