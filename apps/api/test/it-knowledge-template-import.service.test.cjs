const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ItKnowledgeTemplateImportService,
} = require('../dist/modules/it-support/it-knowledge-template-import.service.js');

function createHarness(options = {}) {
  const dbQueries = [];
  const createdSources = [];
  const ingestedSources = [];
  const existingByTemplateKey = new Map(Object.entries(options.existingByTemplateKey || {}));
  const siteTenantId = options.siteTenantId === undefined ? 'tenant-1' : options.siteTenantId;

  const db = {
    async query(sql, params) {
      dbQueries.push({ sql, params });
      if (/FROM sites/i.test(sql)) {
        if (options.siteMissing) return { rows: [] };
        return { rows: [{ id: params[0], tenant_id: siteTenantId }] };
      }
      if (/FROM knowledge_sources/i.test(sql)) {
        const sourceId = existingByTemplateKey.get(params[2]);
        return { rows: sourceId ? [{ id: sourceId }] : [] };
      }
      return { rows: [] };
    },
  };

  const knowledgeSources = {
    async createForSite(input) {
      createdSources.push(input);
      return `source-${createdSources.length}`;
    },
  };

  const ingest = {
    async ingestTextIntoExistingSource(input) {
      ingestedSources.push(input);
      return {
        sourceId: input.sourceId,
        documentId: `doc-${ingestedSources.length}`,
        chunks: 1,
        inserted: 1,
      };
    },
  };

  return {
    dbQueries,
    createdSources,
    ingestedSources,
    service: new ItKnowledgeTemplateImportService(db, knowledgeSources, ingest),
  };
}

test('ItKnowledgeTemplateImportService imports selected templates tenant and site scoped', async () => {
  const harness = createHarness();

  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    templateKeys: ['vpn-not-connecting'],
    createdBy: 'operator-1',
  });

  assert.equal(result.imported.length, 1);
  assert.equal(result.imported[0].templateKey, 'vpn-not-connecting');
  assert.equal(result.skipped.length, 0);
  assert.equal(result.overwritten.length, 0);
  assert.equal(harness.createdSources.length, 1);
  assert.equal(harness.createdSources[0].tenantId, 'tenant-1');
  assert.equal(harness.createdSources[0].siteId, 'site-1');
  assert.equal(harness.createdSources[0].sourceType, 'it_support_template');
  assert.equal(harness.createdSources[0].config.templateKey, 'vpn-not-connecting');
  assert.equal(harness.createdSources[0].config.industry, 'it-support');
  assert.equal(harness.createdSources[0].config.createdBy, 'operator-1');
  assert.equal(harness.ingestedSources.length, 1);
  assert.equal(harness.ingestedSources[0].tenantId, 'tenant-1');
  assert.equal(harness.ingestedSources[0].siteId, 'site-1');
  assert.equal(harness.ingestedSources[0].metadata.templateKey, 'vpn-not-connecting');
  assert.match(harness.ingestedSources[0].text, /# VPN verbindet nicht/);
});

test('ItKnowledgeTemplateImportService skip_existing avoids duplicate template sources', async () => {
  const harness = createHarness({
    existingByTemplateKey: {
      'vpn-not-connecting': 'existing-source',
    },
  });

  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    templateKeys: ['vpn-not-connecting'],
    mode: 'skip_existing',
  });

  assert.equal(result.imported.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].sourceId, 'existing-source');
  assert.equal(harness.createdSources.length, 0);
  assert.equal(harness.ingestedSources.length, 0);
});

test('ItKnowledgeTemplateImportService overwrite re-ingests existing template source', async () => {
  const harness = createHarness({
    existingByTemplateKey: {
      'vpn-not-connecting': 'existing-source',
    },
  });

  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    templateKeys: ['vpn-not-connecting'],
    mode: 'overwrite',
  });

  assert.equal(result.overwritten.length, 1);
  assert.equal(result.overwritten[0].sourceId, 'existing-source');
  assert.equal(harness.createdSources.length, 0);
  assert.equal(harness.ingestedSources.length, 1);
  assert.equal(harness.ingestedSources[0].sourceId, 'existing-source');
});

test('ItKnowledgeTemplateImportService imports all templates when no filter is provided', async () => {
  const harness = createHarness();

  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
  });

  assert.ok(result.imported.length >= 15);
  assert.equal(harness.createdSources.length, result.imported.length);
  assert.equal(harness.ingestedSources.length, result.imported.length);
});

test('ItKnowledgeTemplateImportService rejects cross-tenant site access', async () => {
  const harness = createHarness({ siteTenantId: 'tenant-2' });

  await assert.rejects(
    () => harness.service.importItKnowledgeTemplatesForSite({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      templateKeys: ['vpn-not-connecting'],
    }),
    /Site does not belong to tenant/,
  );
});
