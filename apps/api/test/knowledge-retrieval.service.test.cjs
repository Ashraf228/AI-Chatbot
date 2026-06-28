const test = require('node:test');
const assert = require('node:assert/strict');
const { VectorService } = require('../dist/vector/vector.service.js');
const { ChatPipelineService } = require('../dist/ai/chat-pipeline/chat-pipeline.service.js');
const { ResponseComposerService } = require('../dist/ai/chat-pipeline/response-composer.service.js');

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
  assert.match(captured.sql, /COALESCE\(ks\.sync_status, 'ready'\) = 'ready'/);
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
    { async embed() { return [0.1]; } },
    { async search() { return []; } },
    { async answer() { calls.llm += 1; return { text: 'LLM', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, model: 'm', latencyMs: 1 }; } },
    { async resolveForSite() { return { route: 'faq', reason: 'test', guide: '' }; } },
    { async buildRecommendationContextForSite() { return { products: [], collections: [], state: 'ready_to_recommend', stateGuide: '' }; } },
    { async decide() { return { action: 'normal_answer', handled: false }; } },
    conversationState,
    new ResponseComposerService(),
    { async executeTool() { return { toolName: 'noop', status: 'skipped', message: 'noop' }; } },
    { async assertWithinLimit() {} },
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
    { async embed() { return [0.1]; } },
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
    { async embed() { return [0.1]; } },
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
    { async embed() { return [0.1]; } },
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
