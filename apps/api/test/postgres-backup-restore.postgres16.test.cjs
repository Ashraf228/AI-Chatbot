const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const {
  chmod,
  cp,
  mkdtemp,
  mkdir,
  readdir,
  rm,
  writeFile,
} = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { gzipSync } = require('node:zlib');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_BACKUP_RESTORE_TEST === '1';
const apiRoot = join(__dirname, '..');
const repositoryRoot = join(apiRoot, '..', '..');
const migrationsSource = join(apiRoot, 'migrations');
const backupScript = join(repositoryRoot, 'scripts', 'ops', 'backup-postgres.sh');
const restoreScript = join(repositoryRoot, 'scripts', 'ops', 'restore-postgres-test.sh');
const migration031 = '031_query_embedding_site_runtime_grant_contract.sql';
const migration032 = '032_site_runtime_grant_concurrency.sql';

async function runProcess(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
      ...options,
    });
    return { status: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      status: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
    };
  }
}

async function writeFakeDocker(directory) {
  const binDirectory = join(directory, 'bin');
  const dockerPath = join(binDirectory, 'docker');
  await mkdir(binDirectory, { recursive: true });
  await writeFile(dockerPath, `#!/usr/bin/env bash
set -u
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
last_argument="\${!#}"
case "$last_argument" in
  *current_database*)
    printf '%s\\n' "\${FAKE_SOURCE_DB:-restore_check_fake_source}"
    ;;
  *restore_db=*)
    cat >/dev/null
    printf '0\\n'
    ;;
  *createdb*)
    ;;
  *dropdb*)
    if [[ "\${FAKE_CLEANUP_FAIL:-0}" == "1" ]]; then
      printf 'synthetic cleanup failure\\n' >&2
      exit 43
    fi
    ;;
  *psql*)
    cat >/dev/null
    if [[ "\${FAKE_RESTORE_FAIL:-0}" == "1" ]]; then
      printf 'synthetic restore failure\\n' >&2
      exit 42
    fi
    ;;
  *)
    printf 'unexpected fake Docker invocation\\n' >&2
    exit 90
    ;;
esac
`, 'utf8');
  await chmod(dockerPath, 0o755);
  return { binDirectory, dockerPath };
}

async function createScriptFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'restore-script-regression-'));
  const envFile = join(directory, 'synthetic.env');
  const dumpFile = join(directory, 'synthetic.sql.gz');
  const logFile = join(directory, 'docker.log');
  const { binDirectory } = await writeFakeDocker(directory);
  await writeFile(envFile, 'POSTGRES_USER=synthetic_user\nPOSTGRES_DB=restore_check_fake_source\n', 'utf8');
  await writeFile(dumpFile, gzipSync(Buffer.from('SELECT 1;\n', 'utf8')));
  return {
    directory,
    dumpFile,
    env: {
      HOME: process.env.HOME,
      LANG: 'C',
      PATH: binDirectory + ':' + process.env.PATH,
      PROJECT_DIR: directory,
      ENV_FILE: envFile,
      FAKE_DOCKER_LOG: logFile,
      RESTORE_TEST_DB: 'restore_check_fake_target',
    },
    logFile,
  };
}

async function fakeDockerLog(fixture) {
  try {
    return await require('node:fs/promises').readFile(fixture.logFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

test('restore script rejects an unreadable validation file before Docker is called', async () => {
  const fixture = await createScriptFixture();
  try {
    const validationFile = join(fixture.directory, 'unreadable-validation.sql');
    await writeFile(validationFile, 'SELECT 1;\n', 'utf8');
    await chmod(validationFile, 0o000);
    const result = await runProcess('bash', [restoreScript, fixture.dumpFile], {
      env: {
        ...fixture.env,
        RESTORE_TEST_VALIDATION_SQL_FILE: validationFile,
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /validation SQL file is not readable/i);
    assert.equal(await fakeDockerLog(fixture), '');
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('restore script rejects names that PostgreSQL would truncate before Docker is called', async () => {
  const fixture = await createScriptFixture();
  try {
    const result = await runProcess('bash', [restoreScript, fixture.dumpFile], {
      env: {
        ...fixture.env,
        RESTORE_TEST_DB: 'restore_check_' + 'a'.repeat(60),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /63-byte identifier limit/i);
    assert.equal(await fakeDockerLog(fixture), '');
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('restore script reports success only after one confirmed cleanup', async () => {
  const fixture = await createScriptFixture();
  try {
    const result = await runProcess('bash', [restoreScript, fixture.dumpFile], {
      env: fixture.env,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Restore test completed and temporary database removed/);
    assert.match(result.stdout, /data integrity was not independently verified/);
    const log = await fakeDockerLog(fixture);
    assert.equal(log.split('\n').filter((line) => line.includes('dropdb')).length, 1);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('restore script turns a cleanup failure into an overall failure without a success message', async () => {
  const fixture = await createScriptFixture();
  try {
    const result = await runProcess('bash', [restoreScript, fixture.dumpFile], {
      env: { ...fixture.env, FAKE_CLEANUP_FAIL: '1' },
    });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /Restore test completed/);
    assert.match(result.stderr, /synthetic cleanup failure/);
    assert.match(result.stderr, /Failed to remove owned restore-test database/);
    const log = await fakeDockerLog(fixture);
    assert.equal(log.split('\n').filter((line) => line.includes('dropdb')).length, 1);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('restore script keeps a restore error primary while exposing a cleanup error', async () => {
  const fixture = await createScriptFixture();
  try {
    const result = await runProcess('bash', [restoreScript, fixture.dumpFile], {
      env: {
        ...fixture.env,
        FAKE_RESTORE_FAIL: '1',
        FAKE_CLEANUP_FAIL: '1',
      },
    });
    assert.equal(result.status, 42);
    assert.doesNotMatch(result.stdout, /Restore test completed/);
    assert.match(result.stderr, /synthetic restore failure/);
    assert.match(result.stderr, /synthetic cleanup failure/);
    assert.match(result.stderr, /original restore-test failure remains primary/);
    const log = await fakeDockerLog(fixture);
    assert.equal(log.split('\n').filter((line) => line.includes('dropdb')).length, 1);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

function dockerEnvironment() {
  const environment = {
    HOME: process.env.HOME,
    LANG: 'C',
    LC_ALL: 'C',
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR || tmpdir(),
  };
  for (const name of ['DOCKER_CONFIG', 'DOCKER_CONTEXT', 'DOCKER_HOST']) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return environment;
}

async function docker(args, options = {}) {
  return execFileAsync('docker', args, {
    env: dockerEnvironment(),
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
    ...options,
  });
}

async function compose(context, ...args) {
  return docker([
    'compose',
    '--project-directory', context.projectDirectory,
    '--env-file', context.envFile,
    '--project-name', context.projectName,
    '--file', context.composeFile,
    ...args,
  ]);
}

function isMissingDockerResource(error) {
  const details = error && typeof error === 'object'
    ? [error.message, error.stdout, error.stderr].filter(Boolean).join('\n')
    : String(error);
  return /no such (?:container|volume)|not found/i.test(details);
}

async function waitForPostgres(databaseUrl) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
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

function cleanupIssue(context, error) {
  return new Error(context + ' cleanup failed', { cause: error });
}

async function cleanupDisposablePostgres(context, primaryError) {
  const cleanupErrors = [];
  if (context.control) {
    try {
      await context.control.end();
    } catch (error) {
      cleanupErrors.push(cleanupIssue('PostgreSQL control pool', error));
    }
  }
  if (context.composeAttempted) {
    try {
      await compose(context, 'down', '--volumes', '--remove-orphans');
    } catch (error) {
      cleanupErrors.push(cleanupIssue('temporary Compose project', error));
    }
  }
  if (context.containerId) {
    try {
      await docker(['container', 'inspect', context.containerId]);
      cleanupErrors.push(new Error('Temporary PostgreSQL container still exists: ' + context.containerId));
    } catch (error) {
      if (!isMissingDockerResource(error)) {
        cleanupErrors.push(cleanupIssue('temporary container absence check', error));
      }
    }
  }
  for (const volumeName of context.volumeNames || []) {
    try {
      await docker(['volume', 'inspect', volumeName]);
      cleanupErrors.push(new Error('Temporary PostgreSQL volume still exists: ' + volumeName));
    } catch (error) {
      if (!isMissingDockerResource(error)) {
        cleanupErrors.push(cleanupIssue('temporary volume absence check', error));
      }
    }
  }
  try {
    await rm(context.tempRoot, { recursive: true, force: true });
  } catch (error) {
    cleanupErrors.push(cleanupIssue('temporary test directory', error));
  }

  if (cleanupErrors.length === 0) return;
  const aggregate = new AggregateError(cleanupErrors, 'Backup/restore test cleanup failed');
  if (primaryError && typeof primaryError === 'object') {
    primaryError.cleanupError = aggregate;
    console.error('Additional cleanup failure; the primary PostgreSQL test failure remains primary.');
    return;
  }
  throw aggregate;
}

function databaseUrlFor(context, databaseName) {
  const url = new URL(context.databaseUrl);
  url.pathname = '/' + databaseName;
  return url.toString();
}

async function startDisposablePostgres() {
  const suffix = process.pid + '-' + Date.now() + '-' + randomBytes(3).toString('hex');
  const context = {
    composeAttempted: false,
    containerId: '',
    control: null,
    projectName: ('backup-restore-' + suffix).toLowerCase(),
    sourceDatabase: ('restore_check_source_' + suffix).replaceAll('-', '_'),
    tempRoot: await mkdtemp(join(tmpdir(), 'postgres-backup-restore-')),
    volumeNames: [],
  };
  context.projectDirectory = join(context.tempRoot, 'compose-project');
  context.composeFile = join(context.projectDirectory, 'compose.yml');
  context.envFile = join(context.projectDirectory, 'synthetic.env');
  context.backupDirectory = join(context.tempRoot, 'backups');
  const password = randomBytes(24).toString('hex');
  const user = 'synthetic_restore_user';

  try {
    await mkdir(context.projectDirectory, { recursive: true });
    await mkdir(context.backupDirectory, { recursive: true });
    await writeFile(context.envFile, [
      'POSTGRES_USER=' + user,
      'POSTGRES_PASSWORD=' + password,
      'POSTGRES_DB=' + context.sourceDatabase,
      '',
    ].join('\n'), { encoding: 'utf8', mode: 0o600 });
    await writeFile(context.composeFile, [
      'services:',
      '  db:',
      '    image: pgvector/pgvector:pg16',
      '    pull_policy: never',
      '    environment:',
      '      POSTGRES_USER: ${POSTGRES_USER}',
      '      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}',
      '      POSTGRES_DB: ${POSTGRES_DB}',
      '    ports:',
      '      - "127.0.0.1::5432"',
      '    volumes:',
      '      - db_data:/var/lib/postgresql/data',
      'volumes:',
      '  db_data:',
      '',
    ].join('\n'), 'utf8');

    await docker(['image', 'inspect', 'pgvector/pgvector:pg16']);
    context.composeAttempted = true;
    await compose(context, 'up', '--detach', '--pull', 'never', 'db');
    context.containerId = (await compose(context, 'ps', '--quiet', 'db')).stdout.trim();
    assert.ok(context.containerId, 'Compose did not return its PostgreSQL container ID');
    const mountsResult = await docker([
      'inspect', '--format', '{{json .Mounts}}', context.containerId,
    ]);
    const mounts = JSON.parse(mountsResult.stdout);
    context.volumeNames = mounts
      .filter((mount) => mount.Type === 'volume' && mount.Name)
      .map((mount) => mount.Name);
    const portOutput = (await compose(context, 'port', 'db', '5432')).stdout.trim();
    const port = Number(portOutput.split('\n')[0].split(':').at(-1));
    assert.ok(Number.isInteger(port) && port > 0, 'Compose did not expose a loopback PostgreSQL port');
    context.databaseUrl = 'postgresql://' + encodeURIComponent(user) + ':'
      + encodeURIComponent(password) + '@127.0.0.1:' + port + '/'
      + encodeURIComponent(context.sourceDatabase);
    await waitForPostgres(context.databaseUrl);
    context.control = new Pool({ connectionString: context.databaseUrl, max: 4 });
    return context;
  } catch (error) {
    await cleanupDisposablePostgres(context, error);
    throw error;
  }
}

function scriptEnvironment(context, overrides = {}) {
  return {
    ...dockerEnvironment(),
    BACKUP_DIR: context.backupDirectory,
    BACKUP_PREFIX: 'synthetic_backup',
    BACKUP_RETENTION_DAYS: '0',
    COMPOSE_FILE: context.composeFile,
    COMPOSE_PROJECT_NAME: context.projectName,
    ENV_FILE: context.envFile,
    PROJECT_DIR: context.projectDirectory,
    RESTORE_TEST_DB: 'restore_check_unused',
    RESTORE_TEST_VALIDATION_SQL_FILE: '',
    ...overrides,
  };
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

function withApplicationName(databaseUrl, applicationName) {
  const url = new URL(databaseUrl);
  url.searchParams.set('application_name', applicationName);
  return url.toString();
}

async function runProductionMigrations(databaseUrl, workspace, applicationName) {
  const { DatabaseService } = require('../dist/db/database.service.js');
  const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service.js');
  const previousCwd = process.cwd();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let database;
  try {
    process.chdir(workspace);
    process.env.DATABASE_URL = withApplicationName(databaseUrl, applicationName);
    database = new DatabaseService();
    await new DatabaseMigrationsService(database).runPendingMigrations();
  } finally {
    if (database?.pool) await database.pool.end();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    process.chdir(previousCwd);
  }
}

async function prepareSchema(context, lastMigration, label) {
  await context.control.query('DROP SCHEMA public CASCADE');
  await context.control.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
  await context.control.query('GRANT ALL ON SCHEMA public TO public');
  const workspace = await mkdtemp(join(context.tempRoot, label + '-migrations-'));
  await copyMigrations(workspace, lastMigration);
  await runProductionMigrations(context.databaseUrl, workspace, label);
}

async function sourceSnapshot(context) {
  const migrations = (await context.control.query(
    'SELECT version FROM schema_migrations ORDER BY version',
  )).rows.map((row) => row.version);
  const constraints = (await context.control.query([
    'SELECT conname AS name, pg_get_constraintdef(oid, true) AS definition',
    'FROM pg_constraint',
    "WHERE conrelid = 'provider_approval_grants'::regclass",
    'ORDER BY conname',
  ].join('\n'))).rows;
  return { constraints, migrations };
}

function sqlLiteral(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function validationSql({ markerId, markerName, snapshot, expect032 }) {
  const expectedMigrations = sqlLiteral(JSON.stringify(snapshot.migrations));
  const expectedConstraints = sqlLiteral(JSON.stringify(snapshot.constraints));
  return [
    'DO $restore_validation$',
    'DECLARE',
    '  actual_marker text;',
    '  actual_migrations jsonb;',
    '  actual_constraints jsonb;',
    'BEGIN',
    '  SELECT name INTO actual_marker FROM tenants WHERE id = ' + sqlLiteral(markerId) + ';',
    '  IF actual_marker IS DISTINCT FROM ' + sqlLiteral(markerName) + ' THEN',
    "    RAISE EXCEPTION 'synthetic restore marker mismatch';",
    '  END IF;',
    '  SELECT COALESCE(jsonb_agg(version ORDER BY version), \'[]\'::jsonb)',
    '  INTO actual_migrations FROM schema_migrations;',
    '  IF actual_migrations IS DISTINCT FROM ' + expectedMigrations + '::jsonb THEN',
    "    RAISE EXCEPTION 'restored migration tracking mismatch';",
    '  END IF;',
    "  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', conname, 'definition',",
    "    pg_get_constraintdef(oid, true)) ORDER BY conname), '[]'::jsonb)",
    '  INTO actual_constraints',
    '  FROM pg_constraint',
    "  WHERE conrelid = 'provider_approval_grants'::regclass;",
    '  IF actual_constraints IS DISTINCT FROM ' + expectedConstraints + '::jsonb THEN',
    "    RAISE EXCEPTION 'restored provider approval constraints mismatch';",
    '  END IF;',
    '  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = ' + sqlLiteral(migration032) + ')',
    '     IS DISTINCT FROM ' + (expect032 ? 'true' : 'false') + ' THEN',
    "    RAISE EXCEPTION 'restored migration 032 state mismatch';",
    '  END IF;',
    'END',
    '$restore_validation$;',
    '',
  ].join('\n');
}

async function databaseExists(context, databaseName) {
  const result = await context.control.query(
    'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
    [databaseName],
  );
  return result.rows[0].exists;
}

async function createDatabase(context, databaseName) {
  const result = await compose(
    context,
    'exec', '-T', '-e', 'TEST_DATABASE=' + databaseName,
    'db', 'sh', '-lc', 'createdb -U "$POSTGRES_USER" -- "$TEST_DATABASE"',
  );
  assert.equal(result.stderr, '');
}

async function dropDatabase(context, databaseName) {
  await compose(
    context,
    'exec', '-T', '-e', 'TEST_DATABASE=' + databaseName,
    'db', 'sh', '-lc', 'dropdb -U "$POSTGRES_USER" -- "$TEST_DATABASE"',
  );
}

async function createBackup(context, prefix) {
  const result = await runProcess('bash', [backupScript], {
    env: scriptEnvironment(context, { BACKUP_PREFIX: prefix }),
  });
  assert.equal(result.status, 0, result.stderr);
  const matches = (await readdir(context.backupDirectory))
    .filter((name) => name.startsWith(prefix + '_') && name.endsWith('.sql.gz'));
  assert.equal(matches.length, 1, 'expected exactly one backup for ' + prefix);
  return join(context.backupDirectory, matches[0]);
}

async function runRestore(context, dumpFile, targetDatabase, validationFile) {
  return runProcess('bash', [restoreScript, dumpFile], {
    env: scriptEnvironment(context, {
      RESTORE_TEST_DB: targetDatabase,
      RESTORE_TEST_VALIDATION_SQL_FILE: validationFile || '',
    }),
  });
}

async function roundTrip(context, { label, lastMigration, expect032 }) {
  await prepareSchema(context, lastMigration, 'restore-' + label);
  const markerId = 'synthetic_restore_marker_' + label;
  const markerName = 'Synthetic restore marker ' + label;
  await context.control.query(
    'INSERT INTO tenants (id, name) VALUES ($1, $2)',
    [markerId, markerName],
  );
  const snapshot = await sourceSnapshot(context);
  assert.equal(snapshot.migrations.at(-1), lastMigration);
  assert.equal(snapshot.migrations.includes(migration032), expect032);
  const constraintNames = snapshot.constraints.map((constraint) => constraint.name);
  assert.equal(constraintNames.includes('provider_approval_grants_site_runtime_purpose_check'), expect032);
  assert.equal(constraintNames.includes('provider_approval_grants_site_runtime_no_overlap'), expect032);

  const validationFile = join(context.tempRoot, 'validate-' + label + '.sql');
  await writeFile(validationFile, validationSql({
    expect032,
    markerId,
    markerName,
    snapshot,
  }), 'utf8');
  const backupFile = await createBackup(context, 'synthetic_' + label);
  const targetDatabase = 'restore_check_' + label + '_' + process.pid;
  const result = await runRestore(context, backupFile, targetDatabase, validationFile);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validation passed/);
  assert.equal(await databaseExists(context, targetDatabase), false);
  const marker = await context.control.query('SELECT name FROM tenants WHERE id = $1', [markerId]);
  assert.deepEqual(marker.rows, [{ name: markerName }]);
  return { backupFile, markerId, markerName, validationFile };
}

test('actual backup and restore scripts preserve PostgreSQL 16 schema and synthetic data', {
  skip: !enabled,
  timeout: 300_000,
}, async (t) => {
  let context;
  let primaryError;
  try {
    context = await startDisposablePostgres();

    await t.test('round trip preserves the migration 031 state without applying 032', async () => {
      await roundTrip(context, { label: 'pre032', lastMigration: migration031, expect032: false });
    });

    let post032Evidence;
    await t.test('round trip preserves migration 032 and both database constraints', async () => {
      post032Evidence = await roundTrip(context, {
        label: 'post032',
        lastMigration: migration032,
        expect032: true,
      });
    });

    await t.test('source and restore target equality is rejected before creation', async () => {
      const result = await runRestore(
        context,
        post032Evidence.backupFile,
        context.sourceDatabase,
        post032Evidence.validationFile,
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Refusing to restore into the source database/);
      const marker = await context.control.query(
        'SELECT name FROM tenants WHERE id = $1',
        [post032Evidence.markerId],
      );
      assert.deepEqual(marker.rows, [{ name: post032Evidence.markerName }]);
    });

    await t.test('a pre-existing target and its sentinel data are preserved', async () => {
      const target = 'restore_check_existing_' + process.pid;
      await createDatabase(context, target);
      const targetPool = new Pool({ connectionString: databaseUrlFor(context, target), max: 1 });
      try {
        await targetPool.query('CREATE TABLE restore_sentinel (value text PRIMARY KEY)');
        await targetPool.query('INSERT INTO restore_sentinel (value) VALUES ($1)', ['synthetic-sentinel']);
        const result = await runRestore(
          context,
          post032Evidence.backupFile,
          target,
          post032Evidence.validationFile,
        );
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Refusing to use an existing restore-test database/);
        const sentinel = await targetPool.query('SELECT value FROM restore_sentinel');
        assert.deepEqual(sentinel.rows, [{ value: 'synthetic-sentinel' }]);
      } finally {
        await targetPool.end();
        await dropDatabase(context, target);
      }
    });

    await t.test('a corrupt gzip dump fails and its owned target is removed', async () => {
      const dump = join(context.tempRoot, 'corrupt.sql.gz');
      const target = 'restore_check_corrupt_' + process.pid;
      await writeFile(dump, randomBytes(128));
      const result = await runRestore(context, dump, target, post032Evidence.validationFile);
      assert.notEqual(result.status, 0);
      assert.equal(await databaseExists(context, target), false);
    });

    await t.test('invalid SQL fails with ON_ERROR_STOP and its owned target is removed', async () => {
      const dump = join(context.tempRoot, 'invalid.sql.gz');
      const target = 'restore_check_invalid_sql_' + process.pid;
      await writeFile(dump, gzipSync(Buffer.from([
        'CREATE TABLE partial_restore_marker (id integer);',
        'THIS IS NOT VALID SQL;',
        '',
      ].join('\n'), 'utf8')));
      const result = await runRestore(context, dump, target, post032Evidence.validationFile);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /ERROR/);
      assert.equal(await databaseExists(context, target), false);
    });

    await t.test('a failing validation query fails and its owned target is removed', async () => {
      const validation = join(context.tempRoot, 'failing-validation.sql');
      const target = 'restore_check_validation_' + process.pid;
      await writeFile(validation, [
        'DO $validation$',
        'BEGIN',
        "  RAISE EXCEPTION 'synthetic validation failure';",
        'END',
        '$validation$;',
        '',
      ].join('\n'), 'utf8');
      const result = await runRestore(context, post032Evidence.backupFile, target, validation);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /synthetic validation failure/);
      assert.equal(await databaseExists(context, target), false);
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (context) await cleanupDisposablePostgres(context, primaryError);
  }
});
