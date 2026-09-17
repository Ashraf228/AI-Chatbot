const test = require('node:test');
const assert = require('node:assert/strict');

const { AdminScopeService } = require('../dist/utils/admin-scope.service.js');
const { AgentSelectorService } = require('../dist/conversation-engine/agent-selector.service.js');
const { ConversationContextService } = require('../dist/conversation-engine/conversation-context.service.js');
const { ConversationEngineCompareService } = require('../dist/conversation-engine/conversation-engine-compare.service.js');
const { ConversationEngineController } = require('../dist/conversation-engine/conversation-engine.controller.js');
const { ConversationEngineService } = require('../dist/conversation-engine/conversation-engine.service.js');
const { ConversationQualityService } = require('../dist/conversation-engine/conversation-quality.service.js');
const { GoalDetectorService } = require('../dist/conversation-engine/goal-detector.service.js');
const { HandoffReadinessService } = require('../dist/conversation-engine/handoff-readiness.service.js');
const { IntentClassifierService } = require('../dist/conversation-engine/intent-classifier.service.js');
const { KnowledgePreviewRetrievalService } = require('../dist/conversation-engine/knowledge-preview-retrieval.service.js');
const { NextActionService } = require('../dist/conversation-engine/next-action.service.js');
const { ResponseDraftService } = require('../dist/conversation-engine/response-draft.service.js');
const { AssistantProfileResolverService } = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');
const { KnowledgeSourcesService } = require('../dist/knowledge-sources/knowledge-sources.service.js');
const { ProviderApprovalStorageLookupService } = require('../dist/knowledge-sources/provider-approval-storage-lookup.service.js');
const { RuntimeQueryEmbeddingService } = require('../dist/knowledge-sources/runtime-query-embedding.service.js');
const { EmbeddingService } = require('../dist/vector/embedding.service.js');
const { VectorService } = require('../dist/vector/vector.service.js');

const TENANT_ID = 'tenant-preview';
const SITE_ID = 'site-preview';
const PROMPT_MARKER = 'SYNTHETIC_ADMIN_PREVIEW_PROMPT_MARKER';
const PROVIDER_ERROR_MARKER = 'SYNTHETIC_PROVIDER_ERROR_MARKER';

function grant(overrides = {}) {
  return {
    id: 'synthetic-preview-grant',
    scope_kind: 'site_runtime',
    tenant_id: TENANT_ID,
    site_id: SITE_ID,
    source_id: null,
    source_types: [],
    usage_contexts: ['query_embedding'],
    environment: 'non_production',
    provider_key: 'openai',
    model: 'text-embedding-3-small',
    embedding_dimension: 3,
    provider_region: 'synthetic-region',
    data_categories: ['synthetic-knowledge'],
    customer_data_approved: true,
    production_approved: false,
    provider_dpa_approved: true,
    purpose: 'query_embedding',
    retention_policy: 'synthetic-retention',
    redaction_policy: 'synthetic-redaction',
    logging_policy: 'metadata_only',
    deletion_policy: 'synthetic-deletion',
    reindex_policy: null,
    rate_limit: 'synthetic-rate',
    cost_limit: 'synthetic-cost',
    valid_from: '2020-01-01T00:00:00.000Z',
    expires_at: '2099-01-01T00:00:00.000Z',
    revoked_at: null,
    approved_by: 'synthetic-owner',
    approval_evidence_ref: 'synthetic-evidence',
    ...overrides,
  };
}

function createEngine() {
  return new ConversationEngineService(
    new ConversationContextService(),
    new IntentClassifierService(),
    new GoalDetectorService(),
    new AgentSelectorService(),
    new NextActionService(),
    new HandoffReadinessService(),
    new ConversationQualityService(),
  );
}

class FakeDatabase {
  constructor({
    grantRows = [grant()],
    lookupError = false,
    ready = true,
    knowledgeCount = ready ? 1 : 0,
    siteTenant = TENANT_ID,
  } = {}) {
    this.grantRows = grantRows;
    this.lookupError = lookupError;
    this.ready = ready;
    this.knowledgeCount = knowledgeCount;
    this.siteTenant = siteTenant;
    this.events = [];
    this.grantLookups = 0;
  }

  async query(sql, params = []) {
    const statement = String(sql);
    if (statement.includes('FROM provider_approval_grants')) {
      this.grantLookups += 1;
      this.events.push({ kind: 'grant_lookup', params });
      if (this.lookupError) throw new Error('SYNTHETIC_PRIVATE_DATABASE_ERROR');
      const rows = typeof this.grantRows === 'function'
        ? this.grantRows(this.grantLookups)
        : this.grantRows;
      return { rows: rows || [] };
    }
    if (statement.includes('WITH ranked')) {
      this.events.push({ kind: 'vector_search', params });
      assert.equal(params[0], TENANT_ID);
      assert.equal(params[1], SITE_ID);
      return {
        rows: [{
          id: 'chunk-preview',
          document_id: 'document-preview',
          source_id: 'source-preview',
          source_type: 'manual',
          source_label: 'Synthetic Knowledge',
          content: 'Synthetic answer-ready content.',
          metadata: { synthetic: true },
          title: 'Synthetic Document',
          source_url: null,
          score: 0.91,
        }],
      };
    }
    if (statement.includes('SELECT 1 AS ready')) {
      this.events.push({ kind: 'ready_source_lookup', params });
      return { rows: this.ready && params[0] === TENANT_ID && params[1] === SITE_ID ? [{ ready: 1 }] : [] };
    }
    if (statement.includes('COUNT(*)::text AS count')) {
      return { rows: [{ count: String(this.knowledgeCount) }] };
    }
    if (statement.includes('SELECT id, tenant_id FROM sites')) {
      return params[0] === SITE_ID
        ? { rows: [{ id: SITE_ID, tenant_id: this.siteTenant }] }
        : { rows: [] };
    }
    throw new Error(`Unexpected synthetic query: ${statement.slice(0, 80)}`);
  }
}

function createHarness(options = {}) {
  const db = new FakeDatabase(options);
  const engine = createEngine();
  const responseDrafts = new ResponseDraftService(new ConversationQualityService());
  const runtimeEmbedding = new RuntimeQueryEmbeddingService(
    new KnowledgeSourcesService(db, {}),
    new ProviderApprovalStorageLookupService(db),
    new EmbeddingService(),
  );
  const knowledgePreview = new KnowledgePreviewRetrievalService(runtimeEmbedding, new VectorService(db));
  const controller = new ConversationEngineController(
    db,
    {
      async getSite(siteId) {
        if (siteId !== SITE_ID) return null;
        return {
          id: SITE_ID,
          tenant_id: db.siteTenant,
          config: {
            conversationEngine: {
              previewEnabled: true,
              responsePreviewEnabled: true,
              knowledgePreviewEnabled: true,
              adminTestOnly: true,
            },
          },
        };
      },
    },
    { async listForSite() { return []; } },
    new AdminScopeService(db),
    new AssistantProfileResolverService(),
    { async getDiagnostics() { return { assistantProfileDebug: { profileKey: 'universal-assistant' } }; } },
    engine,
    new ConversationEngineCompareService(engine),
    {},
    {},
    knowledgePreview,
    responseDrafts,
  );
  return { controller, db, runtimeEmbedding };
}

function previewRequest(role = 'operator', tenantId = TENANT_ID) {
  return { dashboardAuth: { role, actorId: `${role}:synthetic`, tenantId } };
}

async function withIsolatedTransport(callback, responseFactory) {
  const keys = [
    'APP_ENV',
    'NODE_ENV',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_EMBED_MODEL',
    'OPENAI_EMBED_PROVIDER',
    'OPENAI_LOG',
  ];
  const previousEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const methods = ['debug', 'info', 'warn', 'error'];
  const originalConsole = Object.fromEntries(methods.map((method) => [method, console[method]]));
  const requests = [];
  const logs = [];
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'synthetic-local-preview-key';
    process.env.OPENAI_EMBED_PROVIDER = 'openai';
    process.env.OPENAI_EMBED_MODEL = 'text-embedding-3-small';
    process.env.OPENAI_LOG = 'debug';
    for (const method of methods) console[method] = (...args) => logs.push({ method, args });
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      const bodyText = typeof init?.body === 'string'
        ? init.body
        : input instanceof Request
          ? await input.clone().text()
          : '';
      requests.push({ url, body: bodyText ? JSON.parse(bodyText) : null, redirect: init?.redirect });
      return responseFactory
        ? responseFactory(requests.length)
        : new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    };
    return await callback({ requests, logs });
  } finally {
    globalThis.fetch = originalFetch;
    for (const method of methods) console[method] = originalConsole[method];
    for (const key of keys) {
      if (previousEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnvironment[key];
    }
  }
}

async function runPreview(harness, request = previewRequest()) {
  return harness.controller.responsePreview(
    SITE_ID,
    { message: PROMPT_MARKER, includeKnowledge: true },
    request,
  );
}

test('actual admin preview path performs an exact stored grant lookup immediately before one SDK transport', async () => {
  let harness;
  await withIsolatedTransport(async ({ requests, logs }) => {
    harness = createHarness();
    const result = await runPreview(harness);

    assert.equal(result.knowledgeRetrieval.status, 'available');
    assert.equal(result.knowledgeRetrieval.snippets.length, 1);
    assert.equal(harness.db.grantLookups, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.openai.com/v1/embeddings');
    assert.equal(requests[0].redirect, 'error');
    assert.equal(requests[0].body.model, 'text-embedding-3-small');
    assert.match(requests[0].body.input, new RegExp(PROMPT_MARKER));
    assert.deepEqual(
      harness.db.events.slice(-3).map((event) => event.kind),
      ['grant_lookup', 'provider_transport', 'vector_search'],
    );
    assert.deepEqual(logs, []);
  }, () => {
    assert.equal(harness.db.events.at(-1)?.kind, 'grant_lookup');
    harness.db.events.push({ kind: 'provider_transport' });
    return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
});

const deniedGrants = [
  ['missing grant', { grantRows: [] }],
  ['expired grant', { grantRows: [grant({ expires_at: '2001-01-01T00:00:00.000Z' })] }],
  ['revoked grant', { grantRows: [grant({ revoked_at: '2021-01-01T00:00:00.000Z' })] }],
  ['foreign tenant grant', { grantRows: [grant({ tenant_id: 'tenant-foreign' })] }],
  ['foreign site grant', { grantRows: [grant({ site_id: 'site-foreign' })] }],
  ['wrong purpose grant', { grantRows: [grant({ purpose: 'llm_generation', usage_contexts: ['llm_generation'] })] }],
  ['wrong usage grant', { grantRows: [grant({ usage_contexts: ['llm_generation'] })] }],
  ['wrong scope grant', {
    grantRows: [grant({ scope_kind: 'source', source_id: 'source-preview', source_types: ['manual'] })],
  }],
  ['wrong provider grant', { grantRows: [grant({ provider_key: 'provider-foreign' })] }],
  ['wrong model grant', { grantRows: [grant({ model: 'model-foreign' })] }],
  ['wrong environment grant', { grantRows: [grant({ environment: 'production', production_approved: true })] }],
  ['lookup failure', { lookupError: true }],
];

for (const [name, options] of deniedGrants) {
  test(`${name} returns the stable preview error with zero provider transports`, async () => {
    await withIsolatedTransport(async ({ requests, logs }) => {
      const harness = createHarness(options);
      const result = await runPreview(harness);

      assert.equal(result.knowledgeRetrieval.status, 'error');
      assert.equal(requests.length, 0);
      assert.deepEqual(logs, []);
      const responseText = JSON.stringify(result.knowledgeRetrieval);
      assert.doesNotMatch(responseText, /provider_approval|grant|tenant-preview|site-preview/i);
    });
  });
}

test('the actual SDK wrapper preserves the typed runtime denial without transport', async () => {
  await withIsolatedTransport(async ({ requests }) => {
    const harness = createHarness({ grantRows: [] });
    const result = await harness.runtimeEmbedding.embedAuthorizedQuery({
      tenantId: TENANT_ID,
      siteId: SITE_ID,
      query: PROMPT_MARKER,
    });

    assert.equal(result.kind, 'denied');
    assert.equal(result.decisionCode, 'missing_policy');
    assert.equal(requests.length, 0);
  });
});

test('admin role does not replace a provider grant', async () => {
  await withIsolatedTransport(async ({ requests }) => {
    const harness = createHarness({ grantRows: [] });
    const result = await runPreview(harness, previewRequest('admin', null));
    assert.equal(result.knowledgeRetrieval.status, 'error');
    assert.equal(requests.length, 0);
  });
});

test('server-side site authorization blocks a foreign operator before source or grant work', async () => {
  await withIsolatedTransport(async ({ requests }) => {
    const harness = createHarness({ siteTenant: 'tenant-foreign' });
    await assert.rejects(runPreview(harness), { message: 'Forbidden' });
    assert.equal(harness.db.grantLookups, 0);
    assert.equal(requests.length, 0);
  });
});

test('no answer-ready source skips grant lookup and transport while preserving readiness semantics', async () => {
  await withIsolatedTransport(async ({ requests }) => {
    const harness = createHarness({ ready: false, knowledgeCount: 1 });
    const result = await runPreview(harness);
    assert.equal(result.knowledgeRetrieval.status, 'empty');
    assert.equal(harness.db.grantLookups, 0);
    assert.equal(requests.length, 0);
  });
});

test('SDK retry is disabled and provider details remain out of the preview response and logs', async () => {
  await withIsolatedTransport(async ({ requests, logs }) => {
    const harness = createHarness();
    const result = await runPreview(harness);
    assert.equal(result.knowledgeRetrieval.status, 'error');
    assert.equal(harness.db.grantLookups, 1);
    assert.equal(requests.length, 1);
    assert.deepEqual(logs, []);
    const visible = JSON.stringify(result);
    assert.doesNotMatch(visible, new RegExp(`${PROMPT_MARKER}|${PROVIDER_ERROR_MARKER}`));
  }, () => new Response(JSON.stringify({ error: { message: PROVIDER_ERROR_MARKER } }), {
    status: 500,
    headers: { 'content-type': 'application/json', 'retry-after-ms': '0' },
  }));
});

test('a later caller attempt performs a fresh lookup and a revoked grant prevents another transport', async () => {
  await withIsolatedTransport(async ({ requests }) => {
    const harness = createHarness({
      grantRows: (attempt) => [grant(attempt > 1 ? { revoked_at: '2021-01-01T00:00:00.000Z' } : {})],
    });
    assert.equal((await runPreview(harness)).knowledgeRetrieval.status, 'available');
    assert.equal((await runPreview(harness)).knowledgeRetrieval.status, 'error');
    assert.equal(harness.db.grantLookups, 2);
    assert.equal(requests.length, 1);
  });
});

test('invalid runtime configuration fails before grant lookup or provider transport', async () => {
  await withIsolatedTransport(async ({ requests }) => {
    process.env.OPENAI_BASE_URL = 'https://invalid.local/v1';
    const harness = createHarness();
    const result = await runPreview(harness);
    assert.equal(result.knowledgeRetrieval.status, 'error');
    assert.equal(harness.db.grantLookups, 0);
    assert.equal(requests.length, 0);
  });
});
