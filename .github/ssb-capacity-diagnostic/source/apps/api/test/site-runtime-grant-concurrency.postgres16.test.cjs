const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { cp, mkdtemp, mkdir, readdir, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_SITE_RUNTIME_GRANT_CONCURRENCY_TEST === '1';
const apiRoot = join(__dirname, '..');
const migrationsSource = join(apiRoot, 'migrations');
const migration031 = '031_query_embedding_site_runtime_grant_contract.sql';
const migration032 = '032_site_runtime_grant_concurrency.sql';
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
  if (cleanupErrors.length === 0) {
    return;
  }

  const cleanupError = new AggregateError(cleanupErrors, context + ' cleanup failed');
  if (primaryError && typeof primaryError === 'object') {
    primaryError.cleanupError = cleanupError;
    console.error('Additional cleanup failure after ' + context + '; the primary test failure remains primary.');
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
        if (isMissingDockerResource(error)) {
          continue;
        }
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
      try {
        await pool.end();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupIssue('PostgreSQL readiness pool', cleanupError)],
          'PostgreSQL readiness probe and cleanup failed',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function eventually(callback, message) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await callback();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

function withApplicationName(databaseUrl, applicationName) {
  const url = new URL(databaseUrl);
  url.searchParams.set('application_name', applicationName);
  return url.toString();
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

async function addMigration032(workspace) {
  await cp(join(migrationsSource, migration032), join(workspace, 'migrations', migration032));
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
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
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

async function migrationVersionCount(pool, version) {
  const result = await pool.query(
    'SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1',
    [version],
  );
  return result.rows[0].count;
}

async function constraintExists(pool, name) {
  const result = await pool.query(
    [
      'SELECT EXISTS (',
      '  SELECT 1 FROM pg_constraint WHERE conname = $1',
      ') AS exists',
    ].join('\n'),
    [name],
  );
  return result.rows[0].exists;
}

async function btreeGistExtensionCount(pool) {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM pg_extension WHERE extname = 'btree_gist'",
  );
  return result.rows[0].count;
}

async function prepareSchema31(context, label) {
  await resetPublicSchema(context.control);
  const workspace = await mkdtemp(join(context.tempRoot, label + '-'));
  await copyMigrations(workspace, migration031);
  await runProductionMigrations(context.databaseUrl, workspace, label + '-schema-031');
  assert.equal(await migrationVersionCount(context.control, migration031), 1);
  return workspace;
}

async function prepareSchema32(context, label) {
  const workspace = await prepareSchema31(context, label);
  await addMigration032(workspace);
  await runProductionMigrations(context.databaseUrl, workspace, label + '-schema-032');
  assert.equal(await migrationVersionCount(context.control, migration032), 1);
  return workspace;
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
    [
      'INSERT INTO tenants (id, name)',
      'VALUES ($1, $2)',
      'ON CONFLICT (id) DO NOTHING',
    ].join('\n'),
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

function grantFor(id, binding, overrides = {}) {
  return {
    id,
    tenantId: binding.tenantId,
    siteId: binding.siteId,
    sourceId: null,
    sourceTypes: '[]',
    usageContexts: '["query_embedding"]',
    scopeKind: 'site_runtime',
    environment: binding.environment,
    providerKey: binding.providerKey,
    model: binding.model,
    embeddingDimension: 3,
    providerRegion: null,
    dataCategories: '["synthetic"]',
    customerDataApproved: false,
    productionApproved: false,
    providerDpaApproved: false,
    purpose: 'query_embedding',
    retentionPolicy: 'synthetic-retention',
    redactionPolicy: 'synthetic-redaction',
    loggingPolicy: 'synthetic-logging',
    deletionPolicy: 'synthetic-deletion',
    reindexPolicy: null,
    rateLimit: 'synthetic-rate-limit',
    costLimit: 'synthetic-cost-limit',
    validFrom: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-02-01T00:00:00.000Z',
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
    grant.id,
    grant.tenantId,
    grant.siteId,
    grant.sourceId,
    grant.sourceTypes,
    grant.usageContexts,
    grant.scopeKind,
    grant.environment,
    grant.providerKey,
    grant.model,
    grant.embeddingDimension,
    grant.providerRegion,
    grant.dataCategories,
    grant.customerDataApproved,
    grant.productionApproved,
    grant.providerDpaApproved,
    grant.purpose,
    grant.retentionPolicy,
    grant.redactionPolicy,
    grant.loggingPolicy,
    grant.deletionPolicy,
    grant.reindexPolicy,
    grant.rateLimit,
    grant.costLimit,
    grant.validFrom,
    grant.expiresAt,
    grant.revokedAt,
    grant.revokedBy,
    grant.revocationReason,
    grant.approvedBy,
    grant.approvalEvidenceRef,
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
    assert.ok(
      constraints.includes(error.constraint),
      'unexpected PostgreSQL constraint: ' + error.constraint,
    );
  }
}

async function runReadOnlyPreflight(pool) {
  const sql = await readFile(preflightPath, 'utf8');
  const client = await pool.connect();
  let active = false;
  let primaryError;
  try {
    await client.query('BEGIN READ ONLY');
    active = true;
    const result = await client.query(sql);
    await client.query('COMMIT');
    active = false;
    return Object.fromEntries(result.rows.map((row) => [row.check_name, Number(row.row_count)]));
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (active) {
      await runCleanup(cleanupErrors, 'read-only preflight transaction', () => client.query('ROLLBACK'));
    }
    await runCleanup(cleanupErrors, 'read-only preflight client', () => client.release());
    finishCleanup(primaryError, cleanupErrors, 'read-only preflight');
  }
}

async function startPostgres(dockerCommand = docker) {
  await dockerCommand('image', 'inspect', 'pgvector/pgvector:pg16');
  const container = 'site-runtime-grant-' + process.pid + '-' + Date.now();
  let containerCreated = false;
  let volumeNames;

  try {
    await dockerCommand(
      'run',
      '-d',
      '--name',
      container,
      '-e',
      'POSTGRES_PASSWORD=temporary-test-password',
      '-e',
      'POSTGRES_DB=site_runtime_grant_test',
      '-p',
      '127.0.0.1::5432',
      'pgvector/pgvector:pg16',
    );
    containerCreated = true;
    volumeNames = await attachedVolumeNames(container, dockerCommand);
    const result = await dockerCommand('port', container, '5432/tcp');
    const port = Number(result.stdout.trim().split('\n')[0].split(':').at(-1));
    const databaseUrl = 'postgres://postgres:temporary-test-password@127.0.0.1:'
      + port + '/site_runtime_grant_test';
    await waitForPostgres(databaseUrl);
    return { container, databaseUrl, volumeNames };
  } catch (error) {
    if (!containerCreated) {
      throw error;
    }

    try {
      await cleanupOwnedPostgresContainer(container, volumeNames, dockerCommand);
    } catch (cleanupError) {
      finishCleanup(error, [cleanupError], 'PostgreSQL test setup');
    }
    throw error;
  }
}

test('PostgreSQL setup keeps an inspect failure primary while removing its own container', async () => {
  const inspectError = new Error('synthetic mount inspection failure');
  const calls = [];
  let container;
  const dockerCommand = async (...args) => {
    calls.push(args);
    if (args[0] === 'image') {
      return { stdout: '' };
    }
    if (args[0] === 'run') {
      container = args[args.indexOf('--name') + 1];
      return { stdout: container + '\n' };
    }
    if (args[0] === 'inspect') {
      throw inspectError;
    }
    if (args[0] === 'rm') {
      return { stdout: container + '\n' };
    }
    throw new Error('unexpected Docker call: ' + args.join(' '));
  };

  await assert.rejects(
    () => startPostgres(dockerCommand),
    (error) => {
      assert.equal(error, inspectError);
      assert.ok(error.cleanupError instanceof AggregateError);
      return true;
    },
  );

  assert.equal(calls.filter((args) => args[0] === 'inspect').length, 2);
  assert.deepEqual(calls.at(-1), ['rm', '-f', '-v', container]);
});

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

async function runConcurrentInsert(context, binding, label, commitFirstTransaction) {
  const firstName = label + '-first';
  const secondName = label + '-second';
  const firstPool = new Pool({
    connectionString: withApplicationName(context.databaseUrl, firstName),
    max: 1,
  });
  const secondPool = new Pool({
    connectionString: withApplicationName(context.databaseUrl, secondName),
    max: 1,
  });
  const first = await firstPool.connect();
  const second = await secondPool.connect();
  let firstOpen = false;
  let secondOpen = false;
  let secondInsert;
  let secondInsertSettled = false;
  let primaryError;

  try {
    const firstGrant = grantFor(label + '_first', binding);
    const secondGrant = grantFor(label + '_second', binding, {
      validFrom: '2026-01-15T00:00:00.000Z',
      expiresAt: '2026-02-15T00:00:00.000Z',
    });
    await first.query('BEGIN');
    firstOpen = true;
    await insertGrant(first, firstGrant);
    await second.query('BEGIN');
    secondOpen = true;
    secondInsert = insertGrant(second, secondGrant);
    await waitForBlockedInsert(context.control, secondName);
    await first.query(commitFirstTransaction ? 'COMMIT' : 'ROLLBACK');
    firstOpen = false;

    if (commitFirstTransaction) {
      await expectPgFailure(() => secondInsert, {
        codes: ['23P01'],
        constraints: ['provider_approval_grants_site_runtime_no_overlap'],
      });
      secondInsertSettled = true;
      await second.query('ROLLBACK');
      secondOpen = false;
      const firstCount = await context.control.query(
        'SELECT count(*)::int AS count FROM provider_approval_grants WHERE id = $1',
        [firstGrant.id],
      );
      const secondCount = await context.control.query(
        'SELECT count(*)::int AS count FROM provider_approval_grants WHERE id = $1',
        [secondGrant.id],
      );
      assert.equal(firstCount.rows[0].count, 1);
      assert.equal(secondCount.rows[0].count, 0);
    } else {
      await secondInsert;
      secondInsertSettled = true;
      await second.query('COMMIT');
      secondOpen = false;
      const result = await context.control.query(
        'SELECT count(*)::int AS count FROM provider_approval_grants WHERE id = $1',
        [secondGrant.id],
      );
      assert.equal(result.rows[0].count, 1);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (firstOpen) {
      await runCleanup(cleanupErrors, 'first concurrent insert transaction', () => first.query('ROLLBACK'));
    }
    if (secondInsert && !secondInsertSettled) {
      await runCleanup(cleanupErrors, 'pending concurrent insert', () => secondInsert);
    }
    if (secondOpen) {
      await runCleanup(cleanupErrors, 'second concurrent insert transaction', () => second.query('ROLLBACK'));
    }
    await runCleanup(cleanupErrors, 'first concurrent insert client', () => first.release());
    await runCleanup(cleanupErrors, 'second concurrent insert client', () => second.release());
    await runCleanup(cleanupErrors, 'concurrent insert pools', async () => {
      const results = await Promise.allSettled([firstPool.end(), secondPool.end()]);
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length > 0) {
        throw new AggregateError(rejected.map((result) => result.reason), 'concurrent insert pool shutdown failed');
      }
    });
    finishCleanup(primaryError, cleanupErrors, 'concurrent insert');
  }
}

async function runConcurrentRevokeAndReplace(context, binding, label, commitRevocation) {
  const existing = grantFor(label + '_existing', binding);
  await insertGrant(context.control, existing);

  const firstName = label + '-revoke';
  const secondName = label + '-replace';
  const firstPool = new Pool({
    connectionString: withApplicationName(context.databaseUrl, firstName),
    max: 1,
  });
  const secondPool = new Pool({
    connectionString: withApplicationName(context.databaseUrl, secondName),
    max: 1,
  });
  const first = await firstPool.connect();
  const second = await secondPool.connect();
  let firstOpen = false;
  let secondOpen = false;
  let replacementInsert;
  let replacementInsertSettled = false;
  let primaryError;

  try {
    const replacement = grantFor(label + '_replacement', binding);
    await first.query('BEGIN');
    firstOpen = true;
    await first.query(
      [
        'UPDATE provider_approval_grants',
        'SET revoked_at = now(),',
        "    revoked_by = 'synthetic-revoker',",
        "    revocation_reason = 'synthetic replacement'",
        'WHERE id = $1',
      ].join('\n'),
      [existing.id],
    );
    await second.query('BEGIN');
    secondOpen = true;
    replacementInsert = insertGrant(second, replacement);
    await waitForBlockedInsert(context.control, secondName);
    await first.query(commitRevocation ? 'COMMIT' : 'ROLLBACK');
    firstOpen = false;

    if (commitRevocation) {
      await replacementInsert;
      replacementInsertSettled = true;
      await second.query('COMMIT');
      secondOpen = false;
      const result = await context.control.query(
        [
          'SELECT',
          '  count(*) FILTER (WHERE id = $1)::int AS existing_count,',
          '  count(*) FILTER (WHERE id = $2)::int AS replacement_count',
          'FROM provider_approval_grants',
        ].join('\n'),
        [existing.id, replacement.id],
      );
      assert.equal(result.rows[0].existing_count, 1);
      assert.equal(result.rows[0].replacement_count, 1);
    } else {
      await expectPgFailure(() => replacementInsert, {
        codes: ['23P01'],
        constraints: ['provider_approval_grants_site_runtime_no_overlap'],
      });
      replacementInsertSettled = true;
      await second.query('ROLLBACK');
      secondOpen = false;
      const result = await context.control.query(
        'SELECT revoked_at IS NULL AS still_active FROM provider_approval_grants WHERE id = $1',
        [existing.id],
      );
      assert.equal(result.rows[0].still_active, true);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (firstOpen) {
      await runCleanup(cleanupErrors, 'first revoke transaction', () => first.query('ROLLBACK'));
    }
    if (replacementInsert && !replacementInsertSettled) {
      await runCleanup(cleanupErrors, 'pending replacement insert', () => replacementInsert);
    }
    if (secondOpen) {
      await runCleanup(cleanupErrors, 'replacement insert transaction', () => second.query('ROLLBACK'));
    }
    await runCleanup(cleanupErrors, 'first revoke client', () => first.release());
    await runCleanup(cleanupErrors, 'replacement insert client', () => second.release());
    await runCleanup(cleanupErrors, 'revoke and replace pools', async () => {
      const results = await Promise.allSettled([firstPool.end(), secondPool.end()]);
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length > 0) {
        throw new AggregateError(rejected.map((result) => result.reason), 'revoke and replace pool shutdown failed');
      }
    });
    finishCleanup(primaryError, cleanupErrors, 'revoke and replace');
  }
}

test('PostgreSQL 16 enforces site-runtime grant purpose and interval concurrency', {
  skip: !enabled,
  timeout: 300_000,
}, async (t) => {
  let postgres;
  let tempRoot;
  let control;
  let primaryError;

  try {
    postgres = await startPostgres();
    tempRoot = await mkdtemp(join(tmpdir(), 'site-runtime-grant-pg16-'));
    control = new Pool({ connectionString: postgres.databaseUrl, max: 4 });
    const context = { ...postgres, tempRoot, control };
    await t.test('the production runner applies 032 only after a clean read-only preflight', async () => {
      const workspace = await prepareSchema31(context, 'valid-migration');
      const binding = await seedBinding(control, 'valid_migration');
      await insertGrant(control, grantFor('valid_migration_grant', binding));
      assert.deepEqual(await runReadOnlyPreflight(control), {
        invalid_site_runtime_purpose: 0,
        invalid_site_runtime_source_or_usage_scope: 0,
        invalid_validity_windows: 0,
        missing_site_runtime_conflict_keys: 0,
        overlapping_active_site_runtime_grant_pairs: 0,
      });

      await addMigration032(workspace);
      await runProductionMigrations(postgres.databaseUrl, workspace, 'valid-migration-032');
      assert.equal(await migrationVersionCount(control, migration032), 1);
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_purpose_check'),
        true,
      );
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_no_overlap'),
        true,
      );
      await runProductionMigrations(postgres.databaseUrl, workspace, 'valid-migration-retry');
      assert.equal(await migrationVersionCount(control, migration032), 1);

      await control.query([
        'ALTER TABLE provider_approval_grants',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_no_overlap,',
        '  DROP CONSTRAINT provider_approval_grants_site_runtime_purpose_check',
      ].join('\n'));
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_no_overlap'),
        false,
      );
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_purpose_check'),
        false,
      );
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_usage_check'),
        true,
      );
    });

    await t.test('a historical wrong purpose blocks 032 without a partial migration', async () => {
      const workspace = await prepareSchema31(context, 'wrong-purpose');
      const binding = await seedBinding(control, 'wrong_purpose');
      await insertGrant(control, grantFor('wrong_purpose_grant', binding, {
        purpose: 'non_query_embedding',
      }));
      const extensionCountBefore = await btreeGistExtensionCount(control);
      assert.equal((await runReadOnlyPreflight(control)).invalid_site_runtime_purpose, 1);
      await addMigration032(workspace);
      await assert.rejects(
        () => runProductionMigrations(postgres.databaseUrl, workspace, 'wrong-purpose-032'),
        /invalid site_runtime purposes/,
      );
      assert.equal(await migrationVersionCount(control, migration032), 0);
      assert.equal(
        (await control.query(
          'SELECT count(*)::int AS count FROM provider_approval_grants WHERE id = $1',
          ['wrong_purpose_grant'],
        )).rows[0].count,
        1,
      );
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_purpose_check'),
        false,
      );
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_no_overlap'),
        false,
      );
      assert.equal(await btreeGistExtensionCount(control), extensionCountBefore);
    });

    await t.test('historical overlaps block 032 without a tracking row or partial constraint', async () => {
      const workspace = await prepareSchema31(context, 'overlap-migration');
      const binding = await seedBinding(control, 'overlap_migration');
      await insertGrant(control, grantFor('overlap_migration_first', binding));
      await insertGrant(control, grantFor('overlap_migration_second', binding, {
        validFrom: '2026-01-15T00:00:00.000Z',
        expiresAt: '2026-02-15T00:00:00.000Z',
      }));
      const extensionCountBefore = await btreeGistExtensionCount(control);
      assert.equal(
        (await runReadOnlyPreflight(control)).overlapping_active_site_runtime_grant_pairs,
        1,
      );
      await addMigration032(workspace);
      await assert.rejects(
        () => runProductionMigrations(postgres.databaseUrl, workspace, 'overlap-migration-032'),
        /overlapping active site_runtime grants/,
      );
      assert.equal(await migrationVersionCount(control, migration032), 0);
      assert.equal(
        (await control.query('SELECT count(*)::int AS count FROM provider_approval_grants'))
          .rows[0].count,
        2,
      );
      assert.equal(
        await constraintExists(control, 'provider_approval_grants_site_runtime_no_overlap'),
        false,
      );
      assert.equal(await btreeGistExtensionCount(control), extensionCountBefore);
    });

    await t.test('valid and adjacent grants work while overlapping inserts and updates fail', async () => {
      await prepareSchema32(context, 'constraint-cases');
      const baseBinding = await seedBinding(control, 'constraint_base');
      const baseGrant = grantFor('constraint_base_grant', baseBinding);
      await insertGrant(control, baseGrant);
      await expectPgFailure(
        () => insertGrant(control, grantFor('constraint_identical', baseBinding)),
        {
          codes: ['23P01'],
          constraints: ['provider_approval_grants_site_runtime_no_overlap'],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('constraint_contained', baseBinding, {
          validFrom: '2026-01-10T00:00:00.000Z',
          expiresAt: '2026-01-20T00:00:00.000Z',
        })),
        {
          codes: ['23P01'],
          constraints: ['provider_approval_grants_site_runtime_no_overlap'],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('constraint_partial', baseBinding, {
          validFrom: '2026-01-20T00:00:00.000Z',
          expiresAt: '2026-02-20T00:00:00.000Z',
        })),
        {
          codes: ['23P01'],
          constraints: ['provider_approval_grants_site_runtime_no_overlap'],
        },
      );
      await insertGrant(control, grantFor('constraint_adjacent', baseBinding, {
        validFrom: '2026-02-01T00:00:00.000Z',
        expiresAt: '2026-03-01T00:00:00.000Z',
      }));

      const changedDimensions = [
        bindingFor('constraint_other_tenant', {
          providerKey: baseBinding.providerKey,
          model: baseBinding.model,
        }),
        bindingFor('constraint_other_site', {
          tenantId: baseBinding.tenantId,
          providerKey: baseBinding.providerKey,
          model: baseBinding.model,
        }),
        { ...baseBinding, providerKey: 'provider_constraint_other' },
        { ...baseBinding, model: 'model_constraint_other' },
        { ...baseBinding, environment: 'production' },
      ];
      for (const [index, binding] of changedDimensions.entries()) {
        await ensureBinding(control, binding);
        await insertGrant(control, grantFor('constraint_dimension_' + index, binding));
      }

      const updateCandidate = grantFor('constraint_update_candidate', {
        ...baseBinding,
        providerKey: 'provider_constraint_update',
      });
      await insertGrant(control, updateCandidate);
      await expectPgFailure(
        () => control.query(
          'UPDATE provider_approval_grants SET provider_key = $1 WHERE id = $2',
          [baseBinding.providerKey, updateCandidate.id],
        ),
        {
          codes: ['23P01'],
          constraints: ['provider_approval_grants_site_runtime_no_overlap'],
        },
      );

      const revokedBinding = await seedBinding(control, 'constraint_revoked');
      const revoked = grantFor('constraint_revoked', revokedBinding, {
        validFrom: '2026-04-01T00:00:00.000Z',
        expiresAt: '2026-05-01T00:00:00.000Z',
      });
      await insertGrant(control, revoked);
      await control.query([
        'UPDATE provider_approval_grants',
        'SET revoked_at = now(),',
        "    revoked_by = 'synthetic-revoker',",
        "    revocation_reason = 'synthetic replacement'",
        'WHERE id = $1',
      ].join('\n'), [revoked.id]);
      await insertGrant(control, grantFor('constraint_replacement', revokedBinding, {
        validFrom: revoked.validFrom,
        expiresAt: revoked.expiresAt,
      }));
    });

    await t.test('purpose, source-scope, usage, and interval negative cases fail closed', async () => {
      await prepareSchema32(context, 'negative-cases');
      const binding = await seedBinding(control, 'negative_cases');
      await expectPgFailure(
        () => insertGrant(control, grantFor('negative_wrong_purpose', binding, {
          purpose: 'answer_generation',
        })),
        {
          codes: ['23514'],
          constraints: ['provider_approval_grants_site_runtime_purpose_check'],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('negative_empty_purpose', binding, { purpose: '' })),
        {
          codes: ['23514'],
          constraints: [
            'provider_approval_grants_site_runtime_purpose_check',
            'provider_approval_grants_text_scope_check',
          ],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('negative_whitespace_purpose', binding, { purpose: ' ' })),
        {
          codes: ['23514'],
          constraints: [
            'provider_approval_grants_site_runtime_purpose_check',
            'provider_approval_grants_text_scope_check',
          ],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('negative_null_purpose', binding, { purpose: null })),
        {
          codes: ['23502', '23514'],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('negative_source_types', binding, {
          sourceTypes: '["source_type"]',
        })),
        {
          codes: ['23514'],
          constraints: ['provider_approval_grants_source_scope_check'],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('negative_usage_context', binding, {
          usageContexts: '["answer_generation"]',
        })),
        {
          codes: ['23514'],
          constraints: ['provider_approval_grants_site_runtime_usage_check'],
        },
      );
      await expectPgFailure(
        () => insertGrant(control, grantFor('negative_invalid_window', binding, {
          validFrom: '2026-06-01T00:00:00.000Z',
          expiresAt: '2026-06-01T00:00:00.000Z',
        })),
        {
          codes: ['23514'],
          constraints: ['provider_approval_grants_valid_window_check'],
        },
      );
    });

    await t.test('uncommitted insert blocks a conflicting writer and commit rejects it', async () => {
      await prepareSchema32(context, 'concurrent-commit');
      const binding = await seedBinding(control, 'concurrent_commit');
      await runConcurrentInsert(context, binding, 'concurrent-commit', true);
    });

    await t.test('uncommitted insert blocks a conflicting writer and rollback allows it', async () => {
      await prepareSchema32(context, 'concurrent-rollback');
      const binding = await seedBinding(control, 'concurrent_rollback');
      await runConcurrentInsert(context, binding, 'concurrent-rollback', false);
    });

    await t.test('committed revocation permits a concurrent replacement grant', async () => {
      await prepareSchema32(context, 'revoke-commit');
      const binding = await seedBinding(control, 'revoke_commit');
      await runConcurrentRevokeAndReplace(context, binding, 'revoke-commit', true);
    });

    await t.test('rolled-back revocation keeps the active grant and rejects a replacement', async () => {
      await prepareSchema32(context, 'revoke-rollback');
      const binding = await seedBinding(control, 'revoke_rollback');
      await runConcurrentRevokeAndReplace(context, binding, 'revoke-rollback', false);
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (control) {
      await runCleanup(cleanupErrors, 'PostgreSQL control pool', () => control.end());
    }
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
    finishCleanup(primaryError, cleanupErrors, 'PostgreSQL 16 site-runtime grant test');
  }
});
