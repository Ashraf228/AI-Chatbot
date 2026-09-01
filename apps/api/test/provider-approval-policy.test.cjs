const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateProviderApprovalPolicy,
  validateProviderApprovalPolicy,
} = require('../dist/knowledge-sources/provider-approval-policy.js');

function createPolicy(overrides = {}) {
  return {
    approvalId: 'approval-1',
    scopeKind: 'source',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceTypes: ['url'],
    usageContexts: ['website_ingest_runtime_indexing'],
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
    dataCategories: ['website_content'],
    customerDataApproved: true,
    productionApproved: false,
    providerDpaApproved: true,
    purpose: 'website_runtime_indexing_validation',
    retentionPolicy: 'no_persisted_provider_payloads',
    redactionPolicy: 'strip_operator_secrets',
    loggingPolicy: 'metadata_only',
    deletionPolicy: 'source_delete_reindex_required',
    rateLimit: '100 requests/day',
    costLimit: '25 eur/month',
    validFrom: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
    approvedBy: 'security_owner',
    approvalEvidenceRef: 'policy-test-1',
    ...overrides,
  };
}

test('validateProviderApprovalPolicy denies missing policy', () => {
  const decision = validateProviderApprovalPolicy({ policy: null });
  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'missing_policy');
});

test('validateProviderApprovalPolicy accepts a fully scoped synthetic contract', () => {
  const decision = validateProviderApprovalPolicy({
    policy: createPolicy(),
    environment: 'non_production',
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.decisionCode, 'allowed');
});

test('validateProviderApprovalPolicy accepts a site_runtime contract only with empty sourceTypes and exact query_embedding usage', () => {
  const allowed = validateProviderApprovalPolicy({
    policy: createPolicy({
      scopeKind: 'site_runtime',
      sourceId: null,
      sourceTypes: [],
      usageContexts: ['query_embedding'],
    }),
    environment: 'non_production',
  });
  assert.equal(allowed.allowed, true);

  const withSourceTypes = validateProviderApprovalPolicy({
    policy: createPolicy({
      scopeKind: 'site_runtime',
      sourceId: null,
      sourceTypes: ['url'],
      usageContexts: ['query_embedding'],
    }),
  });
  assert.equal(withSourceTypes.allowed, false);
  assert.equal(withSourceTypes.decisionCode, 'source_type_not_allowed');

  const withWrongUsage = validateProviderApprovalPolicy({
    policy: createPolicy({
      scopeKind: 'site_runtime',
      sourceId: null,
      sourceTypes: [],
      usageContexts: ['query_embedding', 'knowledge_reindex'],
    }),
  });
  assert.equal(withWrongUsage.allowed, false);
  assert.equal(withWrongUsage.decisionCode, 'usage_context_not_allowed');
});

test('evaluateProviderApprovalPolicy denies source-id mismatch even with valid policy metadata', () => {
  const decision = evaluateProviderApprovalPolicy({
    policy: createPolicy(),
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-2',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'not_granted');
});

test('evaluateProviderApprovalPolicy keeps source_type fallback valid but denies site_runtime for source-scoped checks', () => {
  const fallback = evaluateProviderApprovalPolicy({
    policy: createPolicy({
      scopeKind: 'source_type',
      sourceId: null,
    }),
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-2',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
    requiredScopeKinds: ['source', 'source_type'],
  });
  assert.equal(fallback.allowed, true);

  const denied = evaluateProviderApprovalPolicy({
    policy: createPolicy({
      scopeKind: 'site_runtime',
      sourceId: null,
      sourceTypes: [],
      usageContexts: ['query_embedding'],
    }),
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
    requiredScopeKinds: ['source', 'source_type'],
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.decisionCode, 'not_granted');
});

test('evaluateProviderApprovalPolicy allows only explicit site_runtime checks for query embedding', () => {
  const allowed = evaluateProviderApprovalPolicy({
    policy: createPolicy({
      scopeKind: 'site_runtime',
      sourceId: null,
      sourceTypes: [],
      usageContexts: ['query_embedding'],
      purpose: 'query_embedding_runtime_gate',
    }),
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: null,
    sourceType: null,
    usageContext: 'query_embedding',
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
    requiredScopeKinds: ['site_runtime'],
  });
  assert.equal(allowed.allowed, true);

  const deniedSourceGrant = evaluateProviderApprovalPolicy({
    policy: createPolicy(),
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: null,
    sourceType: null,
    usageContext: 'query_embedding',
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
    requiredScopeKinds: ['site_runtime'],
  });
  assert.equal(deniedSourceGrant.allowed, false);
  assert.equal(deniedSourceGrant.decisionCode, 'not_granted');
});
