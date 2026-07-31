import {
  evaluateProviderApprovalPolicy,
  type ProviderApprovalPolicy as ProviderEmbeddingApproval,
} from './provider-approval-policy';

export type ProviderEmbeddingUsageContext =
  | 'website_ingest_runtime_indexing'
  | 'knowledge_reindex'
  | 'query_embedding';

export type ProviderEmbeddingActorRole = 'system' | 'admin' | 'operator' | 'viewer' | 'public';

export type ProviderEmbeddingEnvironment = 'production' | 'non_production';

export type ProviderEmbeddingDecisionCode =
  | 'allowed'
  | 'missing_policy'
  | 'not_granted'
  | 'unsupported_source_type'
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
  | 'provider_not_configured'
  | 'production_not_approved'
  | 'dpa_not_approved'
  | 'retention_policy_missing'
  | 'logging_policy_missing'
  | 'redaction_policy_missing'
  | 'cost_limit_missing'
  | 'rate_limit_missing';

export {
  evaluateProviderApprovalPolicy,
  validateProviderApprovalPolicy,
  type ProviderApprovalPolicy as ProviderEmbeddingApproval,
} from './provider-approval-policy';

export type ProviderEmbeddingGateInput = {
  tenantId?: string | null;
  siteId?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  usageContext?: string | null;
  actorRole?: ProviderEmbeddingActorRole | null;
  environment?: ProviderEmbeddingEnvironment | null;
  providerKey?: string | null;
  model?: string | null;
  explicitApproval?: ProviderEmbeddingApproval | null;
};

export type ProviderEmbeddingGateDecision = {
  allowed: boolean;
  reason: string;
  decisionCode: ProviderEmbeddingDecisionCode;
  sanitizedMessage: string;
};

const KNOWN_USAGE_CONTEXTS = new Set<ProviderEmbeddingUsageContext>([
  'website_ingest_runtime_indexing',
  'knowledge_reindex',
  'query_embedding',
]);

function deny(
  decisionCode: ProviderEmbeddingDecisionCode,
  reason: string,
  sanitizedMessage: string,
): ProviderEmbeddingGateDecision {
  return {
    allowed: false,
    reason,
    decisionCode,
    sanitizedMessage,
  };
}

function allow(reason: string, sanitizedMessage: string): ProviderEmbeddingGateDecision {
  return {
    allowed: true,
    reason,
    decisionCode: 'allowed',
    sanitizedMessage,
  };
}

export function evaluateProviderEmbeddingGate(
  input: ProviderEmbeddingGateInput,
): ProviderEmbeddingGateDecision {
  const usageContext = (input.usageContext || '').trim();
  const sourceType = (input.sourceType || '').trim();
  const tenantId = (input.tenantId || '').trim();
  const siteId = (input.siteId || '').trim();
  const environment = input.environment || 'non_production';
  const providerKey = (input.providerKey || '').trim();
  const model = (input.model || '').trim();
  const explicitApproval = input.explicitApproval || null;

  if (!KNOWN_USAGE_CONTEXTS.has(usageContext as ProviderEmbeddingUsageContext)) {
    return deny(
      'not_granted',
      'unknown_usage_context',
      'Der Provider-/Embedding-Kontext ist nicht freigegeben.',
    );
  }

  if (!tenantId || !siteId) {
    return deny(
      'not_granted',
      'tenant_or_site_missing',
      'Tenant und Site muessen vor Provider-/Embedding-Nutzung gesetzt sein.',
    );
  }

  if (usageContext === 'website_ingest_runtime_indexing' && sourceType !== 'url') {
    return deny(
      'unsupported_source_type',
      'website_runtime_indexing_requires_url_source',
      'Website-Runtime-Indexing ist nur fuer Website-Quellen freigabefaehig.',
    );
  }

  const policyDecision = evaluateProviderApprovalPolicy({
    policy: explicitApproval,
    tenantId,
    siteId,
    sourceId: input.sourceId,
    sourceType,
    usageContext,
    environment,
    provider: providerKey,
    model,
  });
  if (!policyDecision.allowed) {
    return deny(policyDecision.decisionCode, policyDecision.reason, policyDecision.sanitizedMessage);
  }

  return allow(
    'provider_approval_policy_scope_matched',
    'Die technische Provider-/Embedding-Policy ist fuer diesen Kontext formal vorhanden.',
  );
}

export function assertProviderEmbeddingAllowed(
  input: ProviderEmbeddingGateInput,
): ProviderEmbeddingGateDecision {
  const decision = evaluateProviderEmbeddingGate(input);
  if (!decision.allowed) {
    const error = new Error(decision.sanitizedMessage) as Error & {
      decisionCode?: ProviderEmbeddingDecisionCode;
      gateDecision?: ProviderEmbeddingGateDecision;
    };
    error.name = 'ProviderEmbeddingGateError';
    error.decisionCode = decision.decisionCode;
    error.gateDecision = decision;
    throw error;
  }
  return decision;
}
