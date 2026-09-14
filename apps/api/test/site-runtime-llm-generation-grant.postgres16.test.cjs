const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { cp, mkdtemp, mkdir, readdir, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_SITE_RUNTIME_LLM_GRANT_TEST === '1';
const apiRoot = join(__dirname, '..');
const migrationsSource = join(apiRoot, 'migrations');
const migration032 = '032_site_runtime_grant_concurrency.sql';
const migration033 = '033_site_runtime_llm_generation_grant_contract.sql';
const preflightPath = join(apiRoot, '..', '..', 'scripts', 'ops', 'site-runtime-grant-preflight.sql');

const grantInsertSql = [
  'INSERT INTO provider_approval_grants (',
  '  id, tenant_id, site_id, source_id, source_types, usage_contexts, scope_kind,',
  '  environment, provider_key, model, embedding_dimension, provider_region,',
  '  data_categories, customer_data_approved, production_approved,',
  '  provider_dpa_approved, purpose, retention_policy, redaction_policy,',
  '  logging_policy, deletion_policy, reindex_policy, rate_limit, cost_limit,',
  '  valid_from, expires_at, revoked_at, revoked_by, revocation_reason,',
  '  approved_by, approval_evidence_ref',
  ') VALUES (',
  '  $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13::jsonb,',
  '  $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,',
  '  $28, $29, $30, $31',
  ')',
].join('\n');

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
    primaryError.cleanupError = cleanupError;
    console.error('Additional cleanup failure after ' + context + '; the primary failure remains primary.');
    return;
  }
  throw cleanupError;
}

function isMissingDockerResource(error) {
  const details = error && typeof error === 'object'
    ? [error.message, error.stdout, error.stderr].filter(Boolean).join('\n')
    : String(error);
  return /no such (?:container|volume)|not found/i.test(details);
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

async function cleanupOwnedPostgresContainer(container, capturedVolumeNames, dockerCommand = docker) {
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
    if (!isMissingDockerResource(error)) {
      cleanupErrors.push(cleanupIssue('PostgreSQL test container', error));
    }
  }

  if (volumeNames !== undefined) {
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
    throw new AggregateError(cleanupErrors, 'PostgreSQL test container cleanup failed');
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

async function eventually(callback, message) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await callback()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

function withApplicationName(databaseUrl, applicationName) {
  const url = new URL(databaseUrl);
  url.searchParams.set('application_name', applicationName);
  return url.toString();
}

async function startPostgres() {
  await docker('image', 'inspect', 'pgvector/pgvector:pg16');
  const container = 'site-runtime-llm-schema-' + process.pid + '-' + Date.now();
  let containerCreated = false;
  let volumeNames;
  try {
    await docker(
      'run', '-d', '--name', container,
      '-e', 'POSTGRES_PASSWORD=temporary-test-password',
      '-e', 'POSTGRES_DB=site_runtime_llm_schema_test',
      '-p', '127.0.0.1::5432',
      'pgvector/pgvector:pg16',
    );
    containerCreated = true;
    volumeNames = await attachedVolumeNames(container);
    const result = await docker('port', container, '5432/tcp');
    const port = Number(result.stdout.trim().split('\n')[0].split(':').at(-1));
    const databaseUrl = 'postgres://postgres:temporary-test-password@127.0.0.1:'
      + port + '/site_runtime_llm_schema_test';
    await waitForPostgres(databaseUrl);
    return { container, databaseUrl, volumeNames };
  } catch (error) {
    if (containerCreated) {
      try {
        await cleanupOwnedPostgresContainer(container, volumeNames);
      } catch (cleanupError) {
        finishCleanup(error, [cleanupError], 'PostgreSQL test setup');
      }
    }
    throw error;
  }
}

async function copyMigrations(workspace, lastMigration) {
  const target = join(workspace, 'migrations');
  await mkdir(target, { recursive: true });
  const files = (await readdir(migrationsSource))
    .filter((name) => /^\d+_.+\.sql$/i.test(name))
    .filter((name) => name.localeCompare(lastMigration) <= 0)
    .sort((left, right) => left.localeCompare(right));
  await Promise.all(files.map((name) => cp(join(migrationsSource, name), join(target, name))));
}

async function addMigration033(workspace) {
  await cp(join(migrationsSource, migration033), join(workspace, 'migrations', migration033));
}

async function runProductionMigrations(databaseUrl, workspace, applicationName) {
  const { DatabaseService } = require('../dist/db/database.service.js');
  const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service.js');
  const previousCwd = process.cwd();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let database;
  let primaryError;
  try {
    process.chdir(workspace);
    process.env.DATABASE_URL = withApplicationName(databaseUrl, applicationName);
    database = new DatabaseService();
    await new DatabaseMigrationsService(database).runPendingMigrations();
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (database?.pool) {
      await runCleanup(cleanupErrors, 'production migration database pool', () => database.pool.end());
    }
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    process.chdir(previousCwd);
    finishCleanup(primaryError, cleanupErrors, 'production migration runner');
  }
}

async function resetPublicSchema(pool) {
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public AUTHORIZATION postgres');
  await pool.query('GRANT ALL ON SCHEMA public TO postgres');
  await pool.query('GRANT ALL ON SCHEMA public TO public');
}

async function prepareSchema(context, lastMigration, label) {
  await resetPublicSchema(context.control);
  const workspace = await mkdtemp(join(context.tempRoot, label + '-'));
  await copyMigrations(workspace, lastMigration);
  await runProductionMigrations(context.databaseUrl, workspace, label + '-' + lastMigration.slice(0, 3));
  return workspace;
}

async function prepareSchema32(context, label) {
  return prepareSchema(context, migration032, label);
}

async function prepareSchema33(context, label) {
  return prepareSchema(context, migration033, label);
}

async function migrationVersionCount(pool, version) {
  const result = await pool.query(
    'SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1',
    [version],
  );
  return result.rows[0].count;
}

async function constraintDefinition(pool, name) {
  const result = await pool.query(
    [
      'SELECT pg_get_constraintdef(oid) AS definition',
      'FROM pg_constraint',
      'WHERE conname = $1',
    ].join('\n'),
    [name],
  );
  return result.rows[0]?.definition;
}

function bindingFor(label, overrides = {}) {
  return {
    tenantId: 'tenant_' + label,
    siteId: 'site_' + label,
    providerKey: 'provider_' + label,
    model: 'model_' + label,
    environment: 'non_production',
    ...overrides,
  };
}

async function ensureBinding(pool, binding) {
  await pool.query(
    'INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    [binding.tenantId, 'Synthetic ' + binding.tenantId],
  );
  await pool.query(
    [
      'INSERT INTO sites (id, tenant_id, name, site_key)',
      'VALUES ($1, $2, $3, $4)',
      'ON CONFLICT (id) DO NOTHING',
    ].join('\n'),
    [binding.siteId, binding.tenantId, 'Synthetic ' + binding.siteId, binding.siteId],
  );
}

async function seedBinding(pool, label, overrides = {}) {
  const binding = bindingFor(label, overrides);
  await ensureBinding(pool, binding);
  return binding;
}

function grantFor(id, binding, purpose = 'query_embedding', overrides = {}) {
  return {
    id,
    tenantId: binding.tenantId,
    siteId: binding.siteId,
    sourceId: null,
    sourceTypes: '[]',
    usageContexts: JSON.stringify([purpose]),
    scopeKind: 'site_runtime',
    environment: binding.environment,
    providerKey: binding.providerKey,
    model: binding.model,
    embeddingDimension: purpose === 'query_embedding' ? 3 : null,
    providerRegion: 'synthetic-region',
    dataCategories: '["synthetic"]',
    customerDataApproved: true,
    productionApproved: false,
    providerDpaApproved: true,
    purpose,
    retentionPolicy: 'synthetic-retention',
    redactionPolicy: 'synthetic-redaction',
    loggingPolicy: 'metadata-only',
    deletionPolicy: 'synthetic-deletion',
    reindexPolicy: null,
    rateLimit: 'synthetic-rate-limit',
    costLimit: 'synthetic-cost-limit',
    validFrom: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-10-01T00:00:00.000Z',
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    approvedBy: 'synthetic-approver',
    approvalEvidenceRef: 'synthetic-evidence',
    ...overrides,
  };
}

function grantValues(grant) {
  return [
    grant.id, grant.tenantId, grant.siteId, grant.sourceId, grant.sourceTypes,
    grant.usageContexts, grant.scopeKind, grant.environment, grant.providerKey,
    grant.model, grant.embeddingDimension, grant.providerRegion, grant.dataCategories,
    grant.customerDataApproved, grant.productionApproved, grant.providerDpaApproved,
    grant.purpose, grant.retentionPolicy, grant.redactionPolicy, grant.loggingPolicy,
    grant.deletionPolicy, grant.reindexPolicy, grant.rateLimit, grant.costLimit,
    grant.validFrom, grant.expiresAt, grant.revokedAt, grant.revokedBy,
    grant.revocationReason, grant.approvedBy, grant.approvalEvidenceRef,
  ];
}

async function insertGrant(queryable, grant) {
  await queryable.query(grantInsertSql, grantValues(grant));
}

async function expectPgFailure(callback, { codes, constraints = [] }) {
  let error;
  try {
    await callback();
  } catch (received) {
    error = received;
  }
  assert.ok(error, 'expected PostgreSQL to reject the mutation');
  assert.ok(codes.includes(error.code), 'unexpected PostgreSQL error code: ' + error.code);
  if (constraints.length > 0) {
    assert.ok(constraints.includes(error.constraint), 'unexpected constraint: ' + error.constraint);
  }
  return error;
}

async function runReadOnlyPreflight(pool) {
  const sql = await readFile(preflightPath, 'utf8');
  const client = await pool.connect();
  let active = false;
  try {
    await client.query('BEGIN READ ONLY');
    active = true;
    const result = await client.query(sql);
    await client.query('COMMIT');
    active = false;
    return Object.fromEntries(result.rows.map((row) => [row.check_name, Number(row.row_count)]));
  } finally {
    if (active) await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

async function addLegacyChecksNotValid(pool) {
  await pool.query([
    'ALTER TABLE provider_approval_grants',
    '  ADD CONSTRAINT provider_approval_grants_site_runtime_purpose_check',
    "    CHECK ((scope_kind <> 'site_runtime' OR purpose = 'query_embedding') IS TRUE) NOT VALID,",
    '  ADD CONSTRAINT provider_approval_grants_site_runtime_usage_check',
    "    CHECK (scope_kind <> 'site_runtime' OR usage_contexts = '[\"query_embedding\"]'::jsonb) NOT VALID",
  ].join('\n'));
}

async function waitForBlockedInsert(control, applicationName) {
  await eventually(async () => {
    const result = await control.query(
      [
        'SELECT wait_event_type',
        'FROM pg_stat_activity',
        'WHERE application_name = $1',
        "  AND state = 'active'",
      ].join('\n'),
      [applicationName],
    );
    return result.rows.some((row) => row.wait_event_type === 'Lock');
  }, 'timed out waiting for ' + applicationName + ' to block on PostgreSQL');
}

async function runConcurrentLlmInsert(context, binding, label, commitFirst) {
  const firstName = label + '-first';
  const secondName = label + '-second';
  const firstPool = new Pool({ connectionString: withApplicationName(context.databaseUrl, firstName), max: 1 });
  const secondPool = new Pool({ connectionString: withApplicationName(context.databaseUrl, secondName), max: 1 });
  const first = await firstPool.connect();
  const second = await secondPool.connect();
  let firstOpen = false;
  let secondOpen = false;
  let pending;
  let pendingSettled = false;
  let primaryError;
  const firstGrant = grantFor(label + '_first', binding, 'llm_generation');
  const secondGrant = grantFor(label + '_second', binding, 'llm_generation', {
    validFrom: '2026-09-15T00:00:00.000Z',
    expiresAt: '2026-10-15T00:00:00.000Z',
  });
  try {
    await first.query('BEGIN');
    firstOpen = true;
    await insertGrant(first, firstGrant);
    await second.query('BEGIN');
    secondOpen = true;
    pending = insertGrant(second, secondGrant);
    await waitForBlockedInsert(context.control, secondName);
    await first.query(commitFirst ? 'COMMIT' : 'ROLLBACK');
    firstOpen = false;

    if (commitFirst) {
      await expectPgFailure(() => pending, {
        codes: ['23P01'],
        constraints: ['provider_approval_grants_site_runtime_llm_no_overlap'],
      });
      pendingSettled = true;
      await second.query('ROLLBACK');
      secondOpen = false;
      const ids = await context.control.query(
        'SELECT id FROM provider_approval_grants WHERE id = ANY($1::text[]) ORDER BY id',
        [[firstGrant.id, secondGrant.id]],
      );
      assert.deepEqual(ids.rows.map((row) => row.id), [firstGrant.id]);
    } else {
      await pending;
      pendingSettled = true;
      await second.query('COMMIT');
      secondOpen = false;
      const ids = await context.control.query(
        'SELECT id FROM provider_approval_grants WHERE id = ANY($1::text[]) ORDER BY id',
        [[firstGrant.id, secondGrant.id]],
      );
      assert.deepEqual(ids.rows.map((row) => row.id), [secondGrant.id]);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (firstOpen) await runCleanup(cleanupErrors, 'first LLM insert transaction', () => first.query('ROLLBACK'));
    if (pending && !pendingSettled) await runCleanup(cleanupErrors, 'pending LLM insert', () => pending);
    if (secondOpen) await runCleanup(cleanupErrors, 'second LLM insert transaction', () => second.query('ROLLBACK'));
    first.release();
    second.release();
    await runCleanup(cleanupErrors, 'concurrent LLM pools', () => Promise.all([firstPool.end(), secondPool.end()]));
    finishCleanup(primaryError, cleanupErrors, 'concurrent LLM insert');
  }
}

async function applyQueryOnlyForwardRecovery(pool) {
  await pool.query('BEGIN');
  try {
    await pool.query([
      'ALTER TABLE provider_approval_grants',
      '  DROP CONSTRAINT provider_approval_grants_site_runtime_llm_no_overlap,',
      '  DROP CONSTRAINT provider_approval_grants_site_runtime_usage_check,',
      '  DROP CONSTRAINT provider_approval_grants_site_runtime_purpose_check,',
      '  ADD CONSTRAINT provider_approval_grants_site_runtime_purpose_check',
      "    CHECK ((scope_kind <> 'site_runtime' OR purpose = 'query_embedding') IS TRUE),",
      '  ADD CONSTRAINT provider_approval_grants_site_runtime_usage_check',
      "    CHECK (scope_kind <> 'site_runtime' OR usage_contexts = '[\"query_embedding\"]'::jsonb)",
    ].join('\n'));
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

test('PostgreSQL 16 validates the standalone site-runtime LLM schema migration', {
  skip: !enabled,
  timeout: 300_000,
}, async (t) => {
  let postgres;
  let tempRoot;
  let control;
  let primaryError;
  try {
    postgres = await startPostgres();
    tempRoot = await mkdtemp(join(tmpdir(), 'site-runtime-llm-schema-pg16-'));
    control = new Pool({ connectionString: postgres.databaseUrl, max: 4 });
    const context = { ...postgres, tempRoot, control };

    await t.test('fresh production migrations reach 033 once with the expected catalog contract', async () => {
      const workspace = await prepareSchema33(context, 'fresh-chain');
      assert.equal(await migrationVersionCount(control, migration033), 1);
      await runProductionMigrations(postgres.databaseUrl, workspace, 'fresh-chain-retry');
      assert.equal(await migrationVersionCount(control, migration033), 1);
      assert.equal((await control.query('SELECT count(*)::int AS count FROM provider_approval_grants')).rows[0].count, 0);

      const purpose = await constraintDefinition(control, 'provider_approval_grants_site_runtime_purpose_check');
      const usage = await constraintDefinition(control, 'provider_approval_grants_site_runtime_usage_check');
      const queryOverlap = await constraintDefinition(control, 'provider_approval_grants_site_runtime_no_overlap');
      const llmOverlap = await constraintDefinition(control, 'provider_approval_grants_site_runtime_llm_no_overlap');
      assert.match(purpose, /query_embedding/);
      assert.match(purpose, /llm_generation/);
      assert.match(usage, /query_embedding/);
      assert.match(usage, /llm_generation/);
      assert.match(queryOverlap, /purpose = 'query_embedding'/);
      assert.match(llmOverlap, /purpose = 'llm_generation'/);
      assert.match(llmOverlap, /tstzrange\(valid_from, expires_at, '\[\)'/);
    });

    await t.test('032 upgrade preserves query behavior and enforces exact LLM pairs and bindings', async () => {
      const workspace = await prepareSchema32(context, 'valid-upgrade');
      const base = await seedBinding(control, 'valid_upgrade');
      const queryGrant = grantFor('preserved_query_grant', base);
      await insertGrant(control, queryGrant);
      const before = await control.query(
        'SELECT id, purpose, usage_contexts, valid_from, expires_at FROM provider_approval_grants ORDER BY id',
      );

      await addMigration033(workspace);
      await runProductionMigrations(postgres.databaseUrl, workspace, 'valid-upgrade-033');
      const after = await control.query(
        'SELECT id, purpose, usage_contexts, valid_from, expires_at FROM provider_approval_grants ORDER BY id',
      );
      assert.deepEqual(after.rows, before.rows);

      const llmGrant = grantFor('llm_grant', base, 'llm_generation');
      await insertGrant(control, llmGrant);
      await expectPgFailure(
        () => insertGrant(control, grantFor('llm_overlap', base, 'llm_generation')),
        { codes: ['23P01'], constraints: ['provider_approval_grants_site_runtime_llm_no_overlap'] },
      );
      await insertGrant(control, grantFor('llm_adjacent', base, 'llm_generation', {
        validFrom: llmGrant.expiresAt,
        expiresAt: '2026-11-01T00:00:00.000Z',
      }));
      await expectPgFailure(
        () => insertGrant(control, grantFor('llm_wrong_usage', base, 'llm_generation', {
          usageContexts: '["query_embedding"]',
          validFrom: '2026-11-01T00:00:00.000Z',
          expiresAt: '2026-12-01T00:00:00.000Z',
        })),
        { codes: ['23514'], constraints: ['provider_approval_grants_site_runtime_usage_check'] },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('query_wrong_usage', base, 'query_embedding', {
          usageContexts: '["llm_generation"]',
          validFrom: '2026-12-01T00:00:00.000Z',
          expiresAt: '2027-01-01T00:00:00.000Z',
        })),
        { codes: ['23514'], constraints: ['provider_approval_grants_site_runtime_usage_check'] },
      );

      const changedBindings = [
        bindingFor('other_tenant', { providerKey: base.providerKey, model: base.model }),
        bindingFor('other_site', { tenantId: base.tenantId, providerKey: base.providerKey, model: base.model }),
        { ...base, providerKey: 'provider_other' },
        { ...base, model: 'model_other' },
        { ...base, environment: 'production' },
      ];
      for (const [index, binding] of changedBindings.entries()) {
        await ensureBinding(control, binding);
        await insertGrant(control, grantFor('llm_binding_' + index, binding, 'llm_generation'));
      }

      const updateCandidate = grantFor('llm_update_candidate', { ...base, providerKey: 'provider_update' }, 'llm_generation');
      await insertGrant(control, updateCandidate);
      await expectPgFailure(
        () => control.query('UPDATE provider_approval_grants SET provider_key = $1 WHERE id = $2', [base.providerKey, updateCandidate.id]),
        { codes: ['23P01'], constraints: ['provider_approval_grants_site_runtime_llm_no_overlap'] },
      );

      const { ProviderApprovalStorageLookupService } = require(
        '../dist/knowledge-sources/provider-approval-storage-lookup.service.js'
      );
      const decision = await new ProviderApprovalStorageLookupService(control)
        .evaluateSiteRuntimeQueryEmbeddingApprovalFromStorage({
          tenantId: base.tenantId,
          siteId: base.siteId,
          environment: base.environment,
          providerKey: base.providerKey,
          model: base.model,
          now: '2026-09-15T00:00:00.000Z',
        });
      assert.equal(decision.allowed, true);
      assert.equal(decision.policy.purpose, 'query_embedding');
      assert.deepEqual(await runReadOnlyPreflight(control), {
        invalid_site_runtime_purpose: 0,
        invalid_site_runtime_source_or_usage_scope: 0,
        invalid_validity_windows: 0,
        missing_site_runtime_conflict_keys: 0,
        overlapping_active_site_runtime_grant_pairs: 0,
      });
    });

    await t.test('a committed concurrent LLM insert causes the blocked overlap to fail', async () => {
      await prepareSchema33(context, 'concurrent-commit');
      const binding = await seedBinding(control, 'concurrent_commit');
      await runConcurrentLlmInsert(context, binding, 'llm-concurrent-commit', true);
    });

    await t.test('a rolled-back concurrent LLM insert lets the blocked writer commit', async () => {
      await prepareSchema33(context, 'concurrent-rollback');
      const binding = await seedBinding(control, 'concurrent_rollback');
      await runConcurrentLlmInsert(context, binding, 'llm-concurrent-rollback', false);
    });

    await t.test('an invalid pre-033 pair aborts atomically and a corrected retry succeeds', async () => {
      const workspace = await prepareSchema32(context, 'invalid-pair');
      const binding = await seedBinding(control, 'invalid_pair');
      await control.query([
        'ALTER TABLE provider_approval_grants',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_usage_check,',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_purpose_check',
      ].join('\n'));
      await insertGrant(control, grantFor('invalid_pair_row', binding, 'llm_generation', {
        usageContexts: '["query_embedding"]',
      }));
      await addLegacyChecksNotValid(control);
      await addMigration033(workspace);

      await assert.rejects(
        () => runProductionMigrations(postgres.databaseUrl, workspace, 'invalid-pair-033'),
        /invalid site_runtime purpose or usage pairs/i,
      );
      assert.equal(await migrationVersionCount(control, migration033), 0);
      assert.equal(await constraintDefinition(control, 'provider_approval_grants_site_runtime_llm_no_overlap'), undefined);
      assert.equal((await control.query("SELECT count(*)::int AS count FROM provider_approval_grants WHERE id = 'invalid_pair_row'")).rows[0].count, 1);

      await control.query("DELETE FROM provider_approval_grants WHERE id = 'invalid_pair_row'");
      await runProductionMigrations(postgres.databaseUrl, workspace, 'invalid-pair-retry');
      assert.equal(await migrationVersionCount(control, migration033), 1);
      assert.ok(await constraintDefinition(control, 'provider_approval_grants_site_runtime_llm_no_overlap'));
    });

    await t.test('historical LLM overlaps abort atomically and revocation permits retry', async () => {
      const workspace = await prepareSchema32(context, 'historical-overlap');
      const binding = await seedBinding(control, 'historical_overlap');
      await control.query([
        'ALTER TABLE provider_approval_grants',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_usage_check,',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_purpose_check',
      ].join('\n'));
      await insertGrant(control, grantFor('historical_llm_first', binding, 'llm_generation'));
      await insertGrant(control, grantFor('historical_llm_second', binding, 'llm_generation', {
        validFrom: '2026-09-15T00:00:00.000Z',
        expiresAt: '2026-10-15T00:00:00.000Z',
      }));
      await addLegacyChecksNotValid(control);
      await addMigration033(workspace);

      await assert.rejects(
        () => runProductionMigrations(postgres.databaseUrl, workspace, 'historical-overlap-033'),
        /overlapping active site_runtime LLM grants/i,
      );
      assert.equal(await migrationVersionCount(control, migration033), 0);
      assert.equal(await constraintDefinition(control, 'provider_approval_grants_site_runtime_llm_no_overlap'), undefined);
      assert.equal((await control.query('SELECT count(*)::int AS count FROM provider_approval_grants')).rows[0].count, 2);

      await control.query([
        'ALTER TABLE provider_approval_grants',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_usage_check,',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_purpose_check',
      ].join('\n'));
      await control.query([
        'UPDATE provider_approval_grants',
        'SET revoked_at = now(),',
        "    revoked_by = 'synthetic-revoker',",
        "    revocation_reason = 'synthetic retry preparation'",
        "WHERE id = 'historical_llm_second'",
      ].join('\n'));
      await addLegacyChecksNotValid(control);
      await runProductionMigrations(postgres.databaseUrl, workspace, 'historical-overlap-retry');
      assert.equal(await migrationVersionCount(control, migration033), 1);
    });

    await t.test('query-only forward recovery is atomic and requires removal of every LLM row', async () => {
      await prepareSchema33(context, 'forward-recovery');
      const binding = await seedBinding(control, 'forward_recovery');
      await insertGrant(control, grantFor('revoked_llm_row', binding, 'llm_generation', {
        revokedAt: '2026-09-10T00:00:00.000Z',
        revokedBy: 'synthetic-revoker',
        revocationReason: 'synthetic rollback proof',
      }));

      await assert.rejects(() => applyQueryOnlyForwardRecovery(control), /check constraint/i);
      assert.ok(await constraintDefinition(control, 'provider_approval_grants_site_runtime_llm_no_overlap'));
      assert.match(await constraintDefinition(control, 'provider_approval_grants_site_runtime_purpose_check'), /llm_generation/);
      assert.equal(await migrationVersionCount(control, migration033), 1);

      await control.query("DELETE FROM provider_approval_grants WHERE id = 'revoked_llm_row'");
      await applyQueryOnlyForwardRecovery(control);
      assert.equal(await constraintDefinition(control, 'provider_approval_grants_site_runtime_llm_no_overlap'), undefined);
      assert.doesNotMatch(await constraintDefinition(control, 'provider_approval_grants_site_runtime_purpose_check'), /llm_generation/);
      assert.equal(await migrationVersionCount(control, migration033), 1);
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (control) await runCleanup(cleanupErrors, 'PostgreSQL control pool', () => control.end());
    if (tempRoot) {
      await runCleanup(cleanupErrors, 'PostgreSQL test workspace', () => rm(tempRoot, { recursive: true, force: true }));
    }
    if (postgres) {
      await runCleanup(
        cleanupErrors,
        'PostgreSQL test container and volumes',
        () => cleanupOwnedPostgresContainer(postgres.container, postgres.volumeNames),
      );
    }
    finishCleanup(primaryError, cleanupErrors, 'PostgreSQL 16 site-runtime LLM schema test');
  }
});
