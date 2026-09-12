const test = require('node:test');
const assert = require('node:assert/strict');
const { VectorService } = require('../dist/vector/vector.service.js');
const { ChatPipelineService } = require('../dist/ai/chat-pipeline/chat-pipeline.service.js');
const { ResponseComposerService } = require('../dist/ai/chat-pipeline/response-composer.service.js');

function allowQueryEmbeddingAuthorization(overrides = {}) {
  return {
    async embedAuthorizedQuery() {
      return {
        kind: 'embedded',
        decisionCode: 'allowed',
        reason: 'runtime_query_embedding_authorized',
        sanitizedMessage: 'ok',
        embedding: [0.1],
        environment: 'non_production',
        providerKey: 'openai',
        model: 'text-embedding-3-small',
        ...overrides,
      };
    },
  };
}

test('VectorService.search filters active ready knowledge sources and scopes tenant/site', async () => {
  let captured = null;
  const db = {
    async query(sql, params) {
      captured = { sql, params };
      return {
        rows: [
          {
            id: 'chunk-1',
            document_id: 'doc-1',
            source_id: 'source-1',
            source_type: 'faq',
            source_label: 'FAQ',
            content: 'Antwort',
            metadata: {},
            title: 'FAQ',
            source_url: 'https://example.com',
            score: 0.91,
          },
        ],
      };
    },
  };
  const service = new VectorService(db);

  const rows = await service.search('tenant-1', 'site-1', [0.1, 0.2], 3, 0.7);

  assert.equal(rows.length, 1);
  assert.match(captured.sql, /COALESCE\(ks\.is_active, true\) = true/);
  assert.match(captured.sql, /COALESCE\(ks\.runtime_readiness, 'ready'\) = 'ready'/);
  assert.deepEqual(captured.params.slice(0, 2), ['tenant-1', 'site-1']);
  assert.equal(captured.params[4], 0.7);
});

test('VectorService.upsertChunk removes null bytes before storing chunk text and metadata', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [] };
    },
  };
  const service = new VectorService(db);

  await service.upsertChunk({
    id: 'chunk-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    documentId: 'doc-1',
    content: 'PDF\u0000Text',
    metadata: {
      filename: 'datei\u0000.pdf',
      nested: {
        value: 'A\u0000B',
      },
    },
    contentHash: 'hash-1',
    embedding: [0.1, 0.2],
  });

  const insert = queries.find((query) => /INSERT INTO chunks/i.test(query.sql));
  assert.ok(insert);
  assert.equal(insert.params[4], 'PDFText');
  assert.equal(insert.params[5].filename, 'datei.pdf');
  assert.equal(insert.params[5].nested.value, 'AB');
});

test('ChatPipeline strict knowledgeMode returns safe answer without LLM when retrieval is empty', async () => {
  const calls = { llm: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    { async search() { return []; } },
    { async answer() { calls.llm += 1; return { text: 'LLM', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, model: 'm', latencyMs: 1 }; } },
    { async resolveForSite() { return { route: 'faq', reason: 'test', guide: '' }; } },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    allowQueryEmbeddingAuthorization(),
  );

  const result = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Was steht im Wissen?',
    siteConfig: { knowledgeMode: 'strict' },
  });

  assert.equal(calls.llm, 0);
  assert.match(result.answer, /keine passende Information/i);
});

test('ChatPipeline blocks widget and api retrieval with the same provider-authorization boundary and without internal details', async () => {
  const calls = { llm: 0, authorization: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    { async search() { return []; } },
    {
      async answer() {
        calls.llm += 1;
        return {
          text: 'LLM',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'm',
          latencyMs: 1,
        };
      },
    },
    { async resolveForSite() { return { route: 'faq', reason: 'test', guide: '' }; } },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    {
      async embedAuthorizedQuery() {
        calls.authorization += 1;
        return {
          kind: 'denied',
          decisionCode: 'missing_policy',
          reason: 'provider_approval_storage_grant_missing',
          sanitizedMessage: 'blocked',
          environment: 'non_production',
          providerKey: 'openai',
          model: 'text-embedding-3-small',
        };
      },
    },
  );

  const widgetResult = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Mein VPN geht nicht',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  const apiResult = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-2',
    source: 'api',
    message: 'Mein VPN geht nicht',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  assert.equal(calls.authorization, 2);
  assert.equal(calls.llm, 0);
  assert.equal(widgetResult.sources.length, 0);
  assert.equal(apiResult.sources.length, 0);
  assert.match(widgetResult.answer, /nicht sicher/i);
  assert.match(apiResult.answer, /nicht sicher/i);
  assert.doesNotMatch(widgetResult.answer, /grant|policy|provider|openai/i);
  assert.doesNotMatch(apiResult.answer, /grant|policy|provider|openai/i);
});

test('ChatPipeline evaluation mode bypasses general agent orchestrator and keeps retrieval sources', async () => {
  const calls = { agent: 0, llm: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    {
      async search(_tenantId, _siteId, _embedding, _k, _minScore, options) {
        assert.equal(options.demoOnly, true);
        return [
          {
            id: 'chunk-1',
            document_id: 'doc-1',
            source_id: 'source-1',
            source_type: 'demo',
            source_label: 'Reisepass beantragen',
            content: 'Synthetischer Demo-Kontext zum Reisepass.',
            metadata: { demo: true, synthetic: true },
            title: 'Reisepass beantragen',
            source_url: null,
            score: 0.91,
          },
        ];
      },
    },
    {
      async answer() {
        calls.llm += 1;
        return {
          text: 'Antwort aus Demo-Wissen.',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'm',
          latencyMs: 1,
        };
      },
    },
    { async resolveForSite() { return { route: 'faq', reason: 'test', guide: '' }; } },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    {
      async decide() {
        calls.agent += 1;
        return {
          action: 'warn_sensitive_data',
          handled: true,
          answer: 'Agent-Antwort ohne Quellen.',
          decision: {
            type: 'answer_question',
            confidence: 1,
            suggestedTools: [],
            requiredFields: [],
            collectedFields: {},
            metadata: {},
          },
        };
      },
    },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    allowQueryEmbeddingAuthorization(),
  );

  const result = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'dashboard',
    message: 'Ich brauche einen neuen Reisepass.',
    siteConfig: { knowledgeMode: 'flexible' },
    evaluationMode: true,
  });

  assert.equal(calls.agent, 0);
  assert.equal(calls.llm, 1);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].title, 'Reisepass beantragen');
});

test('ChatPipeline adds IT support answer guidance to routed prompt', async () => {
  const calls = { systemPrompt: '' };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    { async search() { return []; } },
    {
      async answer(systemPrompt) {
        calls.systemPrompt = systemPrompt;
        return {
          text: 'Allgemeine sichere Schritte. Hat das geholfen? Falls nicht, kann ich ein Support-Ticket öffnen.',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'm',
          latencyMs: 1,
        };
      },
    },
    {
      async resolveForSite() {
        return {
          route: 'agent',
          reason: 'it_support_intent',
          moduleKey: 'it-support',
          agentKey: 'it-support-agent',
          guide: 'Routing-Hinweis: IT-Support.',
        };
      },
    },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    allowQueryEmbeddingAuthorization(),
  );

  await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Mein VPN geht nicht',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  assert.match(calls.systemPrompt, /IT-First-Level-Support/i);
  assert.match(calls.systemPrompt, /keine passende Wissensbasis/i);
  assert.match(calls.systemPrompt, /Hat das geholfen/i);
  assert.match(calls.systemPrompt, /Passwörtern|Passwoertern/i);
  assert.match(calls.systemPrompt, /MFA-Codes/i);
});

test('ChatPipeline advisor route returns safe product fallback without catalog or knowledge', async () => {
  const calls = { llm: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    { async search() { return []; } },
    { async answer() { calls.llm += 1; return { text: 'LLM', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, model: 'm', latencyMs: 1 }; } },
    { async resolveForSite() { return { route: 'advisor', reason: 'ecommerce_product_intent', guide: '' }; } },
    {
      async buildRecommendationContextForSite() {
        return {
          products: [],
          collections: [],
          state: 'broad_search',
          stateGuide: 'Advisor-Zustand: broad_search.',
          clarificationQuestion: 'Dazu habe ich aktuell keine verifizierten Produktdaten gefunden.',
        };
      },
    },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    allowQueryEmbeddingAuthorization(),
  );

  const result = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Was kostet der Premium Hoodie?',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  assert.equal(calls.llm, 0);
  assert.match(result.answer, /keine verifizierten Produktdaten/i);
});

test('ChatPipeline allows multiple active answer-ready source types with a single embedding call', async () => {
  const calls = { embed: 0, search: 0, llm: 0, authorization: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    {
      async search() {
        calls.search += 1;
        return [
          {
            id: 'chunk-1',
            document_id: 'doc-1',
            source_id: 'source-1',
            source_type: 'faq',
            source_label: 'FAQ',
            content: 'VPN-Hinweis',
            metadata: {},
            title: 'VPN FAQ',
            source_url: null,
            score: 0.91,
          },
        ];
      },
    },
    {
      async answer() {
        calls.llm += 1;
        return {
          text: 'Nutze den VPN-Hinweis aus dem freigegebenen Wissen.',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'm',
          latencyMs: 1,
        };
      },
    },
    { async resolveForSite() { return { route: 'faq', reason: 'test', guide: '' }; } },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    {
      async embedAuthorizedQuery() {
        calls.authorization += 1;
        calls.embed += 1;
        return {
          kind: 'embedded',
          decisionCode: 'allowed',
          reason: 'runtime_query_embedding_authorized',
          sanitizedMessage: 'ok',
          embedding: [0.1],
          environment: 'non_production',
          providerKey: 'openai',
          model: 'text-embedding-3-small',
        };
      },
    },
  );

  const result = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Mein VPN geht nicht',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  assert.equal(calls.authorization, 1);
  assert.equal(calls.embed, 1);
  assert.equal(calls.search, 1);
  assert.equal(calls.llm, 1);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].title, 'FAQ');
});

test('ChatPipeline fails closed when only one of multiple active answer-ready source types lacks a grant', async () => {
  const calls = { search: 0, llm: 0, authorization: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    {
      async search() {
        calls.search += 1;
        return [];
      },
    },
    {
      async answer() {
        calls.llm += 1;
        return {
          text: 'LLM',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'm',
          latencyMs: 1,
        };
      },
    },
    { async resolveForSite() { return { route: 'faq', reason: 'test', guide: '' }; } },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    {
      async embedAuthorizedQuery() {
        calls.authorization += 1;
        return {
          kind: 'denied',
          decisionCode: 'missing_policy',
          reason: 'provider_approval_storage_grant_missing',
          sanitizedMessage: 'blocked',
          environment: 'non_production',
          providerKey: 'openai',
          model: 'text-embedding-3-small',
        };
      },
    },
  );

  const result = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Mein VPN geht nicht',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  assert.equal(calls.authorization, 1);
  assert.equal(calls.search, 0);
  assert.equal(calls.llm, 0);
  assert.equal(result.sources.length, 0);
  assert.match(result.answer, /nicht sicher/i);
  assert.doesNotMatch(result.answer, /grant|policy|provider|openai|debug/i);
});

test('ChatPipeline no_ready_sources avoids embedding and LLM calls and returns a controlled public answer', async () => {
  const calls = { search: 0, llm: 0, authorization: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    {
      async search() {
        calls.search += 1;
        return [];
      },
    },
    {
      async answer() {
        calls.llm += 1;
        return {
          text: 'LLM',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'm',
          latencyMs: 1,
        };
      },
    },
    { async resolveForSite() { return { route: 'faq', reason: 'test', guide: '' }; } },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    {
      async embedAuthorizedQuery() {
        calls.authorization += 1;
        return {
          kind: 'no_ready_sources',
          decisionCode: 'no_ready_sources',
          reason: 'no_answer_ready_sources',
          sanitizedMessage: 'Keine answer-ready Wissensquellen aktiv.',
          environment: 'non_production',
          providerKey: 'openai',
          model: 'text-embedding-3-small',
        };
      },
    },
  );

  const result = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Mein VPN geht nicht',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  assert.equal(calls.authorization, 1);
  assert.equal(calls.search, 0);
  assert.equal(calls.llm, 0);
  assert.equal(result.sources.length, 0);
  assert.doesNotMatch(result.answer, /grant|policy|provider|openai|debug/i);
  assert.match(result.answer, /keine passende Information|nicht sicher|nicht verfuegbar/i);
});

test('ChatPipeline advisor route keeps catalog-backed behavior when knowledge retrieval reports no_ready_sources', async () => {
  const calls = { search: 0, llm: 0, authorization: 0 };
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const pipeline = new ChatPipelineService(
    db,
    {
      async search() {
        calls.search += 1;
        return [];
      },
    },
    {
      async answer() {
        calls.llm += 1;
        return {
          text: 'Der Premium Hoodie ist verfuegbar.',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'm',
          latencyMs: 1,
        };
      },
    },
    { async resolveForSite() { return { route: 'advisor', reason: 'catalog', guide: '' }; } },
    {
      async buildRecommendationContextForSite() {
        return {
          products: [
            {
              title: 'Premium Hoodie',
              url: 'https://shop.example/products/premium-hoodie',
              vendor: 'Demo',
              productType: 'Hoodie',
              priceMin: '59.00',
              priceMax: '59.00',
              currencyCode: 'EUR',
              availableForSale: true,
              variants: [],
              variantSummary: 'Standard',
            },
          ],
          collections: [],
          state: 'ready_to_recommend',
          stateGuide: 'catalog ready',
        };
      },
    },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
    {
      async embedAuthorizedQuery() {
        calls.authorization += 1;
        return {
          kind: 'no_ready_sources',
          decisionCode: 'no_ready_sources',
          reason: 'no_answer_ready_sources',
          sanitizedMessage: 'Keine answer-ready Wissensquellen aktiv.',
          environment: 'non_production',
          providerKey: 'openai',
          model: 'text-embedding-3-small',
        };
      },
    },
  );

  const result = await pipeline.process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Was kostet der Premium Hoodie?',
    siteConfig: { knowledgeMode: 'flexible' },
  });

  assert.equal(calls.authorization, 1);
  assert.equal(calls.search, 0);
  assert.equal(calls.llm, 1);
  assert.match(result.answer, /Premium Hoodie/i);
});
