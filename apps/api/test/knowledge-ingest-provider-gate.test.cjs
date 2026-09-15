const test = require('node:test');
const assert = require('node:assert/strict');
const { IngestionEmbeddingService, INGESTION_FAILURE } = require('../dist/ingest/ingestion-embedding.service.js');
const { ProviderApprovalStorageLookupService, buildProviderApprovalLookupQuery } = require('../dist/knowledge-sources/provider-approval-storage-lookup.service.js');
const { IngestService } = require('../dist/ingest/ingest.service.js');

function grant(overrides = {}) {
  return {
    id: 'synthetic-grant', scope_kind: 'source', tenant_id: 'tenant-1', site_id: 'site-1', source_id: 'source-1',
    source_types: ['manual'], usage_contexts: ['knowledge_ingest'], purpose: 'knowledge_ingest',
    environment: 'non_production', provider_key: 'openai', model: 'text-embedding-3-small', embedding_dimension: 3,
    provider_region: 'synthetic-region', data_categories: ['synthetic-text'], customer_data_approved: true,
    production_approved: false, provider_dpa_approved: true, retention_policy: 'synthetic-retention',
    redaction_policy: 'synthetic-redaction', logging_policy: 'metadata_only', deletion_policy: 'synthetic-deletion',
    reindex_policy: 'synthetic-reindex', rate_limit: 'synthetic-rate', cost_limit: 'synthetic-cost',
    valid_from: '2020-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', revoked_at: null,
    approved_by: 'synthetic-owner', approval_evidence_ref: 'synthetic-evidence', ...overrides,
  };
}
const context = { tenantId: 'tenant-1', siteId: 'site-1', sourceId: 'source-1', purpose: 'knowledge_ingest' };

async function withTransport(callback, response) {
  const keys = ['NODE_ENV', 'APP_ENV', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_EMBED_MODEL', 'OPENAI_EMBED_PROVIDER', 'OPENAI_LOG'];
  const env = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const originalFetch = globalThis.fetch;
  const methods = ['debug', 'info', 'warn', 'error'];
  const originals = Object.fromEntries(methods.map(k => [k, console[k]]));
  const requests = [], logs = [];
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = 'test'; process.env.OPENAI_API_KEY = 'synthetic-key'; process.env.OPENAI_LOG = 'debug';
    for (const method of methods) console[method] = (...args) => logs.push({ method, args });
    globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(init.body), redirect: init.redirect });
      return response ? response(requests.length) : new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    };
    await callback(requests, logs);
    assert.deepEqual(logs, []);
  } finally {
    globalThis.fetch = originalFetch;
    for (const method of methods) console[method] = originals[method];
    for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  }
}

function runtime({ row = grant(), sourceType = 'manual', sourceMatches = true, lookupError = false } = {}) {
  let lookups = 0;
  const db = { async query(sql, params) {
    if (/FROM knowledge_sources ks/.test(sql)) {
      assert.deepEqual(params, ['source-1', 'site-1', 'tenant-1']);
      assert.match(sql, /s\.tenant_id = ks\.tenant_id/);
      return { rows: sourceMatches ? [{ source_type: sourceType }] : [] };
    }
    if (/FROM provider_approval_grants/.test(sql)) {
      lookups++;
      if (lookupError) throw new Error('PRIVATE_DATABASE_MARKER');
      return { rows: row ? [typeof row === 'function' ? row(lookups) : row].filter(Boolean) : [] };
    }
    throw new Error('Unexpected query');
  }};
  return { service: new IngestionEmbeddingService(db, new ProviderApprovalStorageLookupService(db)), get lookups() { return lookups; } };
}

test('source lookup filters the exact ingestion purpose with a bound parameter', () => {
  const result = buildProviderApprovalLookupQuery({ ...context, purpose: "knowledge_ingest'; --" });
  assert.match(result.sql, /purpose = \$10/);
  assert.equal(result.params[9], "knowledge_ingest'; --");
  assert.equal(result.sql.includes("knowledge_ingest'; --"), false);
});

for (const scope of ['source', 'source_type']) {
  test(`installed SDK permits exact ${scope} ingestion grant with debug logging disabled`, async () => {
    await withTransport(async requests => {
      const { service } = runtime({ row: grant({ scope_kind: scope, source_id: scope === 'source' ? 'source-1' : null }) });
      assert.deepEqual(await service.embed('PRIVATE_PROMPT_MARKER', context), [1, 2, 3]);
      assert.deepEqual(requests, [{ url: 'https://api.openai.com/v1/embeddings',
        body: { model: 'text-embedding-3-small', input: 'PRIVATE_PROMPT_MARKER', encoding_format: 'float' }, redirect: 'error' }]);
    });
  });
}

const denied = [
  ['missing', { row: null }], ['expired', { row: grant({ expires_at: '2001-01-01T00:00:00Z' }) }],
  ['revoked', { row: grant({ revoked_at: '2021-01-01T00:00:00Z' }) }],
  ['future', { row: grant({ valid_from: '2098-01-01T00:00:00Z' }) }],
  ['tenant', { row: grant({ tenant_id: 'foreign' }) }], ['site', { row: grant({ site_id: 'foreign' }) }],
  ['source', { row: grant({ source_id: 'foreign' }) }], ['ownership', { sourceMatches: false }],
  ['source type', { row: grant({ source_types: ['pdf'] }) }], ['lookup failure', { lookupError: true }],
  ['provider', { row: grant({ provider_key: 'foreign' }) }], ['model', { row: grant({ model: 'foreign' }) }],
  ['environment', { row: grant({ environment: 'production' }) }], ['DPA', { row: grant({ provider_dpa_approved: false }) }],
  ['customer data', { row: grant({ customer_data_approved: false }) }],
  ['purpose', { row: grant({ purpose: 'other' }) }], ['mixed usage', { row: grant({ usage_contexts: ['knowledge_ingest', 'knowledge_reindex'] }) }],
  ...['query_embedding', 'llm_generation'].map(purpose => [purpose, { row: grant({ scope_kind: 'site_runtime', source_id: null, source_types: [], purpose, usage_contexts: [purpose] }) }]),
  ['reindex does not permit initial ingestion', { row: grant({ purpose: 'knowledge_reindex', usage_contexts: ['knowledge_reindex'] }) }],
];
for (const [name, options] of denied) test(`denied ${name}: zero calls at actual SDK transport`, async () => {
  await withTransport(async requests => {
    await assert.rejects(runtime(options).service.embed('PRIVATE_PROMPT_MARKER', context), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 0);
  });
});

test('missing context and invalid deployment/provider configuration fail before transport', async () => {
  await withTransport(async requests => {
    for (const invalid of [undefined, {}, { ...context, tenantId: '' }, { ...context, siteId: '' }, { ...context, sourceId: '' }, { ...context, purpose: 'query_embedding' }]) {
      await assert.rejects(runtime().service.embed('text', invalid), { message: INGESTION_FAILURE });
    }
    for (const [key, value] of [['APP_ENV', 'invalid'], ['OPENAI_BASE_URL', 'https://other.invalid/v1'], ['OPENAI_EMBED_PROVIDER', 'other'], ['OPENAI_EMBED_MODEL', 'bad model']]) {
      process.env[key] = value;
      await assert.rejects(runtime().service.embed('text', context), { message: INGESTION_FAILURE });
      delete process.env[key];
    }
    assert.equal(requests.length, 0);
  });
});

test('SDK retries are disabled; every caller retry checks a newly revoked grant', async () => {
  await withTransport(async requests => {
    const r = runtime({ row: n => grant(n > 1 ? { revoked_at: '2021-01-01T00:00:00Z' } : {}) });
    await assert.rejects(r.service.embed('text', context), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 1);
    await assert.rejects(r.service.embed('text', context), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 1); assert.equal(r.lookups, 2);
  }, () => new Response(JSON.stringify({ error: { message: 'PRIVATE_PROVIDER_ERROR' } }), { status: 500 }));
});

test('redirect responses are not followed and remain sanitized', async () => {
  await withTransport(async requests => {
    await assert.rejects(runtime().service.embed('text', context), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 1); assert.equal(requests[0].redirect, 'error');
  }, () => new Response(null, { status: 307, headers: { location: 'https://other.invalid' } }));
});

function ingestion({ sourceType = 'manual', row, ready = false } = {}) {
  const r = runtime({ sourceType, row: row === undefined ? grant({ source_types: [sourceType] }) : row });
  const state = { source: { id: 'source-1', siteId: 'site-1', tenantId: 'tenant-1', type: sourceType,
    runtimeReadiness: ready ? 'ready' : 'not_ready', title: 'Synthetic source', metadata: { content: 'synthetic text', items: [{ q: 'Q', a: 'A' }] } },
    writes: [], ready: 0, failed: 0 };
  const db = { async query(sql, params) { state.writes.push(sql); return { rows: /FOR UPDATE/.test(sql) ? [{ id: 'source-1' }] : [] }; },
    async transaction(fn) { return fn(this); } };
  const sources = {
    async createForSite(input) { state.source.type = input.sourceType; return 'source-1'; },
    async getById() { return state.source; }, async markProcessing() {},
    async markReady(id, metadata, tx) { assert.equal(tx, db); state.ready++; state.source.runtimeReadiness = 'ready'; },
    async markFailed() { state.failed++; state.source.runtimeReadiness = 'failed'; },
  };
  const vector = { async upsertChunk(input, tx) { assert.equal(tx, db); state.writes.push('CHUNK'); return { id: input.id, skipped: false }; } };
  const service = new IngestService(db, vector,
    { async getSite() { return { id: 'site-1', tenant_id: 'tenant-1' }; } }, sources, undefined, r.service);
  return { service, state };
}

for (const kind of ['faq', 'manual']) test(`${kind} entrypoint fails without grant and never becomes ready`, async () => {
  await withTransport(async requests => {
    const { service, state } = ingestion({ sourceType: kind, row: null });
    await assert.rejects(kind === 'faq' ? service.ingestFaq('site-1', 'FAQ', [{ q: 'Q', a: 'A' }])
      : service.ingestManual('site-1', { title: 'Manual', content: 'text' }), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 0); assert.equal(state.ready, 0); assert.equal(state.failed, 1); assert.deepEqual(state.writes, []);
  });
});

test('FAQ batch checks each chunk and does not persist a partial batch after revocation', async () => {
  await withTransport(async requests => {
    const { service, state } = ingestion({ sourceType: 'faq', row: n => grant({ source_types: ['faq'], ...(n > 1 ? { revoked_at: '2021-01-01T00:00:00Z' } : {}) }) });
    await assert.rejects(service.ingestFaq('site-1', 'FAQ', [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }]), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 1); assert.deepEqual(state.writes, []); assert.equal(state.ready, 0); assert.equal(state.failed, 1);
  });
});

test('manual success atomically stores chunks and marks ready after authorized transport', async () => {
  await withTransport(async requests => {
    const { service, state } = ingestion();
    await service.ingestManual('site-1', { title: 'Manual', content: 'synthetic text' });
    assert.equal(requests.length, 1); assert.equal(state.ready, 1); assert.ok(state.writes.includes('CHUNK'));
  });
});

for (const sourceType of ['faq', 'manual', 'it_support_template']) test(`${sourceType} reindex denial preserves existing valid knowledge`, async () => {
  await withTransport(async requests => {
    const { service, state } = ingestion({ sourceType, ready: true });
    await assert.rejects(service.resyncSource('source-1'), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 0); assert.equal(state.failed, 0); assert.equal(state.source.runtimeReadiness, 'ready'); assert.deepEqual(state.writes, []);
  });
});

test('reindex requires and accepts its own exact purpose while retaining source type', async () => {
  await withTransport(async requests => {
    const { service } = ingestion({ sourceType: 'it_support_template', row: grant({ source_types: ['it_support_template'], purpose: 'knowledge_reindex', usage_contexts: ['knowledge_reindex'] }) });
    await service.resyncSource('source-1'); assert.equal(requests.length, 1);
  });
});

async function withPdfParser(text, callback) {
  const pdf = require('pdf-parse');
  const original = pdf.PDFParse;
  const modulePath = require.resolve('../dist/ingest/ingest.service.js');
  const cached = require.cache[modulePath];
  let destroyed = 0;
  try {
    pdf.PDFParse = class { async getText() { return { text }; } async destroy() { destroyed++; } };
    delete require.cache[modulePath];
    const { IngestService: PdfIngestService } = require(modulePath);
    await callback(PdfIngestService);
    assert.equal(destroyed, 1);
  } finally { pdf.PDFParse = original; require.cache[modulePath] = cached; }
}

for (const allowed of [false, true]) test(`PDF parser-to-provider path ${allowed ? 'allows exact grant' : 'denies without grant'}`, async () => {
  await withPdfParser('Synthetic PDF text', async PdfIngestService => {
    await withTransport(async requests => {
      const { service, state } = ingestion({ sourceType: 'pdf', row: allowed ? grant({ source_types: ['pdf'] }) : null });
      Object.setPrototypeOf(service, PdfIngestService.prototype);
      const operation = service.ingestPdf('site-1', { originalname: 'synthetic.pdf', buffer: Buffer.from('synthetic-pdf-parser-fixture') });
      if (allowed) {
        const result = await operation; assert.equal(result.chunks, 1); assert.equal(state.ready, 1);
      } else {
        await assert.rejects(operation, { message: INGESTION_FAILURE });
        assert.equal(state.failed, 1); assert.deepEqual(state.writes, []);
      }
      assert.equal(requests.length, allowed ? 1 : 0);
    });
  });
});

test('PDF with no extractable text records failure without transport', async () => {
  await withPdfParser('', async PdfIngestService => {
    await withTransport(async requests => {
      const { service, state } = ingestion({ sourceType: 'pdf' }); Object.setPrototypeOf(service, PdfIngestService.prototype);
      await assert.rejects(service.ingestPdf('site-1', { originalname: 'synthetic.pdf', buffer: Buffer.from('empty') }), /no extractable text/);
      assert.equal(state.failed, 1); assert.equal(requests.length, 0);
    });
  });
});

for (const allowed of [false, true]) test(`FAQ update ${allowed ? 'uses reindex grant' : 'rejects initial-ingestion grant'} before replacing chunk`, async () => {
  await withTransport(async requests => {
    const r = runtime({ sourceType: 'faq', row: grant({ source_types: ['faq'], ...(allowed ? { purpose: 'knowledge_reindex', usage_contexts: ['knowledge_reindex'] } : {}) }) });
    let writes = 0;
    const service = new IngestService({ async query(sql) {
      assert.match(sql, /d\.tenant_id = c\.tenant_id/);
      return { rows: [{ id: 'chunk-1', site_id: 'site-1', tenant_id: 'tenant-1', source_id: 'source-1', metadata: {} }] };
    }}, { async updateChunk() { writes++; } }, {}, {}, undefined, r.service);
    const operation = service.updateFaqItem('chunk-1', 'Q', 'A');
    if (allowed) await operation;
    else await assert.rejects(operation, { message: INGESTION_FAILURE });
    assert.equal(requests.length, allowed ? 1 : 0); assert.equal(writes, allowed ? 1 : 0);
  });
});

test('direct existing-source entrypoint rejects foreign tenant/site/source before any writes or HTTP', async () => {
  await withTransport(async requests => {
    for (const change of [{ tenantId: 'foreign' }, { siteId: 'foreign' }, { type: 'pdf' }]) {
      const { service, state } = ingestion({ ready: true });
      await assert.rejects(service.ingestTextIntoExistingSource({ ...context, type: 'manual', title: 'T', text: 'text', metadata: {}, ...change }), { message: INGESTION_FAILURE });
      assert.deepEqual(state.writes, []); assert.equal(state.failed, 0);
    }
    assert.equal(requests.length, 0);
  });
});

test('reindex provider failure preserves old documents and ready status', async () => {
  await withTransport(async requests => {
    const { service, state } = ingestion({ ready: true, row: grant({ purpose: 'knowledge_reindex', usage_contexts: ['knowledge_reindex'] }) });
    await assert.rejects(service.resyncSource('source-1'), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 1); assert.deepEqual(state.writes, []);
    assert.equal(state.source.runtimeReadiness, 'ready'); assert.equal(state.failed, 0);
  }, () => new Response(JSON.stringify({ error: { message: 'RAW_PROVIDER_RESPONSE' } }), { status: 500 }));
});

test('source ownership is checked again for each chunk, even with a valid source-type grant', async () => {
  await withTransport(async requests => {
    const { service } = runtime({ row: grant({ scope_kind: 'source_type', source_id: null }) });
    const original = service.db.query; let ownership = 0;
    service.db.query = async (sql, params) => /FROM knowledge_sources ks/.test(sql) && ++ownership > 1 ? { rows: [] } : original(sql, params);
    await service.embed('first', context);
    await assert.rejects(service.embed('second', context), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 1);
  });
});

test('production requires approval and normalized configuration binds the actual request', async () => {
  await withTransport(async requests => {
    process.env.NODE_ENV = 'production'; process.env.APP_ENV = 'production';
    process.env.OPENAI_EMBED_MODEL = '  text-embedding-3-small  ';
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1/';
    await assert.rejects(runtime({ row: grant({ environment: 'production' }) }).service.embed('text', context), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 0);
    await runtime({ row: grant({ environment: 'production', production_approved: true }) }).service.embed('text', context);
    assert.equal(requests.length, 1); assert.equal(requests[0].body.model, 'text-embedding-3-small');
  });
});

test('reindex validation retains HTTP 400 for missing content and PDF re-upload requirement', async () => {
  await withTransport(async requests => {
    for (const sourceType of ['faq', 'manual', 'it_support_template', 'pdf']) {
      const { service, state } = ingestion({ sourceType, ready: true });
      state.source.metadata = {};
      await assert.rejects(service.resyncSource('source-1'), error => error.status === 400);
      assert.equal(state.failed, 0); assert.equal(state.source.runtimeReadiness, 'ready');
      assert.deepEqual(state.writes, []);
    }
    assert.equal(requests.length, 0);
  });
});

for (const failAt of ['chunk', 'ready']) test(`real transaction wrapper rolls back replacement on ${failAt} failure`, async () => {
  const { DatabaseService } = require('../dist/db/database.service.js');
  const { VectorService } = require('../dist/vector/vector.service.js');
  const { KnowledgeSourcesService } = require('../dist/knowledge-sources/knowledge-sources.service.js');
  await withTransport(async requests => {
    const { service, state } = ingestion({ ready: true, row: grant({ purpose: 'knowledge_reindex', usage_contexts: ['knowledge_reindex'] }) });
    const statements = []; let stored = ['old-valid-document', 'old-valid-chunk']; let snapshot;
    let releases = 0;
    const client = {
      async query(sql) {
        statements.push(sql);
        if (sql === 'BEGIN') snapshot = [...stored];
        if (sql === 'ROLLBACK') stored = snapshot;
        if (/DELETE FROM documents/.test(sql)) stored = [];
        if (/INSERT INTO documents/.test(sql)) stored.push('replacement-document');
        if (/INSERT INTO chunks/.test(sql)) { if (failAt === 'chunk') throw new Error('PRIVATE_STORAGE_MARKER'); stored.push('replacement-chunk'); }
        if (/UPDATE knowledge_sources/.test(sql) && failAt === 'ready') throw new Error('PRIVATE_READY_MARKER');
        return { rows: /FOR UPDATE/.test(sql) ? [{ id: 'source-1' }] : [] };
      },
      release() { releases++; },
    };
    const db = Object.create(DatabaseService.prototype);
    db.pool = { async connect() { return client; } };
    service.db = db; service.vector = new VectorService(db);
    service.knowledgeSources.markReady = KnowledgeSourcesService.prototype.markReady.bind({ db });
    await assert.rejects(service.resyncSource('source-1'), { message: INGESTION_FAILURE });
    assert.equal(requests.length, 1);
    assert.deepEqual(stored, ['old-valid-document', 'old-valid-chunk']);
    assert.equal(statements[0], 'BEGIN'); assert.equal(statements.at(-1), 'ROLLBACK');
    assert.equal(statements.includes('COMMIT'), false); assert.equal(releases, 1);
    assert.equal(state.failed, 0); assert.equal(state.source.runtimeReadiness, 'ready');
  });
});
