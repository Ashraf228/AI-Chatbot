const assert = require('node:assert/strict');
const { spawn, execFile } = require('node:child_process');
const { createHash, scryptSync } = require('node:crypto');
const { access, cp, mkdir, mkdtemp, readdir, rm } = require('node:fs/promises');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_SITE_RUNTIME_GRANT_OPERATOR_FLOW_TEST === '1';
const apiRoot = join(__dirname, '..');
const repositoryRoot = join(apiRoot, '..', '..');
const dashboardRoot = join(repositoryRoot, 'apps', 'dashboard');
const migrationsSource = join(apiRoot, 'migrations');
const dashboardStandaloneSource = join(dashboardRoot, '.next', 'standalone');
const dashboardStaticSource = join(dashboardRoot, '.next', 'static');
const apiMain = join(apiRoot, 'dist', 'main.js');
const postgresImage = 'pgvector/pgvector:pg16';

const originTenantId = 't-default';
const targetTenantId = 'synthetic-flow-target';
const targetSiteId = 'synthetic-flow-site';
const foreignTenantId = 'synthetic-flow-foreign';
const foreignSiteId = 'synthetic-flow-foreign-site';
const operatorId = 'synthetic-flow-operator';
const noCapabilityId = 'synthetic-flow-no-capability';
const deactivatedId = 'synthetic-flow-deactivated';
const operatorEmail = 'flow-operator@synthetic.invalid';
const noCapabilityEmail = 'flow-no-capability@synthetic.invalid';
const deactivatedEmail = 'flow-deactivated@synthetic.invalid';
const sessionSecret = 'synthetic-flow-session-secret-not-for-use';
const dashboardToken = 'synthetic-flow-dashboard-token-not-for-use';
const providerKey = 'openai';
const providerModel = 'text-embedding-3-small';

async function docker(...args) {
  return execFileAsync('docker', args, { timeout: 30_000 });
}

function cleanupIssue(context, error) {
  return new Error(context + ' cleanup failed', { cause: error });
}

function isMissingDockerResource(error) {
  const details = error && typeof error === 'object'
    ? [error.message, error.stdout, error.stderr].filter(Boolean).join('\n')
    : String(error);
  return /no such (?:container|object|volume)|not found/i.test(details);
}

async function withOwnedResources(callback) {
  const cleanups = [];
  let primaryError;

  const resources = {
    own(context, cleanup) {
      cleanups.unshift({ context, cleanup });
    },
  };

  try {
    return await callback(resources);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const entry of cleanups) {
      try {
        await entry.cleanup();
      } catch (error) {
        cleanupErrors.push(cleanupIssue(entry.context, error));
      }
    }

    if (cleanupErrors.length > 0) {
      const cleanupError = new AggregateError(cleanupErrors, 'Operator flow test cleanup failed');
      if (primaryError && typeof primaryError === 'object') {
        primaryError.cleanupError = cleanupError;
      } else {
        throw cleanupError;
      }
    }
  }
}

async function attachedVolumeNames(container, dockerCommand = docker) {
  const result = await dockerCommand('inspect', '--format', '{{json .Mounts}}', container);
  const mounts = JSON.parse(result.stdout);
  if (!Array.isArray(mounts)) throw new Error('Docker did not return a mount list');
  return [...new Set(mounts
    .filter((mount) => mount?.Type === 'volume' && typeof mount.Name === 'string' && mount.Name)
    .map((mount) => mount.Name))];
}

async function cleanupOwnedPostgres(container, capturedVolumeNames, dockerCommand = docker) {
  const failures = [];
  let volumeNames = capturedVolumeNames;

  if (volumeNames === undefined) {
    try {
      volumeNames = await attachedVolumeNames(container, dockerCommand);
    } catch (error) {
      failures.push(cleanupIssue('PostgreSQL volume inventory', error));
    }
  }

  try {
    await dockerCommand('rm', '-f', '-v', container);
  } catch (error) {
    if (!isMissingDockerResource(error)) failures.push(cleanupIssue('PostgreSQL container removal', error));
  }

  try {
    await dockerCommand('inspect', container);
    failures.push(new Error('PostgreSQL test container still exists: ' + container));
  } catch (error) {
    if (!isMissingDockerResource(error)) failures.push(cleanupIssue('PostgreSQL container inspection', error));
  }

  if (volumeNames !== undefined) {
    for (const volumeName of volumeNames) {
      try {
        await dockerCommand('volume', 'inspect', volumeName);
        failures.push(new Error('PostgreSQL test volume still exists: ' + volumeName));
      } catch (error) {
        if (!isMissingDockerResource(error)) failures.push(cleanupIssue('PostgreSQL volume inspection', error));
      }
    }
  }

  if (failures.length > 0) throw new AggregateError(failures, 'PostgreSQL cleanup failed');
}

async function waitForPostgres(databaseUrl) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
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

async function startPostgres(resources, dockerCommand = docker) {
  await dockerCommand('image', 'inspect', postgresImage);
  const container = 'site-runtime-grant-operator-flow-' + process.pid + '-' + Date.now();
  const state = { volumeNames: undefined };

  await dockerCommand(
    'run', '-d', '--name', container,
    '-e', 'POSTGRES_PASSWORD=synthetic-temporary-password',
    '-e', 'POSTGRES_DB=operator_flow_test',
    '-p', '127.0.0.1::5432',
    postgresImage,
  );
  resources.own('owned PostgreSQL container', () => (
    cleanupOwnedPostgres(container, state.volumeNames, dockerCommand)
  ));

  state.volumeNames = await attachedVolumeNames(container, dockerCommand);
  const portOutput = await dockerCommand('port', container, '5432/tcp');
  const port = Number(portOutput.stdout.trim().split(':').at(-1));
  if (!Number.isInteger(port) || port <= 0) throw new Error('Docker did not expose a local PostgreSQL port');
  const databaseUrl = 'postgres://postgres:synthetic-temporary-password@127.0.0.1:'
    + port + '/operator_flow_test';
  await waitForPostgres(databaseUrl);
  return { container, volumeNames: state.volumeNames, databaseUrl };
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port');
  return address.port;
}

function minimalEnvironment(tempRoot, overrides) {
  return {
    HOME: tempRoot,
    LANG: 'C',
    PATH: process.env.PATH || '/usr/bin:/bin',
    TMPDIR: tempRoot,
    TZ: 'UTC',
    ...overrides,
  };
}

function startOwnedProcess(resources, label, script, cwd, env, redactions) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError;
  const capture = (chunk) => {
    output = (output + chunk.toString()).slice(-50_000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.once('error', (error) => { spawnError = error; });

  const details = () => redactions.reduce(
    (value, marker) => value.split(marker).join('[redacted]'),
    output,
  );
  resources.own(label + ' process', () => stopOwnedProcess(child));
  return { child, details, get spawnError() { return spawnError; } };
}

async function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.removeListener('exit', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    child.once('exit', onExit);
  });
}

async function stopOwnedProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  if (await waitForProcessExit(child, 8_000)) return;
  child.kill('SIGKILL');
  if (!(await waitForProcessExit(child, 5_000))) {
    throw new Error('Owned test process did not exit');
  }
}

async function waitForHttp(url, processInfo) {
  let lastError;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (processInfo.spawnError) throw processInfo.spawnError;
    if (processInfo.child.exitCode !== null || processInfo.child.signalCode !== null) {
      throw new Error('Test process exited before readiness:\n' + processInfo.details());
    }
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
      lastError = new Error('Readiness endpoint returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for test process: ' + String(lastError) + '\n' + processInfo.details());
}

async function copyMigrations(targetRoot) {
  const target = join(targetRoot, 'migrations');
  await mkdir(target, { recursive: true });
  const migrations = (await readdir(migrationsSource))
    .filter((name) => /^\d+_.+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
  await Promise.all(migrations.map((name) => cp(join(migrationsSource, name), join(target, name))));
}

async function prepareDashboardRuntime(tempRoot) {
  if (!(await pathExists(join(dashboardStandaloneSource, 'apps', 'dashboard', 'server.js')))) {
    throw new Error('Dashboard standalone build is missing');
  }
  const standaloneRoot = join(tempRoot, 'dashboard-standalone');
  await cp(dashboardStandaloneSource, standaloneRoot, { recursive: true });
  const appRoot = join(standaloneRoot, 'apps', 'dashboard');
  await mkdir(join(appRoot, '.next'), { recursive: true });
  await cp(dashboardStaticSource, join(appRoot, '.next', 'static'), { recursive: true });
  const publicSource = join(dashboardRoot, 'public');
  if (await pathExists(publicSource)) await cp(publicSource, join(appRoot, 'public'), { recursive: true });
  return { appRoot, serverScript: join(appRoot, 'server.js') };
}

function syntheticPassword(label) {
  return 'synthetic-only-' + label + '-password';
}

function passwordHash(label) {
  const password = syntheticPassword(label);
  const salt = createHash('sha256').update('operator-flow-' + label).digest().subarray(0, 16);
  return 'scrypt$' + salt.toString('hex') + '$' + scryptSync(password, salt, 64).toString('hex');
}

function operatorCapability() {
  return {
    enabled: true,
    targets: [{ tenantId: targetTenantId, siteIds: [targetSiteId] }],
  };
}

async function seedFixtures(pool) {
  const internalSubscription = await pool.query(
    "SELECT count(*)::int AS count FROM tenant_subscriptions WHERE tenant_id = $1 AND status = 'internal'",
    [originTenantId],
  );
  assert.equal(internalSubscription.rows[0].count, 1);

  for (const [tenantId, name] of [
    [targetTenantId, 'Synthetic flow target'],
    [foreignTenantId, 'Synthetic flow foreign'],
  ]) {
    await pool.query('INSERT INTO tenants(id, name) VALUES ($1, $2)', [tenantId, name]);
  }
  for (const [siteId, tenantId, name] of [
    [targetSiteId, targetTenantId, 'Synthetic flow site'],
    [foreignSiteId, foreignTenantId, 'Synthetic flow foreign site'],
  ]) {
    await pool.query(
      'INSERT INTO sites(id, tenant_id, name, site_key) VALUES ($1, $2, $3, $4)',
      [siteId, tenantId, name, siteId],
    );
  }

  const users = [
    [operatorId, operatorEmail, 'operator', operatorCapability()],
    [noCapabilityId, noCapabilityEmail, 'no-capability', null],
    [deactivatedId, deactivatedEmail, 'deactivated', operatorCapability()],
  ];
  for (const [id, email, passwordLabel, capability] of users) {
    const metadata = { passwordHash: passwordHash(passwordLabel) };
    if (capability) metadata.siteRuntimeGrantOperatorV1 = capability;
    await pool.query(
      `INSERT INTO tenant_users(
         id, tenant_id, email, display_name, role, is_active, metadata, expires_at
       ) VALUES ($1, $2, $3, $4, 'admin', true, $5::jsonb, NULL)`,
      [id, originTenantId, email, 'Synthetic ' + id, JSON.stringify(metadata)],
    );
  }
}

function grantTerms() {
  const now = Date.now();
  return {
    validFrom: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
    embeddingDimension: 1536,
    providerRegion: null,
    dataCategories: ['synthetic-support-content'],
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
    approvalEvidenceRef: 'synthetic-flow-evidence',
  };
}

async function jsonResponse(response) {
  return response.json().catch(() => null);
}

async function login(dashboardBaseUrl, email, passwordLabel, clientId) {
  const response = await fetch(dashboardBaseUrl + '/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '127.0.0.' + clientId,
    },
    body: JSON.stringify({
      mode: 'customer',
      tenantId: originTenantId,
      email,
      password: syntheticPassword(passwordLabel),
    }),
    redirect: 'manual',
  });
  const body = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.role, 'customer');
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie || '', /^ssb_admin=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  return cookie;
}

function bffPath(operation, grantId) {
  const root = '/api/internal/site-runtime-grants/' + targetTenantId + '/' + targetSiteId;
  if (operation === 'preview') return root + '/preview';
  if (operation === 'revoke') return root + '/' + grantId + '/revoke';
  if (operation === 'status') return root + '/' + grantId;
  return root;
}

function bffRequest(dashboardBaseUrl, cookie, operation, options = {}) {
  const method = operation === 'status' ? 'GET' : 'POST';
  const headers = {
    Cookie: cookie,
    ...(method === 'POST' ? {
      Origin: options.origin ?? dashboardBaseUrl,
      'Sec-Fetch-Site': options.fetchSite ?? 'same-origin',
      'Content-Type': 'application/json',
    } : {}),
    ...(options.headers || {}),
  };
  return fetch(dashboardBaseUrl + (options.path || bffPath(operation, options.grantId)), {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(options.body) : undefined,
    redirect: 'manual',
  });
}

async function mutationCounts(pool) {
  const grants = await pool.query('SELECT count(*)::int AS count FROM provider_approval_grants');
  const audits = await pool.query('SELECT count(*)::int AS count FROM provider_approval_audit_events');
  return { grants: grants.rows[0].count, audits: audits.rows[0].count };
}

async function seedForeignGrant(pool, terms) {
  await pool.query(
    `INSERT INTO provider_approval_grants(
       id, tenant_id, site_id, source_id, source_types, usage_contexts, scope_kind,
       environment, provider_key, model, embedding_dimension, provider_region,
       data_categories, customer_data_approved, production_approved, provider_dpa_approved,
       purpose, retention_policy, redaction_policy, logging_policy, deletion_policy,
       reindex_policy, rate_limit, cost_limit, valid_from, expires_at,
       revoked_at, revoked_by, revocation_reason, approved_by, approval_evidence_ref
     ) VALUES (
       'synthetic-foreign-grant', $1, $2, NULL, '[]'::jsonb, '["query_embedding"]'::jsonb, 'site_runtime',
       'non_production', $3, $4, $5, NULL,
       $6::jsonb, true, false, true,
       'query_embedding', $7, $8, $9, $10,
       NULL, $11, $12, $13::timestamptz, $14::timestamptz,
       NULL, NULL, NULL, 'synthetic-fixture', 'synthetic-foreign-evidence'
     )`,
    [
      foreignTenantId, foreignSiteId, providerKey, providerModel, terms.embeddingDimension,
      JSON.stringify(terms.dataCategories), terms.retentionPolicy, terms.redactionPolicy,
      terms.loggingPolicy, terms.deletionPolicy, terms.rateLimit, terms.costLimit,
      terms.validFrom, terms.expiresAt,
    ],
  );
}

test('setup failure after container creation still removes only the owned container', async () => {
  const calls = [];
  const inspectError = new Error('synthetic inspect failure');
  const fakeDocker = async (...args) => {
    calls.push(args);
    if (args[0] === 'image' && args[1] === 'inspect') return { stdout: '', stderr: '' };
    if (args[0] === 'run') return { stdout: 'synthetic-container-id', stderr: '' };
    if (args[0] === 'inspect' && args.includes('--format')) throw inspectError;
    if (args[0] === 'inspect') throw Object.assign(new Error('No such container'), { stderr: 'No such container' });
    if (args[0] === 'rm') return { stdout: '', stderr: '' };
    throw new Error('Unexpected Docker call: ' + args.join(' '));
  };

  await assert.rejects(
    () => withOwnedResources((resources) => startPostgres(resources, fakeDocker)),
    (error) => {
      assert.equal(error, inspectError);
      assert.ok(error.cleanupError instanceof AggregateError);
      return true;
    },
  );
  const runCall = calls.find((args) => args[0] === 'run');
  const container = runCall[runCall.indexOf('--name') + 1];
  assert.deepEqual(calls.filter((args) => args[0] === 'rm'), [['rm', '-f', '-v', container]]);
  assert.equal(calls.filter((args) => args[0] === 'inspect' && args.includes('--format')).length, 2);
});

test('individual login drives the complete site-runtime grant flow through Dashboard and API', { skip: !enabled }, async (t) => {
  let cleanupEvidence;

  await withOwnedResources(async (resources) => {
    assert.equal(await pathExists(apiMain), true, 'API build is missing');
    const tempRoot = await mkdtemp(join(tmpdir(), 'site-runtime-grant-operator-flow-'));
    resources.own('temporary runtime directory', () => rm(tempRoot, { recursive: true, force: true }));

    const postgres = await startPostgres(resources);
    cleanupEvidence = { container: postgres.container, volumeNames: postgres.volumeNames };
    const control = new Pool({ connectionString: postgres.databaseUrl, max: 2 });
    resources.own('PostgreSQL control pool', () => control.end());

    const apiRuntime = join(tempRoot, 'api-runtime');
    await copyMigrations(apiRuntime);
    const apiPort = await findFreePort();
    const dashboardPort = await findFreePort();
    const apiBaseUrl = 'http://127.0.0.1:' + apiPort;
    const dashboardBaseUrl = 'http://127.0.0.1:' + dashboardPort;
    const redactions = [postgres.databaseUrl, sessionSecret, dashboardToken, syntheticPassword('operator')];

    const apiProcess = startOwnedProcess(
      resources,
      'API',
      apiMain,
      apiRuntime,
      minimalEnvironment(tempRoot, {
        ADMIN_SESSION_SECRET: sessionSecret,
        DASHBOARD_INTERNAL_TOKEN: dashboardToken,
        DATABASE_URL: postgres.databaseUrl,
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'synthetic-provider-key-not-for-use',
        OPENAI_EMBED_MODEL: providerModel,
        OPENAI_EMBED_PROVIDER: providerKey,
        PORT: String(apiPort),
        RETENTION_CLEANUP_ENABLED: 'false',
        RUN_MIGRATIONS_ON_STARTUP: 'true',
      }),
      redactions,
    );
    await waitForHttp(apiBaseUrl + '/healthz', apiProcess);
    const migrationCount = await control.query(
      'SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1',
      ['032_site_runtime_grant_concurrency.sql'],
    );
    assert.equal(migrationCount.rows[0].count, 1);
    await seedFixtures(control);

    const dashboardRuntime = await prepareDashboardRuntime(tempRoot);
    const dashboardProcess = startOwnedProcess(
      resources,
      'Dashboard',
      dashboardRuntime.serverScript,
      dashboardRuntime.appRoot,
      minimalEnvironment(tempRoot, {
        ADMIN_SESSION_SECRET: sessionSecret,
        BACKEND_BASE_URL: apiBaseUrl,
        DASHBOARD_INTERNAL_TOKEN: dashboardToken,
        DASHBOARD_PUBLIC_URL: dashboardBaseUrl,
        HOSTNAME: '127.0.0.1',
        PORT: String(dashboardPort),
      }),
      redactions,
    );
    await waitForHttp(dashboardBaseUrl + '/healthz', dashboardProcess);

    const operatorCookie = await login(dashboardBaseUrl, operatorEmail, 'operator', 2);
    const terms = grantTerms();
    let grantId;

    await t.test('preview, create, reuse, status, revoke, and repeated revoke preserve grant and audit counts', async () => {
      const preview = await bffRequest(dashboardBaseUrl, operatorCookie, 'preview', { body: terms });
      assert.equal(preview.status, 200);
      assert.deepEqual(await jsonResponse(preview), {
        kind: 'would_create',
        runtime: { providerKey, model: providerModel, environment: 'non_production' },
      });
      assert.deepEqual(await mutationCounts(control), { grants: 0, audits: 0 });

      const created = await bffRequest(dashboardBaseUrl, operatorCookie, 'create', { body: terms });
      const createdBody = await jsonResponse(created);
      assert.equal(created.status, 201, JSON.stringify(createdBody));
      assert.equal(createdBody.kind, 'created');
      grantId = createdBody.grant.id;
      assert.deepEqual(await mutationCounts(control), { grants: 1, audits: 1 });

      const status = await bffRequest(dashboardBaseUrl, operatorCookie, 'status', { grantId });
      assert.equal(status.status, 200);
      assert.equal((await jsonResponse(status)).grant.id, grantId);

      const reused = await bffRequest(dashboardBaseUrl, operatorCookie, 'create', { body: terms });
      assert.equal(reused.status, 201);
      assert.equal((await jsonResponse(reused)).kind, 'reused');
      assert.deepEqual(await mutationCounts(control), { grants: 1, audits: 1 });

      const revoked = await bffRequest(dashboardBaseUrl, operatorCookie, 'revoke', {
        grantId,
        body: { revocationReason: 'synthetic-flow-complete' },
      });
      assert.equal(revoked.status, 200);
      assert.equal((await jsonResponse(revoked)).kind, 'revoked');
      assert.deepEqual(await mutationCounts(control), { grants: 1, audits: 2 });

      const repeated = await bffRequest(dashboardBaseUrl, operatorCookie, 'revoke', {
        grantId,
        body: { revocationReason: 'synthetic-flow-complete' },
      });
      assert.equal(repeated.status, 200);
      assert.equal((await jsonResponse(repeated)).kind, 'already_revoked');
      assert.deepEqual(await mutationCounts(control), { grants: 1, audits: 2 });

      const revokedStatus = await bffRequest(dashboardBaseUrl, operatorCookie, 'status', { grantId });
      const revokedStatusBody = await jsonResponse(revokedStatus);
      assert.equal(revokedStatus.status, 200);
      assert.equal(revokedStatusBody.grant.status, 'revoked');

      const grant = (await control.query(
        `SELECT tenant_id, site_id, scope_kind, purpose, source_id, source_types,
                usage_contexts, environment, provider_key, model, approved_by, revoked_by
         FROM provider_approval_grants WHERE id = $1`,
        [grantId],
      )).rows[0];
      assert.deepEqual(grant, {
        tenant_id: targetTenantId,
        site_id: targetSiteId,
        scope_kind: 'site_runtime',
        purpose: 'query_embedding',
        source_id: null,
        source_types: [],
        usage_contexts: ['query_embedding'],
        environment: 'non_production',
        provider_key: providerKey,
        model: providerModel,
        approved_by: 'tenant-user:' + operatorId,
        revoked_by: 'tenant-user:' + operatorId,
      });
      const audits = await control.query(
        `SELECT actor_id, actor_role, event_type, decision_code, usage_context
         FROM provider_approval_audit_events
         WHERE approval_grant_id = $1 ORDER BY created_at, event_type`,
        [grantId],
      );
      assert.deepEqual(audits.rows, [
        {
          actor_id: 'tenant-user:' + operatorId,
          actor_role: 'admin',
          event_type: 'approval_created',
          decision_code: 'allowed',
          usage_context: 'query_embedding',
        },
        {
          actor_id: 'tenant-user:' + operatorId,
          actor_role: 'admin',
          event_type: 'approval_revoked',
          decision_code: 'revoked',
          usage_context: 'query_embedding',
        },
      ]);
    });

    await seedForeignGrant(control, terms);
    const negativeBaseline = await mutationCounts(control);

    await t.test('persisted capability and target scope are rechecked for real logged-in users', async () => {
      const noCapabilityCookie = await login(dashboardBaseUrl, noCapabilityEmail, 'no-capability', 3);
      const noCapability = await bffRequest(dashboardBaseUrl, noCapabilityCookie, 'preview', { body: terms });
      assert.equal(noCapability.status, 403);

      const foreignScope = await bffRequest(dashboardBaseUrl, operatorCookie, 'preview', {
        path: '/api/internal/site-runtime-grants/' + foreignTenantId + '/' + foreignSiteId + '/preview',
        body: terms,
      });
      assert.equal(foreignScope.status, 404);
      assert.deepEqual(await mutationCounts(control), negativeBaseline);
    });

    await t.test('foreign and unknown grant ids have identical safe responses in the authorized target scope', async () => {
      const responses = [];
      for (const currentGrantId of ['synthetic-foreign-grant', 'synthetic-unknown-grant']) {
        const response = await bffRequest(dashboardBaseUrl, operatorCookie, 'status', { grantId: currentGrantId });
        responses.push({ status: response.status, body: await jsonResponse(response) });
      }
      assert.deepEqual(responses[0], responses[1]);
      assert.deepEqual(responses[0], { status: 404, body: { message: 'Not found' } });
      assert.deepEqual(await mutationCounts(control), negativeBaseline);
    });

    await t.test('mutation provenance, reserved fields, and shared-key-only API calls fail closed', async () => {
      const wrongOrigin = await bffRequest(dashboardBaseUrl, operatorCookie, 'preview', {
        body: terms,
        origin: 'http://127.0.0.1:1',
      });
      assert.equal(wrongOrigin.status, 403);
      const wrongFetchSite = await bffRequest(dashboardBaseUrl, operatorCookie, 'preview', {
        body: terms,
        fetchSite: 'same-site',
      });
      assert.equal(wrongFetchSite.status, 403);
      const reserved = await bffRequest(dashboardBaseUrl, operatorCookie, 'create', {
        body: { ...terms, actorId: 'synthetic-forgery' },
      });
      assert.equal(reserved.status, 400);

      const sharedKeyOnly = await fetch(
        apiBaseUrl + '/internal/site-runtime-grants/' + targetTenantId + '/' + targetSiteId + '/preview',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-DASHBOARD-TOKEN': dashboardToken },
          body: JSON.stringify(terms),
        },
      );
      assert.equal(sharedKeyOnly.status, 401);
      assert.deepEqual(await mutationCounts(control), negativeBaseline);
    });

    await t.test('capability removal and account deactivation invalidate existing sessions on the next call', async () => {
      const beforeRemoval = await bffRequest(dashboardBaseUrl, operatorCookie, 'status', { grantId });
      assert.equal(beforeRemoval.status, 200);
      await control.query(
        "UPDATE tenant_users SET metadata = metadata - 'siteRuntimeGrantOperatorV1' WHERE id = $1",
        [operatorId],
      );
      const afterRemoval = await bffRequest(dashboardBaseUrl, operatorCookie, 'preview', { body: terms });
      assert.equal(afterRemoval.status, 403);

      const deactivatedCookie = await login(dashboardBaseUrl, deactivatedEmail, 'deactivated', 4);
      await control.query('UPDATE tenant_users SET is_active = false WHERE id = $1', [deactivatedId]);
      const afterDeactivation = await bffRequest(dashboardBaseUrl, deactivatedCookie, 'preview', { body: terms });
      assert.equal(afterDeactivation.status, 401);
      assert.deepEqual(await mutationCounts(control), negativeBaseline);
    });
  });

  assert.ok(cleanupEvidence);
  await assert.rejects(() => docker('inspect', cleanupEvidence.container), isMissingDockerResource);
  for (const volumeName of cleanupEvidence.volumeNames) {
    await assert.rejects(() => docker('volume', 'inspect', volumeName), isMissingDockerResource);
  }
});
