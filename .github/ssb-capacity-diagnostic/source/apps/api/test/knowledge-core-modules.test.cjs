const test = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { PrismaService } = require('../dist/db/prisma.service');
const { RateLimitService } = require('../dist/utils/rate-limit.service');
const { ChatPipelineModule } = require('../dist/ai/chat-pipeline/chat-pipeline.module');
const { IngestModule } = require('../dist/ingest/ingest.module');
const { KnowledgeConversationService } = require('../dist/ai/chat-pipeline/knowledge-conversation.service');
const { WebsiteKnowledgeIndexService } = require('../dist/ingest/website-knowledge-index.service');

test('Nest resolves both production modules with real providers and without starting runtime hooks', async (t) => {
  const module = await Test.createTestingModule({ imports: [ChatPipelineModule, IngestModule] })
    .overrideProvider(PrismaService).useValue({ async query(){ assert.fail('No database call expected during compilation'); } })
    .overrideProvider(RateLimitService).useValue({ async allow(){ return {allowed:true}; } })
    .compile();
  t.after(() => module.close());
  assert.ok(module.get(KnowledgeConversationService));
  assert.ok(module.get(WebsiteKnowledgeIndexService));
});
