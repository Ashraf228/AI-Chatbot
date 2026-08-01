const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateProviderApprovalPolicy,
  validateProviderApprovalPolicy,
} = require('../dist/knowledge-sources/provider-approval-policy.js');

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
