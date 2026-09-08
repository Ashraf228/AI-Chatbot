const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RuntimeQueryEmbeddingService,
} = require('../dist/knowledge-sources/runtime-query-embedding.service.js');
const {
  KnowledgeSourcesService,
} = require('../dist/knowledge-sources/knowledge-sources.service.js');

function withEnv(env, fn) {
  const previous = {
    OPENAI_EMBED_PROVIDER: process.env.OPENAI_EMBED_PROVIDER,
    OPENAI_EMBED_MODEL: process.env.OPENAI_EMBED_MODEL,
    NODE_ENV: process.env.NODE_ENV,
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function createRuntimeService({
  hasReadySources = true,
  approvalDecision,
  resolvedConfig = {
    providerKey: 'openai',
    model: 'text-embedding-3-small',
  },
  supportsResolvedConfig = true,
} = {}) {
  const calls = {
    ready: [],
    approval: [],
    embed: [],
  };

  const service = new RuntimeQueryEmbeddingService(
    {
      async hasActiveRuntimeReadySource(tenantId, siteId) {
        calls.ready.push({ tenantId, siteId });
        return hasReadySources;
      },
    },
    {
      async evaluateSiteRuntimeQueryEmbeddingApprovalFromStorage(input) {
        calls.approval.push(input);
        return approvalDecision || {
          allowed: true,
          decisionCode: 'allowed',
          reason: 'provider_approval_storage_lookup_matched',
          sanitizedMessage: 'ok',
        };
      },
    },
    {
      resolveConfig() {
        return resolvedConfig;
      },
      supportsResolvedConfig() {
        return supportsResolvedConfig;
      },
      async embedWithResolvedConfig(query, config) {
        calls.embed.push({ query, config });
        return [0.1, 0.2, 0.3];
      },
    },
  );

  return { service, calls };
}

test('KnowledgeSourcesService hasActiveRuntimeReadySource uses exact tenant, site, active, and ready filters', async () => {
  let captured = null;
  const service = new KnowledgeSourcesService(
    {
      async query(sql, params) {
        captured = { sql, params };
        return { rows: [{ ready: 1 }] };
      },
    },
    {},
  );

  const result = await service.hasActiveRuntimeReadySource('tenant-1', 'site-1');

  assert.equal(result, true);
  assert.deepEqual(captured.params, ['tenant-1', 'site-1']);
  assert.match(captured.sql, /tenant_id = \$1/);
  assert.match(captured.sql, /site_id = \$2/);
  assert.match(captured.sql, /is_active = true/);
  assert.match(captured.sql, /runtime_readiness = 'ready'/);
  assert.doesNotMatch(captured.sql, /tenant_id IS NULL/);
  assert.doesNotMatch(captured.sql, /source_type/i);
});

test('RuntimeQueryEmbeddingService returns no_ready_sources without grant lookup or embedding', async () => {
  const { service, calls } = createRuntimeService({ hasReadySources: false });

  const result = await service.embedAuthorizedQuery({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    query: 'Wie richte ich VPN ein?',
  });

  assert.equal(result.kind, 'no_ready_sources');
  assert.equal(calls.ready.length, 1);
  assert.equal(calls.approval.length, 0);
  assert.equal(calls.embed.length, 0);
});

test('RuntimeQueryEmbeddingService uses one exact site_runtime lookup and one embedding for a valid runtime query', async () => {
  const { service, calls } = createRuntimeService();

  await withEnv(
    {
      OPENAI_EMBED_PROVIDER: 'openai',
      OPENAI_EMBED_MODEL: 'text-embedding-3-small',
      NODE_ENV: 'production',
    },
    async () => {
      const result = await service.embedAuthorizedQuery({
        tenantId: 'tenant-prod',
        siteId: 'site-prod',
        query: 'Produktfrage',
      });

      assert.equal(result.kind, 'embedded');
      assert.equal(result.environment, 'production');
      assert.deepEqual(result.embedding, [0.1, 0.2, 0.3]);
    },
  );

  assert.deepEqual(calls.ready, [{ tenantId: 'tenant-prod', siteId: 'site-prod' }]);
  assert.equal(calls.approval.length, 1);
  assert.deepEqual(calls.approval[0], {
    tenantId: 'tenant-prod',
    siteId: 'site-prod',
    environment: 'production',
    providerKey: 'openai',
    model: 'text-embedding-3-small',
  });
  assert.equal(calls.embed.length, 1);
  assert.deepEqual(calls.embed[0], {
    query: 'Produktfrage',
    config: {
      providerKey: 'openai',
      model: 'text-embedding-3-small',
    },
  });
});

test('RuntimeQueryEmbeddingService fails closed on denied runtime grants without embedding', async () => {
  const { service, calls } = createRuntimeService({
    approvalDecision: {
      allowed: false,
      decisionCode: 'missing_policy',
      reason: 'provider_approval_storage_grant_missing',
      sanitizedMessage: 'blocked',
    },
  });

  const result = await service.embedAuthorizedQuery({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    query: 'VPN',
  });

  assert.equal(result.kind, 'denied');
  assert.equal(result.decisionCode, 'missing_policy');
  assert.equal(calls.approval.length, 1);
  assert.equal(calls.embed.length, 0);
});

test('RuntimeQueryEmbeddingService does not embed when a site runtime grant has the wrong purpose', async () => {
  const { service, calls } = createRuntimeService({
    approvalDecision: {
      allowed: false,
      decisionCode: 'missing_policy',
      reason: 'provider_approval_storage_grant_missing',
      sanitizedMessage: 'blocked',
    },
  });

  const result = await service.embedAuthorizedQuery({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    query: 'VPN',
  });

  assert.equal(result.kind, 'denied');
  assert.equal(result.decisionCode, 'missing_policy');
  assert.equal(calls.approval.length, 1);
  assert.equal(calls.embed.length, 0);
});

test('RuntimeQueryEmbeddingService fails closed when the configured provider cannot be proven at call time', async () => {
  const { service, calls } = createRuntimeService({
    resolvedConfig: {
      providerKey: 'custom-provider',
      model: 'custom-model',
    },
    supportsResolvedConfig: false,
  });

  const result = await service.embedAuthorizedQuery({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    query: 'Support',
  });

  assert.equal(result.kind, 'denied');
  assert.equal(result.decisionCode, 'unsupported_provider_configuration');
  assert.equal(calls.ready.length, 0);
  assert.equal(calls.approval.length, 0);
  assert.equal(calls.embed.length, 0);
});

test('RuntimeQueryEmbeddingService does not increase grant lookups when multiple runtime-ready sources exist', async () => {
  const { service, calls } = createRuntimeService({ hasReadySources: true });

  const result = await service.embedAuthorizedQuery({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    query: 'Mehrere Quellen',
  });

  assert.equal(result.kind, 'embedded');
  assert.equal(calls.approval.length, 1);
  assert.equal(calls.embed.length, 1);
});
