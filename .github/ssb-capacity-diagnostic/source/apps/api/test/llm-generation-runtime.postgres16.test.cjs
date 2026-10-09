const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { cp, mkdir, mkdtemp, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_LLM_GENERATION_RUNTIME_TEST === '1';
const apiRoot = join(__dirname, '..');
const migrationsSource = join(apiRoot, 'migrations');
const migration033 = '033_site_runtime_llm_generation_grant_contract.sql';

async function docker(...args) {
  return execFileAsync('docker', args, { timeout: 30_000 });
}

function cleanupIssue(context, error) {
  return new Error(context + ' cleanup failed', { cause: error });
}

async function runCleanup(cleanupErrors, context, callback) {
  try {
    await callback();
  } catch (error) {
    cleanupErrors.push(cleanupIssue(context, error));
  }
}

function finishCleanup(primaryError, cleanupErrors, context) {
  if (cleanupErrors.length === 0) return;
  const cleanupError = new AggregateError(cleanupErrors, context + ' cleanup failed');
  if (primaryError && typeof primaryError === 'object') {
    // Preserve diagnostics attached by an inner cleanup without replacing its stack.
    const previousCleanupError = primaryError.cleanupError;
    primaryError.cleanupError = previousCleanupError === undefined
      ? cleanupError
      : new AggregateError([previousCleanupError, cleanupError], context + ' cleanup failed');
    return;
  }
  throw cleanupError;
}

function restoreEnvironmentValue(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restoreProcessContext(originalFetch, previousEnv) {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    restoreEnvironmentValue(key, value);
  }
}

async function waitForPostgres(databaseUrl) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch (error) {
      lastError = error;
      await pool.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function attachedVolumeNames(container, dockerCommand = docker) {
  const result = await dockerCommand('inspect', '--format', '{{json .Mounts}}', container);
  const mounts = JSON.parse(result.stdout);
  if (!Array.isArray(mounts)) {
    throw new Error('Docker did not return a mount list for the test container');
  }
  return [...new Set(
    mounts
      .filter((mount) => mount?.Type === 'volume' && typeof mount.Name === 'string' && mount.Name.length > 0)
      .map((mount) => mount.Name),
  )];
}

function isMissingDockerResource(error) {
  const details = error && typeof error === 'object'
    ? [error.message, error.stdout, error.stderr].filter(Boolean).join('\n')
    : String(error);
  return /no such (?:container|volume)|not found/i.test(details);
}

async function cleanupContainer(container, capturedVolumeNames, dockerCommand = docker) {
  const cleanupErrors = [];
  let volumeNames = capturedVolumeNames;
  if (volumeNames === undefined) {
    try {
      volumeNames = await attachedVolumeNames(container, dockerCommand);
    } catch (error) {
      cleanupErrors.push(cleanupIssue('PostgreSQL test volume inventory', error));
    }
  }

  try {
    await dockerCommand('rm', '-f', '-v', container);
  } catch (error) {
    cleanupErrors.push(cleanupIssue('PostgreSQL test container', error));
  }

  if (volumeNames == null) {
    cleanupErrors.push(new Error('PostgreSQL test volume inventory unavailable; cleanup unverified'));
  } else {
    for (const volumeName of volumeNames) {
      try {
        await dockerCommand('volume', 'inspect', volumeName);
      } catch (error) {
        if (isMissingDockerResource(error)) continue;
        cleanupErrors.push(cleanupIssue('PostgreSQL test volume inspection', error));
        continue;
      }
      cleanupErrors.push(new Error('PostgreSQL test volume still exists after cleanup: ' + volumeName));
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'PostgreSQL runtime test cleanup failed');
  }
}

async function startPostgres(dockerCommand = docker) {
  await dockerCommand('image', 'inspect', 'pgvector/pgvector:pg16');
  const container = 'llm-generation-runtime-' + process.pid + '-' + Date.now();
  let created = false;
  let volumeNames = null;
  try {
    await dockerCommand(
      'run', '-d', '--name', container,
      '-e', 'POSTGRES_PASSWORD=temporary-test-password',
      '-e', 'POSTGRES_DB=llm_generation_runtime_test',
      '-p', '127.0.0.1::5432',
      'pgvector/pgvector:pg16',
    );
    created = true;
    volumeNames = await attachedVolumeNames(container, dockerCommand);
    const portResult = await dockerCommand('port', container, '5432/tcp');
    const port = Number(portResult.stdout.trim().split('\n')[0].split(':').at(-1));
    const databaseUrl = 'postgres://postgres:temporary-test-password@127.0.0.1:'
      + port + '/llm_generation_runtime_test';
    await waitForPostgres(databaseUrl);
    return { container, databaseUrl, volumeNames };
  } catch (error) {
    if (created) {
      const cleanupErrors = [];
      await runCleanup(
        cleanupErrors,
        'PostgreSQL runtime test setup resources',
        () => cleanupContainer(container, volumeNames, dockerCommand),
      );
      finishCleanup(error, cleanupErrors, 'PostgreSQL runtime test setup');
    }
    throw error;
  }
}

async function copyMigrations(workspace) {
  const target = join(workspace, 'migrations');
  await mkdir(target, { recursive: true });
  const files = (await readdir(migrationsSource))
    .filter((name) => /^\d+_.+\.sql$/i.test(name))
    .filter((name) => name.localeCompare(migration033) <= 0)
    .sort((left, right) => left.localeCompare(right));
  await Promise.all(files.map((name) => cp(join(migrationsSource, name), join(target, name))));
}

async function runMigrations(databaseUrl, workspace, overrides = {}) {
  const previousCwd = process.cwd();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let database;
  let primaryError;
  try {
    process.chdir(workspace);
    process.env.DATABASE_URL = databaseUrl;
    if (overrides.createDatabase) {
      database = overrides.createDatabase();
    } else {
      const { DatabaseService } = require('../dist/db/database.service.js');
      database = new DatabaseService();
    }
    const migrations = overrides.createMigrations
      ? overrides.createMigrations(database)
      : new (require('../dist/db/database-migrations.service.js').DatabaseMigrationsService)(database);
    await migrations.runPendingMigrations();
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (database?.pool) {
      await runCleanup(cleanupErrors, 'production migration database pool', () => database.pool.end());
    }
    await runCleanup(cleanupErrors, 'production migration working directory', () => process.chdir(previousCwd));
    await runCleanup(
      cleanupErrors,
      'production migration DATABASE_URL',
      () => restoreEnvironmentValue('DATABASE_URL', previousDatabaseUrl),
    );
    finishCleanup(primaryError, cleanupErrors, 'production migration runner');
  }
}

async function cleanupRuntimeTest({
  primaryError,
  pool,
  workspace,
  postgres,
  originalFetch,
  previousEnv,
  restoreProcessContextFn = restoreProcessContext,
  rmFn = rm,
  cleanupContainerFn = cleanupContainer,
}) {
  const cleanupErrors = [];
  await runCleanup(
    cleanupErrors,
    'LLM generation runtime transport and environment',
    () => restoreProcessContextFn(originalFetch, previousEnv),
  );
  if (pool) {
    await runCleanup(cleanupErrors, 'LLM generation runtime database pool', () => pool.end());
  }
  if (workspace) {
    await runCleanup(
      cleanupErrors,
      'LLM generation runtime workspace',
      () => rmFn(workspace, { recursive: true, force: true }),
    );
  }
  if (postgres) {
    await runCleanup(
      cleanupErrors,
      'LLM generation runtime PostgreSQL resources',
      () => cleanupContainerFn(postgres.container, postgres.volumeNames),
    );
  }
  finishCleanup(primaryError, cleanupErrors, 'LLM generation runtime test');
}

async function withRuntimeCleanup(operation, getCleanupState) {
  let primaryError;
  try {
    return await operation();
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    await cleanupRuntimeTest({ ...getCleanupState(), primaryError });
  }
}

async function insertGrant(pool, { id, purpose, revokedAt = null }) {
  await pool.query(
    `INSERT INTO provider_approval_grants (
       id, tenant_id, site_id, source_id, source_types, usage_contexts, scope_kind,
       environment, provider_key, model, embedding_dimension, provider_region,
       data_categories, customer_data_approved, production_approved,
       provider_dpa_approved, purpose, retention_policy, redaction_policy,
       logging_policy, deletion_policy, reindex_policy, rate_limit, cost_limit,
       valid_from, expires_at, revoked_at, revoked_by, revocation_reason,
       approved_by, approval_evidence_ref
     ) VALUES (
       $1, 'tenant-1', 'site-1', NULL, '[]'::jsonb, $2::jsonb, 'site_runtime',
       'non_production', 'openai', 'gpt-4.1-mini', NULL, 'eu',
       '["synthetic_support_message"]'::jsonb, true, false,
       true, $3, 'synthetic-retention', 'synthetic-redaction',
       'metadata-only', 'synthetic-deletion', NULL, 'synthetic-rate', 'synthetic-cost',
       '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', $4, NULL, NULL,
       'synthetic-approver', 'synthetic-evidence'
     )`,
    [id, JSON.stringify([purpose]), purpose, revokedAt],
  );
}

function successfulProviderResponse() {
  return new Response(JSON.stringify({
    id: 'synthetic-completion',
    object: 'chat.completion',
    created: 0,
    model: 'gpt-4.1-mini',
    choices: [{ index: 0, message: { role: 'assistant', content: 'Sicher beantwortet' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function successfulStreamingProviderResponse() {
  const event = {
    id: 'synthetic-stream-completion',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'gpt-4.1-mini',
    choices: [{ index: 0, delta: { content: 'Sicher gestreamt' }, finish_reason: null }],
  };
  return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

async function expectSafeDenial(promise) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, 503);
    assert.match(error.message, /Antwortgenerierung.*nicht sicher verfuegbar/i);
    return true;
  });
}

test('cleanup after a failed volume inspect still removes the owned container', async () => {
  const calls = [];
  const inspectError = new Error('synthetic volume inspect failure');
  const fakeDocker = async (...args) => {
    calls.push(args);
    if (args[0] === 'image' && args[1] === 'inspect') return { stdout: '', stderr: '' };
    if (args[0] === 'run') return { stdout: 'synthetic-container-id', stderr: '' };
    if (args[0] === 'inspect' && args.includes('--format')) throw inspectError;
    if (args[0] === 'rm') return { stdout: '', stderr: '' };
    throw new Error('Unexpected Docker call: ' + args.join(' '));
  };

  await assert.rejects(
    () => startPostgres(fakeDocker),
    (error) => error === inspectError,
  );
  const runCall = calls.find((args) => args[0] === 'run');
  const container = runCall[runCall.indexOf('--name') + 1];
  assert.deepEqual(
    calls.filter((args) => args[0] === 'rm'),
    [['rm', '-f', '-v', container]],
  );
  assert.equal(calls.filter((args) => args[0] === 'inspect' && args.includes('--format')).length, 1);
});

test('container removal failure remains visible while captured volumes are checked', async () => {
  const calls = [];
  const removeError = new Error('synthetic container removal failure');
  const fakeDocker = async (...args) => {
    calls.push(args);
    if (args[0] === 'rm') throw removeError;
    if (args[0] === 'volume' && args[1] === 'inspect') {
      throw Object.assign(new Error('No such volume'), { stderr: 'No such volume' });
    }
    throw new Error('Unexpected Docker call: ' + args.join(' '));
  };

  await assert.rejects(
    () => cleanupContainer('synthetic-container', ['synthetic-volume'], fakeDocker),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors.length, 1);
      assert.equal(error.errors[0].cause, removeError);
      return true;
    },
  );
  assert.deepEqual(calls, [
    ['rm', '-f', '-v', 'synthetic-container'],
    ['volume', 'inspect', 'synthetic-volume'],
  ]);
});

test('migration cleanup restores cwd and an unset DATABASE_URL after pool failure', async () => {
  const originalCwd = process.cwd();
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const workspace = await mkdtemp(join(tmpdir(), 'llm-generation-runtime-cleanup-'));
  const migrationError = new Error('synthetic migration failure');
  const poolError = new Error('synthetic migration pool.end failure');
  delete process.env.DATABASE_URL;

  try {
    await assert.rejects(
      () => runMigrations('postgres://synthetic', workspace, {
        createDatabase: () => ({ pool: { end: async () => { throw poolError; } } }),
        createMigrations: () => ({ runPendingMigrations: async () => { throw migrationError; } }),
      }),
      (error) => {
        assert.equal(error, migrationError);
        assert.ok(error.cleanupError instanceof AggregateError);
        assert.equal(error.cleanupError.errors.length, 1);
        assert.equal(error.cleanupError.errors[0].cause, poolError);
        return true;
      },
    );
    assert.equal(process.cwd(), originalCwd);
    assert.equal(process.env.DATABASE_URL, undefined);
  } finally {
    process.chdir(originalCwd);
    restoreEnvironmentValue('DATABASE_URL', originalDatabaseUrl);
    await rm(workspace, { recursive: true, force: true });
  }
});

test('successful migration fails when pool cleanup fails but restores process context', async () => {
  const originalCwd = process.cwd();
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const workspace = await mkdtemp(join(tmpdir(), 'llm-generation-runtime-cleanup-'));
  const poolError = new Error('synthetic successful-run pool.end failure');
  delete process.env.DATABASE_URL;

  try {
    await assert.rejects(
      () => runMigrations('postgres://synthetic', workspace, {
        createDatabase: () => ({ pool: { end: async () => { throw poolError; } } }),
        createMigrations: () => ({ runPendingMigrations: async () => {} }),
      }),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 1);
        assert.equal(error.errors[0].cause, poolError);
        return true;
      },
    );
    assert.equal(process.cwd(), originalCwd);
    assert.equal(process.env.DATABASE_URL, undefined);
  } finally {
    process.chdir(originalCwd);
    restoreEnvironmentValue('DATABASE_URL', originalDatabaseUrl);
    await rm(workspace, { recursive: true, force: true });
  }
});

test('outer failure preserves the primary error and still cleans every owned resource', async () => {
  const originalFetch = globalThis.fetch;
  const previousEnv = { LLM_GENERATION_RUNTIME_TEST_ENV: process.env.LLM_GENERATION_RUNTIME_TEST_ENV };
  const primaryError = new Error('synthetic runtime test failure');
  const poolError = new Error('synthetic runtime pool.end failure');
  const calls = [];
  globalThis.fetch = () => { throw new Error('synthetic temporary transport'); };
  process.env.LLM_GENERATION_RUNTIME_TEST_ENV = 'temporary';

  try {
    await assert.rejects(
      () => withRuntimeCleanup(
        async () => { throw primaryError; },
        () => ({
          pool: { end: async () => { calls.push('pool'); throw poolError; } },
          workspace: '/synthetic-workspace',
          postgres: { container: 'synthetic-container', volumeNames: [] },
          originalFetch,
          previousEnv,
          rmFn: async () => { calls.push('workspace'); },
          cleanupContainerFn: async () => { calls.push('container'); },
        }),
      ),
      (error) => error === primaryError,
    );
    assert.deepEqual(calls, ['pool', 'workspace', 'container']);
    assert.equal(globalThis.fetch, originalFetch);
    assert.equal(process.env.LLM_GENERATION_RUNTIME_TEST_ENV, previousEnv.LLM_GENERATION_RUNTIME_TEST_ENV);
    assert.ok(primaryError.cleanupError instanceof AggregateError);
    assert.equal(primaryError.cleanupError.errors.length, 1);
    assert.equal(primaryError.cleanupError.errors[0].cause, poolError);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironmentValue('LLM_GENERATION_RUNTIME_TEST_ENV', previousEnv.LLM_GENERATION_RUNTIME_TEST_ENV);
  }
});

test('cleanup continues after multiple failures and reports every cleanup error', async () => {
  const originalFetch = globalThis.fetch;
  const previousEnv = { LLM_GENERATION_RUNTIME_TEST_ENV: process.env.LLM_GENERATION_RUNTIME_TEST_ENV };
  const primaryError = new Error('synthetic outer failure');
  const contextError = new Error('synthetic context cleanup failure');
  const poolError = new Error('synthetic pool cleanup failure');
  const workspaceError = new Error('synthetic workspace cleanup failure');
  const containerError = new Error('synthetic container cleanup failure');
  const calls = [];

  try {
    await assert.rejects(
      () => withRuntimeCleanup(
        async () => { throw primaryError; },
        () => ({
          pool: { end: async () => { calls.push('pool'); throw poolError; } },
          workspace: '/synthetic-workspace',
          postgres: { container: 'synthetic-container', volumeNames: [] },
          originalFetch,
          previousEnv,
          restoreProcessContextFn: async () => { calls.push('context'); throw contextError; },
          rmFn: async () => { calls.push('workspace'); throw workspaceError; },
          cleanupContainerFn: async () => { calls.push('container'); throw containerError; },
        }),
      ),
      (error) => error === primaryError,
    );
    assert.deepEqual(calls, ['context', 'pool', 'workspace', 'container']);
    assert.equal(primaryError.cleanupError.errors.length, 4);
    assert.deepEqual(
      primaryError.cleanupError.errors.map((error) => error.cause),
      [contextError, poolError, workspaceError, containerError],
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironmentValue('LLM_GENERATION_RUNTIME_TEST_ENV', previousEnv.LLM_GENERATION_RUNTIME_TEST_ENV);
  }
});

function reachableCleanupErrors(error, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return seen;
  seen.add(error);
  reachableCleanupErrors(error.cause, seen);
  reachableCleanupErrors(error.cleanupError, seen);
  if (error instanceof AggregateError) {
    for (const nested of error.errors) reachableCleanupErrors(nested, seen);
  }
  return seen;
}

for (const hasPrimary of [true, false]) {
  test('nested cleanup retains inner and outer errors ' + (hasPrimary ? 'with primary' : 'without primary'), async () => {
    const previousCwd = process.cwd();
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const workspace = await mkdtemp(join(tmpdir(), 'llm-generation-runtime-nested-'));
    const primary = new Error('synthetic migration failure');
    const primaryStack = primary.stack;
    const inner = new Error('synthetic inner pool failure');
    const outer = new Error('synthetic outer workspace failure');
    const calls = [];
    let migrationFailure;
    try {
      await assert.rejects(withRuntimeCleanup(async () => {
        try {
          await runMigrations('postgres://synthetic', workspace, {
            createDatabase: () => ({ pool: { end: async () => { throw inner; } } }),
            createMigrations: () => ({ runPendingMigrations: async () => { if (hasPrimary) throw primary; } }),
          });
        } catch (error) {
          migrationFailure = error;
          throw error;
        }
      }, () => ({
        originalFetch: globalThis.fetch,
        previousEnv: {},
        workspace,
        postgres: { container: 'synthetic-owned-container', volumeNames: [] },
        rmFn: async () => { calls.push('workspace'); throw outer; },
        cleanupContainerFn: async () => { calls.push('container'); },
      })), (error) => {
        assert.equal(error, migrationFailure);
        if (hasPrimary) {
          assert.equal(error, primary);
          assert.equal(error.stack, primaryStack);
        } else {
          assert.ok(error instanceof AggregateError);
        }
        const errors = reachableCleanupErrors(error);
        assert.ok(errors.has(inner), 'inner pool diagnosis must remain reachable');
        assert.ok(errors.has(outer), 'outer workspace diagnosis must remain reachable');
        return true;
      });
      assert.deepEqual(calls, ['workspace', 'container']);
      assert.equal(process.cwd(), previousCwd);
      assert.equal(process.env.DATABASE_URL, previousDatabaseUrl);
    } finally {
      process.chdir(previousCwd);
      restoreEnvironmentValue('DATABASE_URL', previousDatabaseUrl);
      await rm(workspace, { recursive: true, force: true });
    }
  });
}

for (const removeFails of [true, false]) {
  test('unknown inventory cleanup preserves inspect evidence with remove ' + (removeFails ? 'failure' : 'success'), async () => {
    const inspectError = new Error('synthetic mount inspect failure');
    const removeError = new Error('synthetic remove failure');
    const calls = [];
    await assert.rejects(startPostgres(async (...args) => {
      calls.push(args);
      if (args[0] === 'image' || args[0] === 'run') return { stdout: '' };
      if (args[0] === 'inspect') throw inspectError;
      if (args[0] === 'rm') {
        if (removeFails) throw removeError;
        return { stdout: '' };
      }
      throw new Error('Unexpected Docker call');
    }), (error) => {
      assert.equal(error, inspectError);
      const errors = reachableCleanupErrors(error);
      assert.ok([...errors].every((entry) => !(entry instanceof TypeError)));
      assert.ok([...errors].some((entry) => /volume inventory unavailable; cleanup unverified/.test(entry.message)));
      if (removeFails) assert.ok(errors.has(removeError));
      return true;
    });
    const run = calls.find((args) => args[0] === 'run');
    assert.deepEqual(calls.filter((args) => args[0] === 'rm'), [
      ['rm', '-f', '-v', run[run.indexOf('--name') + 1]],
    ]);
  });
}

test('PostgreSQL 16 binds persisted LLM grants to the actual SDK transport', {
  skip: !enabled,
  timeout: 300_000,
}, async () => {
  let postgres;
  let pool;
  let workspace;
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_LOG: process.env.OPENAI_LOG,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };
  const originalFetch = globalThis.fetch;
  const requests = [];

  await withRuntimeCleanup(async () => {
    postgres = await startPostgres();
    pool = new Pool({ connectionString: postgres.databaseUrl, max: 2 });
    workspace = await mkdtemp(join(tmpdir(), 'llm-generation-runtime-pg16-'));
    await copyMigrations(workspace);
    await runMigrations(postgres.databaseUrl, workspace);

    await pool.query("INSERT INTO tenants(id, name) VALUES ('tenant-1', 'Synthetic tenant')");
    await pool.query(
      "INSERT INTO sites(id, tenant_id, name, site_key) VALUES ('site-1', 'tenant-1', 'Synthetic site', 'synthetic-site')",
    );
    await insertGrant(pool, { id: 'llm-grant', purpose: 'llm_generation' });

    process.env.NODE_ENV = 'test';
    delete process.env.APP_ENV;
    process.env.OPENAI_API_KEY = 'synthetic-test-key';
    delete process.env.OPENAI_BASE_URL;
    process.env.OPENAI_LOG = 'debug';
    process.env.OPENAI_MODEL = 'gpt-4.1-mini';
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      assert.equal(init.redirect, 'error');
      requests.push({ url, body: JSON.parse(init.body) });
      return requests.length === 1
        ? successfulProviderResponse()
        : successfulStreamingProviderResponse();
    };

    const { ProviderApprovalStorageLookupService } = require(
      '../dist/knowledge-sources/provider-approval-storage-lookup.service.js'
    );
    const { LlmService } = require('../dist/vector/llm.service.js');
    const service = new LlmService(pool, new ProviderApprovalStorageLookupService(pool));

    const normal = await service.answer(
      'synthetic system prompt',
      'synthetic user prompt',
      { tenantId: 'tenant-1', siteId: 'site-1' },
    );
    assert.equal(normal.text, 'Sicher beantwortet');

    const chunks = [];
    const streamed = await service.streamAnswer(
      'synthetic stream system prompt',
      'synthetic stream user prompt',
      (chunk) => chunks.push(chunk),
      { tenantId: 'tenant-1', siteId: 'site-1' },
    );
    assert.equal(streamed.text, 'Sicher gestreamt');
    assert.deepEqual(chunks, ['Sicher gestreamt']);
    assert.equal(requests.length, 2);

    await pool.query(
      "UPDATE provider_approval_grants SET revoked_at = NOW(), revoked_by = 'synthetic-reviewer', revocation_reason = 'synthetic-test' WHERE id = 'llm-grant'",
    );
    await expectSafeDenial(service.answer(
      'synthetic system prompt',
      'synthetic user prompt',
      { tenantId: 'tenant-1', siteId: 'site-1' },
    ));
    assert.equal(requests.length, 2);

    await insertGrant(pool, { id: 'query-grant', purpose: 'query_embedding' });
    await expectSafeDenial(service.answer(
      'synthetic system prompt',
      'synthetic user prompt',
      { tenantId: 'tenant-1', siteId: 'site-1' },
    ));
    await expectSafeDenial(service.answer(
      'synthetic system prompt',
      'synthetic user prompt',
      { tenantId: 'tenant-foreign', siteId: 'site-1' },
    ));
    assert.equal(requests.length, 2);
  }, () => ({ pool, workspace, postgres, originalFetch, previousEnv }));
});
