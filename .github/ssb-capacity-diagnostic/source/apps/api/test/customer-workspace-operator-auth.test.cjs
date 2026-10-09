const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const test = require('node:test');

const {
  CustomerWorkspaceOperatorAuthService,
} = require('../dist/conversation-engine/customer-workspace-operator-auth.service.js');

const SESSION_SECRET = 'synthetic-session-secret-for-workspace-auth-tests';
const DASHBOARD_TOKEN = 'synthetic-dashboard-token-for-workspace-auth-tests';
const TENANT_ID = 'tenant-synthetic';
const ASSIGNED_SITE_ID = 'site-assigned';
const OTHER_SITE_ID = 'site-other';
const PRINCIPAL_ID = 'tenant-user-synthetic';
const EMAIL = 'workspace-user@synthetic.invalid';

function capability(overrides = {}) {
  return { enabled: true, siteIds: [ASSIGNED_SITE_ID], ...overrides };
}

function principal(overrides = {}) {
  return {
    id: PRINCIPAL_ID,
    tenant_id: TENANT_ID,
    email: EMAIL,
    role: 'editor',
    is_active: true,
    expires_at: null,
    workspace_capability: capability(),
    ...overrides,
  };
}

class FakeDatabase {
  constructor({ currentPrincipal = principal(), sites = [{ id: ASSIGNED_SITE_ID, tenantId: TENANT_ID }] } = {}) {
    this.currentPrincipal = currentPrincipal;
    this.sites = sites;
    this.queries = [];
    this.failure = null;
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    if (this.failure) throw this.failure;
    if (sql.includes('FROM tenant_users')) {
      return { rows: this.currentPrincipal?.id === params[0] ? [this.currentPrincipal] : [] };
    }
    if (sql.includes('FROM sites')) {
      const [siteId, tenantId] = params;
      return {
        rows: this.sites.some((site) => site.id === siteId && site.tenantId === tenantId)
          ? [{ id: siteId }]
          : [],
      };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }
}

function claims(overrides = {}) {
  const iat = Date.now();
  const exp = iat + 60 * 60 * 1000;
  return {
    role: 'customer',
    sub: `customer:${TENANT_ID}:${EMAIL}`,
    tenantId: TENANT_ID,
    tenantUserId: PRINCIPAL_ID,
    email: EMAIL,
    displayName: 'Synthetic Workspace User',
    iat,
    exp,
    sessionIssuedAt: new Date(iat).toISOString(),
    sessionExpiresAt: new Date(exp).toISOString(),
    jti: 'synthetic-session-id',
    ...overrides,
  };
}

function signClaims(value) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function authInput(token = signClaims(claims()), overrides = {}) {
  return {
    authorizationHeader: `Bearer ${token}`,
    dashboardTokenHeader: DASHBOARD_TOKEN,
    targetSiteId: ASSIGNED_SITE_ID,
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

test('authorizes an active individual customer only for an assigned same-tenant site', async () => {
  const db = new FakeDatabase();
  const service = new CustomerWorkspaceOperatorAuthService(db);

  assert.deepEqual(await service.authorize(authInput()), {
    tenantId: TENANT_ID,
    siteId: ASSIGNED_SITE_ID,
    actorId: `tenant-user:${PRINCIPAL_ID}`,
    actorRole: 'customer',
  });
  assert.deepEqual(db.queries[0].params, [PRINCIPAL_ID, 'customerWorkspaceOperatorV1']);
  assert.deepEqual(db.queries[1].params, [ASSIGNED_SITE_ID, TENANT_ID]);
});

test('rejects missing bearer credentials, wrong internal token, shared operator, and signed claim tampering', async () => {
  const service = new CustomerWorkspaceOperatorAuthService(new FakeDatabase());
  await assertRejected(service.authorize(authInput(undefined, { authorizationHeader: undefined })), 401);
  await assertRejected(service.authorize(authInput(undefined, { dashboardTokenHeader: 'wrong-token-with-sufficient-length-0000' })), 401);
  await assertRejected(service.authorize(authInput(signClaims(claims({
    role: 'operator',
    sub: 'dashboard-operator',
    tenantId: undefined,
    tenantUserId: undefined,
    email: undefined,
    displayName: undefined,
  })))), 401);

  const valid = signClaims(claims());
  const [payload, signature] = valid.split('.');
  await assertRejected(service.authorize(authInput(`${payload.slice(0, -1)}A.${signature}`)), 401);
  await assertRejected(service.authorize(authInput(signClaims(claims({ tenantId: 'tenant-forged' })))), 401);
});

test('rechecks account state, membership, role, and expiry on every request', async () => {
  const token = signClaims(claims());
  const invalidPrincipals = [
    null,
    principal({ is_active: false }),
    principal({ tenant_id: 'tenant-foreign' }),
    principal({ email: 'different@synthetic.invalid' }),
    principal({ role: 'viewer' }),
    principal({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    principal({ expires_at: 'invalid-expiry' }),
  ];
  for (const currentPrincipal of invalidPrincipals) {
    await assertRejected(
      new CustomerWorkspaceOperatorAuthService(new FakeDatabase({ currentPrincipal })).authorize(authInput(token)),
      401,
    );
  }
});

test('capability removal, malformed capability, and unassigned or foreign sites fail closed', async () => {
  const token = signClaims(claims());
  for (const workspaceCapability of [
    null,
    {},
    { enabled: false, siteIds: [ASSIGNED_SITE_ID] },
    { enabled: true, siteIds: [] },
    { enabled: true, siteIds: ['*'] },
    { enabled: true, siteIds: [ASSIGNED_SITE_ID, ASSIGNED_SITE_ID] },
    { enabled: true, siteIds: Array.from({ length: 101 }, (_, index) => `site-${index}`) },
    { enabled: true, siteIds: [ASSIGNED_SITE_ID], tenantId: TENANT_ID },
  ]) {
    await assertRejected(
      new CustomerWorkspaceOperatorAuthService(new FakeDatabase({
        currentPrincipal: principal({ workspace_capability: workspaceCapability }),
      })).authorize(authInput(token)),
      403,
    );
  }

  const service = new CustomerWorkspaceOperatorAuthService(new FakeDatabase());
  await assertRejected(service.authorize(authInput(token, { targetSiteId: OTHER_SITE_ID })), 404);
  await assertRejected(
    new CustomerWorkspaceOperatorAuthService(new FakeDatabase({ sites: [] })).authorize(authInput(token)),
    404,
  );
});

test('database lookup failures are sanitized and never grant access', async () => {
  const db = new FakeDatabase();
  db.failure = new Error('synthetic database details');
  await assertRejected(new CustomerWorkspaceOperatorAuthService(db).authorize(authInput()), 500);
});
