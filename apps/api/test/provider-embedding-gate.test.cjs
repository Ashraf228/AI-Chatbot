const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertProviderEmbeddingAllowed,
  evaluateProviderEmbeddingGate,
} = require('../dist/knowledge-sources/provider-embedding-gate.js');

test('ProviderEmbeddingGate denies website runtime indexing by default', () => {
  const decision = evaluateProviderEmbeddingGate({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    actorRole: 'system',
    environment: 'non_production',
    explicitApproval: { granted: false },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'not_granted');
  assert.match(decision.sanitizedMessage, /ohne explizite Freigabe/i);
});

test('ProviderEmbeddingGate denies unknown usage contexts', () => {
  const decision = evaluateProviderEmbeddingGate({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceType: 'url',
    usageContext: 'unknown_context',
    explicitApproval: { granted: true },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'not_granted');
  assert.match(decision.sanitizedMessage, /Kontext/i);
});

test('ProviderEmbeddingGate denies unsupported source types for website runtime indexing', () => {
  const decision = evaluateProviderEmbeddingGate({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceType: 'faq',
    usageContext: 'website_ingest_runtime_indexing',
    explicitApproval: { granted: true },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'unsupported_source_type');
});

test('ProviderEmbeddingGate denies production usage without explicit production approval', () => {
  const decision = evaluateProviderEmbeddingGate({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    environment: 'production',
    explicitApproval: {
      granted: true,
      customerDataApproved: true,
      providerKey: 'openai',
      model: 'text-embedding-3-small',
    },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'production_not_approved');
});

test('ProviderEmbeddingGate denies usage without customer-data approval', () => {
  const decision = evaluateProviderEmbeddingGate({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    explicitApproval: {
      granted: true,
      providerKey: 'openai',
      model: 'text-embedding-3-small',
      productionApproved: false,
      customerDataApproved: false,
    },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionCode, 'customer_data_not_approved');
});

test('ProviderEmbeddingGate allows only fully scoped explicit approvals', () => {
  const decision = assertProviderEmbeddingAllowed({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    actorRole: 'admin',
    environment: 'non_production',
    explicitApproval: {
      granted: true,
      grantedBy: 'security_owner',
      providerKey: 'openai',
      model: 'text-embedding-3-small',
      approvedTenantId: 'tenant-1',
      approvedSiteId: 'site-1',
      allowedSourceTypes: ['url'],
      allowedUsageContexts: ['website_ingest_runtime_indexing'],
      customerDataApproved: true,
      productionApproved: false,
    },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.decisionCode, 'allowed');
  assert.match(decision.sanitizedMessage, /formal vorhanden/i);
});
