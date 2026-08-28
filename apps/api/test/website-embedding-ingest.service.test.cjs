const test = require('node:test');
const assert = require('node:assert/strict');
const { WebsiteEmbeddingIngestService } = require('../dist/knowledge-sources/website-embedding-ingest.service.js');

function createSource(overrides = {}) {
  return {
    id: 'source-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    type: 'url',
    title: 'Website Quelle',
    normalizedSourceUrl: 'https://example.com/faq',
    sourceUrl: 'https://example.com/faq',
    sourceDomain: 'example.com',
    ingestStatus: 'extracted',
    indexStatus: 'pending',
    runtimeReadiness: 'not_ready',
    isActive: true,
    ...overrides,
  };
}

function createGrant(overrides = {}) {
  return {
    approvalId: 'approval-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceTypes: ['url'],
    usageContexts: ['website_ingest_runtime_indexing'],
    environment: 'non_production',
    provider: 'openai',
    model: 'text-embedding-3-small',
    embeddingDimension: 6,
    dataCategories: ['website_content'],
    customerDataApproved: true,
    providerDpaApproved: true,
    productionApproved: false,
    purpose: 'website_runtime_indexing_validation',
    retentionPolicy: 'no_persisted_provider_payloads',
    redactionPolicy: 'strip_operator_secrets',
    loggingPolicy: 'metadata_only',
    deletionPolicy: 'source_delete_reindex_required',
    reindexPolicy: 'manual_reindex_only',
    rateLimit: '100/day',
    costLimit: '25 eur/month',
    validFrom: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
    approvedBy: 'security_owner',
    approvalEvidenceRef: 'policy-test-1',
    ...overrides,
  };
}

function createAdapter(overrides = {}) {
  const calls = [];
  return {
    calls,
    adapter: {
      mode: 'mock',
      label: 'deterministic-mock',
      embeddingDimension: 6,
      async embedText(text, context) {
        calls.push({ text, context });
        const chars = Array.from(text).slice(0, 6).map((char) => char.charCodeAt(0) / 255);
        while (chars.length < 6) chars.push(0);
        return chars;
      },
      ...overrides,
    },
  };
}

function createDeps() {
  const dbQueries = [];
  const updateCalls = [];
  const restoreCalls = [];
  const knowledgeSourceCalls = [];
  const approvalLookupCalls = [];
  const source = createSource();
  const chunkState = new Map([
    [
      'chunk-1',
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        sourceId: 'source-1',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        title: source.title,
        sourceUrl: source.sourceUrl,
        sourceLabel: source.title,
        content: 'Website Inhalt A',
        metadata: { chunkIndex: 0, providerFree: true },
        contentHash: 'hash-1',
        embedding: null,
      },
    ],
    [
      'chunk-2',
      {
        id: 'chunk-2',
        documentId: 'doc-1',
        sourceId: 'source-1',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        title: source.title,
        sourceUrl: source.sourceUrl,
        sourceLabel: source.title,
        content: 'Website Inhalt B',
        metadata: { chunkIndex: 1, providerFree: true },
        contentHash: 'hash-2',
        embedding: null,
      },
    ],
    [
      'foreign-chunk',
      {
        id: 'foreign-chunk',
        documentId: 'doc-foreign',
        sourceId: 'source-foreign',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        title: 'Fremde Quelle',
        sourceUrl: 'https://foreign.example',
        sourceLabel: 'Fremde Quelle',
        content: 'Fremder Inhalt',
        metadata: { providerFree: false, untouched: true },
        contentHash: 'foreign-hash',
        embedding: '[0.9,0.8,0.7,0.6,0.5,0.4]',
      },
    ],
  ]);

  return {
    dbQueries,
    updateCalls,
    restoreCalls,
    knowledgeSourceCalls,
    approvalLookupCalls,
    chunkState,
    source,
    db: {
      async query(sql, params) {
        dbQueries.push({ sql, params });
        if (/FROM documents d\s+JOIN chunks c/i.test(sql)) {
          const rows = [...chunkState.values()]
            .filter((chunk) => chunk.sourceId === params[0])
            .map((chunk) => ({
              chunk_id: chunk.id,
              document_id: chunk.documentId,
              title: chunk.title,
              source_url: chunk.sourceUrl,
              content: chunk.content,
              metadata: chunk.metadata,
              content_hash: chunk.contentHash,
              embedding_vector: chunk.embedding,
            }));
          return {
            rows,
          };
        }
        if (/WITH ranked AS/i.test(sql)) {
          const rows = [...chunkState.values()]
            .filter((chunk) => chunk.tenantId === params[0] && chunk.siteId === params[1] && chunk.embedding !== null)
            .map((chunk) => ({
              id: chunk.id,
              document_id: chunk.documentId,
              source_id: chunk.sourceId,
              source_type: 'url',
              source_label: chunk.sourceLabel,
              title: chunk.title,
              source_url: chunk.sourceUrl,
              score: chunk.sourceId === 'source-1' ? 0.99 : 0.5,
            }))
            .sort((a, b) => b.score - a.score);
          return {
            rows,
          };
        }
        if (/UPDATE chunks\s+SET content = \$2,/i.test(sql)) {
          const chunk = chunkState.get(params[0]);
          if (chunk) {
            chunk.content = params[1];
            chunk.metadata = params[2];
            chunk.contentHash = params[3];
            chunk.embedding = params[4];
            restoreCalls.push({
              id: params[0],
              metadata: params[2],
              contentHash: params[3],
              embedding: params[4],
            });
          }
          return { rows: [] };
        }
        return { rows: [] };
      },
    },
    vector: {
      async updateChunk(params) {
        updateCalls.push(params);
        const chunk = chunkState.get(params.id);
        if (chunk) {
          chunk.content = params.content;
          chunk.metadata = params.metadata;
          chunk.contentHash = params.contentHash;
          chunk.embedding = `[${params.embedding.join(',')}]`;
        }
        return { id: params.id, updated: true };
      },
    },
    knowledgeSources: {
      async getById() {
        return source;
      },
      async markReady() {
        knowledgeSourceCalls.push({ method: 'markReady', args: [...arguments] });
      },
      async markBlocked() {
        knowledgeSourceCalls.push({ method: 'markBlocked', args: [...arguments] });
      },
      async markFailed() {
        knowledgeSourceCalls.push({ method: 'markFailed', args: [...arguments] });
      },
    },
    approvalLookup: {
      async findProviderApprovalGrant(input) {
        approvalLookupCalls.push(input);
        return createGrant();
      },
    },
  };
}

test('WebsiteEmbeddingIngestService denies when no storage grant exists and never calls adapter', async () => {
  const deps = createDeps();
  deps.approvalLookup.findProviderApprovalGrant = async (input) => {
    deps.approvalLookupCalls.push(input);
    return null;
  };
  const { adapter, calls } = createAdapter();
  const service = new WebsiteEmbeddingIngestService(deps.db, deps.vector, deps.knowledgeSources, deps.approvalLookup);

  const result = await service.runWebsiteEmbeddingIngest({
    sourceId: 'source-1',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    adapter,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.decisionCode, 'missing_policy');
  assert.equal(calls.length, 0);
  assert.equal(deps.updateCalls.length, 0);
  assert.equal(deps.restoreCalls.length, 0);
  assert.equal(deps.knowledgeSourceCalls.some((entry) => entry.method === 'markBlocked'), true);
});

test('WebsiteEmbeddingIngestService denies expired, revoked, future, tenant/site/source/provider/model/context mismatches without calling adapter', async () => {
  const cases = [
    createGrant({ expiresAt: '2026-01-01T00:00:00.000Z' }),
    createGrant({ revokedAt: '2026-07-20T00:00:00.000Z' }),
    createGrant({ validFrom: '2026-12-01T00:00:00.000Z' }),
    createGrant({ tenantId: 'tenant-x' }),
    createGrant({ siteId: 'site-x' }),
    createGrant({ sourceId: 'source-x' }),
    createGrant({ provider: 'azure-openai' }),
    createGrant({ model: 'text-embedding-3-large' }),
    createGrant({ usageContexts: ['query_embedding'] }),
  ];

  for (const grant of cases) {
    const deps = createDeps();
    deps.approvalLookup.findProviderApprovalGrant = async () => grant;
    const { adapter, calls } = createAdapter();
    const service = new WebsiteEmbeddingIngestService(deps.db, deps.vector, deps.knowledgeSources, deps.approvalLookup);

    const result = await service.runWebsiteEmbeddingIngest({
      sourceId: 'source-1',
      providerKey: 'openai',
      model: 'text-embedding-3-small',
      adapter,
    });

    assert.equal(result.allowed, false);
    assert.equal(calls.length, 0);
    assert.equal(deps.updateCalls.length, 0);
    assert.equal(deps.restoreCalls.length, 0);
  }
});

test('WebsiteEmbeddingIngestService requires a mock adapter and sanitizes adapter failures', async () => {
  const deps = createDeps();
  const service = new WebsiteEmbeddingIngestService(deps.db, deps.vector, deps.knowledgeSources, deps.approvalLookup);

  const nonMock = await service.runWebsiteEmbeddingIngest({
    sourceId: 'source-1',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    adapter: {
      mode: 'provider',
      label: 'not-allowed',
      embeddingDimension: 6,
      async embedText() {
        return [0, 0, 0, 0, 0, 0];
      },
    },
  });
  assert.equal(nonMock.allowed, false);
  assert.equal(nonMock.decisionCode, 'mock_adapter_required');

  const failingDeps = createDeps();
  const failingService = new WebsiteEmbeddingIngestService(
    failingDeps.db,
    failingDeps.vector,
    failingDeps.knowledgeSources,
    failingDeps.approvalLookup,
  );
  const { adapter } = createAdapter({
    async embedText() {
      throw new Error('raw provider stack should not leak');
    },
  });
  const failing = await failingService.runWebsiteEmbeddingIngest({
    sourceId: 'source-1',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    adapter,
  });
  assert.equal(failing.allowed, false);
  assert.equal(failing.decisionCode, 'embedding_failed');
  assert.equal(failingDeps.restoreCalls.length, 0);
  assert.equal(
    failingDeps.knowledgeSourceCalls.some((entry) => entry.method === 'markFailed'),
    true,
  );
});

test('WebsiteEmbeddingIngestService indexes website chunks with mock embeddings, verifies retrieval/source attribution, and marks source ready', async () => {
  const deps = createDeps();
  const { adapter, calls } = createAdapter();
  const service = new WebsiteEmbeddingIngestService(deps.db, deps.vector, deps.knowledgeSources, deps.approvalLookup);

  const result = await service.runWebsiteEmbeddingIngest({
    sourceId: 'source-1',
    actorRole: 'admin',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    adapter,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.embeddingsCreated, 2);
  assert.equal(result.retrievalVerified, true);
  assert.equal(result.sourceAttributionVerified, true);
  assert.equal(result.runtimeReadinessChanged, true);
  assert.equal(result.readyTransitionAdded, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].context.phase, 'index');
  assert.equal(calls[2].context.phase, 'verification');
  assert.equal(deps.updateCalls.length, 2);
  assert.equal(deps.restoreCalls.length, 0);
  assert.equal(deps.updateCalls[0].metadata.websiteEmbeddingIndexed, true);
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markReady'),
    true,
  );
  assert.equal(deps.approvalLookupCalls.length, 2);
});

test('WebsiteEmbeddingIngestService fails without ready transition when retrieval/source attribution cannot be verified', async () => {
  const deps = createDeps();
  deps.chunkState.delete('chunk-2');
  const originalQuery = deps.db.query.bind(deps.db);
  deps.db.query = async (sql, params) => {
    if (/WITH ranked AS/i.test(sql)) {
      deps.dbQueries.push({ sql, params });
      return {
        rows: [
          {
            id: 'chunk-x',
            document_id: 'doc-x',
            source_id: 'source-foreign',
            source_type: 'url',
            source_label: 'Fremde Quelle',
            title: 'Fremde Quelle',
            source_url: 'https://foreign.example',
            score: 0.99,
          },
        ],
      };
    }
    return originalQuery(sql, params);
  };
  const { adapter, calls } = createAdapter();
  const service = new WebsiteEmbeddingIngestService(deps.db, deps.vector, deps.knowledgeSources, deps.approvalLookup);

  const result = await service.runWebsiteEmbeddingIngest({
    sourceId: 'source-1',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    adapter,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.decisionCode, 'retrieval_not_verified');
  assert.equal(result.runtimeReadinessChanged, false);
  assert.equal(result.readyTransitionAdded, false);
  assert.equal(calls.length, 2);
  assert.equal(deps.restoreCalls.length, 1);
  assert.equal(deps.chunkState.get('chunk-1').embedding, null);
  assert.equal(deps.chunkState.get('chunk-1').metadata.providerFree, true);
  assert.equal(deps.chunkState.get('foreign-chunk').embedding, '[0.9,0.8,0.7,0.6,0.5,0.4]');
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markReady'),
    false,
  );
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markFailed'),
    true,
  );
});

test('WebsiteEmbeddingIngestService restores persisted chunk state after mid-run failure', async () => {
  const deps = createDeps();
  const { adapter } = createAdapter({
    async embedText(text, context) {
      if (context.phase === 'index' && context.chunkIndex === 1) {
        throw new Error('network provider should not leak');
      }
      const chars = Array.from(text).slice(0, 6).map((char) => char.charCodeAt(0) / 255);
      while (chars.length < 6) chars.push(0);
      return chars;
    },
  });
  const service = new WebsiteEmbeddingIngestService(deps.db, deps.vector, deps.knowledgeSources, deps.approvalLookup);

  const result = await service.runWebsiteEmbeddingIngest({
    sourceId: 'source-1',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    adapter,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.decisionCode, 'embedding_failed');
  assert.equal(result.readyTransitionAdded, false);
  assert.equal(deps.updateCalls.length, 1);
  assert.equal(deps.restoreCalls.length, 1);
  assert.equal(deps.chunkState.get('chunk-1').embedding, null);
  assert.equal(deps.chunkState.get('chunk-1').metadata.providerFree, true);
  assert.equal(deps.chunkState.get('foreign-chunk').metadata.untouched, true);
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markReady'),
    false,
  );
});

test('WebsiteEmbeddingIngestService restores earlier chunk writes when a later gate check denies the run', async () => {
  const deps = createDeps();
  let grantCalls = 0;
  deps.approvalLookup.findProviderApprovalGrant = async () => {
    grantCalls += 1;
    return grantCalls === 1 ? createGrant() : null;
  };
  const { adapter, calls } = createAdapter();
  const service = new WebsiteEmbeddingIngestService(deps.db, deps.vector, deps.knowledgeSources, deps.approvalLookup);

  const result = await service.runWebsiteEmbeddingIngest({
    sourceId: 'source-1',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    adapter,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.decisionCode, 'missing_policy');
  assert.equal(calls.length, 1);
  assert.equal(deps.updateCalls.length, 1);
  assert.equal(deps.restoreCalls.length, 1);
  assert.equal(deps.chunkState.get('chunk-1').embedding, null);
  assert.equal(deps.chunkState.get('chunk-1').metadata.providerFree, true);
  assert.equal(deps.chunkState.get('foreign-chunk').embedding, '[0.9,0.8,0.7,0.6,0.5,0.4]');
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markBlocked'),
    true,
  );
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markReady'),
    false,
  );
});
