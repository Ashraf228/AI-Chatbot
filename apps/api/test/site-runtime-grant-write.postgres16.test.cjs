const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { cp, mkdtemp, mkdir, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_SITE_RUNTIME_GRANT_WRITE_TEST === '1';
const apiRoot = join(__dirname, '..');
const migrationsSource = join(apiRoot, 'migrations');

async function docker(...args) {
  return execFileAsync('docker', args, { timeout: 30_000 });
}

function withApplicationName(databaseUrl, applicationName) {
  const url = new URL(databaseUrl);
  url.searchParams.set('application_name', applicationName);
  return url.toString();
}

async function attachedVolumeNames(container) {
  const result = await docker('inspect', '--format', '{{json .Mounts}}', container);
  const mounts = JSON.parse(result.stdout);
  if (!Array.isArray(mounts)) throw new Error('Docker did not return a mount list');
  return [...new Set(mounts
    .filter((mount) => mount?.Type === 'volume' && typeof mount.Name === 'string')
    .map((mount) => mount.Name))];
}

async function cleanupPostgres(container, volumeNames, dockerFn = docker) {
  const failures = [];
  try {
    await dockerFn('rm', '-f', '-v', container);
  } catch (error) {
    if (!/no such container|not found/i.test(String(error?.stderr || error?.message || error))) failures.push(error);
  }
  for (const volumeName of volumeNames) {
    try {
      await dockerFn('volume', 'inspect', volumeName);
      failures.push(new Error('PostgreSQL test volume still exists: ' + volumeName));
    } catch (error) {
      if (!/no such volume|not found/i.test(String(error?.stderr || error?.message || error))) failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, 'PostgreSQL test cleanup failed');
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

async function startPostgres() {
  await docker('image', 'inspect', 'pgvector/pgvector:pg16');
  const container = 'site-runtime-grant-write-' + process.pid + '-' + Date.now();
  let created = false;
  let volumeNames = [];
  try {
    await docker(
      'run', '-d', '--name', container,
      '-e', 'POSTGRES_PASSWORD=temporary-test-password',
      '-e', 'POSTGRES_DB=site_runtime_grant_write_test',
      '-p', '127.0.0.1::5432',
      'pgvector/pgvector:pg16',
    );
    created = true;
    volumeNames = await attachedVolumeNames(container);
    const port = Number((await docker('port', container, '5432/tcp')).stdout.trim().split(':').at(-1));
    const databaseUrl = 'postgres://postgres:temporary-test-password@127.0.0.1:'
      + port + '/site_runtime_grant_write_test';
    await waitForPostgres(databaseUrl);
    return { container, volumeNames, databaseUrl };
  } catch (error) {
    if (created) await cleanupPostgres(container, volumeNames).catch((cleanupError) => { error.cleanupError = cleanupError; });
    throw error;
  }
}

async function copyMigrations(workspace) {
  const migrations = join(workspace, 'migrations');
  await mkdir(migrations, { recursive: true });
  const files = (await readdir(migrationsSource)).filter((name) => /^\d+_.+\.sql$/i.test(name)).sort();
  await Promise.all(files.map((name) => cp(join(migrationsSource, name), join(migrations, name))));
}

function createDatabase(databaseUrl) {
  const { DatabaseService } = require('../dist/db/database.service.js');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  try {
    return new DatabaseService();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

async function runProductionMigrations(databaseUrl, workspace, applicationName) {
  const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service.js');
  const previousCwd = process.cwd();
  const database = createDatabase(withApplicationName(databaseUrl, applicationName));
  try {
    process.chdir(workspace);
    await new DatabaseMigrationsService(database).runPendingMigrations();
  } finally {
    process.chdir(previousCwd);
    await database.pool.end();
  }
}

async function resetAndMigrate(context, label) {
  await context.control.query('DROP SCHEMA public CASCADE');
  await context.control.query('CREATE SCHEMA public AUTHORIZATION postgres');
  await context.control.query('GRANT ALL ON SCHEMA public TO postgres');
  await context.control.query('GRANT ALL ON SCHEMA public TO public');
  const workspace = await mkdtemp(join(context.tempRoot, label + '-'));
  await copyMigrations(workspace);
  await runProductionMigrations(context.databaseUrl, workspace, label + '-runner');
  return workspace;
}

async function seedSite(pool, tenantId = 'tenant-write', siteId = 'site-write') {
  await pool.query('INSERT INTO tenants(id, name) VALUES ($1, $2)', [tenantId, 'Synthetic ' + tenantId]);
  await pool.query(
    'INSERT INTO sites(id, tenant_id, name, site_key) VALUES ($1, $2, $3, $4)',
    [siteId, tenantId, 'Synthetic ' + siteId, siteId],
  );
  return { tenantId, siteId, actorId: 'synthetic-admin', actorRole: 'admin' };
}

function terms(overrides = {}) {
  return {
    validFrom: '2030-02-01T00:00:00.000Z',
    expiresAt: '2030-03-01T00:00:00.000Z',
    embeddingDimension: 1536,
    providerRegion: null,
    dataCategories: ['synthetic'],
    customerDataApproved: true,
    productionApproved: false,
    providerDpaApproved: true,
    retentionPolicy: 'synthetic-retention',
    redactionPolicy: 'synthetic-redaction',
    loggingPolicy: 'synthetic-logging',
    deletionPolicy: 'synthetic-deletion',
    reindexPolicy: null,
    rateLimit: 'synthetic-rate-limit',
    costLimit: 'synthetic-cost-limit',
    approvalEvidenceRef: 'synthetic-evidence',
    ...overrides,
  };
}

function runtimeContract() {
  return {
    resolveRuntimeContract() {
      return {
        environment: 'non_production',
        providerKey: 'openai',
        model: 'text-embedding-3-small',
        supported: true,
      };
    },
  };
}

function createService(databaseUrl, auditWriter) {
  const { SiteRuntimeGrantWriteService } = require('../dist/knowledge-sources/site-runtime-grant-write.service.js');
  const { ProviderApprovalAuditWriter } = require('../dist/knowledge-sources/provider-approval-audit-writer.service.js');
  const db = createDatabase(databaseUrl);
  return {
    db,
    service: new SiteRuntimeGrantWriteService(db, auditWriter || new ProviderApprovalAuditWriter(), runtimeContract()),
  };
}

async function count(pool, table) {
  return (await pool.query('SELECT count(*)::int AS count FROM ' + table)).rows[0].count;
}

async function waitForLock(control, applicationName) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await control.query(
      `SELECT waiting.wait_event_type,
              COALESCE(
                array_agg(blocker.application_name) FILTER (WHERE blocker.application_name IS NOT NULL),
                ARRAY[]::text[]
              ) AS blocker_application_names
       FROM pg_stat_activity waiting
       LEFT JOIN LATERAL unnest(pg_blocking_pids(waiting.pid)) AS blocker_pid(pid) ON true
       LEFT JOIN pg_stat_activity blocker ON blocker.pid = blocker_pid.pid
       WHERE waiting.application_name = $1
         AND waiting.state = 'active'
       GROUP BY waiting.pid, waiting.wait_event_type`,
      [applicationName],
    );
    const waiting = result.rows.find((row) => row.wait_event_type === 'Lock');
    if (waiting) return waiting;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('timed out waiting for database lock: ' + applicationName);
}

function deferred() {
  let signalEntered;
  let release;
  const entered = new Promise((resolve) => { signalEntered = resolve; });
  const pending = new Promise((resolve) => { release = resolve; });
  return { entered, pending, release, signalEntered };
}

async function captureCleanupFailure(failures, action) {
  try {
    await action();
  } catch (error) {
    failures.push(error);
  }
}

async function withPostgresTestResources(run, overrides = {}) {
  const startPostgresFn = overrides.startPostgres || startPostgres;
  const mkdtempFn = overrides.mkdtemp || mkdtemp;
  const createPoolFn = overrides.createPool || ((options) => new Pool(options));
  const rmFn = overrides.rm || rm;
  const cleanupPostgresFn = overrides.cleanupPostgres || cleanupPostgres;
  let postgres;
  let tempRoot;
  let control;
  const databases = [];
  let primaryError;

  try {
    postgres = await startPostgresFn();
    tempRoot = await mkdtempFn(join(tmpdir(), 'site-runtime-grant-write-pg16-'));
    control = createPoolFn({ connectionString: postgres.databaseUrl, max: 2 });
    return await run({
      postgres,
      tempRoot,
      control,
      service(name, auditWriter) {
        const created = createService(withApplicationName(postgres.databaseUrl, name), auditWriter);
        databases.push(created.db);
        return created.service;
      },
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const database of databases) {
      await captureCleanupFailure(cleanupErrors, () => database.pool.end());
    }
    if (control) await captureCleanupFailure(cleanupErrors, () => control.end());
    if (tempRoot) {
      await captureCleanupFailure(cleanupErrors, () => rmFn(tempRoot, { recursive: true, force: true }));
    }
    if (postgres) {
      await captureCleanupFailure(
        cleanupErrors,
        () => cleanupPostgresFn(postgres.container, postgres.volumeNames),
      );
    }
    if (cleanupErrors.length) {
      if (primaryError && typeof primaryError === 'object') {
        primaryError.cleanupError = new AggregateError(cleanupErrors, 'PostgreSQL write-service test cleanup failed');
      } else {
        throw new AggregateError(cleanupErrors, 'PostgreSQL write-service test cleanup failed');
      }
    }
  }
}

function setupCleanupDocker(calls) {
  return async (...args) => {
    calls.push(args);
    if (args[0] === 'rm') return { stdout: '', stderr: '' };
    if (args[0] === 'volume' && args[1] === 'inspect') {
      throw Object.assign(new Error('No such volume'), { stderr: 'No such volume' });
    }
    throw new Error('Unexpected Docker call: ' + args.join(' '));
  };
}

test('setup removes its own container when temp directory creation fails', async () => {
  const setupError = new Error('synthetic mkdtemp failure');
  const dockerCalls = [];
  const container = 'site-runtime-grant-write-mkdtemp-failure';
  await assert.rejects(
    () => withPostgresTestResources(async () => {}, {
      startPostgres: async () => ({ container, volumeNames: ['synthetic-volume'], databaseUrl: 'postgres://unused' }),
      mkdtemp: async () => { throw setupError; },
      cleanupPostgres: (ownedContainer, volumeNames) => cleanupPostgres(
        ownedContainer,
        volumeNames,
        setupCleanupDocker(dockerCalls),
      ),
    }),
    (error) => error === setupError,
  );
  assert.deepEqual(dockerCalls[0], ['rm', '-f', '-v', container]);
  assert.deepEqual(dockerCalls[1], ['volume', 'inspect', 'synthetic-volume']);
});

test('setup removes its temp directory and own container when control pool creation fails', async () => {
  const setupError = new Error('synthetic pool creation failure');
  const tempCleanupError = new Error('synthetic temp cleanup failure');
  const dockerCalls = [];
  const removedPaths = [];
  const container = 'site-runtime-grant-write-pool-failure';
  const tempRoot = join(tmpdir(), 'site-runtime-grant-write-pool-failure');
  await assert.rejects(
    () => withPostgresTestResources(async () => {}, {
      startPostgres: async () => ({ container, volumeNames: ['synthetic-volume'], databaseUrl: 'postgres://unused' }),
      mkdtemp: async () => tempRoot,
      createPool: () => { throw setupError; },
      rm: (...args) => {
        removedPaths.push(args);
        throw tempCleanupError;
      },
      cleanupPostgres: (ownedContainer, volumeNames) => cleanupPostgres(
        ownedContainer,
        volumeNames,
        setupCleanupDocker(dockerCalls),
      ),
    }),
    (error) => error === setupError,
  );
  assert.deepEqual(removedPaths, [[tempRoot, { recursive: true, force: true }]]);
  assert.deepEqual(dockerCalls[0], ['rm', '-f', '-v', container]);
  assert.deepEqual(dockerCalls[1], ['volume', 'inspect', 'synthetic-volume']);
  assert.ok(setupError.cleanupError instanceof AggregateError);
  assert.deepEqual(setupError.cleanupError.errors, [tempCleanupError]);
});

test('SiteRuntimeGrantWriteService uses PostgreSQL 16 transactions and cleans its disposable resources', { skip: !enabled }, async (t) => {
  await withPostgresTestResources(async ({ postgres, tempRoot, control, service }) => {
    await t.test('create and exact repeat persist one grant and one audit event', async () => {
      await resetAndMigrate({ control, databaseUrl: postgres.databaseUrl, tempRoot }, 'create-repeat');
      const scope = await seedSite(control);
      const writer = service('write-create-repeat');
      assert.equal((await writer.create(scope, terms())).kind, 'created');
      assert.equal((await writer.create(scope, terms())).kind, 'reused');
      assert.equal(await count(control, 'provider_approval_grants'), 1);
      assert.equal(await count(control, 'provider_approval_audit_events'), 1);
    });

    await t.test('audit failures roll create and revoke back', async () => {
      await resetAndMigrate({ control, databaseUrl: postgres.databaseUrl, tempRoot }, 'audit-rollback');
      const scope = await seedSite(control);
      const failingAudit = { async record() { throw new Error('synthetic audit failure'); } };
      await assert.rejects(() => service('write-create-audit-failure', failingAudit).create(scope, terms()), /synthetic audit failure/);
      assert.equal(await count(control, 'provider_approval_grants'), 0);

      const created = await service('write-create-before-revoke').create(scope, terms());
      await assert.rejects(
        () => service('write-revoke-audit-failure', failingAudit).revoke(scope, { grantId: created.grant.id, revocationReason: 'synthetic reason' }),
        /synthetic audit failure/,
      );
      const grant = (await control.query('SELECT revoked_at FROM provider_approval_grants WHERE id = $1', [created.grant.id])).rows[0];
      assert.equal(grant.revoked_at, null);
    });

    await t.test('parallel identical creates are serialized into created then reused', async () => {
      await resetAndMigrate({ control, databaseUrl: postgres.databaseUrl, tempRoot }, 'parallel-reuse');
      const scope = await seedSite(control);
      const gate = deferred();
      const { ProviderApprovalAuditWriter } = require('../dist/knowledge-sources/provider-approval-audit-writer.service.js');
      const firstAudit = new ProviderApprovalAuditWriter();
      const blockingAudit = {
        async record(tx, input) {
          gate.signalEntered();
          await gate.pending;
          return firstAudit.record(tx, input);
        },
      };
      const first = service('parallel-reuse-first', blockingAudit);
      const second = service('parallel-reuse-second');
      const firstCreate = first.create(scope, terms());
      await gate.entered;
      const secondCreate = second.create(scope, terms());
      const wait = await waitForLock(control, 'parallel-reuse-second');
      assert.ok(wait.blocker_application_names.includes('parallel-reuse-first'));
      gate.release();
      const results = await Promise.all([firstCreate, secondCreate]);
      assert.deepEqual(results.map((result) => result.kind).sort(), ['created', 'reused']);
      assert.equal(await count(control, 'provider_approval_grants'), 1);
    });

    await t.test('parallel overlapping creates leave exactly one active grant', async () => {
      await resetAndMigrate({ control, databaseUrl: postgres.databaseUrl, tempRoot }, 'parallel-conflict');
      const scope = await seedSite(control);
      const gate = deferred();
      const { ProviderApprovalAuditWriter } = require('../dist/knowledge-sources/provider-approval-audit-writer.service.js');
      const realAudit = new ProviderApprovalAuditWriter();
      const blockingAudit = { async record(tx, input) { gate.signalEntered(); await gate.pending; return realAudit.record(tx, input); } };
      const firstCreate = service('parallel-conflict-first', blockingAudit).create(scope, terms());
      await gate.entered;
      const secondCreate = service('parallel-conflict-second').create(scope, terms({ approvalEvidenceRef: 'different-evidence' }));
      const wait = await waitForLock(control, 'parallel-conflict-second');
      assert.ok(wait.blocker_application_names.includes('parallel-conflict-first'));
      gate.release();
      const results = await Promise.all([firstCreate, secondCreate]);
      assert.deepEqual(results.map((result) => result.kind).sort(), ['conflict', 'created']);
      assert.equal((await control.query("SELECT count(*)::int AS count FROM provider_approval_grants WHERE revoked_at IS NULL")).rows[0].count, 1);
    });

    await t.test('revoke serializes a replacement after commit', async () => {
      await resetAndMigrate({ control, databaseUrl: postgres.databaseUrl, tempRoot }, 'revoke-replacement');
      const scope = await seedSite(control);
      const original = await service('revoke-seed').create(scope, terms());
      const gate = deferred();
      const { ProviderApprovalAuditWriter } = require('../dist/knowledge-sources/provider-approval-audit-writer.service.js');
      const realAudit = new ProviderApprovalAuditWriter();
      const blockingAudit = { async record(tx, input) { gate.signalEntered(); await gate.pending; return realAudit.record(tx, input); } };
      const revocation = service('revoke-first', blockingAudit).revoke(scope, {
        grantId: original.grant.id,
        revocationReason: 'synthetic replacement',
      });
      await gate.entered;
      const replacement = service('revoke-replacement').create(scope, terms({ approvalEvidenceRef: 'replacement-evidence' }));
      const wait = await waitForLock(control, 'revoke-replacement');
      assert.ok(wait.blocker_application_names.includes('revoke-first'));
      gate.release();
      assert.equal((await revocation).kind, 'revoked');
      assert.equal((await replacement).kind, 'created');
      assert.equal((await control.query("SELECT count(*)::int AS count FROM provider_approval_grants WHERE revoked_at IS NULL")).rows[0].count, 1);
    });

    await t.test('replacement waits for a revoke and rechecks the rolled-back grant', async () => {
      await resetAndMigrate({ control, databaseUrl: postgres.databaseUrl, tempRoot }, 'revoke-rollback-replacement');
      const scope = await seedSite(control);
      const original = await service('revoke-rollback-seed').create(scope, terms());
      const gate = deferred();
      const auditError = new Error('synthetic revoke audit failure');
      const failingAudit = {
        async record() {
          gate.signalEntered();
          await gate.pending;
          throw auditError;
        },
      };
      const revocation = service('revoke-rollback', failingAudit).revoke(scope, {
        grantId: original.grant.id,
        revocationReason: 'synthetic rollback',
      });
      await gate.entered;
      const replacement = service('revoke-rollback-replacement').create(
        scope,
        terms({ approvalEvidenceRef: 'after-rollback' }),
      );
      const wait = await waitForLock(control, 'revoke-rollback-replacement');
      assert.ok(wait.blocker_application_names.includes('revoke-rollback'));
      gate.release();
      await assert.rejects(
        () => revocation,
        (error) => error === auditError,
      );
      assert.equal((await replacement).kind, 'conflict');

      const grants = await control.query(
        'SELECT id, revoked_at FROM provider_approval_grants ORDER BY id',
      );
      assert.deepEqual(grants.rows, [{ id: original.grant.id, revoked_at: null }]);
      const audits = await control.query(
        'SELECT approval_grant_id, event_type FROM provider_approval_audit_events ORDER BY created_at, id',
      );
      assert.deepEqual(audits.rows, [{ approval_grant_id: original.grant.id, event_type: 'approval_created' }]);
    });
  });
});
