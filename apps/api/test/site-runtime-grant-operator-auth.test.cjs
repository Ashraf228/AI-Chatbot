const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const test = require('node:test');

const {
  SiteRuntimeGrantOperatorAuthService,
} = require('../dist/knowledge-sources/site-runtime-grant-operator-auth.service.js');

const SESSION_SECRET = 'synthetic-session-secret-for-operator-auth-tests';
const DASHBOARD_TOKEN = 'synthetic-dashboard-token-for-operator-auth-tests';
const PRINCIPAL_ID = 'operator-user-1';
const ORIGIN_TENANT_ID = 't_default';
const TARGET_TENANT_ID = 'tenant-target';
const TARGET_SITE_ID = 'site-target';

function capability(overrides = {}) {
  return {
    enabled: true,
    targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID] }],
    ...overrides,
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

class FakeDatabase {
  constructor({ currentPrincipal = principal(), sites = [{ id: TARGET_SITE_ID, tenantId: TARGET_TENANT_ID }] } = {}) {
    this.currentPrincipal = currentPrincipal;
    this.sites = sites;
    this.queries = [];
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    if (sql.includes('FROM tenant_users')) {
      return { rows: this.currentPrincipal && this.currentPrincipal.id === params[0] ? [this.currentPrincipal] : [] };
    }
    if (sql.includes('FROM sites')) {
      const [siteId, tenantId] = params;
      return {
        rows: this.sites.some((site) => site.id === siteId && site.tenantId === tenantId) ? [{ id: siteId }] : [],
      };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signClaims(claims, secret = SESSION_SECRET) {
  const payload = encodePayload(claims);
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function claims(overrides = {}) {
  const iat = Date.now();
  const exp = iat + 60 * 60 * 1000;
  return {
    role: 'customer',
    sub: `customer:${ORIGIN_TENANT_ID}:operator@synthetic.invalid`,
    tenantId: ORIGIN_TENANT_ID,
    tenantUserId: PRINCIPAL_ID,
    email: 'operator@synthetic.invalid',
    displayName: 'Synthetic Operator',
    iat,
    exp,
    sessionIssuedAt: new Date(iat).toISOString(),
    sessionExpiresAt: new Date(exp).toISOString(),
    jti: 'synthetic-session-id',
    ...overrides,
  };
}

function authInput(token, overrides = {}) {
  return {
    authorizationHeader: token ? `Bearer ${token}` : undefined,
    dashboardTokenHeader: DASHBOARD_TOKEN,
    targetTenantId: TARGET_TENANT_ID,
    targetSiteId: TARGET_SITE_ID,
    ...overrides,
  };
}

function statusOf(error) {
  return typeof error?.getStatus === 'function' ? error.getStatus() : null;
}

async function assertRejected(promise, status) {
  await assert.rejects(promise, (error) => {
    assert.equal(statusOf(error), status);
    return true;
  });
}

test.beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
  process.env.DASHBOARD_INTERNAL_TOKEN = DASHBOARD_TOKEN;
});

test.afterEach(() => {
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.DASHBOARD_INTERNAL_TOKEN;
});

test('accepts a token produced by the existing dashboard signer and derives a fixed service context', async () => {
  const dashboardAuth = await import('../../dashboard/lib/auth-core.ts');
  const token = await dashboardAuth.createTenantSessionToken({
    role: 'customer',
    tenantId: ORIGIN_TENANT_ID,
    tenantUserId: PRINCIPAL_ID,
    email: 'operator@synthetic.invalid',
    displayName: 'Synthetic Operator',
  });
  const db = new FakeDatabase();
  const service = new SiteRuntimeGrantOperatorAuthService(db);

  assert.deepEqual(
    await service.authorize(authInput(token, { actorId: 'attacker', actorRole: 'operator' })),
    {
      tenantId: TARGET_TENANT_ID,
      siteId: TARGET_SITE_ID,
      actorId: `tenant-user:${PRINCIPAL_ID}`,
      actorRole: 'admin',
    },
  );
  assert.equal(db.queries[0].sql.includes('password'), false);
  assert.match(db.queries[0].sql, /metadata -> 'siteRuntimeGrantOperatorV1'/);
});

test('rejects missing, wrong, shared-key-only, and incomplete server credentials', async () => {
  const service = new SiteRuntimeGrantOperatorAuthService(new FakeDatabase());
  const token = signClaims(claims());

  await assertRejected(service.authorize(authInput(null)), 401);
  await assertRejected(service.authorize(authInput(token, { dashboardTokenHeader: 'wrong-dashboard-token-value-long-enough' })), 401);
  await assertRejected(service.authorize(authInput(null, { adminKey: 'synthetic-admin-key' })), 401);

  delete process.env.ADMIN_SESSION_SECRET;
  await assertRejected(service.authorize(authInput(token)), 401);
  process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
  delete process.env.DASHBOARD_INTERNAL_TOKEN;
  await assertRejected(service.authorize(authInput(token)), 401);
});

test('rejects the shared dashboard operator principal, tampering, signed claim changes, and expiry', async () => {
  const dashboardAuth = await import('../../dashboard/lib/auth-core.ts');
  const service = new SiteRuntimeGrantOperatorAuthService(new FakeDatabase());
  const operatorToken = await dashboardAuth.createOperatorSessionToken();
  await assertRejected(service.authorize(authInput(operatorToken)), 401);

  const validToken = signClaims(claims());
  const [payload, signature] = validToken.split('.');
  const tampered = `${payload.slice(0, -1)}A.${signature}`;
  await assertRejected(service.authorize(authInput(tampered)), 401);

  await assertRejected(service.authorize(authInput(signClaims(claims({ tenantId: 'other-origin' })))), 401);
  const expiredAt = Date.now() - 1000;
  const issuedAt = expiredAt - 60 * 60 * 1000;
  await assertRejected(service.authorize(authInput(signClaims(claims({
    iat: issuedAt,
    exp: expiredAt,
    sessionIssuedAt: new Date(issuedAt).toISOString(),
    sessionExpiresAt: new Date(expiredAt).toISOString(),
  })))), 401);
});

test('rejects missing, inactive, expired, or claim-mismatched persisted principals', async () => {
  const token = signClaims(claims());
  const cases = [
    null,
    principal({ is_active: false }),
    principal({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    principal({ expires_at: 'invalid-persisted-expiry' }),
    principal({ tenant_id: 't-default' }),
    principal({ email: 'different@synthetic.invalid' }),
    principal({ role: 'viewer' }),
  ];

  for (const currentPrincipal of cases) {
    const service = new SiteRuntimeGrantOperatorAuthService(new FakeDatabase({ currentPrincipal }));
    await assertRejected(service.authorize(authInput(token)), 401);
  }
});

test('accepts matching account expiry and rejects a persisted expiry changed after login', async () => {
  const accountExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const exp = Date.now() + 60 * 60 * 1000;
  const token = signClaims(claims({
    exp,
    sessionExpiresAt: new Date(exp).toISOString(),
    accountExpiresAt,
  }));
  const db = new FakeDatabase({ currentPrincipal: principal({ expires_at: accountExpiresAt }) });
  await new SiteRuntimeGrantOperatorAuthService(db).authorize(authInput(token));

  db.currentPrincipal = principal({ expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() });
  await assertRejected(new SiteRuntimeGrantOperatorAuthService(db).authorize(authInput(token)), 401);
});

test('requires both the repository internal-tenant convention and an internal subscription', async () => {
  const token = signClaims(claims());
  await assertRejected(
    new SiteRuntimeGrantOperatorAuthService(new FakeDatabase({
      currentPrincipal: principal({ has_internal_subscription: false }),
    })).authorize(authInput(token)),
    403,
  );

  const customerClaims = claims({
    tenantId: 'enterprise-customer',
    sub: 'customer:enterprise-customer:operator@synthetic.invalid',
  });
  await assertRejected(
    new SiteRuntimeGrantOperatorAuthService(new FakeDatabase({
      currentPrincipal: principal({ tenant_id: 'enterprise-customer', has_internal_subscription: true }),
    })).authorize(authInput(signClaims(customerClaims))),
    403,
  );
});

test('fails closed for missing and malformed capabilities, wildcards, unknown fields, and role-only access', async () => {
  const malformedCapabilities = [
    null,
    {},
    { enabled: 'true', targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID] }] },
    { enabled: false, targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID] }] },
    { enabled: true, targets: 'all' },
    { enabled: true, targets: [] },
    { enabled: true, targets: [{ tenantId: '', siteIds: [TARGET_SITE_ID] }] },
    { enabled: true, targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [] }] },
    { enabled: true, targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [''] }] },
    { enabled: true, targets: [{ tenantId: '*', siteIds: [TARGET_SITE_ID] }] },
    { enabled: true, targets: [{ tenantId: TARGET_TENANT_ID, siteIds: ['*'] }] },
    {
      enabled: true,
      targets: [
        { tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID] },
        { tenantId: TARGET_TENANT_ID, siteIds: ['site-other'] },
      ],
    },
    { enabled: true, targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID, TARGET_SITE_ID] }] },
    { enabled: true, targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID], extra: true }] },
    { enabled: true, targets: [{ tenantId: TARGET_TENANT_ID, siteIds: [TARGET_SITE_ID] }], extra: true },
  ];
  const token = signClaims(claims());

  for (const operatorCapability of malformedCapabilities) {
    const service = new SiteRuntimeGrantOperatorAuthService(new FakeDatabase({
      currentPrincipal: principal({ operator_capability: operatorCapability, role: 'owner' }),
    }));
    await assertRejected(service.authorize(authInput(token)), 403);
  }
});

test('hides disallowed tenants, disallowed sites, and incorrect persisted site ownership', async () => {
  const service = new SiteRuntimeGrantOperatorAuthService(new FakeDatabase());
  const token = signClaims(claims());
  await assertRejected(service.authorize(authInput(token, { targetTenantId: 'tenant-other' })), 404);
  await assertRejected(service.authorize(authInput(token, { targetSiteId: 'site-other' })), 404);

  const wrongOwner = new SiteRuntimeGrantOperatorAuthService(new FakeDatabase({
    sites: [{ id: TARGET_SITE_ID, tenantId: 'tenant-other' }],
  }));
  await assertRejected(wrongOwner.authorize(authInput(token)), 404);
});

test('rechecks capability removal and user deactivation on every authorization call', async () => {
  const db = new FakeDatabase();
  const service = new SiteRuntimeGrantOperatorAuthService(db);
  const token = signClaims(claims());

  await service.authorize(authInput(token));
  db.currentPrincipal = principal({ operator_capability: null });
  await assertRejected(service.authorize(authInput(token)), 403);
  db.currentPrincipal = principal({ is_active: false });
  await assertRejected(service.authorize(authInput(token)), 401);
  assert.equal(db.queries.filter((entry) => entry.sql.includes('FROM tenant_users')).length, 3);
});

test('public failures do not expose bearer, dashboard credential, session secret, or database details', async () => {
  const secretMarker = 'session-secret-do-not-leak-1234567890';
  const dashboardMarker = 'dashboard-secret-do-not-leak-1234567890';
  process.env.ADMIN_SESSION_SECRET = secretMarker;
  process.env.DASHBOARD_INTERNAL_TOKEN = dashboardMarker;
  const token = signClaims(claims(), secretMarker);

  const db = {
    async query() {
      throw new Error('synthetic database detail');
    },
  };
  const service = new SiteRuntimeGrantOperatorAuthService(db);
  await assert.rejects(
    service.authorize(authInput(token, { dashboardTokenHeader: dashboardMarker })),
    (error) => {
      assert.equal(statusOf(error), 500);
      const publicResponse = JSON.stringify(error.getResponse());
      assert.equal(publicResponse.includes(token), false);
      assert.equal(publicResponse.includes(secretMarker), false);
      assert.equal(publicResponse.includes(dashboardMarker), false);
      assert.equal(publicResponse.includes('synthetic database detail'), false);
      return true;
    },
  );
});
