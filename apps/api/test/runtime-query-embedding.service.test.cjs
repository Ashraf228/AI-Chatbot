const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

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
    APP_ENV: process.env.APP_ENV,
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
      async embedWithResolvedConfig(query, config, authorizeTransport) {
        await authorizeTransport();
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

test('RuntimeQueryEmbeddingService maps explicit staging to the non-production approval environment', async () => {
  const { service, calls } = createRuntimeService();

  await withEnv({ NODE_ENV: 'production', APP_ENV: 'staging' }, async () => {
    const result = await service.embedAuthorizedQuery({
      tenantId: 'tenant-staging',
      siteId: 'site-staging',
      query: 'Staging-Frage',
    });

    assert.equal(result.kind, 'embedded');
    assert.equal(result.environment, 'non_production');
  });

  assert.equal(calls.approval.length, 1);
  assert.equal(calls.approval[0].environment, 'non_production');
  assert.equal(calls.embed.length, 1);
});

test('RuntimeQueryEmbeddingService resolves the complete NODE_ENV and APP_ENV decision table', async () => {
  const validCases = [
    { nodeEnv: 'production', appEnv: undefined, environment: 'production' },
    { nodeEnv: 'production', appEnv: 'production', environment: 'production' },
    { nodeEnv: 'production', appEnv: 'staging', environment: 'non_production' },
    { nodeEnv: 'development', appEnv: undefined, environment: 'non_production' },
    { nodeEnv: 'development', appEnv: 'staging', environment: 'non_production' },
    { nodeEnv: 'test', appEnv: undefined, environment: 'non_production' },
    { nodeEnv: 'test', appEnv: 'staging', environment: 'non_production' },
    { nodeEnv: 'custom', appEnv: undefined, environment: 'non_production' },
    { nodeEnv: 'custom', appEnv: 'staging', environment: 'non_production' },
    { nodeEnv: undefined, appEnv: undefined, environment: 'non_production' },
    { nodeEnv: undefined, appEnv: 'staging', environment: 'non_production' },
  ];

  for (const current of validCases) {
    const { service } = createRuntimeService();
    await withEnv({ NODE_ENV: current.nodeEnv, APP_ENV: current.appEnv }, async () => {
      const contract = service.resolveRuntimeContract();
      assert.equal(contract.supported, true);
      assert.equal(contract.environment, current.environment);
    });
  }

  const invalidCases = [
    { nodeEnv: 'development', appEnv: 'production' },
    { nodeEnv: 'test', appEnv: 'production' },
    { nodeEnv: 'custom', appEnv: 'production' },
    { nodeEnv: undefined, appEnv: 'production' },
    { nodeEnv: 'production', appEnv: '' },
    { nodeEnv: 'production', appEnv: 'STAGING' },
    { nodeEnv: 'production', appEnv: ' staging ' },
    { nodeEnv: 'production', appEnv: 'unknown' },
  ];

  for (const current of invalidCases) {
    const { service } = createRuntimeService();
    await withEnv({ NODE_ENV: current.nodeEnv, APP_ENV: current.appEnv }, async () => {
      const contract = service.resolveRuntimeContract();
      assert.deepEqual(contract, {
        environment: null,
        providerKey: 'openai',
        model: 'text-embedding-3-small',
        supported: false,
        reason: 'invalid_deployment_environment',
      });
    });
  }
});

test('RuntimeQueryEmbeddingService rejects invalid APP_ENV before source, grant, or embedding work', async () => {
  for (const appEnv of ['', 'STAGING', ' staging ', 'unknown']) {
    const { service, calls } = createRuntimeService();
    await withEnv({ NODE_ENV: 'production', APP_ENV: appEnv }, async () => {
      const result = await service.embedAuthorizedQuery({
        tenantId: 'tenant-1',
        siteId: 'site-1',
        query: 'Support',
      });
      assert.equal(result.kind, 'denied');
      assert.equal(result.decisionCode, 'unsupported_provider_configuration');
      assert.equal(result.reason, 'runtime_query_embedding_deployment_environment_invalid');
      assert.equal(result.environment, null);
    });
    assert.deepEqual(calls, { ready: [], approval: [], embed: [] });
  }
});

test('production and staging Compose bind the API to explicit deployment environments', () => {
  const repositoryRoot = join(__dirname, '..', '..', '..');
  const productionCompose = readFileSync(join(repositoryRoot, 'docker-compose.yml'), 'utf8');
  const stagingCompose = readFileSync(join(repositoryRoot, 'docker-compose.staging.yml'), 'utf8');
  const productionApi = productionCompose.split('\n  api:')[1].split('\n  dashboard:')[0];
  const stagingApi = stagingCompose.split('\n  api:')[1].split('\n  dashboard:')[0];

  assert.match(productionApi, /NODE_ENV: production/);
  assert.match(productionApi, /APP_ENV: production/);
  assert.doesNotMatch(productionApi, /APP_ENV:\s*\$\{/);
  assert.match(stagingCompose, /x-staging-app-env:[\s\S]*?APP_ENV: staging/);
  assert.match(stagingApi, /<<: \*staging-app-env/);
  assert.match(stagingApi, /NODE_ENV: production/);
});

test('RuntimeQueryEmbeddingService exposes the same resolved runtime contract used by the lookup boundary', async () => {
  const { service } = createRuntimeService({
    resolvedConfig: { providerKey: 'openai', model: 'text-embedding-3-small' },
  });
  const contract = service.resolveRuntimeContract();
  assert.equal(contract.supported, true);
  assert.equal(contract.providerKey, 'openai');
  assert.equal(contract.model, 'text-embedding-3-small');
  assert.equal(contract.environment, 'non_production');
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
