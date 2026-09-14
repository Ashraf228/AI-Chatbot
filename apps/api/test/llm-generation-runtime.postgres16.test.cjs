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

async function attachedVolumeNames(container) {
  const result = await docker('inspect', '--format', '{{json .Mounts}}', container);
  const mounts = JSON.parse(result.stdout);
  return mounts
    .filter((mount) => mount?.Type === 'volume' && typeof mount.Name === 'string')
    .map((mount) => mount.Name);
}

function isMissingDockerResource(error) {
  const details = error && typeof error === 'object'
    ? [error.message, error.stdout, error.stderr].filter(Boolean).join('\n')
    : String(error);
  return /no such (?:container|volume)|not found/i.test(details);
}

async function cleanupContainer(container, volumeNames) {
  const failures = [];
  try {
    await docker('rm', '-f', '-v', container);
  } catch (error) {
    if (!isMissingDockerResource(error)) failures.push(error);
  }

  for (const volumeName of volumeNames) {
    try {
      await docker('volume', 'inspect', volumeName);
      failures.push(new Error('PostgreSQL test volume still exists: ' + volumeName));
    } catch (error) {
      if (!isMissingDockerResource(error)) failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'PostgreSQL runtime test cleanup failed');
  }
}

async function startPostgres() {
  await docker('image', 'inspect', 'pgvector/pgvector:pg16');
  const container = 'llm-generation-runtime-' + process.pid + '-' + Date.now();
  let created = false;
  let volumeNames = [];
  try {
    await docker(
      'run', '-d', '--name', container,
      '-e', 'POSTGRES_PASSWORD=temporary-test-password',
      '-e', 'POSTGRES_DB=llm_generation_runtime_test',
      '-p', '127.0.0.1::5432',
      'pgvector/pgvector:pg16',
    );
    created = true;
    volumeNames = await attachedVolumeNames(container);
    const portResult = await docker('port', container, '5432/tcp');
    const port = Number(portResult.stdout.trim().split('\n')[0].split(':').at(-1));
    const databaseUrl = 'postgres://postgres:temporary-test-password@127.0.0.1:'
      + port + '/llm_generation_runtime_test';
    await waitForPostgres(databaseUrl);
    return { container, databaseUrl, volumeNames };
  } catch (error) {
    if (created) {
      try {
        await cleanupContainer(container, volumeNames);
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
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

async function runMigrations(databaseUrl, workspace) {
  const { DatabaseService } = require('../dist/db/database.service.js');
  const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service.js');
  const previousCwd = process.cwd();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let database;
  try {
    process.chdir(workspace);
    process.env.DATABASE_URL = databaseUrl;
    database = new DatabaseService();
    await new DatabaseMigrationsService(database).runPendingMigrations();
  } finally {
    if (database?.pool) await database.pool.end();
    process.chdir(previousCwd);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
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

  try {
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
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (pool) await pool.end();
    if (workspace) await rm(workspace, { recursive: true, force: true });
    if (postgres) await cleanupContainer(postgres.container, postgres.volumeNames);
  }
});
