const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ItKnowledgeTemplateImportService,
} = require('../dist/modules/it-support/it-knowledge-template-import.service.js');
const {
  KnowledgeSourcesService,
} = require('../dist/knowledge-sources/knowledge-sources.service.js');

function createHarness(options = {}) {
  const state = {
    queries: [],
    createdSources: [],
    overwrittenSources: [],
    limitChecks: [],
    transactionCalls: 0,
    committed: false,
    rolledBack: false,
  };
  const existingByTemplateKey = new Map(Object.entries(options.existingByTemplateKey || {}));
  const siteTenantId = options.siteTenantId === undefined ? 'tenant-1' : options.siteTenantId;
  const tx = {
    async query(sql, params = []) {
      state.queries.push({ sql, params, transaction: true });
      if (/FROM sites/i.test(sql)) {
        if (options.siteMissing) return { rows: [] };
        return { rows: [{ id: params[0], tenant_id: siteTenantId }] };
      }
      if (/config->>'templateKey' AS template_key/i.test(sql)) {
        return {
          rows: [...existingByTemplateKey].map(([template_key, id]) => ({ id, template_key })),
        };
      }
      if (/DELETE FROM knowledge_sources/i.test(sql)) {
        const allowed = options.deletableSourceId === params[0]
          && siteTenantId === params[1]
          && params[2] === 'site-1';
        return { rows: allowed ? [{ id: params[0] }] : [] };
      }
      if (/FROM documents/i.test(sql)) {
        return { rows: options.documentSourceId === params[0] ? [{ id: 'document-1' }] : [] };
      }
      if (/FROM knowledge_sources/i.test(sql)) {
        if (/FOR UPDATE/i.test(sql)) {
          const allowed = options.deletableSourceId === params[0]
            && siteTenantId === params[1]
            && params[2] === 'site-1'
            && options.deletableSourceIsActive !== true
            && (options.deletableSourceRuntimeReadiness || 'not_ready') === 'not_ready';
          return { rows: allowed ? [{ id: params[0] }] : [] };
        }
        const sourceId = existingByTemplateKey.get(params[2]);
        return {
          rows: sourceId ? [{
            id: sourceId,
            is_active: options.existingIsActive === true,
            runtime_readiness: options.existingRuntimeReadiness || 'not_ready',
          }] : [],
        };
      }
      return { rows: [] };
    },
  };
  const db = {
    query: tx.query,
    async transaction(callback) {
      state.transactionCalls += 1;
      try {
        const result = await callback(tx);
        state.committed = true;
        return result;
      } catch (error) {
        state.rolledBack = true;
        throw error;
      }
    },
  };
  const knowledgeSources = {
    async createForSite(input, queryable) {
      assert.equal(queryable, tx);
      state.createdSources.push(input);
      if (options.failCreateAt === state.createdSources.length) {
        throw new Error('synthetic create failure');
      }
      return `source-${state.createdSources.length}`;
    },
    async replaceWithInactiveDraft(input, queryable) {
      assert.equal(queryable, tx);
      state.overwrittenSources.push(input);
      if (options.failOverwrite) throw new Error('synthetic overwrite failure');
      return input.sourceId;
    },
  };
  const usageLimits = {
    async assertWithinLimit(tenantId, key, increment, queryable) {
      assert.equal(queryable, tx);
      state.limitChecks.push({ tenantId, key, increment });
      if (options.limitExceeded) throw new Error('synthetic plan limit');
    },
  };

  return {
    state,
    service: new ItKnowledgeTemplateImportService(db, knowledgeSources, usageLimits),
  };
}

test('imports selected templates as inactive provider-free drafts in one transaction', async () => {
  const harness = createHarness();
  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    templateKeys: ['vpn-not-connecting'],
    createdBy: 'tenant-user:poweruser-1',
  });

  assert.equal(harness.state.transactionCalls, 1);
  assert.equal(harness.state.committed, true);
  assert.equal(result.imported.length, 1);
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.answerReadyTransitionAdded, false);
  assert.deepEqual(harness.state.limitChecks, [{
    tenantId: 'tenant-1',
    key: 'maxKnowledgeSources',
    increment: 1,
  }]);
  const source = harness.state.createdSources[0];
  assert.equal(source.tenantId, 'tenant-1');
  assert.equal(source.siteId, 'site-1');
  assert.equal(source.sourceType, 'it_support_template');
  assert.equal(source.isActive, false);
  assert.equal(source.ingestStatus, 'created');
  assert.equal(source.indexStatus, 'not_requested');
  assert.equal(source.runtimeReadiness, 'not_ready');
  assert.equal(source.config.templateKey, 'vpn-not-connecting');
  assert.equal(source.config.createdBy, 'tenant-user:poweruser-1');
  assert.equal(source.config.providerCallsUsed, false);
  assert.equal(source.config.answerReady, false);
  assert.match(source.config.content, /# VPN verbindet nicht/);
});

test('skip_existing is idempotent and does not consume another source limit', async () => {
  const harness = createHarness({
    existingByTemplateKey: { 'vpn-not-connecting': 'existing-source' },
  });
  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    templateKeys: ['vpn-not-connecting'],
    mode: 'skip_existing',
  });

  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].sourceId, 'existing-source');
  assert.equal(harness.state.createdSources.length, 0);
  assert.equal(harness.state.overwrittenSources.length, 0);
  assert.equal(harness.state.limitChecks.length, 0);
});

test('overwrite returns an existing source to the inactive draft lifecycle', async () => {
  const harness = createHarness({
    existingByTemplateKey: { 'vpn-not-connecting': 'existing-source' },
  });
  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    templateKeys: ['vpn-not-connecting'],
    mode: 'overwrite',
  });

  assert.equal(result.overwritten.length, 1);
  assert.equal(result.overwritten[0].sourceId, 'existing-source');
  assert.equal(harness.state.createdSources.length, 0);
  assert.equal(harness.state.overwrittenSources.length, 1);
  assert.equal(harness.state.overwrittenSources[0].tenantId, 'tenant-1');
  assert.equal(harness.state.overwrittenSources[0].siteId, 'site-1');
  assert.equal(harness.state.overwrittenSources[0].config.answerReady, false);
});

test('active or ready templates cannot be overwritten through the poweruser import', async () => {
  for (const state of [
    { existingIsActive: true, existingRuntimeReadiness: 'ready' },
    { existingIsActive: true, existingRuntimeReadiness: 'not_ready' },
    { existingIsActive: false, existingRuntimeReadiness: 'ready' },
  ]) {
    const harness = createHarness({
      existingByTemplateKey: { 'vpn-not-connecting': 'existing-source' },
      ...state,
    });
    await assert.rejects(
      () => harness.service.importItKnowledgeTemplatesForSite({
        tenantId: 'tenant-1',
        siteId: 'site-1',
        templateKeys: ['vpn-not-connecting'],
        mode: 'overwrite',
      }),
      /not an editable draft/,
    );
    assert.equal(harness.state.createdSources.length, 0);
    assert.equal(harness.state.overwrittenSources.length, 0);
    assert.equal(harness.state.rolledBack, true);
  }
});

test('draft replacement rechecks lifecycle in SQL before removing stale documents', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: sql.startsWith('UPDATE') ? [{ id: 'source-1' }] : [] };
    },
  };
  const service = new KnowledgeSourcesService(db, {});
  await service.replaceWithInactiveDraft({
    sourceId: 'source-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    label: 'Synthetic draft',
    config: { templateKey: 'vpn-not-connecting' },
  }, db);

  assert.match(calls[0].sql, /source_type = 'it_support_template'/);
  assert.match(calls[0].sql, /is_active = false/);
  assert.match(calls[0].sql, /runtime_readiness = 'not_ready'/);
  assert.equal(calls[1].sql, 'DELETE FROM documents WHERE source_id = $1');
  assert.deepEqual(calls[1].params, ['source-1']);
});

test('all-template import accounts for the full source increment', async () => {
  const harness = createHarness();
  const result = await harness.service.importItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
  });

  assert.ok(result.imported.length >= 15);
  assert.equal(harness.state.createdSources.length, result.imported.length);
  assert.equal(harness.state.limitChecks[0].increment, result.imported.length);
});

test('rejects foreign sites, unknown templates, and unsupported modes', async () => {
  await assert.rejects(
    () => createHarness({ siteTenantId: 'tenant-2' }).service.importItKnowledgeTemplatesForSite({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      templateKeys: ['vpn-not-connecting'],
    }),
    /Site does not belong to tenant/,
  );
  await assert.rejects(
    () => createHarness().service.importItKnowledgeTemplatesForSite({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      templateKeys: ['unknown-template'],
    }),
    /Unknown IT knowledge template/,
  );
  await assert.rejects(
    () => createHarness().service.importItKnowledgeTemplatesForSite({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      templateKeys: ['vpn-not-connecting'],
      mode: 'unsafe-mode',
    }),
    /Invalid import mode/,
  );
});

test('a partial create failure rejects and rolls back the import transaction', async () => {
  const harness = createHarness({ failCreateAt: 2 });
  await assert.rejects(
    () => harness.service.importItKnowledgeTemplatesForSite({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      templateKeys: ['vpn-not-connecting', 'password-reset'],
    }),
    /synthetic create failure/,
  );
  assert.equal(harness.state.rolledBack, true);
  assert.equal(harness.state.committed, false);
});

test('lists imported draft state without exposing an answer-ready transition', async () => {
  const harness = createHarness({
    existingByTemplateKey: { 'vpn-not-connecting': 'existing-source' },
  });
  const result = await harness.service.listItKnowledgeTemplatesForSite({
    tenantId: 'tenant-1',
    siteId: 'site-1',
  });
  const vpn = result.templates.find((entry) => entry.key === 'vpn-not-connecting');
  assert.equal(vpn.importedSourceId, 'existing-source');
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.answerReadyTransitionAdded, false);
});

test('deletes only an inactive template draft in the exact tenant and site scope', async () => {
  const harness = createHarness({ deletableSourceId: 'source-owned' });
  const result = await harness.service.deleteItKnowledgeTemplateDraft({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-owned',
  });
  assert.deepEqual(result, {
    ok: true,
    sourceId: 'source-owned',
    siteId: 'site-1',
    providerCallsUsed: false,
  });

  await assert.rejects(
    () => createHarness({ deletableSourceId: 'source-owned' }).service.deleteItKnowledgeTemplateDraft({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      sourceId: 'source-foreign',
    }),
    /Knowledge source not found/,
  );
});

test('locks the eligible draft and rejects deletion when any document remains attached', async () => {
  const harness = createHarness({
    deletableSourceId: 'source-with-document',
    documentSourceId: 'source-with-document',
  });

  await assert.rejects(
    () => harness.service.deleteItKnowledgeTemplateDraft({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      sourceId: 'source-with-document',
    }),
    (error) => error?.status === 409 && error?.message === 'Knowledge source contains documents',
  );

  const sourceLockIndex = harness.state.queries.findIndex(
    ({ sql }) => /FROM knowledge_sources/i.test(sql) && /FOR UPDATE/i.test(sql),
  );
  const documentReadIndex = harness.state.queries.findIndex(({ sql }) => /FROM documents/i.test(sql));
  assert.ok(sourceLockIndex >= 0);
  assert.ok(documentReadIndex > sourceLockIndex);
  assert.equal(harness.state.queries.some(({ sql }) => /DELETE FROM knowledge_sources/i.test(sql)), false);
  assert.equal(harness.state.rolledBack, true);
});

test('keeps foreign, active, and ready template sources protected from deletion', async () => {
  for (const options of [
    { deletableSourceId: 'source-protected', siteTenantId: 'tenant-2' },
    { deletableSourceId: 'source-protected', deletableSourceIsActive: true },
    { deletableSourceId: 'source-protected', deletableSourceRuntimeReadiness: 'ready' },
  ]) {
    const harness = createHarness(options);
    await assert.rejects(
      () => harness.service.deleteItKnowledgeTemplateDraft({
        tenantId: 'tenant-1',
        siteId: 'site-1',
        sourceId: 'source-protected',
      }),
    );
    assert.equal(harness.state.queries.some(({ sql }) => /DELETE FROM knowledge_sources/i.test(sql)), false);
    assert.equal(harness.state.rolledBack, true);
  }
});
