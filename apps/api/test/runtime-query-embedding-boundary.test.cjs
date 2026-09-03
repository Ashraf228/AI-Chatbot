const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC_ROOT = path.join(__dirname, '..', 'src');

function readSource(relativePath) {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), 'utf8');
}

test('public runtime callers only use RuntimeQueryEmbeddingService for query embeddings', async () => {
  const chatPipeline = readSource('ai/chat-pipeline/chat-pipeline.service.ts');
  const toolExecutor = readSource('tools/tool-executor.service.ts');
  const toolDispatcher = readSource('tools/tool-dispatcher.service.ts');

  assert.match(chatPipeline, /RuntimeQueryEmbeddingService/);
  assert.match(toolExecutor, /RuntimeQueryEmbeddingService/);
  assert.match(toolDispatcher, /RuntimeQueryEmbeddingService/);

  assert.doesNotMatch(chatPipeline, /\bEmbeddingService\b/);
  assert.doesNotMatch(toolExecutor, /\bEmbeddingService\b/);
  assert.doesNotMatch(toolDispatcher, /\bEmbeddingService\b/);

  assert.doesNotMatch(chatPipeline, /embedder\.embed\(/);
  assert.doesNotMatch(toolExecutor, /embedder\.embed\(/);
  assert.doesNotMatch(toolDispatcher, /embedder\.embed\(/);
});

test('site runtime boundary performs the grant lookup inside the runtime query embedding service', async () => {
  const runtimeQueryEmbedding = readSource('knowledge-sources/runtime-query-embedding.service.ts');

  assert.match(
    runtimeQueryEmbedding,
    /evaluateSiteRuntimeQueryEmbeddingApprovalFromStorage\(/,
  );
  assert.doesNotMatch(
    runtimeQueryEmbedding,
    /evaluateProviderApprovalFromStorage\(/,
  );
});

test('direct low-level embed callsites remain limited to runtime service, ingestion, and admin preview paths', async () => {
  const allowedFiles = new Set([
    'conversation-engine/knowledge-preview-retrieval.service.ts',
    'ingest/ingest.service.ts',
  ]);

  const discovered = [];
  const stack = [SRC_ROOT];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.ts')) {
        continue;
      }
      const relativePath = path.relative(SRC_ROOT, fullPath);
      const contents = fs.readFileSync(fullPath, 'utf8');
      if (/embedder\.embed\(/.test(contents)) {
        discovered.push(relativePath);
      }
    }
  }

  assert.deepEqual(discovered.sort(), Array.from(allowedFiles).sort());
});
