const assert = require('node:assert/strict');
const test = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

const { PrismaService } = require('../dist/db/prisma.service.js');
const {
  SiteRuntimeGrantOperatorAuthService,
} = require('../dist/knowledge-sources/site-runtime-grant-operator-auth.service.js');
const {
  SiteRuntimeGrantWriteService,
} = require('../dist/knowledge-sources/site-runtime-grant-write.service.js');
const {
  SiteRuntimeGrantsController,
} = require('../dist/knowledge-sources/site-runtime-grants.controller.js');

const SESSION_SECRET = 'synthetic-session-secret-for-controller-tests';
const DASHBOARD_TOKEN = 'synthetic-dashboard-token-for-controller-tests';
const PRINCIPAL_ID = 'operator-user-1';
const ORIGIN_TENANT_ID = 't_default';
const TARGET_TENANT_ID = 'tenant-target';
const TARGET_SITE_ID = 'site-target';

function capability() {
  return {
    enabled: true,
    targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID] }],
  };
}

function principal(overrides = {}) {
  return {
    id: PRINCIPAL_ID,
    tenant_id: ORIGIN_TENANT_ID,
    email: 'operator@synthetic.invalid',
    role: 'admin',
    is_active: true,
    expires_at: null,
    operator_capability: capability(),
    has_internal_subscription: true,
    ...overrides,
  };
}

function terms(overrides = {}) {
  return {
    validFrom: '2030-01-01T00:00:00.000Z',
    expiresAt: '2030-02-01T00:00:00.000Z',
    embeddingDimension: 1536,
    providerRegion: 'synthetic-region',
    dataCategories: ['synthetic-support-content'],
    customerDataApproved: false,
    productionApproved: false,
    providerDpaApproved: false,
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

function grant(id = 'grant-1') {
  return {
    id,
    providerKey: 'synthetic-provider',
    model: 'synthetic-model',
    environment: 'synthetic',
    validFrom: '2030-01-01T00:00:00.000Z',
    expiresAt: '2030-02-01T00:00:00.000Z',
    status: 'scheduled',
    revokedAt: null,
  };
}

class FakeDatabase {
  constructor() {
    this.currentPrincipal = principal();
    this.sites = [{ id: TARGET_SITE_ID, tenantId: TARGET_TENANT_ID }];
    this.queries = [];
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    if (sql.includes('FROM tenant_users')) {
      return {
        rows: this.currentPrincipal?.id === params[0] ? [this.currentPrincipal] : [],
      };
    }
    if (sql.includes('FROM sites')) {
      const [siteId, tenantId] = params;
      return {
        rows: this.sites.some((site) => site.id === siteId && site.tenantId === tenantId)
          ? [{ id: siteId }]
          : [],
      };
    }
    throw new Error('Unexpected synthetic query');
  }
}

class FakeWriteService {
  constructor() {
    this.reset();
  }

  reset() {
    this.calls = [];
    this.results = {
      preview: { kind: 'would_create', runtime: { providerKey: 'synthetic-provider', model: 'synthetic-model', environment: 'synthetic' } },
      create: { kind: 'created', grant: grant() },
      revoke: { kind: 'revoked', grant: { ...grant(), status: 'revoked', revokedAt: '2030-01-02T00:00:00.000Z' } },
      status: { kind: 'found', grant: grant() },
    };
    this.failMethod = null;
  }

  call(method, context, input) {
    this.calls.push({ method, context, input });
    if (this.failMethod === method) throw new Error('synthetic database detail must not leak');
    return this.results[method];
  }

  preview(context, input) {
    return this.call('preview', context, input);
  }

  create(context, input) {
    return this.call('create', context, input);
  }

  revoke(context, input) {
    return this.call('revoke', context, input);
  }

  status(context, input) {
    return this.call('status', context, input);
  }
}

async function createHarness() {
  const db = new FakeDatabase();
  const writes = new FakeWriteService();
  const moduleRef = await Test.createTestingModule({
    controllers: [SiteRuntimeGrantsController],
    providers: [
      SiteRuntimeGrantOperatorAuthService,
      { provide: PrismaService, useValue: db },
      { provide: SiteRuntimeGrantWriteService, useValue: writes },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a local port');
  return { app, db, writes, baseUrl: `http://127.0.0.1:${address.port}` };
}

function request(harness, path, { method = 'POST', token, body, headers = {} } = {}) {
  const nextHeaders = {
    'Content-Type': 'application/json',
    'X-DASHBOARD-TOKEN': DASHBOARD_TOKEN,
    ...headers,
  };
  if (token) nextHeaders.Authorization = `Bearer ${token}`;
  return fetch(`${harness.baseUrl}${path}`, {
    method,
    headers: nextHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseBody(response) {
  return response.json().catch(() => null);
}

let harness;
let validToken;

test.before(async () => {
  process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
  process.env.DASHBOARD_INTERNAL_TOKEN = DASHBOARD_TOKEN;
  const dashboardAuth = await import('../../dashboard/lib/auth-core.ts');
  validToken = await dashboardAuth.createTenantSessionToken({
    role: 'customer',
    tenantId: ORIGIN_TENANT_ID,
    tenantUserId: PRINCIPAL_ID,
    email: 'operator@synthetic.invalid',
    displayName: 'Synthetic Operator',
  });
  harness = await createHarness();
});

test.beforeEach(() => {
  harness.db.currentPrincipal = principal();
  harness.db.sites = [{ id: TARGET_SITE_ID, tenantId: TARGET_TENANT_ID }];
  harness.db.queries = [];
  harness.writes.reset();
});

test.after(async () => {
  await harness?.app.close();
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.DASHBOARD_INTERNAL_TOKEN;
});

test('rejects missing credentials and shared-dashboard-key-only before any write call', async () => {
  const path = `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}`;
  const missing = await fetch(`${harness.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(terms()),
  });
  assert.equal(missing.status, 401);

  const sharedOnly = await request(harness, path, { body: terms() });
  assert.equal(sharedOnly.status, 401);
  assert.equal(harness.writes.calls.length, 0);
});

test('uses the production auth service for missing capability and foreign target scope', async () => {
  const path = `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}`;
  harness.db.currentPrincipal = principal({ operator_capability: null });
  const noCapability = await request(harness, path, { token: validToken, body: terms() });
  assert.equal(noCapability.status, 403);

  harness.db.currentPrincipal = principal();
  const foreign = await request(harness, '/internal/site-runtime-grants/tenant-other/site-other', {
    token: validToken,
    body: terms(),
  });
  assert.equal(foreign.status, 404);
  assert.equal(harness.writes.calls.length, 0);
});

test('derives the fixed write context and ignores forged actor, role, and tenant headers', async () => {
  const response = await request(
    harness,
    `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}`,
    {
      token: validToken,
      body: terms(),
      headers: {
        'X-DASHBOARD-ACTOR': 'forged-actor',
        'X-DASHBOARD-ROLE': 'admin',
        'X-DASHBOARD-TENANT': 'forged-tenant',
        'X-ADMIN-KEY': 'forged-admin-key',
      },
    },
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await responseBody(response), { kind: 'created', grant: grant() });
  assert.deepEqual(harness.writes.calls, [{
    method: 'create',
    context: {
      tenantId: TARGET_TENANT_ID,
      siteId: TARGET_SITE_ID,
      actorId: `tenant-user:${PRINCIPAL_ID}`,
      actorRole: 'admin',
    },
    input: terms(),
  }]);
});

test('rejects unknown and reserved fields before the write service despite global whitelist mode', async () => {
  const path = `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}`;
  for (const body of [
    terms({ actorRole: 'admin' }),
    terms({ tenantId: TARGET_TENANT_ID }),
    terms({ providerKey: 'synthetic-provider' }),
    terms({ environment: 'non_production' }),
    terms({ APP_ENV: 'staging' }),
  ]) {
    const response = await request(harness, path, { token: validToken, body });
    assert.equal(response.status, 400);
  }
  assert.equal(harness.writes.calls.length, 0);
});

test('maps preview safely and maps unavailable runtime to conflict', async () => {
  const path = `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}/preview`;
  const preview = await request(harness, path, { token: validToken, body: terms() });
  assert.equal(preview.status, 200);
  assert.deepEqual(await responseBody(preview), harness.writes.results.preview);

  harness.writes.results.preview = {
    kind: 'unsupported_runtime_configuration',
    reason: 'internal-runtime-detail',
  };
  const unavailable = await request(harness, path, { token: validToken, body: terms() });
  assert.equal(unavailable.status, 409);
  assert.equal(JSON.stringify(await responseBody(unavailable)).includes('internal-runtime-detail'), false);
});

test('revoke accepts only revocationReason and combines it with the scoped path grant id', async () => {
  const path = `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}/grant-1/revoke`;
  const valid = await request(harness, path, {
    token: validToken,
    body: { revocationReason: 'synthetic-reason' },
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(harness.writes.calls[0].input, {
    grantId: 'grant-1',
    revocationReason: 'synthetic-reason',
  });

  harness.writes.calls = [];
  const invalid = await request(harness, path, {
    token: validToken,
    body: { revocationReason: 'synthetic-reason', actorId: 'forged' },
  });
  assert.equal(invalid.status, 400);
  assert.equal(harness.writes.calls.length, 0);
});

test('returns identical not-found responses for foreign and unknown grant ids', async () => {
  harness.writes.results.status = { kind: 'not_found', reason: 'site_runtime_grant_not_found' };
  const responses = [];
  for (const grantId of ['foreign-grant', 'unknown-grant']) {
    const response = await request(
      harness,
      `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}/${grantId}`,
      { method: 'GET', token: validToken },
    );
    responses.push({ status: response.status, body: await responseBody(response) });
  }
  assert.equal(responses[0].status, 404);
  assert.deepEqual(responses[0], responses[1]);
});

test('does not expose unexpected write-service details in the public 500 response', async () => {
  harness.writes.failMethod = 'create';
  const response = await request(
    harness,
    `/internal/site-runtime-grants/${TARGET_TENANT_ID}/${TARGET_SITE_ID}`,
    { token: validToken, body: terms() },
  );
  assert.equal(response.status, 500);
  const publicBody = JSON.stringify(await responseBody(response));
  assert.equal(publicBody.includes('synthetic database detail'), false);
  assert.equal(publicBody.includes(validToken), false);
  assert.equal(publicBody.includes(DASHBOARD_TOKEN), false);
});
