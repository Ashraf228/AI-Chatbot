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
