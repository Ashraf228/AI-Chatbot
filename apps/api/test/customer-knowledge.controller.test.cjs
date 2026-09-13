const assert = require('node:assert/strict');
const test = require('node:test');
const { NotFoundException } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

const { AuditLogService } = require('../dist/audit-logs/audit-log.service.js');
const { PrismaService } = require('../dist/db/prisma.service.js');
const {
  CustomerKnowledgePoweruserAuthService,
} = require('../dist/modules/it-support/customer-knowledge-poweruser-auth.service.js');
const {
  CustomerKnowledgeController,
} = require('../dist/modules/it-support/customer-knowledge.controller.js');
const {
  ItKnowledgeTemplateImportService,
} = require('../dist/modules/it-support/it-knowledge-template-import.service.js');

const SESSION_SECRET = 'synthetic-session-secret-for-knowledge-tests';
const DASHBOARD_TOKEN = 'synthetic-dashboard-token-for-knowledge-tests';
const TENANT_ID = 'tenant-1';
const SITE_ID = 'site-1';
const USER_ID = 'poweruser-1';

function capability(siteIds = [SITE_ID]) {
  return { enabled: true, siteIds };
}

function principal(overrides = {}) {
  return {
    id: USER_ID,
    tenant_id: TENANT_ID,
    email: 'poweruser@synthetic.invalid',
    role: 'editor',
    is_active: true,
    expires_at: null,
    knowledge_capability: capability(),
    ...overrides,
  };
}

class FakeDatabase {
  constructor() {
    this.currentPrincipal = principal();
    this.sites = [{ id: SITE_ID, tenantId: TENANT_ID }];
    this.queries = [];
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
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
    throw new Error('Unexpected synthetic query');
  }
}

class FakeTemplateService {
  constructor() {
    this.reset();
  }

  reset() {
    this.calls = [];
  }

  async listItKnowledgeTemplatesForSite(context) {
    this.calls.push({ method: 'list', context });
    return {
      ...context,
      templates: [{
        key: 'vpn-not-connecting',
        title: 'VPN verbindet nicht',
        category: 'connectivity',
        issueType: 'vpn',
        tags: ['vpn'],
        importedSourceId: null,
      }],
      providerCallsUsed: false,
      answerReadyTransitionAdded: false,
    };
  }

  async importItKnowledgeTemplatesForSite(input) {
    this.calls.push({ method: 'import', input });
    return {
      tenantId: input.tenantId,
      siteId: input.siteId,
      mode: input.mode,
      imported: [{ templateKey: input.templateKeys[0], sourceId: 'source-1', status: 'imported' }],
      skipped: [],
      overwritten: [],
      providerCallsUsed: false,
      answerReadyTransitionAdded: false,
    };
  }

  async deleteItKnowledgeTemplateDraft(input) {
    this.calls.push({ method: 'delete', input });
    if (input.sourceId !== 'source-1') throw new NotFoundException('Knowledge source not found');
    return { ok: true, siteId: input.siteId, sourceId: input.sourceId, providerCallsUsed: false };
  }
}

async function createHarness() {
  const db = new FakeDatabase();
  const templates = new FakeTemplateService();
  const audit = { calls: [], async record(input) { this.calls.push(input); } };
  const moduleRef = await Test.createTestingModule({
    controllers: [CustomerKnowledgeController],
    providers: [
      CustomerKnowledgePoweruserAuthService,
      { provide: PrismaService, useValue: db },
      { provide: ItKnowledgeTemplateImportService, useValue: templates },
      { provide: AuditLogService, useValue: audit },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a local port');
  return { app, db, templates, audit, baseUrl: `http://127.0.0.1:${address.port}` };
}

function request(harness, path, { method = 'GET', token, body, headers = {} } = {}) {
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

let harness;
let validToken;
let viewerToken;

test.before(async () => {
  process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
  process.env.DASHBOARD_INTERNAL_TOKEN = DASHBOARD_TOKEN;
  const dashboardAuth = await import('../../dashboard/lib/auth-core.ts');
  validToken = await dashboardAuth.createTenantSessionToken({
    role: 'customer',
    tenantId: TENANT_ID,
    tenantUserId: USER_ID,
    email: 'poweruser@synthetic.invalid',
    displayName: 'Synthetic Poweruser',
  });
  viewerToken = await dashboardAuth.createTenantSessionToken({
    role: 'viewer',
    tenantId: TENANT_ID,
    tenantUserId: USER_ID,
    email: 'poweruser@synthetic.invalid',
    displayName: 'Synthetic Viewer',
  });
  harness = await createHarness();
});

test.beforeEach(() => {
  harness.db.currentPrincipal = principal();
  harness.db.sites = [{ id: SITE_ID, tenantId: TENANT_ID }];
  harness.db.queries = [];
  harness.templates.reset();
  harness.audit.calls = [];
});

test.after(async () => {
  await harness?.app.close();
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.DASHBOARD_INTERNAL_TOKEN;
});

test('requires an individual signed customer session in addition to the dashboard token', async () => {
  const path = `/customer/it-knowledge/${SITE_ID}/templates`;
  assert.equal((await fetch(`${harness.baseUrl}${path}`)).status, 401);
  assert.equal((await request(harness, path)).status, 401);
  assert.equal((await request(harness, path, { token: viewerToken })).status, 401);
  assert.equal(harness.templates.calls.length, 0);
});

test('rechecks active persisted principal, tenant membership, capability, and exact site', async () => {
  const path = `/customer/it-knowledge/${SITE_ID}/templates`;

  harness.db.currentPrincipal = principal({ is_active: false });
  assert.equal((await request(harness, path, { token: validToken })).status, 401);

  harness.db.currentPrincipal = principal({ tenant_id: 'tenant-other' });
  assert.equal((await request(harness, path, { token: validToken })).status, 401);

  harness.db.currentPrincipal = principal({ knowledge_capability: null });
  assert.equal((await request(harness, path, { token: validToken })).status, 403);

  harness.db.currentPrincipal = principal({
    knowledge_capability: null,
    operator_capability: { enabled: true, targets: [{ tenantId: TENANT_ID, siteIds: [SITE_ID] }] },
  });
  assert.equal((await request(harness, path, { token: validToken })).status, 403);

  harness.db.currentPrincipal = principal({ knowledge_capability: capability(['site-other']) });
  assert.equal((await request(harness, path, { token: validToken })).status, 404);
  assert.equal(harness.templates.calls.length, 0);
});

test('lists templates only after the production authorization service approves the site', async () => {
  const response = await request(harness, `/customer/it-knowledge/${SITE_ID}/templates`, { token: validToken });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.siteId, SITE_ID);
  assert.equal(body.providerCallsUsed, false);
  assert.equal(body.answerReadyTransitionAdded, false);
  assert.equal(harness.templates.calls[0].context.actorId, `tenant-user:${USER_ID}`);
});

test('rejects reserved and unknown import fields before any mutation or self-authorization', async () => {
  const path = `/customer/it-knowledge/${SITE_ID}/templates/import`;
  for (const body of [
    { templateKeys: ['vpn-not-connecting'], providerKey: 'synthetic-provider' },
    { templateKeys: ['vpn-not-connecting'], knowledgeManagementV1: { enabled: true, siteIds: [SITE_ID] } },
    { templateKeys: ['vpn-not-connecting'], tenantId: TENANT_ID },
  ]) {
    const response = await request(harness, path, { method: 'POST', token: validToken, body });
    assert.equal(response.status, 400);
  }
  assert.equal(harness.templates.calls.length, 0);
});

test('imports selected templates with server-derived tenant, site, and actor context', async () => {
  const response = await request(harness, `/customer/it-knowledge/${SITE_ID}/templates/import`, {
    method: 'POST',
    token: validToken,
    body: { templateKeys: ['vpn-not-connecting'], mode: 'skip_existing' },
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.providerCallsUsed, false);
  assert.equal(body.answerReadyTransitionAdded, false);
  assert.deepEqual(harness.templates.calls[0].input, {
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    templateKeys: ['vpn-not-connecting'],
    mode: 'skip_existing',
    createdBy: `tenant-user:${USER_ID}`,
  });
  assert.equal(harness.audit.calls[0].action, 'import_it_knowledge_templates');
});

test('rejects a foreign or manipulated source id without deleting another resource', async () => {
  const response = await request(
    harness,
    `/customer/it-knowledge/${SITE_ID}/templates/source-foreign`,
    { method: 'DELETE', token: validToken },
  );
  assert.equal(response.status, 404);
  assert.equal(harness.audit.calls.length, 0);
});

test('deletes an owned inactive draft and records the customer actor', async () => {
  const response = await request(
    harness,
    `/customer/it-knowledge/${SITE_ID}/templates/source-1`,
    { method: 'DELETE', token: validToken },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).providerCallsUsed, false);
  assert.deepEqual(harness.templates.calls[0].input, {
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    sourceId: 'source-1',
  });
  assert.equal(harness.audit.calls[0].actorRole, 'customer');
});
