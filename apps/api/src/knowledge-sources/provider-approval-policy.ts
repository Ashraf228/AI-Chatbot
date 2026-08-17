import type {
  ProviderEmbeddingEnvironment,
  ProviderEmbeddingUsageContext,
} from './provider-embedding-gate';

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
  tenantId: string;
  siteId: string;
  sourceId?: string | null;
  sourceTypes: string[];
  usageContexts: ProviderEmbeddingUsageContext[];
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

function isValidTimestamp(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
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

  if (!hasListValue(policy.sourceTypes)) {
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

  if (!tenantId || tenantId !== policy.tenantId.trim()) {
    return deny('tenant_mismatch', 'tenant_mismatch', 'Die technische Approval-Policy deckt diesen Tenant nicht ab.');
  }

  if (!siteId || siteId !== policy.siteId.trim()) {
    return deny('site_mismatch', 'site_mismatch', 'Die technische Approval-Policy deckt diese Site nicht ab.');
  }

  if (hasText(policy.sourceId) && sourceId !== policy.sourceId.trim()) {
    return deny(
      'not_granted',
      'source_id_mismatch',
      'Die technische Approval-Policy deckt diese Quelle nicht ab.',
    );
  }

  if (!sourceType || !policy.sourceTypes.includes(sourceType)) {
    return deny(
      'source_type_not_allowed',
      'source_type_not_allowed',
      'Der Quelltyp ist durch die technische Approval-Policy nicht erlaubt.',
    );
  }

  if (!usageContext || !policy.usageContexts.includes(usageContext as ProviderEmbeddingUsageContext)) {
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
