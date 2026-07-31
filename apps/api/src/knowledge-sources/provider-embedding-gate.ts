export type ProviderEmbeddingUsageContext =
  | 'website_ingest_runtime_indexing'
  | 'knowledge_reindex'
  | 'query_embedding';

export type ProviderEmbeddingActorRole = 'system' | 'admin' | 'operator' | 'viewer' | 'public';

export type ProviderEmbeddingEnvironment = 'production' | 'non_production';

export type ProviderEmbeddingDecisionCode =
  | 'allowed'
  | 'not_granted'
  | 'unsupported_source_type'
  | 'customer_data_not_approved'
  | 'provider_not_configured'
  | 'production_not_approved';

export type ProviderEmbeddingApproval = {
  granted: boolean;
  grantedBy?: string | null;
  providerKey?: string | null;
  model?: string | null;
  approvedTenantId?: string | null;
  approvedSiteId?: string | null;
  allowedSourceTypes?: string[] | null;
  allowedUsageContexts?: string[] | null;
  productionApproved?: boolean;
  customerDataApproved?: boolean;
};

export type ProviderEmbeddingGateInput = {
  tenantId?: string | null;
  siteId?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  usageContext?: string | null;
  actorRole?: ProviderEmbeddingActorRole | null;
  environment?: ProviderEmbeddingEnvironment | null;
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
  const explicitApproval = input.explicitApproval || { granted: false };

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

  if (!explicitApproval.granted) {
    return deny(
      'not_granted',
      'explicit_approval_missing',
      'Provider-/Embedding-Nutzung bleibt ohne explizite Freigabe gesperrt.',
    );
  }

  if (
    explicitApproval.approvedTenantId
    && explicitApproval.approvedTenantId.trim()
    && explicitApproval.approvedTenantId !== tenantId
  ) {
    return deny(
      'not_granted',
      'tenant_not_approved',
      'Die Freigabe gilt nicht fuer diesen Tenant.',
    );
  }

  if (
    explicitApproval.approvedSiteId
    && explicitApproval.approvedSiteId.trim()
    && explicitApproval.approvedSiteId !== siteId
  ) {
    return deny(
      'not_granted',
      'site_not_approved',
      'Die Freigabe gilt nicht fuer diese Site.',
    );
  }

  if (
    explicitApproval.allowedSourceTypes
    && explicitApproval.allowedSourceTypes.length > 0
    && !explicitApproval.allowedSourceTypes.includes(sourceType)
  ) {
    return deny(
      'unsupported_source_type',
      'source_type_not_approved',
      'Der Quelltyp ist fuer diese Provider-/Embedding-Freigabe nicht erlaubt.',
    );
  }

  if (
    explicitApproval.allowedUsageContexts
    && explicitApproval.allowedUsageContexts.length > 0
    && !explicitApproval.allowedUsageContexts.includes(usageContext)
  ) {
    return deny(
      'not_granted',
      'usage_context_not_approved',
      'Der Provider-/Embedding-Kontext ist durch die Freigabe nicht abgedeckt.',
    );
  }

  if (environment === 'production' && explicitApproval.productionApproved !== true) {
    return deny(
      'production_not_approved',
      'production_not_approved',
      'Provider-/Embedding-Nutzung ist in Production ohne separate Freigabe gesperrt.',
    );
  }

  if (explicitApproval.customerDataApproved !== true) {
    return deny(
      'customer_data_not_approved',
      'customer_data_not_approved',
      'Provider-/Embedding-Nutzung bleibt ohne Datenfreigabe gesperrt.',
    );
  }

  if (!explicitApproval.providerKey?.trim() || !explicitApproval.model?.trim()) {
    return deny(
      'provider_not_configured',
      'provider_or_model_missing',
      'Provider und Modell muessen vor einer Embedding-Freigabe festgelegt werden.',
    );
  }

  return allow(
    'explicit_provider_embedding_approval_present',
    'Die Provider-/Embedding-Freigabe ist fuer diesen Kontext formal vorhanden.',
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
