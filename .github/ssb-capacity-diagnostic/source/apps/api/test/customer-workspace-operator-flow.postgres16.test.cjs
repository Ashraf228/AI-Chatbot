const assert = require('node:assert/strict');
const { execFile, spawn } = require('node:child_process');
const { createHash, scryptSync } = require('node:crypto');
const { access, cp, mkdir, mkdtemp, readdir, rm } = require('node:fs/promises');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_CUSTOMER_WORKSPACE_OPERATOR_FLOW_TEST === '1';
const apiRoot = join(__dirname, '..');
const repositoryRoot = join(apiRoot, '..', '..');
const dashboardRoot = join(repositoryRoot, 'apps', 'dashboard');
const migrationsSource = join(apiRoot, 'migrations');
const dashboardStandaloneSource = join(dashboardRoot, '.next', 'standalone');
const dashboardStaticSource = join(dashboardRoot, '.next', 'static');
const apiMain = join(apiRoot, 'dist', 'main.js');
const postgresImage = 'pgvector/pgvector:pg16';

const tenantId = 'synthetic-workspace-tenant';
const siteId = 'synthetic-workspace-site';
const siblingSiteId = 'synthetic-workspace-sibling';
const foreignTenantId = 'synthetic-workspace-foreign-tenant';
const foreignSiteId = 'synthetic-workspace-foreign-site';
const customerId = 'synthetic-workspace-customer';
const viewerId = 'synthetic-workspace-viewer';
const customerEmail = 'workspace-customer@synthetic.invalid';
const viewerEmail = 'workspace-viewer@synthetic.invalid';
const sessionSecret = 'synthetic-workspace-session-secret-not-for-use';
const dashboardToken = 'synthetic-workspace-dashboard-token-not-for-use';
const adminKey = 'synthetic-workspace-admin-key-not-for-use';

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
  let result;
  let primaryError;
  let failed = false;
  const resources = {
    own(context, cleanup) {
      cleanups.unshift({ context, cleanup });
    },
  };

  try {
    result = await callback(resources);
  } catch (error) {
    primaryError = error;
    failed = true;
  }
  const cleanupErrors = [];
  for (const entry of cleanups) {
    try {
      await entry.cleanup();
    } catch (error) {
      cleanupErrors.push(cleanupIssue(entry.context, error));
    }
  }
  if (failed && cleanupErrors.length > 0) {
    throw new AggregateError([primaryError, ...cleanupErrors], 'Customer workspace flow and cleanup failed', {
      cause: primaryError,
    });
  }
  if (failed) throw primaryError;
  if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'Customer workspace flow cleanup failed');
  return result;
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
  const container = 'customer-workspace-flow-' + process.pid + '-' + Date.now();
  const state = { volumeNames: undefined };
  resources.own('owned PostgreSQL container', () => cleanupOwnedPostgres(container, state.volumeNames, dockerCommand));
  await dockerCommand(
    'run', '-d', '--name', container,
    '-e', 'POSTGRES_PASSWORD=synthetic-temporary-password',
    '-e', 'POSTGRES_DB=customer_workspace_flow',
    '-p', '127.0.0.1::5432',
    postgresImage,
  );
  state.volumeNames = await attachedVolumeNames(container, dockerCommand);
  const portOutput = await dockerCommand('port', container, '5432/tcp');
  const port = Number(portOutput.stdout.trim().split(':').at(-1));
  if (!Number.isInteger(port) || port <= 0) throw new Error('Docker did not expose a local PostgreSQL port');
  const databaseUrl = 'postgres://postgres:synthetic-temporary-password@127.0.0.1:'
    + port + '/customer_workspace_flow';
  await waitForPostgres(databaseUrl);
  return { container, volumeNames: state.volumeNames, databaseUrl };
}

function includesError(error, target) {
  if (error === target) return true;
  if (!error || typeof error !== 'object') return false;
  return (error.cause !== undefined && includesError(error.cause, target))
    || (Array.isArray(error.errors) && error.errors.some((entry) => includesError(entry, target)));
}

test('workspace cleanup removes an owned container after a partially failed Docker start', async () => {
  const primary = new Error('Docker start timed out after creating the container');
  let container;
  let exists = false;
  let volumeExists = false;
  const calls = [];
  const dockerCommand = async (...args) => {
    calls.push(args);
    if (args[0] === 'image') return { stdout: '{}' };
    if (args[0] === 'run') {
      container = args[args.indexOf('--name') + 1];
      exists = true;
      volumeExists = true;
      throw primary;
    }
    if (args[0] === 'inspect' && args[1] === '--format') {
      assert.equal(args.at(-1), container);
      return { stdout: JSON.stringify([{ Type: 'volume', Name: 'synthetic-owned-volume' }]) };
    }
    if (args[0] === 'rm') {
      assert.deepEqual(args, ['rm', '-f', '-v', container]);
      exists = false;
      volumeExists = false;
      return { stdout: container };
    }
    if (args[0] === 'inspect') {
      assert.equal(exists, false);
      throw new Error('No such container: ' + container);
    }
    if (args[0] === 'volume') {
      assert.deepEqual(args, ['volume', 'inspect', 'synthetic-owned-volume']);
      assert.equal(volumeExists, false);
      throw new Error('No such volume: synthetic-owned-volume');
    }
    throw new Error('Unexpected Docker command: ' + args.join(' '));
  };
  await assert.rejects(withOwnedResources((resources) => startPostgres(resources, dockerCommand)),
    (error) => error === primary);
  assert.equal(exists, false);
  assert.equal(volumeExists, false);
  assert.equal(calls.filter((args) => args[0] === 'rm').length, 1);
  assert.equal(calls.filter((args) => args[0] === 'volume').length, 1);
});

test('workspace cleanup does not remove resources when the prerequisite image check fails', async () => {
  const primary = new Error('Image unavailable');
  const calls = [];
  await assert.rejects(withOwnedResources((resources) => startPostgres(resources, async (...args) => {
    calls.push(args);
    throw primary;
  })), (error) => error === primary);
  assert.deepEqual(calls, [['image', 'inspect', postgresImage]]);
});

test('workspace cleanup retains Docker inventory and removal failures and attempts other cleanup', async () => {
  const primary = new Error('Docker start failed');
  const inventory = new Error('Docker inventory unavailable');
  const removal = new Error('Docker removal failed');
  const calls = [];
  let otherCleaned = false;
  const dockerCommand = async (...args) => {
    calls.push(args);
    if (args[0] === 'image') return { stdout: '{}' };
    if (args[0] === 'run') throw primary;
    if (args[0] === 'inspect' && args[1] === '--format') throw inventory;
    if (args[0] === 'rm') throw removal;
    if (args[0] === 'inspect') throw new Error('No such container: synthetic-owned-container');
    throw new Error('Unexpected Docker command');
  };
  await assert.rejects(withOwnedResources(async (resources) => {
    resources.own('other owned resource', async () => { otherCleaned = true; });
    await startPostgres(resources, dockerCommand);
  }), (error) => {
    for (const expected of [primary, inventory, removal]) assert.ok(includesError(error, expected));
    assert.equal(error.cause, primary);
    return true;
  });
  assert.equal(otherCleaned, true);
  assert.equal(calls.filter((args) => args[0] === 'rm').length, 1);
  assert.equal(calls.filter((args) => args[0] === 'inspect').length, 2);
});

test('workspace cleanup preserves frozen primary errors and all independent cleanup failures', async () => {
  const primary = Object.freeze(new Error('Flow failed'));
  const originalStack = primary.stack;
  const poolError = new Error('Pool close failed');
  const processError = new Error('Process stop failed');
  const calls = [];
  await assert.rejects(withOwnedResources(async (resources) => {
    resources.own('temporary directory', async () => { calls.push('directory'); });
    resources.own('pool', async () => { calls.push('pool'); throw poolError; });
    resources.own('process', async () => { calls.push('process'); throw processError; });
    throw primary;
  }), (error) => {
    assert.equal(error.cause, primary);
    for (const expected of [primary, poolError, processError]) assert.ok(includesError(error, expected));
    return true;
  });
  assert.deepEqual(calls, ['process', 'pool', 'directory']);
  assert.equal(primary.stack, originalStack);
  assert.equal(Object.hasOwn(primary, 'cleanupError'), false);
});

test('workspace cleanup preserves nested inner and outer cleanup diagnostics', async () => {
  const primary = new Error('Inner flow failed');
  const inner = new Error('Inner cleanup failed');
  const outer = new Error('Outer cleanup failed');
  await assert.rejects(withOwnedResources(async (outerResources) => {
    outerResources.own('outer', async () => { throw outer; });
    await withOwnedResources(async (innerResources) => {
      innerResources.own('inner', async () => { throw inner; });
      throw primary;
    });
  }), (error) => {
    for (const expected of [primary, inner, outer]) assert.ok(includesError(error, expected));
    assert.equal(error.cause.cause, primary);
    return true;
  });
});

test('workspace cleanup preserves falsy primary rejections alongside cleanup failures', async () => {
  for (const primary of [null, undefined, 0]) {
    const cleanup = new Error('Cleanup failed');
    await assert.rejects(withOwnedResources(async (resources) => {
      resources.own('resource', async () => { throw cleanup; });
      throw primary;
    }), (error) => {
      assert.equal(error.cause, primary);
      assert.equal(error.errors[0], primary);
      assert.ok(includesError(error, cleanup));
      return true;
    });
  }
});

test('workspace cleanup reports failures after a successful flow', async () => {
  const cleanup = new Error('Cleanup failed');
  await assert.rejects(withOwnedResources(async (resources) => {
    resources.own('resource', async () => { throw cleanup; });
    return 'success';
  }), (error) => {
    assert.ok(includesError(error, cleanup));
    assert.equal(Object.hasOwn(error, 'cause'), false);
    return true;
  });
});

test('workspace cleanup returns successful results after reverse-order release', async () => {
  const calls = [];
  const result = { completed: true };
  assert.equal(await withOwnedResources(async (resources) => {
    resources.own('first', async () => { calls.push('first'); });
    resources.own('second', async () => { calls.push('second'); });
    return result;
  }), result);
  assert.deepEqual(calls, ['second', 'first']);
});

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
  if (!(await waitForProcessExit(child, 5_000))) throw new Error('Owned test process did not exit');
}

function startOwnedProcess(resources, label, script, cwd, env, redactions) {
  const child = spawn(process.execPath, [script], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let spawnError;
  const capture = (chunk) => { output = (output + chunk.toString()).slice(-50_000); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.once('error', (error) => { spawnError = error; });
  const details = () => redactions.reduce((value, marker) => value.split(marker).join('[redacted]'), output);
  resources.own(label + ' process', () => stopOwnedProcess(child));
  return { child, details, get spawnError() { return spawnError; } };
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
  const serverSource = join(dashboardStandaloneSource, 'apps', 'dashboard', 'server.js');
  if (!(await pathExists(serverSource))) throw new Error('Dashboard standalone build is missing');
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
  const salt = createHash('sha256').update('customer-workspace-flow-' + label).digest().subarray(0, 16);
  return 'scrypt$' + salt.toString('hex') + '$' + scryptSync(password, salt, 64).toString('hex');
}

async function seedFixtures(pool) {
  for (const [currentTenantId, name] of [
    [tenantId, 'Synthetic workspace tenant'],
    [foreignTenantId, 'Synthetic foreign tenant'],
  ]) {
    await pool.query('INSERT INTO tenants(id, name) VALUES ($1, $2)', [currentTenantId, name]);
  }

  const siteConfig = JSON.stringify({
    conversationEngine: {
      previewEnabled: true,
      responsePreviewEnabled: true,
      adminTestOnly: true,
    },
  });
  for (const [currentSiteId, currentTenantId, name] of [
    [siteId, tenantId, 'Synthetic assigned workspace'],
    [siblingSiteId, tenantId, 'Synthetic unassigned workspace'],
    [foreignSiteId, foreignTenantId, 'Synthetic foreign workspace'],
  ]) {
    await pool.query(
      'INSERT INTO sites(id, tenant_id, name, site_key, config) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [currentSiteId, currentTenantId, name, currentSiteId, siteConfig],
    );
  }

  for (const [id, email, role, label] of [
    [customerId, customerEmail, 'editor', 'customer'],
    [viewerId, viewerEmail, 'viewer', 'viewer'],
  ]) {
    await pool.query(
      `INSERT INTO tenant_users(
         id, tenant_id, email, display_name, role, is_active, metadata, expires_at
       ) VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, NULL)`,
      [id, tenantId, email, 'Synthetic ' + role, role, JSON.stringify({ passwordHash: passwordHash(label) })],
    );
  }
}

async function jsonResponse(response) {
  return response.json().catch(() => null);
}

function sessionToken(cookie) {
  const token = cookie?.split('=')[1];
  assert.match(token || '', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  return token;
}

async function loginCustomer(dashboardBaseUrl, email, label, clientId) {
  const response = await fetch(dashboardBaseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.' + clientId },
    body: JSON.stringify({ mode: 'customer', tenantId, email, password: syntheticPassword(label) }),
    redirect: 'manual',
  });
  const body = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(body));
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie || '', /^ssb_admin=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  return { cookie, role: body.role };
}

async function loginPanel(dashboardBaseUrl, mode, label, clientId) {
  const response = await fetch(dashboardBaseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.1.' + clientId },
    body: JSON.stringify({ mode, password: syntheticPassword(label) }),
    redirect: 'manual',
  });
  const body = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(body));
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie || '', /^ssb_admin=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  return cookie;
}

function bffRequest(dashboardBaseUrl, cookie, method, targetSiteId, suffix, body) {
  const headers = { Cookie: cookie };
  const mutating = method !== 'GET';
  if (mutating) {
    headers.Origin = dashboardBaseUrl;
    headers['Sec-Fetch-Site'] = 'same-origin';
  }
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(
    dashboardBaseUrl + '/api/sites/' + encodeURIComponent(targetSiteId) + '/conversation-engine/' + suffix,
    {
      method,
      headers,
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    },
  );
}

function adminWorkspaceAccess(apiBaseUrl, method, targetUserId, siteIds) {
  return fetch(apiBaseUrl + '/admin/tenant-users/' + encodeURIComponent(targetUserId) + '/customer-workspace-access', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: method === 'PUT' ? JSON.stringify({ siteIds }) : undefined,
  });
}

function minimalPdf(text) {
  const escaped = text.replace(/([\\()])/g, '\\$1');
  const stream = 'BT /F1 12 Tf 72 720 Td (' + escaped + ') Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(output));
    output += (index + 1) + ' 0 obj\n' + objects[index] + '\nendobj\n';
  }
  const xrefOffset = Buffer.byteLength(output);
  output += 'xref\n0 6\n0000000000 65535 f \n';
  output += offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  output += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
  return Buffer.from(output);
}

test('individual customer workspace access is enforced through login, BFF, and API', { skip: !enabled }, async (t) => {
  let cleanupEvidence;

  await withOwnedResources(async (resources) => {
    assert.equal(await pathExists(apiMain), true, 'API build is missing');
    const tempRoot = await mkdtemp(join(tmpdir(), 'customer-workspace-flow-'));
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
    const redactions = [
      postgres.databaseUrl,
      sessionSecret,
      dashboardToken,
      adminKey,
      syntheticPassword('customer'),
      syntheticPassword('viewer'),
      syntheticPassword('admin-panel'),
      syntheticPassword('operator-panel'),
    ];

    const apiProcess = startOwnedProcess(
      resources,
      'API',
      apiMain,
      apiRuntime,
      minimalEnvironment(tempRoot, {
        ADMIN_KEY: adminKey,
        ADMIN_SESSION_SECRET: sessionSecret,
        ALLOW_PRODUCTION_AUTO_MIGRATIONS: 'true',
        APP_ENV: 'staging',
        DASHBOARD_INTERNAL_TOKEN: dashboardToken,
        DATABASE_URL: postgres.databaseUrl,
        NODE_PATH: join(apiRoot, 'node_modules'),
        NODE_ENV: 'production',
        PORT: String(apiPort),
        RETENTION_CLEANUP_ENABLED: 'false',
        RUN_MIGRATIONS_ON_STARTUP: 'true',
      }),
      redactions,
    );
    await waitForHttp(apiBaseUrl + '/healthz', apiProcess);
    await seedFixtures(control);

    const dashboardRuntime = await prepareDashboardRuntime(tempRoot);
    const dashboardProcess = startOwnedProcess(
      resources,
      'Dashboard',
      dashboardRuntime.serverScript,
      dashboardRuntime.appRoot,
      minimalEnvironment(tempRoot, {
        ADMIN_PANEL_PASSWORD_HASH: passwordHash('admin-panel'),
        ADMIN_SESSION_SECRET: sessionSecret,
        BACKEND_BASE_URL: apiBaseUrl,
        DASHBOARD_INTERNAL_TOKEN: dashboardToken,
        DASHBOARD_PUBLIC_URL: dashboardBaseUrl,
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        OPERATOR_PANEL_PASSWORD_HASH: passwordHash('operator-panel'),
        PORT: String(dashboardPort),
      }),
      redactions,
    );
    await waitForHttp(dashboardBaseUrl + '/healthz', dashboardProcess);

    const customer = await loginCustomer(dashboardBaseUrl, customerEmail, 'customer', 2);
    assert.equal(customer.role, 'customer');
    const bearer = sessionToken(customer.cookie);

    await t.test('access is absent by default and only a platform admin can grant it', async () => {
      const beforeGrant = await bffRequest(dashboardBaseUrl, customer.cookie, 'GET', siteId, 'demo-workspace/access');
      assert.equal(beforeGrant.status, 403);

      for (const method of ['PUT', 'DELETE']) {
        const response = await fetch(
          apiBaseUrl + '/admin/tenant-users/' + customerId + '/customer-workspace-access',
          {
            method,
            headers: {
              Authorization: 'Bearer ' + bearer,
              'Content-Type': 'application/json',
              'X-Dashboard-Actor': 'forged-admin',
              'X-Dashboard-Role': 'customer',
              'X-Dashboard-Tenant': foreignTenantId,
              'X-Dashboard-Token': dashboardToken,
            },
            body: method === 'PUT' ? JSON.stringify({ siteIds: [siteId] }) : undefined,
          },
        );
        assert.equal(response.status, 403);
      }

      const foreignGrant = await adminWorkspaceAccess(apiBaseUrl, 'PUT', customerId, [foreignSiteId]);
      assert.equal(foreignGrant.status, 400);
      const grant = await adminWorkspaceAccess(apiBaseUrl, 'PUT', customerId, [siteId]);
      assert.equal(grant.status, 200, JSON.stringify(await jsonResponse(grant.clone())));
      assert.deepEqual(await jsonResponse(grant), {
        tenantUserId: customerId,
        tenantId,
        capability: 'customerWorkspaceOperatorV1',
        enabled: true,
        siteIds: [siteId],
      });
    });

    await t.test('assigned customer reads and writes config through the real BFF and API', async () => {
      const access = await bffRequest(dashboardBaseUrl, customer.cookie, 'GET', siteId, 'demo-workspace/access');
      assert.equal(access.status, 200);
      assert.deepEqual(await jsonResponse(access), { allowed: true, siteId });

      const initial = await bffRequest(dashboardBaseUrl, customer.cookie, 'GET', siteId, 'demo-workspace/config');
      assert.equal(initial.status, 200);
      assert.equal((await jsonResponse(initial)).hasSavedConfig, false);

      const saved = await bffRequest(dashboardBaseUrl, customer.cookie, 'PUT', siteId, 'demo-workspace/config', {
        assistantName: 'Synthetic Workspace Assistant',
        companyContext: 'Synthetic internal support only.',
        assistantRole: 'Synthetic support assistant',
        targetAudience: ['Synthetic support team'],
        tone: 'friendly',
        allowedTasks: ['answer_questions', 'collect_requests', 'triage_support', 'prepare_handoff'],
        blockedTasks: [],
        handoffAllowed: true,
        ticketAllowed: true,
        requiredFields: ['fullName', 'description'],
      });
      const savedBody = await jsonResponse(saved);
      assert.equal(saved.status, 200, JSON.stringify(savedBody));
      assert.equal(savedBody.savedConfig.metadata.updatedByRole, 'customer');
      assert.equal(savedBody.savedConfig.metadata.customerDataAllowed, false);
      assert.equal(savedBody.savedConfig.metadata.publicWidgetActivation, false);
      assert.equal(savedBody.savedConfig.metadata.productionActivation, false);
    });

    await t.test('temporary PDF and simulated handoff use no provider or delivery transport', async () => {
      const form = new FormData();
      form.append(
        'file',
        new Blob([minimalPdf('Synthetic workspace knowledge only.')], { type: 'application/pdf' }),
        'synthetic-workspace.pdf',
      );
      const pdf = await bffRequest(
        dashboardBaseUrl,
        customer.cookie,
        'POST',
        siteId,
        'knowledge/pdf-extract',
        form,
      );
      const pdfBody = await jsonResponse(pdf);
      assert.equal(pdf.status, 201, JSON.stringify(pdfBody));
      assert.match(pdfBody.extractedText, /Synthetic workspace knowledge only/);
      assert.deepEqual(pdfBody.boundary, {
        pdfStorageUsed: false,
        fileStorageUsed: false,
        dbWriteUsed: false,
        embeddingGenerationUsed: false,
        ragIndexingUsed: false,
        providerCallsUsed: false,
        ocrUsed: false,
      });

      const pilot = await bffRequest(dashboardBaseUrl, customer.cookie, 'POST', siteId, 'runtime-pilot', {
        message: 'Ich brauche einen echten Menschen fuer diesen synthetischen Fall.',
        knowledgeSnippets: [{
          id: 'synthetic-snippet',
          title: 'Synthetic knowledge',
          excerpt: pdfBody.extractedText,
          sourceType: 'synthetic',
          scope: 'demo-workspace',
        }],
        demoWorkspace: {
          handoffAllowed: true,
          ticketAllowed: true,
          requiredFields: ['fullName', 'description'],
        },
      });
      const pilotBody = await jsonResponse(pilot);
      assert.equal(pilot.status, 201, JSON.stringify(pilotBody));
      assert.equal(pilotBody.runtimePilotEnabled, true);
      assert.equal(pilotBody.conversationEnginePreview.shouldHandoff, true);
      assert.equal(pilotBody.runtimeState.ticketFieldRequestSimulated, true);
      assert.equal(pilotBody.sideEffects.ticketDelivery, false);
      assert.equal(pilotBody.sideEffects.emailDelivery, false);
      assert.equal(pilotBody.sideEffects.webhookDelivery, false);
      assert.equal(pilotBody.sideEffects.providerCalls, false);
      assert.equal(pilotBody.activationBoundary.publicWidgetActivation, false);
      assert.equal(pilotBody.activationBoundary.productionActivation, false);
      assert.equal(pilotBody.assistantProfileDebug, null);

      const privilegedPilotInput = await bffRequest(
        dashboardBaseUrl,
        customer.cookie,
        'POST',
        siteId,
        'runtime-pilot',
        {
          message: 'Synthetic cross-scope attempt.',
          websiteAnswerRuntimePilotInput: {
            tenantId: foreignTenantId,
            siteId: foreignSiteId,
            sourceId: 'synthetic-foreign-source',
          },
        },
      );
      assert.equal(privilegedPilotInput.status, 400);
    });

    await t.test('unassigned, foreign, forged, viewer, and shared operator contexts fail closed', async () => {
      for (const targetSiteId of [siblingSiteId, foreignSiteId]) {
        const response = await bffRequest(
          dashboardBaseUrl,
          customer.cookie,
          'GET',
          targetSiteId,
          'demo-workspace/access',
        );
        assert.equal(response.status, 404);
      }

      const directWithoutBearer = await fetch(
        apiBaseUrl + '/admin/sites/' + siteId + '/conversation-engine/demo-workspace/access',
        {
          headers: {
            'X-Dashboard-Actor': 'forged-customer',
            'X-Dashboard-Role': 'customer',
            'X-Dashboard-Tenant': tenantId,
            'X-Dashboard-Tenant-User': customerId,
            'X-Dashboard-Token': dashboardToken,
          },
        },
      );
      assert.equal(directWithoutBearer.status, 401);

      const forgedScope = await fetch(
        apiBaseUrl + '/admin/sites/' + siblingSiteId + '/conversation-engine/demo-workspace/access',
        {
          headers: {
            Authorization: 'Bearer ' + bearer,
            'X-Dashboard-Actor': 'forged-customer',
            'X-Dashboard-Role': 'customer',
            'X-Dashboard-Tenant': foreignTenantId,
            'X-Dashboard-Tenant-User': customerId,
            'X-Dashboard-Token': dashboardToken,
          },
        },
      );
      assert.equal(forgedScope.status, 404);

      const viewer = await loginCustomer(dashboardBaseUrl, viewerEmail, 'viewer', 3);
      assert.equal(viewer.role, 'viewer');
      const viewerAccess = await bffRequest(dashboardBaseUrl, viewer.cookie, 'GET', siteId, 'demo-workspace/access');
      assert.equal(viewerAccess.status, 403);

      const operatorCookie = await loginPanel(dashboardBaseUrl, 'operator', 'operator-panel', 4);
      const operatorAccess = await bffRequest(
        dashboardBaseUrl,
        operatorCookie,
        'GET',
        siteId,
        'demo-workspace/access',
      );
      assert.equal(operatorAccess.status, 403);

      const adminCookie = await loginPanel(dashboardBaseUrl, 'admin', 'admin-panel', 5);
      const adminAccess = await bffRequest(dashboardBaseUrl, adminCookie, 'GET', siteId, 'demo-workspace/access');
      assert.equal(adminAccess.status, 200);
    });

    await t.test('revocation and account deactivation affect an existing session on its next request', async () => {
      const revoke = await adminWorkspaceAccess(apiBaseUrl, 'DELETE', customerId);
      assert.equal(revoke.status, 200);
      const afterRevoke = await bffRequest(dashboardBaseUrl, customer.cookie, 'GET', siteId, 'demo-workspace/access');
      assert.equal(afterRevoke.status, 403);

      const regrant = await adminWorkspaceAccess(apiBaseUrl, 'PUT', customerId, [siteId]);
      assert.equal(regrant.status, 200);
      await control.query('UPDATE tenant_users SET is_active = false WHERE id = $1', [customerId]);
      const afterDeactivation = await bffRequest(
        dashboardBaseUrl,
        customer.cookie,
        'GET',
        siteId,
        'demo-workspace/access',
      );
      assert.equal(afterDeactivation.status, 401);
    });
  });

  assert.ok(cleanupEvidence);
  await assert.rejects(() => docker('inspect', cleanupEvidence.container), isMissingDockerResource);
  for (const volumeName of cleanupEvidence.volumeNames) {
    await assert.rejects(() => docker('volume', 'inspect', volumeName), isMissingDockerResource);
  }
});
