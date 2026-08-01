const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertProviderEmbeddingAllowed,
  evaluateProviderEmbeddingGate,
} = require('../dist/knowledge-sources/provider-embedding-gate.js');

function createPolicy(overrides = {}) {
  return {
    approvalId: 'approval-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceTypes: ['url'],
    usageContexts: ['website_ingest_runtime_indexing'],
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
    embeddingDimension: 1536,
    providerRegion: 'eu',
    dataCategories: ['website_content'],
    customerDataApproved: true,
    productionApproved: false,
    providerDpaApproved: true,
    purpose: 'website_runtime_indexing_validation',
    retentionPolicy: 'no_persisted_provider_payloads',
    redactionPolicy: 'strip_operator_secrets',
    loggingPolicy: 'metadata_only',
    deletionPolicy: 'source_delete_reindex_required',
    reindexPolicy: 'manual_reindex_only',
    rateLimit: '100 requests/day',
    costLimit: '25 eur/month',
    validFrom: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
    approvedBy: 'security_owner',
    approvalEvidenceRef: 'policy-test-1',
    ...overrides,
  };
}

function createGateInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    actorRole: 'system',
    environment: 'non_production',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    explicitApproval: createPolicy(),
    ...overrides,
  };
}

test('ProviderEmbeddingGate denies website runtime indexing by default when policy is missing', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: null,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'missing_policy');
  assert.match(decision.sanitizedMessage, /Approval-Policy/i);
});

test('ProviderEmbeddingGate denies unknown usage contexts', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    usageContext: 'unknown_context',
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'not_granted');
  assert.match(decision.sanitizedMessage, /Kontext/i);
});

test('ProviderEmbeddingGate denies malformed policy metadata', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ approvalEvidenceRef: '' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'not_granted');
  assert.match(decision.sanitizedMessage, /unvollstaendig/i);
});

test('ProviderEmbeddingGate denies revoked policies', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ revokedAt: '2026-07-15T00:00:00.000Z' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'revoked');
});

test('ProviderEmbeddingGate denies expired policies', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ expiresAt: '2026-07-15T00:00:00.000Z' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'expired');
});

test('ProviderEmbeddingGate denies policies that are not yet valid', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ validFrom: '2026-08-15T00:00:00.000Z' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'not_yet_valid');
});

test('ProviderEmbeddingGate denies tenant mismatches', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ tenantId: 'tenant-2' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'tenant_mismatch');
});

test('ProviderEmbeddingGate denies site mismatches', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ siteId: 'site-2' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'site_mismatch');
});

test('ProviderEmbeddingGate allows a site-wide policy without sourceId when the remaining scope matches', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ sourceId: null }),
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.decisionCode, 'allowed');
});

test('ProviderEmbeddingGate denies source type mismatches', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ sourceTypes: ['faq'] }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'source_type_not_allowed');
});

test('ProviderEmbeddingGate denies usage context mismatches', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ usageContexts: ['query_embedding'] }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'usage_context_not_allowed');
});

test('ProviderEmbeddingGate denies provider mismatches', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ provider: 'azure-openai' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'provider_not_allowed');
});

test('ProviderEmbeddingGate denies model mismatches', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ model: 'text-embedding-3-large' }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'model_not_allowed');
});

test('ProviderEmbeddingGate denies usage without customer-data approval', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ customerDataApproved: false }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'customer_data_not_approved');
});

test('ProviderEmbeddingGate denies production usage without explicit production approval', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput({
      environment: 'production',
    }),
    explicitApproval: createPolicy({
      environment: 'production',
      productionApproved: false,
    }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'production_not_approved');
});

test('ProviderEmbeddingGate denies usage without provider DPA approval', () => {
  const decision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ providerDpaApproved: false }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'dpa_not_approved');
});

test('ProviderEmbeddingGate denies policies without retention, logging, redaction, rate, and cost controls', () => {
  const retentionDecision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ retentionPolicy: '' }),
  });
  assert.equal(retentionDecision.decisionCode, 'retention_policy_missing');

  const loggingDecision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ loggingPolicy: '' }),
  });
  assert.equal(loggingDecision.decisionCode, 'logging_policy_missing');

  const redactionDecision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ redactionPolicy: '' }),
  });
  assert.equal(redactionDecision.decisionCode, 'redaction_policy_missing');

  const rateDecision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ rateLimit: '' }),
  });
  assert.equal(rateDecision.decisionCode, 'rate_limit_missing');

  const costDecision = evaluateProviderEmbeddingGate({
    ...createGateInput(),
    explicitApproval: createPolicy({ costLimit: '' }),
  });
  assert.equal(costDecision.decisionCode, 'cost_limit_missing');
});

test('ProviderEmbeddingGate allows only fully scoped synthetic approval policies', () => {
  const decision = assertProviderEmbeddingAllowed(createGateInput());

  assert.equal(decision.allowed, true);
  assert.equal(decision.decisionCode, 'allowed');
  assert.match(decision.sanitizedMessage, /formal vorhanden/i);
});
