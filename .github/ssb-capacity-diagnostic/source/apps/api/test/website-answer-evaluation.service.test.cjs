const test = require('node:test');
const assert = require('node:assert/strict');
const { WebsiteAnswerEvaluationService } = require('../dist/knowledge-sources/website-answer-evaluation.service.js');

function createSource(overrides = {}) {
  return {
    id: 'source-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    type: 'url',
    title: 'Website Quelle',
    label: 'Website Quelle',
    normalizedSourceUrl: 'https://example.com/faq',
    sourceUrl: 'https://example.com/faq',
    sourceDomain: 'example.com',
    runtimeReadiness: 'ready',
    indexStatus: 'indexed',
    isActive: true,
    ...overrides,
  };
}

function createVectorRow(overrides = {}) {
  return {
    id: 'chunk-1',
    document_id: 'doc-1',
    source_id: 'source-1',
    source_type: 'url',
    source_label: 'Website Quelle',
    content: 'Die Oeffnungszeiten sind Montag bis Freitag von 09 bis 17 Uhr.',
    metadata: { website: true, synthetic: true },
    title: 'Website Quelle',
    source_url: 'https://example.com/faq',
    score: 0.97,
    ...overrides,
  };
}

function createMockAdapter(overrides = {}) {
  const calls = [];
  return {
    calls,
    adapter: {
      mode: 'mock',
      label: 'website-answer-mock',
      async answer(input) {
        calls.push(input);
        return {
          decision: 'answered',
          answerText: `Antwort: ${input.contexts[0]}`,
          usedSourceId: input.sourceId,
          warnings: [],
        };
      },
      ...overrides,
    },
  };
}

function createServiceContext(overrides = {}) {
  const vectorCalls = [];
  const vector = {
    async search(tenantId, siteId, embedding, k) {
      vectorCalls.push({ tenantId, siteId, embedding, k });
      return overrides.vectorRows || [createVectorRow()];
    },
  };
  const knowledgeSources = {
    async getById() {
      return overrides.source ?? createSource();
    },
  };
  return {
    vectorCalls,
    service: new WebsiteAnswerEvaluationService(vector, knowledgeSources),
  };
}

function createInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    question: 'Wann ist geoeffnet?',
    expectedAnswerHints: ['09 bis 17 Uhr'],
    expectedSourceId: 'source-1',
    expectedUrl: 'https://example.com/faq',
    expectedTitle: 'Website Quelle',
    expectedDomain: 'example.com',
    evaluationMode: 'mock',
    queryEmbedding: [0.1, 0.2, 0.3],
    ...overrides,
  };
}

test('WebsiteAnswerEvaluationService blocks missing source scope before retrieval or adapter calls', async () => {
  const { service, vectorCalls } = createServiceContext();
  const { adapter, calls } = createMockAdapter();

  const result = await service.evaluateWebsiteAnswer(
    createInput({
      sourceId: 'source-1',
      expectedSourceId: 'source-2',
      answerAdapter: adapter,
    }),
  );

  assert.equal(result.answered, false);
  assert.equal(result.decisionCode, 'source_scope_mismatch');
  assert.equal(vectorCalls.length, 0);
  assert.equal(calls.length, 0);
});

test('WebsiteAnswerEvaluationService blocks non-ready website sources and never calls retrieval or adapter', async () => {
  for (const source of [
    createSource({ runtimeReadiness: 'not_ready', indexStatus: 'indexed' }),
    createSource({ runtimeReadiness: 'ready', indexStatus: 'pending' }),
    createSource({ runtimeReadiness: 'blocked', indexStatus: 'blocked' }),
    createSource({ runtimeReadiness: 'failed', indexStatus: 'failed' }),
  ]) {
    const { service, vectorCalls } = createServiceContext({ source });
    const { adapter, calls } = createMockAdapter();

    const result = await service.evaluateWebsiteAnswer(
      createInput({ answerAdapter: adapter }),
    );

    assert.equal(result.answered, false);
    assert.match(result.decisionCode, /source_not_ready|source_not_indexed/);
    assert.equal(vectorCalls.length, 0);
    assert.equal(calls.length, 0);
  }
});

test('WebsiteAnswerEvaluationService blocks tenant and site mismatches before retrieval', async () => {
  for (const input of [
    createInput({ tenantId: 'tenant-x' }),
    createInput({ siteId: 'site-x' }),
  ]) {
    const { service, vectorCalls } = createServiceContext();
    const { adapter, calls } = createMockAdapter();

    const result = await service.evaluateWebsiteAnswer({
      ...input,
      answerAdapter: adapter,
    });

      assert.equal(result.answered, false);
      assert.match(result.decisionCode, /tenant_mismatch|site_mismatch/);
      assert.equal(result.sourceId, null);
      assert.equal(result.sourceUrl, null);
      assert.equal(result.sourceTitle, null);
      assert.equal(result.sourceDomain, null);
      assert.equal(vectorCalls.length, 0);
      assert.equal(calls.length, 0);
  }
});

test('WebsiteAnswerEvaluationService blocks retrieval-empty answers and never calls adapter', async () => {
  const { service, vectorCalls } = createServiceContext({ vectorRows: [] });
  const { adapter, calls } = createMockAdapter();

  const result = await service.evaluateWebsiteAnswer(
    createInput({ answerAdapter: adapter }),
  );

  assert.equal(result.answered, false);
  assert.equal(result.decisionCode, 'retrieval_empty');
  assert.equal(result.sourceId, null);
  assert.equal(result.sourceUrl, null);
  assert.equal(result.sourceTitle, null);
  assert.equal(result.sourceDomain, null);
  assert.equal(vectorCalls.length, 1);
  assert.equal(calls.length, 0);
});

test('WebsiteAnswerEvaluationService blocks cross-tenant or foreign source retrieval before answer generation', async () => {
  const { service, vectorCalls } = createServiceContext({
    vectorRows: [
      createVectorRow({
        source_id: 'source-foreign',
        title: 'Fremde Quelle',
        source_label: 'Fremde Quelle',
        source_url: 'https://foreign.example',
      }),
    ],
  });
  const { adapter, calls } = createMockAdapter();

  const result = await service.evaluateWebsiteAnswer(
    createInput({ answerAdapter: adapter }),
  );

  assert.equal(result.answered, false);
  assert.equal(result.decisionCode, 'source_attribution_not_verified');
  assert.equal(result.sourceId, null);
  assert.equal(result.sourceUrl, null);
  assert.equal(result.sourceTitle, null);
  assert.equal(result.sourceDomain, null);
  assert.equal(vectorCalls.length, 1);
  assert.equal(calls.length, 0);
});

test('WebsiteAnswerEvaluationService answers with verified source attribution using retrieved context only', async () => {
  const { service, vectorCalls } = createServiceContext({
    vectorRows: [
      createVectorRow(),
      createVectorRow({
        id: 'chunk-2',
        content: 'Am Samstag bleibt das Buero geschlossen.',
        score: 0.94,
      }),
    ],
  });
  const { adapter, calls } = createMockAdapter({
    async answer(input) {
      calls.push(input);
      assert.equal(input.sourceId, 'source-1');
      assert.equal(input.sourceUrl, 'https://example.com/faq');
      assert.equal(input.sourceTitle, 'Website Quelle');
      assert.equal(input.sourceDomain, 'example.com');
      assert.equal(input.contexts.length, 2);
      assert.match(input.contexts[0], /09 bis 17 Uhr/);
      return {
        decision: 'answered',
        answerText: 'Antwort: Die Oeffnungszeiten sind Montag bis Freitag von 09 bis 17 Uhr.',
        usedSourceId: input.sourceId,
        warnings: [],
      };
    },
  });

  const result = await service.evaluateWebsiteAnswer(
    createInput({ answerAdapter: adapter }),
  );

  assert.equal(result.answered, true);
  assert.equal(result.decisionCode, 'answered');
  assert.equal(result.retrievalVerified, true);
  assert.equal(result.sourceAttributionVerified, true);
  assert.equal(result.sourceId, 'source-1');
  assert.equal(result.sourceUrl, 'https://example.com/faq');
  assert.equal(result.sourceTitle, 'Website Quelle');
  assert.equal(result.sourceDomain, 'example.com');
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.liveLlmAnswerUsed, false);
  assert.equal(result.liveEmbeddingsUsed, false);
  assert.equal(result.ragUsed, false);
  assert.equal(vectorCalls.length, 1);
  assert.equal(calls.length, 1);
});

test('WebsiteAnswerEvaluationService rejects fake source attribution from the mock adapter', async () => {
  const { service } = createServiceContext();
  const { adapter, calls } = createMockAdapter({
    async answer(input) {
      calls.push(input);
      return {
        decision: 'answered',
        answerText: 'Antwort mit falscher Quelle.',
        usedSourceId: 'source-foreign',
        warnings: [],
      };
    },
  });

  const result = await service.evaluateWebsiteAnswer(
    createInput({ answerAdapter: adapter }),
  );

  assert.equal(result.answered, false);
  assert.equal(result.decisionCode, 'fake_source_attribution');
  assert.equal(result.sourceId, null);
  assert.equal(result.sourceUrl, null);
  assert.equal(result.sourceTitle, null);
  assert.equal(result.sourceDomain, null);
  assert.equal(calls.length, 1);
});

test('WebsiteAnswerEvaluationService sanitizes adapter failures and requires mock-only mode', async () => {
  const { service } = createServiceContext();

  const nonMock = await service.evaluateWebsiteAnswer(
    createInput({
      answerAdapter: {
        mode: 'provider',
        label: 'not-allowed',
        async answer() {
          return { decision: 'answered', answerText: 'x', usedSourceId: 'source-1' };
        },
      },
    }),
  );
  assert.equal(nonMock.answered, false);
  assert.equal(nonMock.decisionCode, 'mock_adapter_required');

  const { adapter } = createMockAdapter({
    async answer() {
      throw new Error('raw provider stack should not leak');
    },
  });
  const failing = await service.evaluateWebsiteAnswer(
    createInput({ answerAdapter: adapter }),
  );

  assert.equal(failing.answered, false);
  assert.equal(failing.decisionCode, 'answer_generation_failed');
  assert.equal(
    failing.sanitizedMessage,
    'Die Website-Answer-Evaluation ist fehlgeschlagen.',
  );
  assert.equal(failing.sourceId, null);
  assert.equal(failing.sourceUrl, null);
  assert.equal(failing.sourceTitle, null);
  assert.equal(failing.sourceDomain, null);
});
