const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProviderApprovalStorageLookupService,
  buildProviderApprovalLookupQuery,
  evaluateStoredProviderApprovalGrant,
  mapProviderApprovalGrantRow,
} = require('../dist/knowledge-sources/provider-approval-storage-lookup.service.js');

function createRow(overrides = {}) {
  return {
    id: 'approval-1',
    tenant_id: 'tenant-1',
    site_id: 'site-1',
    source_id: 'source-1',
    source_types: ['url'],
    usage_contexts: ['website_ingest_runtime_indexing'],
    environment: 'non_production',
    provider_key: 'openai',
    model: 'text-embedding-3-small',
    embedding_dimension: 1536,
    provider_region: 'eu',
    data_categories: ['website_content'],
    customer_data_approved: true,
    production_approved: false,
    provider_dpa_approved: true,
    purpose: 'website_runtime_indexing_validation',
    retention_policy: 'no_persisted_provider_payloads',
    redaction_policy: 'strip_operator_secrets',
    logging_policy: 'metadata_only',
    deletion_policy: 'source_delete_reindex_required',
    reindex_policy: 'manual_reindex_only',
    rate_limit: '100 requests/day',
    cost_limit: '25 eur/month',
    valid_from: '2026-07-01T00:00:00.000Z',
    expires_at: '2026-12-31T23:59:59.000Z',
    revoked_at: null,
    approved_by: 'security_owner',
    approval_evidence_ref: 'evidence-1',
    ...overrides,
  };
}

function createLookupInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceType: 'url',
    usageContext: 'website_ingest_runtime_indexing',
    environment: 'non_production',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    now: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

test('buildProviderApprovalLookupQuery keeps untrusted values parameterized and orders source-specific grants first', () => {
  const input = createLookupInput({
    tenantId: "tenant-1'; DROP TABLE provider_approval_grants; --",
    sourceId: 'source-1',
  });
  const { sql, params } = buildProviderApprovalLookupQuery(input);

  assert.match(sql, /FROM provider_approval_grants/i);
  assert.match(sql, /source_types \? \$7/i);
  assert.match(sql, /usage_contexts \? \$8/i);
  assert.match(sql, /CASE WHEN source_id = \$9 THEN 0 ELSE 1 END/i);
  assert.equal(sql.includes(input.tenantId), false);
  assert.equal(params[0], input.tenantId);
  assert.equal(params[8], 'source-1');
});

test('mapProviderApprovalGrantRow returns null for malformed JSON arrays', () => {
  const policy = mapProviderApprovalGrantRow(createRow({ usage_contexts: 'not-an-array' }));
  assert.equal(policy, null);
});

test('evaluateStoredProviderApprovalGrant denies no grant, revoked, expired, future, cross-tenant, scope mismatches, and missing approvals', () => {
  const noGrant = evaluateStoredProviderApprovalGrant(createLookupInput({ policy: null }));
  assert.equal(noGrant.allowed, false);
  assert.equal(noGrant.decisionCode, 'missing_policy');

  const revoked = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ revoked_at: '2026-07-15T00:00:00.000Z' })),
  });
  assert.equal(revoked.allowed, false);
  assert.equal(revoked.decisionCode, 'revoked');

  const expired = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ expires_at: '2026-07-15T00:00:00.000Z' })),
  });
  assert.equal(expired.allowed, false);
  assert.equal(expired.decisionCode, 'expired');

  const future = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ valid_from: '2026-08-15T00:00:00.000Z' })),
  });
  assert.equal(future.allowed, false);
  assert.equal(future.decisionCode, 'not_yet_valid');

  const crossTenant = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ tenant_id: 'tenant-2' })),
  });
  assert.equal(crossTenant.allowed, false);
  assert.equal(crossTenant.decisionCode, 'tenant_mismatch');

  const siteMismatch = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ site_id: 'site-2' })),
  });
  assert.equal(siteMismatch.allowed, false);
  assert.equal(siteMismatch.decisionCode, 'site_mismatch');

  const sourceMismatch = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ source_id: 'source-2' })),
  });
  assert.equal(sourceMismatch.allowed, false);
  assert.equal(sourceMismatch.decisionCode, 'not_granted');

  const sourceTypeMismatch = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ source_types: ['faq'] })),
  });
  assert.equal(sourceTypeMismatch.allowed, false);
  assert.equal(sourceTypeMismatch.decisionCode, 'source_type_not_allowed');

  const usageContextMismatch = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ usage_contexts: ['query_embedding'] })),
  });
  assert.equal(usageContextMismatch.allowed, false);
  assert.equal(usageContextMismatch.decisionCode, 'usage_context_not_allowed');

  const environmentMismatch = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ environment: 'production', production_approved: true })),
  });
  assert.equal(environmentMismatch.allowed, false);
  assert.equal(environmentMismatch.decisionCode, 'not_granted');

  const providerMismatch = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ provider_key: 'azure-openai' })),
  });
  assert.equal(providerMismatch.allowed, false);
  assert.equal(providerMismatch.decisionCode, 'provider_not_allowed');

  const modelMismatch = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ model: 'text-embedding-3-large' })),
  });
  assert.equal(modelMismatch.allowed, false);
  assert.equal(modelMismatch.decisionCode, 'model_not_allowed');

  const noCustomerApproval = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ customer_data_approved: false })),
  });
  assert.equal(noCustomerApproval.allowed, false);
  assert.equal(noCustomerApproval.decisionCode, 'customer_data_not_approved');

  const noDpaApproval = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow({ provider_dpa_approved: false })),
  });
  assert.equal(noDpaApproval.allowed, false);
  assert.equal(noDpaApproval.decisionCode, 'dpa_not_approved');
});

test('evaluateStoredProviderApprovalGrant requires production approval in production and allows a valid synthetic grant', () => {
  const denied = evaluateStoredProviderApprovalGrant({
    ...createLookupInput({ environment: 'production' }),
    policy: mapProviderApprovalGrantRow(createRow({ environment: 'production', production_approved: false })),
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.decisionCode, 'production_not_approved');

  const allowed = evaluateStoredProviderApprovalGrant({
    ...createLookupInput(),
    policy: mapProviderApprovalGrantRow(createRow()),
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.decisionCode, 'allowed');
  assert.equal(allowed.approvalGrantId, 'approval-1');
  assert.equal(allowed.providerKey, 'openai');
  assert.equal(allowed.model, 'text-embedding-3-small');
});

test('ProviderApprovalStorageLookupService returns missing_policy when no grant matches and sanitizes DB errors', async () => {
  const missingService = new ProviderApprovalStorageLookupService({
    async query() {
      return { rows: [] };
    },
  });

  const missing = await missingService.evaluateProviderApprovalFromStorage(createLookupInput());
  assert.equal(missing.allowed, false);
  assert.equal(missing.decisionCode, 'missing_policy');
  assert.match(missing.sanitizedMessage, /Storage-Grant/i);

  const failingService = new ProviderApprovalStorageLookupService({
    async query() {
      throw new Error('db down: password=secret');
    },
  });

  const failing = await failingService.evaluateProviderApprovalFromStorage(createLookupInput());
  assert.equal(failing.allowed, false);
  assert.equal(failing.decisionCode, 'not_granted');
  assert.equal(failing.sanitizedMessage.includes('password='), false);
});

test('ProviderApprovalStorageLookupService loads a valid grant and supports site-wide fallback rows', async () => {
  let captured = null;
  const service = new ProviderApprovalStorageLookupService({
    async query(sql, params) {
      captured = { sql, params };
      return { rows: [createRow({ source_id: null })] };
    },
  });

  const decision = await service.evaluateProviderApprovalFromStorage(createLookupInput());
  assert.equal(decision.allowed, true);
  assert.equal(decision.decisionCode, 'allowed');
  assert.equal(decision.policy.sourceId, null);
  assert.match(captured.sql, /ORDER BY\s+CASE WHEN source_id = \$9 THEN 0 ELSE 1 END/i);
});
