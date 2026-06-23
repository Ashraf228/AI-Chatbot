const test = require('node:test');
const assert = require('node:assert/strict');

async function loadTools() {
  return import('../../../scripts/demo/evaluation-demo-tools.mjs');
}

const baseEnv = {
  DEMO_PARTNER_DISPLAY_NAME: 'Demo Partner',
  DEMO_WORKSPACE_TITLE: 'Evaluation Workspace',
  DEMO_TENANT_SLUG: 'demo-tenant',
  DEMO_TENANT_DISPLAY_NAME: 'Demo Tenant',
  DEMO_SITE_SLUG: 'demo-site',
  DEMO_SITE_DISPLAY_NAME: 'Demo Site',
  DEMO_VIEWER_EMAIL: 'viewer@example.test',
  DEMO_VIEWER_DISPLAY_NAME: 'Demo Viewer',
  DEMO_VIEWER_PASSWORD: 'long-demo-password',
  DEMO_VIEWER_EXPIRES_AT: '2099-01-01T00:00:00.000Z',
  DEMO_ALLOWED_ORIGIN: 'https://demo.example.test',
  DEMO_PRIVACY_URL: 'https://demo.example.test/privacy?tracking=removed#section',
};

function createFakeDb() {
  const state = {
    tenant: false,
    site: false,
    viewer: false,
    sourceIds: new Set(),
    transactionCount: 0,
    queries: [],
  };
  const query = async (sql, params = []) => {
    state.queries.push({ sql, params });
    if (/FROM tenants WHERE id = \$1 LIMIT 1/i.test(sql)) {
      return { rows: state.tenant ? [{ id: params[0] }] : [] };
    }
    if (/FROM sites WHERE id = \$1 OR site_key = \$1 LIMIT 1/i.test(sql)) {
      return { rows: state.site ? [{ id: params[0], tenant_id: 'demo-tenant', is_evaluation_demo: true }] : [] };
    }
    if (/FROM tenant_users WHERE tenant_id = \$1 AND lower\(email\) = \$2/i.test(sql)) {
      return { rows: state.viewer ? [{ id: 'viewer-1', tenant_id: params[0], role: 'viewer', evaluation_site_id: 'demo-site' }] : [] };
    }
    if (/FROM tenant_users WHERE tenant_id <> \$1 AND lower\(email\) = \$2/i.test(sql)) {
      return { rows: [] };
    }
    if (/SELECT id, tenant_id, is_evaluation_demo FROM sites WHERE id = \$1 LIMIT 1/i.test(sql)) {
      return { rows: [{ id: params[0], tenant_id: 'demo-tenant', is_evaluation_demo: true }] };
    }
    if (/INSERT INTO tenants/i.test(sql)) {
      state.tenant = true;
      return { rows: [] };
    }
    if (/INSERT INTO sites/i.test(sql)) {
      state.site = true;
      return { rows: [] };
    }
    if (/INSERT INTO tenant_users|UPDATE tenant_users/i.test(sql)) {
      state.viewer = true;
      return { rows: [] };
    }
    if (/INSERT INTO knowledge_sources/i.test(sql)) {
      state.sourceIds.add(params[0]);
      return { rows: [] };
    }
    return { rows: [] };
  };
  return {
    state,
    async query(sql, params) {
      return query(sql, params);
    },
    async transaction(callback) {
      state.transactionCount += 1;
      return callback({ query });
    },
  };
}

test('demo provisioning config validates safe public inputs and masks viewer email', async () => {
  const { loadConfig, summarizePlan } = await loadTools();
  const config = loadConfig(baseEnv, { allowLongExpiry: true });

  assert.equal(config.allowedOrigin, 'https://demo.example.test');
  assert.equal(config.privacyUrl, 'https://demo.example.test/privacy');
  assert.equal(config.viewerEmail, 'viewer@example.test');
  assert.equal(summarizePlan(config).viewerEmail, 'vi***@example.test');
  assert.equal(JSON.stringify(summarizePlan(config)).includes('long-demo-password'), false);
});

test('demo provisioning rejects missing password and unsafe origin credentials', async () => {
  const { loadConfig } = await loadTools();
  assert.throws(() => loadConfig({ ...baseEnv, DEMO_VIEWER_PASSWORD: '' }, { allowLongExpiry: true }), /DEMO_VIEWER_PASSWORD/);
  assert.throws(() => loadConfig({ ...baseEnv, DEMO_ALLOWED_ORIGIN: 'https://user:pass@example.test' }, { allowLongExpiry: true }), /credentials/);
});

test('demo provisioning is dry-run by default and execute requires embedding ingestion', async () => {
  const { loadConfig, provisionEvaluationDemo } = await loadTools();
  const config = loadConfig(baseEnv, { allowLongExpiry: true });
  const db = createFakeDb();

  const dryRun = await provisionEvaluationDemo(db, config, {});
  assert.equal(dryRun.dryRun, true);
  assert.equal(db.state.transactionCount, 0);

  await assert.rejects(
    () => provisionEvaluationDemo(db, config, { execute: true }),
    /ingestion callback/,
  );
});

test('demo provisioning execute ingests every synthetic article and remains idempotent', async () => {
  const { DEMO_ARTICLES } = await import('../../../scripts/demo/evaluation-demo-content.mjs');
  const { loadConfig, provisionEvaluationDemo } = await loadTools();
  const config = loadConfig(baseEnv, { allowLongExpiry: true });
  const db = createFakeDb();
  const ingested = [];
  const ingestDemoArticle = async (input) => {
    ingested.push(input);
    assert.equal(input.tenantId, 'demo-tenant');
    assert.equal(input.siteId, 'demo-site');
    assert.equal(input.metadata.demo, true);
    assert.equal(input.metadata.synthetic, true);
    return { chunks: 1, inserted: 1 };
  };

  const first = await provisionEvaluationDemo(db, config, { execute: true, ingestDemoArticle });
  const second = await provisionEvaluationDemo(db, config, { execute: true, ingestDemoArticle });

  assert.equal(first.counts.sources, DEMO_ARTICLES.length);
  assert.equal(first.counts.chunks, DEMO_ARTICLES.length);
  assert.equal(second.counts.tenants, 0);
  assert.equal(second.counts.sites, 0);
  assert.equal(second.counts.viewers, 0);
  assert.equal(db.state.sourceIds.size, DEMO_ARTICLES.length);
  assert.equal(ingested.length, DEMO_ARTICLES.length * 2);
});

test('demo reset requires site confirmation and deletes only evaluation chat data', async () => {
  const { loadConfig, resetEvaluationDemo } = await loadTools();
  const config = loadConfig(baseEnv, { allowLongExpiry: true, requirePassword: false });
  const deletedSql = [];
  const db = {
    async query(sql) {
      if (/FROM sites/i.test(sql)) return { rows: [{ id: 'demo-site', tenant_id: 'demo-tenant', is_evaluation_demo: true }] };
      if (/SELECT\s+\(SELECT count/i.test(sql)) return { rows: [{ sessions: 1, conversations: 1, messages: 2 }] };
      return { rows: [] };
    },
    async transaction(callback) {
      return callback({
        async query(sql) {
          if (/^DELETE/i.test(sql.trim())) deletedSql.push(sql);
          if (/SELECT id FROM conversations/i.test(sql)) return { rows: [{ id: 'conversation-1' }] };
          return { rows: [] };
        },
      });
    },
  };

  await assert.rejects(() => resetEvaluationDemo(db, config, { execute: true, confirm: 'wrong-site' }), /confirmation/);
  const result = await resetEvaluationDemo(db, config, { execute: true, confirm: 'demo-site' });
  assert.equal(result.dryRun, false);
  assert.equal(deletedSql.some((sql) => /knowledge_sources|sites|tenant_users/i.test(sql)), false);
  assert.equal(deletedSql.some((sql) => /evaluation_chat_sessions/i.test(sql)), true);
});
