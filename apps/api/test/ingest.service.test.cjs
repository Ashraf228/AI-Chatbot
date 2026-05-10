const test = require('node:test');
const assert = require('node:assert/strict');
const { IngestService } = require('../dist/ingest/ingest.service.js');

function createDeps() {
  const dbQueries = [];

  return {
    dbQueries,
    db: {
      async query(sql, params) {
        dbQueries.push({ sql, params });
        return { rows: [] };
      },
    },
    embedder: {
      async embed(content) {
        return [content.length, 1, 2];
      },
    },
    vector: {
      async upsertChunk(params) {
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
      async markReady() {},
      async markFailed() {},
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
