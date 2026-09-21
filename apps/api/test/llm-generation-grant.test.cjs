const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProviderApprovalStorageLookupService,
  buildSiteRuntimeLlmGenerationLookupQuery,
  mapProviderApprovalGrantRow,
} = require('../dist/knowledge-sources/provider-approval-storage-lookup.service.js');
const { LlmService } = require('../dist/vector/llm.service.js');

const FIXTURE_NOW = '2026-09-13T12:00:00.000Z';

function grantRow(overrides = {}) {
  return {
    id: 'llm-grant-1',
    scope_kind: 'site_runtime',
    tenant_id: 'tenant-1',
    site_id: 'site-1',
    source_id: null,
    source_types: [],
    usage_contexts: ['llm_generation'],
    environment: 'non_production',
    provider_key: 'openai',
    model: 'gpt-4.1-mini',
    embedding_dimension: null,
    provider_region: 'eu',
    data_categories: ['synthetic_support_message'],
    customer_data_approved: true,
    production_approved: false,
    provider_dpa_approved: true,
    purpose: 'llm_generation',
    retention_policy: 'no_provider_payload_storage',
    redaction_policy: 'runtime_input_redaction',
    logging_policy: 'metadata_only',
    deletion_policy: 'conversation_retention_policy',
    reindex_policy: null,
    rate_limit: 'synthetic-rate-limit',
    cost_limit: 'synthetic-cost-limit',
    valid_from: '2026-09-01T00:00:00.000Z',
    expires_at: '2026-10-01T00:00:00.000Z',
    revoked_at: null,
    approved_by: 'synthetic-security-owner',
    approval_evidence_ref: 'synthetic-evidence-ref',
    ...overrides,
  };
}

function withRuntimeEnv(callback) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_LOG: process.env.OPENAI_LOG,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };
  process.env.NODE_ENV = 'test';
  delete process.env.APP_ENV;
  process.env.OPENAI_API_KEY = 'synthetic-test-key';
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_LOG;
  process.env.OPENAI_MODEL = 'gpt-4.1-mini';

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

function createSdkRuntime({ rows = [grantRow()], siteMatches = true } = {}) {
  const calls = { site: [], lookup: [] };
  const db = {
    async query(sql, params) {
      if (/FROM provider_approval_grants/i.test(sql)) {
        calls.lookup.push({ sql, params });
        return { rows: typeof rows === 'function' ? rows(calls.lookup.length) : rows };
      }
      if (/FROM sites/i.test(sql)) {
        calls.site.push({ sql, params });
        return { rows: siteMatches ? [{ id: params[0] }] : [] };
      }
      throw new Error('Unexpected synthetic database query');
    },
  };
  const lookup = new ProviderApprovalStorageLookupService(db);
  return { service: new LlmService(db, lookup), calls };
}

async function withMockedFetch(fetchMock, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function retryableProviderResponse(message = 'synthetic retryable provider failure') {
  return new Response(
    JSON.stringify({ error: { message, type: 'server_error' } }),
    { status: 500, headers: { 'content-type': 'application/json' } },
  );
}

function successfulProviderResponse(model = 'gpt-4.1-mini') {
  return new Response(
    JSON.stringify({
      id: 'synthetic-completion',
      object: 'chat.completion',
      created: 0,
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Sicher beantwortet' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function successfulStreamingProviderResponse(content) {
  const event = {
    id: 'synthetic-stream-completion',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'gpt-4.1-mini',
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  };
  return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

async function captureConsoleLoggerCalls(callback) {
  const methods = ['debug', 'info', 'warn', 'error'];
  const originals = Object.fromEntries(methods.map((method) => [method, console[method]]));
  const calls = [];
  for (const method of methods) {
    console[method] = (...args) => calls.push({ method, args });
  }
  try {
    await callback();
    return calls;
  } finally {
    for (const method of methods) console[method] = originals[method];
  }
}

function createRuntime({ rows = [grantRow()], siteMatches = true, lookupError = null, providerError = null } = {}) {
  const calls = { site: [], lookup: [], provider: [] };
  const db = {
    async query(sql, params) {
      if (/FROM provider_approval_grants/i.test(sql)) {
        calls.lookup.push({ sql, params });
        if (lookupError) throw lookupError;
        return { rows: typeof rows === 'function' ? rows(calls.lookup.length) : rows };
      }
      if (/FROM sites/i.test(sql)) {
        calls.site.push({ sql, params });
        return { rows: siteMatches ? [{ id: params[0] }] : [] };
      }
      throw new Error('Unexpected synthetic database query');
    },
  };
  const lookup = new ProviderApprovalStorageLookupService(db);
  const service = new LlmService(db, lookup);
  service.client = {
    chat: {
      completions: {
        async create(input) {
          calls.provider.push(input);
          if (providerError) throw providerError;
          if (input.stream) {
            return (async function* stream() {
              yield { choices: [{ delta: { content: 'Sicher' } }] };
              yield { choices: [{ delta: { content: ' beantwortet' } }] };
            })();
          }
          return {
            choices: [{ message: { content: 'Sicher beantwortet' } }],
            usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
          };
        },
      },
    },
  };
  return { service, calls };
}

async function expectSafeDenial(promise) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, 503);
    assert.match(error.message, /Antwortgenerierung.*nicht sicher verfuegbar/i);
    assert.doesNotMatch(error.message, /grant|policy|provider|openai|tenant|site|database|storage|llm-grant/i);
    return true;
  });
}

test('LLM site-runtime lookup is exact, parameterized, site-owned, and purpose-specific', () => {
  const input = {
    tenantId: "tenant-1'; DROP TABLE sites; --",
    siteId: 'site-1',
    environment: 'non_production',
    providerKey: 'openai',
    model: 'gpt-4.1-mini',
    now: FIXTURE_NOW,
  };
  const { sql, params } = buildSiteRuntimeLlmGenerationLookupQuery(input);
  assert.match(sql, /scope_kind = 'site_runtime'/i);
  assert.match(sql, /purpose = \$7/i);
  assert.match(sql, /usage_contexts = \$8::jsonb/i);
  assert.match(sql, /FROM sites[\s\S]*sites\.id = \$2[\s\S]*sites\.tenant_id = \$1/i);
  assert.match(sql, /LIMIT 2/i);
  assert.equal(sql.includes(input.tenantId), false);
  assert.equal(params[0], input.tenantId);
  assert.equal(params[6], 'llm_generation');
  assert.equal(params[7], '["llm_generation"]');
});

test('site-runtime policy mapping accepts only matching query and LLM purpose/usage pairs', () => {
  assert.equal(mapProviderApprovalGrantRow(grantRow()).purpose, 'llm_generation');
  assert.equal(
    mapProviderApprovalGrantRow(grantRow({ purpose: 'query_embedding', usage_contexts: ['query_embedding'] })).purpose,
    'query_embedding',
  );
  assert.equal(mapProviderApprovalGrantRow(grantRow({ purpose: 'query_embedding' })), null);
  assert.equal(mapProviderApprovalGrantRow(grantRow({ usage_contexts: ['query_embedding'] })), null);
  assert.equal(mapProviderApprovalGrantRow(grantRow({ purpose: 'answer_generation' })), null);
});

test('LlmService authorizes one exact normal attempt before calling the provider', async () => {
  await withRuntimeEnv(async () => {
    const { service, calls } = createRuntime();
    const result = await service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' });

    assert.equal(result.text, 'Sicher beantwortet');
    assert.deepEqual(result.usage, { inputTokens: 2, outputTokens: 3, totalTokens: 5, status: 'confirmed' });
    assert.equal(calls.site.length, 1);
    assert.deepEqual(calls.site[0].params, ['site-1', 'tenant-1']);
    assert.equal(calls.lookup.length, 1);
    assert.equal(calls.lookup[0].params[0], 'tenant-1');
    assert.equal(calls.lookup[0].params[1], 'site-1');
    assert.equal(calls.lookup[0].params[6], 'llm_generation');
    assert.equal(calls.provider.length, 1);
    assert.equal(calls.provider[0].model, 'gpt-4.1-mini');
  });
});

test('LlmService streams only after the same exact grant boundary', async () => {
  await withRuntimeEnv(async () => {
    const { service, calls } = createRuntime();
    const chunks = [];
    const result = await service.streamAnswer(
      'system',
      'user',
      (chunk) => chunks.push(chunk),
      { tenantId: 'tenant-1', siteId: 'site-1' },
    );

    assert.equal(result.text, 'Sicher beantwortet');
    assert.deepEqual(chunks, ['Sicher', ' beantwortet']);
    assert.equal(calls.lookup.length, 1);
    assert.equal(calls.provider.length, 1);
    assert.equal(calls.provider[0].stream, true);
  });
});

test('LlmService denies missing, mismatched, invalid, expired, and revoked grants with zero provider calls', async () => {
  const cases = [
    { name: 'missing grant', options: { rows: [] } },
    { name: 'ambiguous grants', options: { rows: [grantRow(), grantRow({ id: 'llm-grant-2' })] } },
    { name: 'query-embedding grant', options: { rows: [grantRow({ purpose: 'query_embedding', usage_contexts: ['query_embedding'] })] } },
    {
      name: 'ingestion grant',
      options: {
        rows: [grantRow({
          scope_kind: 'source',
          source_id: 'source-1',
          purpose: 'knowledge_ingest',
          usage_contexts: ['website_ingest_runtime_indexing'],
        })],
      },
    },
    { name: 'wrong scope', options: { rows: [grantRow({ scope_kind: 'source_type', source_types: ['faq'] })] } },
    { name: 'wrong tenant', options: { rows: [grantRow({ tenant_id: 'tenant-2' })] } },
    { name: 'wrong site', options: { rows: [grantRow({ site_id: 'site-2' })] } },
    { name: 'wrong provider', options: { rows: [grantRow({ provider_key: 'other-provider' })] } },
    { name: 'wrong model', options: { rows: [grantRow({ model: 'other-model' })] } },
    { name: 'expired', options: { rows: [grantRow({ expires_at: '2026-01-01T00:00:00.000Z' })] } },
    { name: 'revoked', options: { rows: [grantRow({ revoked_at: '2026-09-10T00:00:00.000Z' })] } },
    { name: 'lookup failure', options: { lookupError: new Error('database password=secret') } },
  ];

  await withRuntimeEnv(async () => {
    for (const current of cases) {
      const { service, calls } = createRuntime(current.options);
      await expectSafeDenial(
        service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }),
      );
      assert.equal(calls.provider.length, 0, current.name);
    }
  });
});

test('LlmService binds production approval to the resolved deployment environment', async () => {
  await withRuntimeEnv(async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';

    const denied = createRuntime({
      rows: [grantRow({ environment: 'production', production_approved: false })],
    });
    await expectSafeDenial(
      denied.service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }),
    );
    assert.equal(denied.calls.provider.length, 0);

    const allowed = createRuntime({
      rows: [grantRow({ environment: 'production', production_approved: true })],
    });
    await allowed.service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' });
    assert.equal(allowed.calls.lookup[0].params[4], 'production');
    assert.equal(allowed.calls.provider.length, 1);

    process.env.NODE_ENV = 'test';
    const unsupported = createRuntime();
    await expectSafeDenial(
      unsupported.service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }),
    );
    assert.equal(unsupported.calls.site.length, 0);
    assert.equal(unsupported.calls.lookup.length, 0);
    assert.equal(unsupported.calls.provider.length, 0);
  });
});

test('streaming denial remains generic and performs no provider call', async () => {
  await withRuntimeEnv(async () => {
    const { service, calls } = createRuntime({ rows: [] });
    await expectSafeDenial(
      service.streamAnswer(
        'system',
        'user',
        () => assert.fail('a denied stream must not emit a provider chunk'),
        { tenantId: 'tenant-1', siteId: 'site-1' },
      ),
    );
    assert.equal(calls.provider.length, 0);
  });
});

test('LlmService denies absent context and a site outside the tenant before grant lookup', async () => {
  await withRuntimeEnv(async () => {
    const missingContext = createRuntime();
    await expectSafeDenial(missingContext.service.answer('system', 'user', undefined));
    assert.equal(missingContext.calls.site.length, 0);
    assert.equal(missingContext.calls.lookup.length, 0);
    assert.equal(missingContext.calls.provider.length, 0);

    const foreignSite = createRuntime({ siteMatches: false });
    await expectSafeDenial(
      foreignSite.service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-foreign' }),
    );
    assert.equal(foreignSite.calls.site.length, 1);
    assert.equal(foreignSite.calls.lookup.length, 0);
    assert.equal(foreignSite.calls.provider.length, 0);
  });
});

test('LlmService rejects a manipulated allowed decision that does not match the outgoing context', async () => {
  await withRuntimeEnv(async () => {
    const db = {
      async query() {
        return { rows: [{ id: 'site-1' }] };
      },
    };
    const service = new LlmService(db, {
      async evaluateSiteRuntimeLlmGenerationApprovalFromStorage() {
        return {
          allowed: true,
          decisionCode: 'allowed',
          policy: {
            ...mapProviderApprovalGrantRow(grantRow()),
            tenantId: 'tenant-foreign',
          },
        };
      },
    });
    let providerCalls = 0;
    service.client = { chat: { completions: { async create() { providerCalls += 1; } } } };

    await expectSafeDenial(
      service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }),
    );
    assert.equal(providerCalls, 0);
  });
});

test('each caller retry performs a fresh lookup and cannot reuse a revoked or missing grant', async () => {
  await withRuntimeEnv(async () => {
    const { service, calls } = createRuntime({
      rows: (lookupCount) => (lookupCount === 1 ? [grantRow()] : []),
      providerError: new Error('synthetic provider failure'),
    });

    await assert.rejects(
      service.answer('system', 'first', { tenantId: 'tenant-1', siteId: 'site-1' }),
      /synthetic provider failure/,
    );
    await expectSafeDenial(
      service.answer('system', 'retry', { tenantId: 'tenant-1', siteId: 'site-1' }),
    );

    assert.equal(calls.lookup.length, 2);
    assert.equal(calls.provider.length, 1);
  });
});

test('the actual SDK performs one normal HTTP attempt and a revoked caller retry performs none', async () => {
  await withRuntimeEnv(async () => {
    const { service, calls } = createSdkRuntime({
      rows: (lookupCount) => lookupCount === 1
        ? [grantRow()]
        : [grantRow({ revoked_at: '2026-09-13T12:00:00.000Z' })],
    });
    const requests = [];

    await withMockedFetch(async (input, init) => {
      requests.push({ url: input instanceof Request ? input.url : input.toString(), init });
      return retryableProviderResponse();
    }, async () => {
      await assert.rejects(
        service.answer('system', 'first', { tenantId: 'tenant-1', siteId: 'site-1' }),
        /synthetic retryable provider failure/,
      );
      assert.equal(requests.length, 1);

      await expectSafeDenial(
        service.answer('system', 'revoked retry', { tenantId: 'tenant-1', siteId: 'site-1' }),
      );
    });

    assert.equal(requests.length, 1);
    assert.equal(calls.lookup.length, 2);
  });
});

test('the actual SDK performs one streaming HTTP attempt and an expired caller retry performs none', async () => {
  await withRuntimeEnv(async () => {
    const { service, calls } = createSdkRuntime({
      rows: (lookupCount) => lookupCount === 1
        ? [grantRow()]
        : [grantRow({ expires_at: '2026-09-13T11:59:59.000Z' })],
    });
    const requests = [];

    await withMockedFetch(async (input, init) => {
      requests.push({ url: input instanceof Request ? input.url : input.toString(), init });
      return retryableProviderResponse();
    }, async () => {
      await assert.rejects(
        service.streamAnswer(
          'system',
          'first',
          () => {},
          { tenantId: 'tenant-1', siteId: 'site-1' },
        ),
        /synthetic retryable provider failure/,
      );
      assert.equal(requests.length, 1);

      await expectSafeDenial(
        service.streamAnswer(
          'system',
          'expired retry',
          () => {},
          { tenantId: 'tenant-1', siteId: 'site-1' },
        ),
      );
    });

    assert.equal(requests.length, 1);
    assert.equal(calls.lookup.length, 2);
  });
});

test('the actual SDK uses the same normalized model and fixed endpoint as the grant lookup', async () => {
  await withRuntimeEnv(async () => {
    process.env.OPENAI_MODEL = '  gpt-4.1-mini  ';
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1/';
    const { service, calls } = createSdkRuntime();
    const requests = [];

    const result = await withMockedFetch(async (input, init) => {
      requests.push({
        url: input instanceof Request ? input.url : input.toString(),
        body: JSON.parse(init.body),
        redirect: init.redirect,
      });
      return successfulProviderResponse();
    }, () => service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }));

    assert.equal(result.model, 'gpt-4.1-mini');
    assert.equal(calls.lookup[0].params[3], 'gpt-4.1-mini');
    assert.deepEqual(requests, [{
      url: 'https://api.openai.com/v1/chat/completions',
      body: {
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'user' },
        ],
      },
      redirect: 'error',
    }]);
  });
});

test('LLM administration, lookup and actual SDK bind to the same configured model without live HTTP', async () => {
  await withRuntimeEnv(async () => {
    const { resolveSiteRuntimeLlmGrantRuntimeContract } = require('../dist/knowledge-sources/site-runtime-grant-runtime-contract.js');
    process.env.OPENAI_MODEL = '  gpt-5.4-mini  ';
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1/';
    const contract = resolveSiteRuntimeLlmGrantRuntimeContract();
    assert.deepEqual(contract, {
      supported: true, environment: 'non_production', providerKey: 'openai', model: 'gpt-5.4-mini',
    });
    assert.equal(JSON.stringify(contract).includes('synthetic-test-key'), false);
    const { service, calls } = createSdkRuntime({ rows: [grantRow({ model: contract.model })] });
    const requests = [];
    await withMockedFetch(async (input, init) => {
      requests.push({ url: input instanceof Request ? input.url : input.toString(), body: JSON.parse(init.body) });
      return successfulProviderResponse(contract.model);
    }, () => service.answer('synthetic system', 'synthetic user', { tenantId: 'tenant-1', siteId: 'site-1' }));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(requests[0].body.model, contract.model);
    assert.equal(calls.lookup[0].params[3], contract.model);
  });
});

test('invalid provider endpoint and model configuration fail closed before any HTTP request', async () => {
  await withRuntimeEnv(async () => {
    let requests = 0;
    await withMockedFetch(async () => {
      requests += 1;
      return successfulProviderResponse();
    }, async () => {
      process.env.OPENAI_BASE_URL = 'https://unapproved-provider.invalid/v1';
      const invalidEndpoint = createSdkRuntime();
      await expectSafeDenial(
        invalidEndpoint.service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }),
      );
      assert.equal(invalidEndpoint.calls.site.length, 0);
      assert.equal(invalidEndpoint.calls.lookup.length, 0);

      delete process.env.OPENAI_BASE_URL;
      process.env.OPENAI_MODEL = 'invalid model';
      const invalidModel = createSdkRuntime();
      await expectSafeDenial(
        invalidModel.service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }),
      );
      assert.equal(invalidModel.calls.site.length, 0);
      assert.equal(invalidModel.calls.lookup.length, 0);
    });

    assert.equal(requests, 0);
  });
});

test('the actual SDK transport refuses redirects instead of following them to another target', async () => {
  await withRuntimeEnv(async () => {
    const { service } = createSdkRuntime();
    const requests = [];

    await withMockedFetch(async (input, init) => {
      requests.push({
        url: input instanceof Request ? input.url : input.toString(),
        redirect: init.redirect,
      });
      return new Response(null, {
        status: 307,
        headers: { location: 'https://unapproved-provider.invalid/v1/chat/completions' },
      });
    }, async () => {
      await assert.rejects(
        service.answer('system', 'user', { tenantId: 'tenant-1', siteId: 'site-1' }),
      );
    });

    assert.deepEqual(requests, [{
      url: 'https://api.openai.com/v1/chat/completions',
      redirect: 'error',
    }]);
  });
});

test('actual SDK logging stays disabled when OPENAI_LOG requests debug output', async () => {
  await withRuntimeEnv(async () => {
    process.env.OPENAI_LOG = 'debug';
    const { service } = createSdkRuntime();
    const streamedChunks = [];
    let requestCount = 0;

    const loggerCalls = await captureConsoleLoggerCalls(async () => {
      await withMockedFetch(async () => {
        requestCount += 1;
        if (requestCount === 1) return successfulProviderResponse('SDK_RESPONSE_MARKER');
        if (requestCount === 2) return successfulStreamingProviderResponse('SDK_STREAM_RESPONSE_MARKER');
        if (requestCount === 3) return retryableProviderResponse('SDK_ERROR_RESPONSE_MARKER');
        return retryableProviderResponse('SDK_STREAM_ERROR_RESPONSE_MARKER');
      }, async () => {
        await service.answer(
          'SDK_SYSTEM_PROMPT_MARKER',
          'SDK_USER_PROMPT_MARKER',
          { tenantId: 'tenant-1', siteId: 'site-1' },
        );
        await service.streamAnswer(
          'SDK_STREAM_SYSTEM_PROMPT_MARKER',
          'SDK_STREAM_USER_PROMPT_MARKER',
          (chunk) => streamedChunks.push(chunk),
          { tenantId: 'tenant-1', siteId: 'site-1' },
        );
        await assert.rejects(
          service.answer(
            'SDK_ERROR_SYSTEM_PROMPT_MARKER',
            'SDK_ERROR_USER_PROMPT_MARKER',
            { tenantId: 'tenant-1', siteId: 'site-1' },
          ),
          /SDK_ERROR_RESPONSE_MARKER/,
        );
        await assert.rejects(
          service.streamAnswer(
            'SDK_STREAM_ERROR_SYSTEM_PROMPT_MARKER',
            'SDK_STREAM_ERROR_USER_PROMPT_MARKER',
            () => {},
            { tenantId: 'tenant-1', siteId: 'site-1' },
          ),
          /SDK_STREAM_ERROR_RESPONSE_MARKER/,
        );
      });
    });

    assert.equal(requestCount, 4);
    assert.deepEqual(streamedChunks, ['SDK_STREAM_RESPONSE_MARKER']);
    assert.deepEqual(loggerCalls, []);
  });
});
