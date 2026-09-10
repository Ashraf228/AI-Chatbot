const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SiteRuntimeGrantWriteService,
} = require('../dist/knowledge-sources/site-runtime-grant-write.service.js');
const {
  ProviderApprovalAuditWriter,
} = require('../dist/knowledge-sources/provider-approval-audit-writer.service.js');
const {
  buildSiteRuntimeGrantRuntimeContract,
} = require('../dist/knowledge-sources/site-runtime-grant-runtime-contract.js');

const now = new Date('2027-01-01T00:00:00.000Z');

function context(overrides = {}) {
  return {
    tenantId: 'tenant-internal',
    siteId: 'site-internal',
    actorId: 'synthetic-admin',
    actorRole: 'admin',
    ...overrides,
  };
}

function terms(overrides = {}) {
  return {
    validFrom: '2027-02-01T00:00:00.000Z',
    expiresAt: '2027-03-01T00:00:00.000Z',
    embeddingDimension: 1536,
    providerRegion: null,
    dataCategories: ['synthetic'],
    customerDataApproved: true,
    productionApproved: false,
    providerDpaApproved: true,
    retentionPolicy: 'synthetic-retention',
    redactionPolicy: 'synthetic-redaction',
    loggingPolicy: 'synthetic-logging',
    deletionPolicy: 'synthetic-deletion',
    reindexPolicy: null,
    rateLimit: 'synthetic-rate-limit',
    costLimit: 'synthetic-cost-limit',
    approvalEvidenceRef: 'synthetic-evidence',
    ...overrides,
  };
}

function rowFromTerms(id, currentTerms, currentContext = context()) {
  return {
    id,
    tenant_id: currentContext.tenantId,
    site_id: currentContext.siteId,
    source_id: null,
    source_types: [],
    usage_contexts: ['query_embedding'],
    scope_kind: 'site_runtime',
    environment: 'non_production',
    provider_key: 'openai',
    model: 'text-embedding-3-small',
    embedding_dimension: currentTerms.embeddingDimension,
    provider_region: currentTerms.providerRegion,
    data_categories: currentTerms.dataCategories,
    customer_data_approved: currentTerms.customerDataApproved,
    production_approved: currentTerms.productionApproved,
    provider_dpa_approved: currentTerms.providerDpaApproved,
    purpose: 'query_embedding',
    retention_policy: currentTerms.retentionPolicy,
    redaction_policy: currentTerms.redactionPolicy,
    logging_policy: currentTerms.loggingPolicy,
    deletion_policy: currentTerms.deletionPolicy,
    reindex_policy: currentTerms.reindexPolicy,
    rate_limit: currentTerms.rateLimit,
    cost_limit: currentTerms.costLimit,
    valid_from: currentTerms.validFrom,
    expires_at: currentTerms.expiresAt,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    approved_by: currentContext.actorId,
    approval_evidence_ref: currentTerms.approvalEvidenceRef,
  };
}

class FakeDatabase {
  constructor({ sites = [context()], grants = [], overlapError = null } = {}) {
    this.sites = sites.map((site) => ({ id: site.siteId, tenantId: site.tenantId }));
    this.grants = grants;
    this.overlapError = overlapError;
    this.transactionCalls = 0;
    this.queries = [];
  }

  async transaction(callback) {
    this.transactionCalls += 1;
    const snapshot = structuredClone(this.grants);
    try {
      return await callback(this);
    } catch (error) {
      this.grants = snapshot;
      throw error;
    }
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    if (sql.includes('SELECT now() AS now')) return { rows: [{ now }] };
    if (sql.includes('SELECT id FROM sites')) {
      const [siteId, tenantId] = params;
      return { rows: this.sites.some((site) => site.id === siteId && site.tenantId === tenantId) ? [{ id: siteId }] : [] };
    }
    if (sql.includes('FROM provider_approval_grants') && sql.includes('SELECT')) {
      if (sql.includes('WHERE id = $1')) {
        const [id, tenantId, siteId] = params;
        return { rows: this.grants.filter((grant) => grant.id === id && grant.tenant_id === tenantId && grant.site_id === siteId) };
      }
      const [tenantId, siteId, providerKey, model, environment] = params;
      return {
        rows: this.grants.filter((grant) => grant.tenant_id === tenantId && grant.site_id === siteId
          && grant.provider_key === providerKey && grant.model === model && grant.environment === environment
          && grant.revoked_at === null),
      };
    }
    if (sql.includes('INSERT INTO provider_approval_grants')) {
      if (this.overlapError) throw this.overlapError;
      const row = {
        id: params[0], tenant_id: params[1], site_id: params[2], source_id: null,
        source_types: [], usage_contexts: ['query_embedding'], scope_kind: 'site_runtime',
        environment: params[3], provider_key: params[4], model: params[5], embedding_dimension: params[6],
        provider_region: params[7], data_categories: JSON.parse(params[8]), customer_data_approved: params[9],
        production_approved: params[10], provider_dpa_approved: params[11], purpose: 'query_embedding',
        retention_policy: params[12], redaction_policy: params[13], logging_policy: params[14], deletion_policy: params[15],
        reindex_policy: params[16], rate_limit: params[17], cost_limit: params[18], valid_from: params[19],
        expires_at: params[20], revoked_at: null, revoked_by: null, revocation_reason: null,
        approved_by: params[21], approval_evidence_ref: params[22],
      };
      this.grants.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE provider_approval_grants')) {
      const [revokedAt, revokedBy, reason, id, tenantId, siteId] = params;
      const row = this.grants.find((grant) => grant.id === id && grant.tenant_id === tenantId
        && grant.site_id === siteId && grant.revoked_at === null);
      if (!row) return { rows: [] };
      row.revoked_at = revokedAt;
      row.revoked_by = revokedBy;
      row.revocation_reason = reason;
      return { rows: [row] };
    }
    throw new Error('Unexpected query: ' + sql);
  }
}

function createService(options = {}) {
  const db = new FakeDatabase(options);
  const auditCalls = [];
  const auditWriter = options.auditWriter || {
    async record(tx, input) {
      auditCalls.push({ tx, input });
    },
  };
  const runtime = options.runtime || {
    resolveRuntimeContract() {
      return {
        environment: 'non_production',
        providerKey: 'openai',
        model: 'text-embedding-3-small',
        supported: true,
      };
    },
  };
  return { db, auditCalls, service: new SiteRuntimeGrantWriteService(db, auditWriter, runtime) };
}

function runtimeResolver(nodeEnv, appEnv, providerSupported = true) {
  return {
    resolveRuntimeContract() {
      return buildSiteRuntimeGrantRuntimeContract(
        { providerKey: 'openai', model: 'text-embedding-3-small' },
        providerSupported,
        nodeEnv,
        appEnv,
      );
    },
  };
}

test('create persists only the fixed site-runtime contract and records audit on the transaction client', async () => {
  const { service, db, auditCalls } = createService();
  const result = await service.create(context(), terms());

  assert.equal(result.kind, 'created');
  assert.equal(db.grants.length, 1);
  const grant = db.grants[0];
  assert.equal(grant.scope_kind, 'site_runtime');
  assert.equal(grant.purpose, 'query_embedding');
  assert.equal(grant.source_id, null);
  assert.deepEqual(grant.source_types, []);
  assert.deepEqual(grant.usage_contexts, ['query_embedding']);
  assert.equal(grant.provider_key, 'openai');
  assert.equal(grant.approved_by, 'synthetic-admin');
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].tx, db);
  assert.equal(auditCalls[0].input.eventType, 'approval_created');
});

test('writer uses the shared staging resolution and accepts valid non-production terms', async () => {
  const { service, db, auditCalls } = createService({
    runtime: runtimeResolver('production', 'staging'),
  });

  const preview = await service.preview(context(), terms());
  assert.deepEqual(preview, {
    kind: 'would_create',
    runtime: {
      providerKey: 'openai',
      model: 'text-embedding-3-small',
      environment: 'non_production',
    },
  });

  const created = await service.create(context(), terms());
  assert.equal(created.kind, 'created');
  assert.equal(db.grants[0].environment, 'non_production');
  assert.equal(db.grants[0].production_approved, false);
  assert.equal(auditCalls.length, 1);
});

test('writer still rejects production terms without production approval', async () => {
  const { service, db, auditCalls } = createService({
    runtime: runtimeResolver('production', 'production'),
  });

  assert.deepEqual(await service.create(context(), terms()), {
    kind: 'invalid_terms',
    reason: 'production_not_approved',
  });
  assert.equal(db.grants.length, 0);
  assert.equal(auditCalls.length, 0);
});

test('writer rejects invalid deployment configuration before database or audit work', async () => {
  const { service, db, auditCalls } = createService({
    runtime: runtimeResolver('production', ' staging '),
  });
  const expected = {
    kind: 'unsupported_runtime_configuration',
    reason: 'site_runtime_grant_runtime_configuration_unsupported',
  };

  assert.deepEqual(await service.preview(context(), terms()), expected);
  assert.deepEqual(await service.create(context(), terms()), expected);
  assert.equal(db.transactionCalls, 0);
  assert.deepEqual(db.queries, []);
  assert.equal(db.grants.length, 0);
  assert.equal(auditCalls.length, 0);
});

test('identical future create is reused without a second grant or audit entry', async () => {
  const currentTerms = terms({ validFrom: '2030-02-01T00:00:00.000Z', expiresAt: '2030-03-01T00:00:00.000Z' });
  const existing = rowFromTerms('existing-future', currentTerms);
  const { service, db, auditCalls } = createService({ grants: [existing] });
  const result = await service.create(context(), currentTerms);

  assert.equal(result.kind, 'reused');
  assert.equal(result.grant.id, 'existing-future');
  assert.equal(db.grants.length, 1);
  assert.equal(auditCalls.length, 0);
});

test('overlapping changed approval terms are a conflict without audit mutation', async () => {
  const existing = rowFromTerms('existing', terms());
  const { service, db, auditCalls } = createService({ grants: [existing] });
  const result = await service.create(context(), terms({ approvalEvidenceRef: 'changed-evidence' }));

  assert.equal(result.kind, 'conflict');
  assert.equal(result.grant.id, 'existing');
  assert.equal(db.grants.length, 1);
  assert.equal(auditCalls.length, 0);
});

test('only the known PostgreSQL overlap constraint is classified as a conflict', async () => {
  const overlapError = Object.assign(new Error('overlap'), {
    code: '23P01',
    constraint: 'provider_approval_grants_site_runtime_no_overlap',
  });
  const { service } = createService({ overlapError });
  assert.deepEqual(await service.create(context(), terms()), { kind: 'conflict', grant: null });

  const wrongConstraint = Object.assign(new Error('different exclusion violation'), {
    code: '23P01',
    constraint: 'different_exclusion_constraint',
  });
  const wrongConstraintService = createService({ overlapError: wrongConstraint });
  await assert.rejects(
    () => wrongConstraintService.service.create(context(), terms()),
    (error) => error === wrongConstraint,
  );

  const unexpected = Object.assign(new Error('database unavailable'), { code: '08006' });
  const failing = createService({ overlapError: unexpected });
  await assert.rejects(() => failing.service.create(context(), terms()), /database unavailable/);
});

test('missing and malformed contexts fail closed before transaction or audit', async () => {
  const { service, db, auditCalls } = createService();
  const invalidContexts = [
    undefined,
    null,
    {},
    { tenantId: 'tenant-internal', siteId: 'site-internal', actorRole: 'admin' },
    { tenantId: 'tenant-internal', siteId: 'site-internal', actorId: 7, actorRole: 'admin' },
  ];
  for (const invalidContext of invalidContexts) {
    assert.equal((await service.create(invalidContext, terms())).kind, 'invalid_context');
  }
  assert.equal(db.transactionCalls, 0);
  assert.equal(db.grants.length, 0);
  assert.equal(auditCalls.length, 0);
});

test('role and reserved term injection fail before database mutation', async () => {
  const { service, db, auditCalls } = createService();
  assert.equal((await service.create(context({ actorRole: 'operator' }), terms())).kind, 'invalid_context');
  assert.equal((await service.create(context(), { ...terms(), providerKey: 'other-provider' })).kind, 'invalid_terms');
  assert.equal(db.transactionCalls, 0);
  assert.equal(db.grants.length, 0);
  assert.equal(auditCalls.length, 0);
});

test('a reversed validity window fails without grant or audit mutation', async () => {
  const { service, db, auditCalls } = createService();
  const result = await service.create(context(), terms({
    validFrom: '2030-03-01T00:00:00.000Z',
    expiresAt: '2030-02-01T00:00:00.000Z',
  }));
  assert.deepEqual(result, {
    kind: 'invalid_terms',
    reason: 'site_runtime_grant_validity_window_invalid',
  });
  assert.equal(db.grants.length, 0);
  assert.equal(auditCalls.length, 0);
  assert.equal(db.transactionCalls, 1);
});

test('preview does not mutate and create independently rechecks the scoped site', async () => {
  const { service, db } = createService();
  assert.equal((await service.preview(context(), terms())).kind, 'would_create');
  assert.equal(db.grants.length, 0);
  db.sites = [];
  assert.equal((await service.create(context(), terms())).kind, 'not_found');
  assert.equal(db.grants.length, 0);
});

test('revoke preserves original approval data and is idempotent', async () => {
  const existing = rowFromTerms('revoke-me', terms());
  const { service, db, auditCalls } = createService({ grants: [existing] });
  const revoked = await service.revoke(context(), { grantId: 'revoke-me', revocationReason: 'synthetic reason' });
  assert.equal(revoked.kind, 'revoked');
  assert.equal(db.grants[0].approved_by, 'synthetic-admin');
  assert.equal(db.grants[0].revoked_by, 'synthetic-admin');
  assert.equal(auditCalls.length, 1);
  assert.equal((await service.revoke(context(), { grantId: 'revoke-me', revocationReason: 'second' })).kind, 'already_revoked');
  assert.equal(auditCalls.length, 1);
});

test('revoke and status hide foreign and unknown grants without mutation or audit', async () => {
  const foreignTenantGrant = rowFromTerms(
    'foreign-tenant-grant',
    terms(),
    context({ tenantId: 'foreign-tenant' }),
  );
  const foreignSiteGrant = rowFromTerms(
    'foreign-site-grant',
    terms(),
    context({ siteId: 'foreign-site' }),
  );
  const { service, db, auditCalls } = createService({ grants: [foreignTenantGrant, foreignSiteGrant] });
  const notFound = { kind: 'not_found', reason: 'site_runtime_grant_not_found' };

  assert.deepEqual(
    await service.revoke(context({ tenantId: 'foreign-tenant' }), {
      grantId: 'foreign-tenant-grant',
      revocationReason: 'synthetic reason',
    }),
    notFound,
  );
  assert.deepEqual(
    await service.revoke(context(), { grantId: 'foreign-tenant-grant', revocationReason: 'synthetic reason' }),
    notFound,
  );
  assert.deepEqual(
    await service.revoke(context(), { grantId: 'foreign-site-grant', revocationReason: 'synthetic reason' }),
    notFound,
  );
  assert.deepEqual(await service.status(context(), 'foreign-tenant-grant'), notFound);
  assert.deepEqual(await service.status(context(), 'foreign-site-grant'), notFound);
  assert.deepEqual(await service.status(context(), 'unknown-grant'), notFound);
  assert.ok(db.grants.every((grant) => grant.revoked_at === null));
  assert.equal(auditCalls.length, 0);
});

test('status returns only the explicitly allowed safe projection', async () => {
  const currentTerms = terms({
    validFrom: '2030-02-01T00:00:00.000Z',
    expiresAt: '2030-03-01T00:00:00.000Z',
  });
  const stored = {
    ...rowFromTerms('projected-grant', currentTerms),
    revocation_reason: 'internal-only-reason',
    internal_policy_detail: 'must-not-be-projected',
  };
  const { service } = createService({ grants: [stored] });

  assert.deepEqual(await service.status(context(), 'projected-grant'), {
    kind: 'found',
    grant: {
      id: 'projected-grant',
      providerKey: 'openai',
      model: 'text-embedding-3-small',
      environment: 'non_production',
      validFrom: '2030-02-01T00:00:00.000Z',
      expiresAt: '2030-03-01T00:00:00.000Z',
      status: 'scheduled',
      revokedAt: null,
    },
  });
});

test('audit failures roll a created grant back', async () => {
  const { service, db } = createService({
    auditWriter: {
      async record() {
        throw new Error('synthetic audit failure');
      },
    },
  });
  await assert.rejects(() => service.create(context(), terms()), /synthetic audit failure/);
  assert.equal(db.grants.length, 0);
});

test('audit writer uses only the supplied queryable client', async () => {
  const queries = [];
  const tx = { async query(sql, params) { queries.push({ sql, params }); return { rows: [] }; } };
  await new ProviderApprovalAuditWriter().record(tx, {
    tenantId: 'tenant-internal',
    siteId: 'site-internal',
    approvalGrantId: 'grant-internal',
    actorId: 'synthetic-admin',
    actorRole: 'admin',
    eventType: 'approval_created',
    decisionCode: 'allowed',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    sanitizedReason: 'synthetic',
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /INSERT INTO provider_approval_audit_events/);
});
