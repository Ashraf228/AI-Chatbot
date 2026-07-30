const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveLifecycleFromLegacySyncStatus,
  deriveLegacySyncStatus,
  isKnowledgeSourceCompletionReady,
  normalizeKnowledgeSourceUrlMetadata,
  resolveKnowledgeSourceLifecycle,
  sanitizeKnowledgeSourceErrorMessage,
} = require('../dist/knowledge-sources/knowledge-source-readiness.js');

test('knowledge source lifecycle backfills ready sources as extracted, indexed, and answer-ready', () => {
  const lifecycle = deriveLifecycleFromLegacySyncStatus('ready');

  assert.deepEqual(lifecycle, {
    syncStatus: 'ready',
    ingestStatus: 'extracted',
    indexStatus: 'indexed',
    runtimeReadiness: 'ready',
  });
});

test('knowledge source lifecycle keeps extracted-only sources out of completion readiness', () => {
  const lifecycle = resolveKnowledgeSourceLifecycle({
    syncStatus: 'processing',
    ingestStatus: 'extracted',
    indexStatus: 'not_requested',
    runtimeReadiness: 'not_ready',
    isActive: true,
  });

  assert.equal(lifecycle.syncStatus, 'processing');
  assert.equal(isKnowledgeSourceCompletionReady({
    isActive: true,
    runtimeReadiness: lifecycle.runtimeReadiness,
  }), false);
});

test('knowledge source lifecycle keeps fetch-pending and fetched website sources out of completion readiness', () => {
  const pending = resolveKnowledgeSourceLifecycle({
    syncStatus: 'pending',
    ingestStatus: 'fetch_pending',
    indexStatus: 'not_requested',
    runtimeReadiness: 'not_ready',
    isActive: true,
  });
  const fetched = resolveKnowledgeSourceLifecycle({
    syncStatus: 'processing',
    ingestStatus: 'fetched',
    indexStatus: 'not_requested',
    runtimeReadiness: 'not_ready',
    isActive: true,
  });

  assert.equal(pending.syncStatus, 'pending');
  assert.equal(fetched.syncStatus, 'processing');
  assert.equal(isKnowledgeSourceCompletionReady({ isActive: true, runtimeReadiness: pending.runtimeReadiness }), false);
  assert.equal(isKnowledgeSourceCompletionReady({ isActive: true, runtimeReadiness: fetched.runtimeReadiness }), false);
});

test('knowledge source lifecycle keeps blocked sources out of ready state', () => {
  const legacyStatus = deriveLegacySyncStatus({
    ingestStatus: 'blocked',
    runtimeReadiness: 'blocked',
    isActive: true,
  });

  assert.equal(legacyStatus, 'failed');
  assert.equal(isKnowledgeSourceCompletionReady({
    isActive: true,
    runtimeReadiness: 'blocked',
  }), false);
});

test('knowledge source lifecycle keeps inactive sources out of completion even when previously indexed', () => {
  assert.equal(deriveLegacySyncStatus({
    syncStatus: 'ready',
    ingestStatus: 'extracted',
    runtimeReadiness: 'ready',
    isActive: false,
  }), 'disabled');
  assert.equal(isKnowledgeSourceCompletionReady({
    isActive: false,
    runtimeReadiness: 'ready',
  }), false);
});

test('knowledge source readiness helper normalizes source URL metadata without enabling crawling', () => {
  assert.deepEqual(
    normalizeKnowledgeSourceUrlMetadata('https://Example.com/faq'),
    {
      normalizedSourceUrl: 'https://example.com/faq',
      sourceDomain: 'example.com',
    },
  );
  assert.deepEqual(
    normalizeKnowledgeSourceUrlMetadata('not-a-valid-url'),
    {
      normalizedSourceUrl: 'not-a-valid-url',
      sourceDomain: null,
    },
  );
});

test('knowledge source readiness helper sanitizes stored ingest errors', () => {
  const message = `${'x'.repeat(1205)}  `;
  const sanitized = sanitizeKnowledgeSourceErrorMessage(message);

  assert.equal(sanitized.length, 1000);
  assert.equal(sanitizeKnowledgeSourceErrorMessage('   '), null);
});
