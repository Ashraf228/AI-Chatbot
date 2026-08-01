const test = require('node:test');
const assert = require('node:assert/strict');
const { IngestService } = require('../dist/ingest/ingest.service.js');
const websiteIngest = require('../dist/ingest/website-ingest.js');

function createDeps() {
  const dbQueries = [];
  const embedCalls = [];
  const vectorCalls = [];
  const knowledgeSourceCalls = [];

  return {
    dbQueries,
    embedCalls,
    vectorCalls,
    knowledgeSourceCalls,
    db: {
      async query(sql, params) {
        dbQueries.push({ sql, params });
        return { rows: [] };
      },
    },
    embedder: {
      async embed(content) {
        embedCalls.push(content);
        return [content.length, 1, 2];
      },
    },
    vector: {
      async upsertChunk(params) {
        vectorCalls.push(params);
        return { id: params.id, skipped: false };
      },
    },
    sites: {
      async getSite(siteId) {
        return {
          id: siteId,
          tenant_id: 'tenant-1',
        };
      },
    },
    knowledgeSources: {
      async createForSite() {
        knowledgeSourceCalls.push({ method: 'createForSite', args: [...arguments] });
        return 'source-1';
      },
      async listForSite() {
        return [];
      },
      async getById(sourceId) {
        return {
          id: sourceId,
          tenantId: 'tenant-1',
          siteId: 'site-1',
          type: 'manual',
          title: 'Manual',
          metadata: { content: 'Alter Inhalt' },
          url: '',
        };
      },
      async markProcessing() {},
      async markReady() { knowledgeSourceCalls.push({ method: 'markReady', args: [...arguments] }); },
      async markFailed() { knowledgeSourceCalls.push({ method: 'markFailed', args: [...arguments] }); },
      async markFetchPending() { knowledgeSourceCalls.push({ method: 'markFetchPending', args: [...arguments] }); },
      async markFetching() { knowledgeSourceCalls.push({ method: 'markFetching', args: [...arguments] }); },
      async markFetched() { knowledgeSourceCalls.push({ method: 'markFetched', args: [...arguments] }); },
      async markExtracted() { knowledgeSourceCalls.push({ method: 'markExtracted', args: [...arguments] }); },
      async markRuntimeIndexPending() { knowledgeSourceCalls.push({ method: 'markRuntimeIndexPending', args: [...arguments] }); },
      async markBlocked() { knowledgeSourceCalls.push({ method: 'markBlocked', args: [...arguments] }); },
      async setActive(sourceId, isActive) {
        return { id: sourceId, siteId: 'site-1', isActive };
      },
      async deleteSource(sourceId) {
        return { ok: true, deletedId: sourceId, siteId: 'site-1' };
      },
      async deleteIfUnused() {},
    },
  };
}

test('IngestService.ingestFaq stores FAQ document and chunk', async () => {
  const deps = createDeps();
  const service = new IngestService(
    deps.db,
    deps.embedder,
    deps.vector,
    deps.sites,
    deps.knowledgeSources,
  );

  const result = await service.ingestFaq('site-1', 'FAQ', [
    { q: 'Was macht ihr?', a: 'Alles rund um KI.' },
  ]);

  assert.equal(result.inserted, 1);
  assert.ok(result.documentId);
  assert.equal(deps.dbQueries.length >= 1, true);
  assert.match(deps.dbQueries[0].sql, /INSERT INTO documents/i);
  assert.equal(deps.dbQueries[0].params[3], 'site-1');
});

test('IngestService.ingestFaq rejects unknown sites', async () => {
  const deps = createDeps();
  deps.sites.getSite = async () => null;
  const service = new IngestService(
    deps.db,
    deps.embedder,
    deps.vector,
    deps.sites,
    deps.knowledgeSources,
  );

  await assert.rejects(
    () => service.ingestFaq('missing-site', 'FAQ', [{ q: 'Q', a: 'A' }]),
    /Invalid siteId/,
  );
});

test('IngestService.ingestFaq keeps tenant context scoped to the selected site', async () => {
  const captured = {
    sourceInput: null,
    chunkInput: null,
  };

  const deps = createDeps();
  deps.sites.getSite = async () => ({
    id: 'site-2',
    tenant_id: 'tenant-2',
  });
  deps.knowledgeSources.createForSite = async (input) => {
    captured.sourceInput = input;
    return 'source-tenant-2';
  };
  deps.vector.upsertChunk = async (params) => {
    captured.chunkInput = params;
    return { id: params.id, skipped: false };
  };

  const service = new IngestService(
    deps.db,
    deps.embedder,
    deps.vector,
    deps.sites,
    deps.knowledgeSources,
  );

  await service.ingestFaq('site-2', 'FAQ', [{ q: 'Q', a: 'A' }]);

  assert.equal(captured.sourceInput.tenantId, 'tenant-2');
  assert.equal(captured.sourceInput.siteId, 'site-2');
  assert.equal(captured.chunkInput.tenantId, 'tenant-2');
  assert.equal(captured.chunkInput.siteId, 'site-2');
});

test('IngestService.ingestManual creates source and chunk', async () => {
  const deps = createDeps();
  let createdSource = null;
  let chunkInput = null;
  deps.knowledgeSources.createForSite = async (input) => {
    createdSource = input;
    return 'manual-source';
  };
  deps.vector.upsertChunk = async (params) => {
    chunkInput = params;
    return { id: params.id, skipped: false };
  };
  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);

  const result = await service.ingestManual('site-1', {
    title: 'Manual',
    content: 'Das ist Unternehmenswissen.',
    tags: ['support'],
  });

  assert.equal(result.sourceId, 'manual-source');
  assert.equal(createdSource.sourceType, 'manual');
  assert.equal(createdSource.syncStatus, 'processing');
  assert.equal(chunkInput.metadata.kind, 'manual');
});

test('IngestService.deleteSource delegates source cleanup', async () => {
  const deps = createDeps();
  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);

  const result = await service.deleteSource('source-1');

  assert.equal(result.ok, true);
  assert.equal(result.deletedId, 'source-1');
});

test('IngestService.resyncSource replaces old chunks via source documents', async () => {
  const deps = createDeps();
  const deletes = [];
  deps.db.query = async (sql, params) => {
    deps.dbQueries.push({ sql, params });
    if (/DELETE FROM documents WHERE source_id/i.test(sql)) {
      deletes.push(params[0]);
    }
    return { rows: [] };
  };
  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);

  const result = await service.resyncSource('source-1');

  assert.equal(result.sourceId, 'source-1');
  assert.deepEqual(deletes, ['source-1']);
});

test('IngestService.resyncSource supports IT support template sources', async () => {
  const deps = createDeps();
  let chunkInput = null;
  deps.knowledgeSources.getById = async (sourceId) => ({
    id: sourceId,
    tenantId: 'tenant-1',
    siteId: 'site-1',
    type: 'it_support_template',
    title: 'VPN verbindet nicht',
    metadata: {
      content: '# VPN verbindet nicht\n\n## Sichere erste Schritte\n1. VPN-Client neu starten.',
      templateKey: 'vpn-not-connecting',
      templateVersion: '2026-06-10',
      industry: 'it-support',
      category: 'connectivity',
      issueType: 'vpn',
      tags: ['vpn'],
    },
    url: '',
  });
  deps.vector.upsertChunk = async (params) => {
    chunkInput = params;
    return { id: params.id, skipped: false };
  };

  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);
  const result = await service.resyncSource('source-1');

  assert.equal(result.sourceId, 'source-1');
  assert.equal(chunkInput.metadata.kind, 'it_support_template');
  assert.equal(chunkInput.metadata.templateKey, 'vpn-not-connecting');
  assert.equal(chunkInput.metadata.industry, 'it-support');
});

test('IngestService.ingestUrl persists website text without embeddings or vector writes and keeps runtime index pending', async () => {
  const deps = createDeps();
  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);
  const originalFetchWebsiteSource = websiteIngest.fetchWebsiteSource;
  websiteIngest.fetchWebsiteSource = async () => ({
    normalizedUrl: 'https://93.184.216.34/faq',
    finalUrl: 'https://93.184.216.34/faq',
    sourceDomain: '93.184.216.34',
    contentType: 'text/html; charset=utf-8',
    statusCode: 200,
    redirectCount: 0,
    responseBytes: 24,
    extractedText: 'FAQ Inhalt',
    extractedChars: 10,
    truncated: false,
  });

  try {
    const result = await service.ingestUrl('site-1', 'https://93.184.216.34/faq', 'FAQ');

    assert.equal(result.runtimeReadiness, 'not_ready');
    assert.equal(result.ingestStatus, 'extracted');
    assert.equal(result.indexStatus, 'pending');
    assert.equal(result.extractedTextLength > 0, true);
    assert.equal(deps.embedCalls.length, 0);
    assert.equal(deps.vectorCalls.length, 0);
    assert.equal(deps.dbQueries.some((entry) => /INSERT INTO chunks/i.test(entry.sql)), true);
    assert.equal(
      deps.dbQueries.some((entry) => /INSERT INTO chunks/i.test(entry.sql) && entry.params.length === 7),
      true,
    );
    assert.equal(
      deps.knowledgeSourceCalls.some((entry) => entry.method === 'markRuntimeIndexPending'),
      true,
    );
    assert.equal(
      deps.knowledgeSourceCalls.some((entry) => entry.method === 'markReady'),
      false,
    );
    const runtimeGateCall = deps.knowledgeSourceCalls.find((entry) => entry.method === 'markRuntimeIndexPending');
    assert.equal(runtimeGateCall.args[1].runtimeIndexingRequired, true);
    assert.equal(runtimeGateCall.args[1].runtimeIndexingMode, 'provider_or_embedding_gate_required');
  } finally {
    websiteIngest.fetchWebsiteSource = originalFetchWebsiteSource;
  }
});

test('IngestService.ingestUrl blocks private redirect targets and records blocked status', async () => {
  const deps = createDeps();
  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);
  const originalFetchWebsiteSource = websiteIngest.fetchWebsiteSource;
  websiteIngest.fetchWebsiteSource = async () => {
    throw new websiteIngest.WebsitePolicyError('Private oder interne Website-Ziele sind nicht erlaubt.', 'resolved_ip_blocked');
  };

  try {
    await assert.rejects(
      () => service.ingestUrl('site-1', 'https://93.184.216.34/faq', 'FAQ'),
      /Private oder interne Website-Ziele sind nicht erlaubt/,
    );

    assert.equal(
      deps.knowledgeSourceCalls.some((entry) => entry.method === 'markBlocked'),
      true,
    );
  } finally {
    websiteIngest.fetchWebsiteSource = originalFetchWebsiteSource;
  }
});

test('IngestService.evaluateWebsiteRuntimeIndexingGate denies website embedding by default without provider calls', async () => {
  const deps = createDeps();
  deps.knowledgeSources.getById = async (sourceId) => ({
    id: sourceId,
    tenantId: 'tenant-1',
    siteId: 'site-1',
    type: 'url',
    title: 'Website',
    metadata: { providerFree: true },
    ingestStatus: 'extracted',
    indexStatus: 'pending',
    runtimeReadiness: 'not_ready',
    url: 'https://example.com/faq',
  });
  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);

  const result = await service.evaluateWebsiteRuntimeIndexingGate({
    sourceId: 'source-1',
  });

  assert.equal(result.allowed, false);
  assert.equal(result.decisionCode, 'missing_policy');
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.embeddingGenerationUsed, false);
  assert.equal(result.readyTransitionAdded, false);
  assert.equal(deps.embedCalls.length, 0);
  assert.equal(deps.vectorCalls.length, 0);
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markBlocked'),
    true,
  );
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markReady'),
    false,
  );
});

test('IngestService.evaluateWebsiteRuntimeIndexingGate can acknowledge explicit approval without executing provider work', async () => {
  const deps = createDeps();
  deps.knowledgeSources.getById = async (sourceId) => ({
    id: sourceId,
    tenantId: 'tenant-1',
    siteId: 'site-1',
    type: 'url',
    title: 'Website',
    metadata: { providerFree: true },
    ingestStatus: 'extracted',
    indexStatus: 'pending',
    runtimeReadiness: 'not_ready',
    url: 'https://example.com/faq',
  });
  const service = new IngestService(deps.db, deps.embedder, deps.vector, deps.sites, deps.knowledgeSources);

  const result = await service.evaluateWebsiteRuntimeIndexingGate({
    sourceId: 'source-1',
    actorRole: 'admin',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
    explicitApproval: {
      approvalId: 'approval-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      sourceId: 'source-1',
      sourceTypes: ['url'],
      usageContexts: ['website_ingest_runtime_indexing'],
      environment: 'non_production',
      provider: 'openai',
      model: 'text-embedding-3-small',
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
      rateLimit: '100 requests/day',
      costLimit: '25 eur/month',
      validFrom: '2026-07-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
      approvedBy: 'security_owner',
      approvalEvidenceRef: 'policy-test-1',
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.decisionCode, 'allowed');
  assert.equal(result.indexStatus, 'pending');
  assert.equal(result.runtimeReadiness, 'not_ready');
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.embeddingGenerationUsed, false);
  assert.equal(result.readyTransitionAdded, false);
  assert.equal(deps.embedCalls.length, 0);
  assert.equal(deps.vectorCalls.length, 0);
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markBlocked'),
    false,
  );
  assert.equal(
    deps.knowledgeSourceCalls.some((entry) => entry.method === 'markReady'),
    false,
  );
});
