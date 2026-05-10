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
