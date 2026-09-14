const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { cp, mkdir, mkdtemp, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);
const enabled = process.env.POSTGRES16_IT_TEMPLATE_DELETE_TEST === '1';
const apiRoot = join(__dirname, '..');
const migrationsSource = join(apiRoot, 'migrations');
const postgresImage = 'pgvector/pgvector:pg16';

async function docker(...args) {
  return execFileAsync('docker', args, { timeout: 30_000 });
}

function isMissingDockerResource(error) {
  const details = error && typeof error === 'object'
    ? [error.message, error.stdout, error.stderr].filter(Boolean).join('\n')
    : String(error);
  return /no such (?:container|object|volume)|not found/i.test(details);
}

async function attachedVolumeNames(container) {
  const result = await docker('inspect', '--format', '{{json .Mounts}}', container);
  const mounts = JSON.parse(result.stdout);
  if (!Array.isArray(mounts)) throw new Error('Docker did not return a mount list');
  return [...new Set(mounts
    .filter((mount) => mount?.Type === 'volume' && typeof mount.Name === 'string' && mount.Name)
    .map((mount) => mount.Name))];
}

async function cleanupPostgres(container, volumeNames) {
  const failures = [];
  try {
    await docker('rm', '-f', '-v', container);
  } catch (error) {
    if (!isMissingDockerResource(error)) failures.push(error);
  }
  try {
    await docker('inspect', container);
    failures.push(new Error('PostgreSQL test container still exists: ' + container));
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

async function startPostgres() {
  await docker('image', 'inspect', postgresImage);
  const container = 'it-template-delete-' + process.pid + '-' + Date.now();
  let created = false;
  let volumeNames = [];
  try {
    await docker(
      'run', '-d', '--name', container,
      '-e', 'POSTGRES_PASSWORD=synthetic-temporary-password',
      '-e', 'POSTGRES_DB=it_template_delete_test',
      '-p', '127.0.0.1::5432',
      postgresImage,
    );
    created = true;
    volumeNames = await attachedVolumeNames(container);
    const portOutput = await docker('port', container, '5432/tcp');
    const port = Number(portOutput.stdout.trim().split(':').at(-1));
    if (!Number.isInteger(port) || port <= 0) throw new Error('Docker did not expose PostgreSQL');
    const databaseUrl = 'postgres://postgres:synthetic-temporary-password@127.0.0.1:'
      + port + '/it_template_delete_test';
    await waitForPostgres(databaseUrl);
    return { container, volumeNames, databaseUrl };
  } catch (error) {
    if (created) {
      await cleanupPostgres(container, volumeNames).catch((cleanupError) => {
        error.cleanupError = cleanupError;
      });
    }
    throw error;
  }
}

function withApplicationName(databaseUrl, applicationName) {
  const url = new URL(databaseUrl);
  url.searchParams.set('application_name', applicationName);
  return url.toString();
}

function createDatabase(databaseUrl, applicationName) {
  const { DatabaseService } = require('../dist/db/database.service.js');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = withApplicationName(databaseUrl, applicationName);
  try {
    return new DatabaseService();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

async function copyMigrations(workspace) {
  const migrations = join(workspace, 'migrations');
  await mkdir(migrations, { recursive: true });
  const names = (await readdir(migrationsSource))
    .filter((name) => /^\d+_.+\.sql$/i.test(name))
    .sort();
  await Promise.all(names.map((name) => cp(join(migrationsSource, name), join(migrations, name))));
}

async function runProductionMigrations(databaseUrl, workspace) {
  const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service.js');
  const previousCwd = process.cwd();
  const database = createDatabase(databaseUrl, 'it-template-delete-migrations');
  try {
    process.chdir(workspace);
    await new DatabaseMigrationsService(database).runPendingMigrations();
  } finally {
    process.chdir(previousCwd);
    await database.pool.end();
  }
}

async function eventually(callback) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const value = await callback();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for PostgreSQL state');
}

function vectorLiteral() {
  return '[' + ['1', ...Array(1535).fill('0')].join(',') + ']';
}

async function insertSource(pool, {
  id,
  tenantId = 'tenant-main',
  siteId = 'site-main',
  active = false,
  readiness = 'not_ready',
}) {
  await pool.query(
    `INSERT INTO knowledge_sources(
       id, tenant_id, site_id, source_type, label, sync_status,
       is_active, ingest_status, index_status, runtime_readiness, config
     ) VALUES ($1, $2, $3, 'it_support_template', $1, 'pending',
       $4, 'created', 'not_requested', $5, '{}'::jsonb)`,
    [id, tenantId, siteId, active, readiness],
  );
}

async function insertDocument(pool, {
  id,
  sourceId,
  tenantId = 'tenant-main',
  siteId = 'site-main',
  withChunk = true,
}) {
  await pool.query(
    `INSERT INTO documents(id, tenant_id, site_id, type, title, source_id)
     VALUES ($1, $2, $3, 'manual', $1, $4)`,
    [id, tenantId, siteId, sourceId],
  );
  if (withChunk) {
    await pool.query(
      `INSERT INTO chunks(
         id, tenant_id, site_id, document_id, content, metadata, content_hash, embedding
       ) VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7::vector)`,
      [
        'chunk-' + id,
        tenantId,
        siteId,
        id,
        'Synthetic retrieval marker for ' + id,
        'hash-' + id,
        vectorLiteral(),
      ],
    );
  }
}

function deleteInput(sourceId, overrides = {}) {
  return {
    tenantId: 'tenant-main',
    siteId: 'site-main',
    sourceId,
    ...overrides,
  };
}

function isHttpStatus(status) {
  return (error) => (
    typeof error?.getStatus === 'function'
    && error.getStatus() === status
  );
}

function createGatedDatabase(databaseUrl) {
  const database = createDatabase(databaseUrl, 'it-template-delete-gated');
  const originalConnect = database.pool.connect.bind(database.pool);
  let releaseLock;
  let reportLock;
  const locked = new Promise((resolve) => { reportLock = resolve; });
  const proceed = new Promise((resolve) => { releaseLock = resolve; });

  database.pool.connect = async () => {
    const client = await originalConnect();
    const originalQuery = client.query.bind(client);
    client.query = async (...args) => {
      const result = await originalQuery(...args);
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
      if (/FROM knowledge_sources/i.test(text) && /FOR UPDATE/i.test(text)) {
        reportLock();
        await proceed;
      }
      return result;
    };
    return client;
  };

  return { database, locked, release: releaseLock };
}

test('template draft deletion preserves document bindings and retrieval safety', { skip: !enabled }, async (t) => {
  const postgres = await startPostgres();
  const tempRoot = await mkdtemp(join(tmpdir(), 'it-template-delete-pg16-'));
  let database;
  let gatedDatabase;
  let insertPool;
  let control;
  let primaryError;

  try {
    await copyMigrations(tempRoot);
    await runProductionMigrations(postgres.databaseUrl, tempRoot);
    database = createDatabase(postgres.databaseUrl, 'it-template-delete-service');
    control = new Pool({
      connectionString: withApplicationName(postgres.databaseUrl, 'it-template-delete-control'),
      max: 6,
    });
    const {
      ItKnowledgeTemplateImportService,
    } = require('../dist/modules/it-support/it-knowledge-template-import.service.js');
    const { VectorService } = require('../dist/vector/vector.service.js');
    const service = new ItKnowledgeTemplateImportService(database, {}, {});
    const vector = new VectorService(database);

    await control.query(
      `INSERT INTO tenants(id, name)
       VALUES ('tenant-main', 'Synthetic main'), ('tenant-foreign', 'Synthetic foreign')`,
    );
    await control.query(
      `INSERT INTO sites(id, tenant_id, name, site_key)
       VALUES
         ('site-main', 'tenant-main', 'Synthetic main', 'synthetic-main'),
         ('site-other', 'tenant-main', 'Synthetic other', 'synthetic-other'),
         ('site-foreign', 'tenant-foreign', 'Synthetic foreign', 'synthetic-foreign')`,
    );

    await t.test('legacy deletion orphans indexed content and makes it retrieval eligible', async () => {
      await insertSource(control, { id: 'source-legacy' });
      await insertSource(control, { id: 'source-allowed', active: true, readiness: 'ready' });
      await insertDocument(control, { id: 'document-legacy', sourceId: 'source-legacy' });
      await insertDocument(control, { id: 'document-allowed', sourceId: 'source-allowed' });

      const before = await vector.search('tenant-main', 'site-main', [1, ...Array(1535).fill(0)], 10);
      assert.deepEqual(before.map((row) => row.id), ['chunk-document-allowed']);

      await control.query(
        `DELETE FROM knowledge_sources
         WHERE id = $1
           AND tenant_id = $2
           AND site_id = $3
           AND source_type = 'it_support_template'
           AND is_active = false
           AND runtime_readiness = 'not_ready'`,
        ['source-legacy', 'tenant-main', 'site-main'],
      );

      const orphan = await control.query(
        'SELECT source_id FROM documents WHERE id = $1',
        ['document-legacy'],
      );
      assert.equal(orphan.rows[0].source_id, null);
      const after = await vector.search('tenant-main', 'site-main', [1, ...Array(1535).fill(0)], 10);
      assert.deepEqual(
        new Set(after.map((row) => row.id)),
        new Set(['chunk-document-legacy', 'chunk-document-allowed']),
      );
      await control.query(
        'DELETE FROM documents WHERE id = ANY($1::text[])',
        [['document-legacy', 'document-allowed']],
      );
      await control.query('DELETE FROM knowledge_sources WHERE id = $1', ['source-allowed']);
    });

    await t.test('fixed service returns 409 and preserves source, document, binding, and chunk', async () => {
      await insertSource(control, { id: 'source-blocked' });
      await insertSource(control, { id: 'source-still-allowed', active: true, readiness: 'ready' });
      await insertDocument(control, { id: 'document-blocked', sourceId: 'source-blocked' });
      await insertDocument(control, { id: 'document-still-allowed', sourceId: 'source-still-allowed' });

      await assert.rejects(
        () => service.deleteItKnowledgeTemplateDraft(deleteInput('source-blocked')),
        isHttpStatus(409),
      );
      const state = await control.query(
        `SELECT
           EXISTS(SELECT 1 FROM knowledge_sources WHERE id = 'source-blocked') AS source_exists,
           (SELECT source_id FROM documents WHERE id = 'document-blocked') AS source_id,
           EXISTS(SELECT 1 FROM chunks WHERE id = 'chunk-document-blocked') AS chunk_exists`,
      );
      assert.deepEqual(state.rows[0], {
        source_exists: true,
        source_id: 'source-blocked',
        chunk_exists: true,
      });
      const results = await vector.search('tenant-main', 'site-main', [1, ...Array(1535).fill(0)], 10);
      assert.equal(results.some((row) => row.id === 'chunk-document-blocked'), false);
      assert.equal(results.some((row) => row.id === 'chunk-document-still-allowed'), true);
    });

    await t.test('a document without chunks still prevents deletion', async () => {
      await insertSource(control, { id: 'source-document-only' });
      await insertDocument(control, {
        id: 'document-without-chunk',
        sourceId: 'source-document-only',
        withChunk: false,
      });
      await assert.rejects(
        () => service.deleteItKnowledgeTemplateDraft(deleteInput('source-document-only')),
        isHttpStatus(409),
      );
      assert.equal(
        (await control.query(
          'SELECT source_id FROM documents WHERE id = $1',
          ['document-without-chunk'],
        )).rows[0].source_id,
        'source-document-only',
      );
    });

    await t.test('a document-free eligible draft is deleted', async () => {
      await insertSource(control, { id: 'source-empty' });
      const result = await service.deleteItKnowledgeTemplateDraft(deleteInput('source-empty'));
      assert.deepEqual(result, {
        ok: true,
        sourceId: 'source-empty',
        siteId: 'site-main',
        providerCallsUsed: false,
      });
      assert.equal(
        (await control.query(
          'SELECT count(*)::int AS count FROM knowledge_sources WHERE id = $1',
          ['source-empty'],
        )).rows[0].count,
        0,
      );
    });

    await t.test('foreign scopes and active or ready sources remain protected', async () => {
      await insertSource(control, { id: 'source-scope-protected' });
      await insertSource(control, { id: 'source-active', active: true });
      await insertSource(control, { id: 'source-ready', readiness: 'ready' });

      await assert.rejects(
        () => service.deleteItKnowledgeTemplateDraft(deleteInput('source-scope-protected', {
          tenantId: 'tenant-foreign',
        })),
        isHttpStatus(400),
      );
      await assert.rejects(
        () => service.deleteItKnowledgeTemplateDraft(deleteInput('source-scope-protected', {
          siteId: 'site-other',
        })),
        isHttpStatus(404),
      );
      await assert.rejects(
        () => service.deleteItKnowledgeTemplateDraft(deleteInput('source-active')),
        isHttpStatus(404),
      );
      await assert.rejects(
        () => service.deleteItKnowledgeTemplateDraft(deleteInput('source-ready')),
        isHttpStatus(404),
      );
      assert.equal(
        (await control.query(
          `SELECT count(*)::int AS count
           FROM knowledge_sources
           WHERE id = ANY($1::text[])`,
          [['source-scope-protected', 'source-active', 'source-ready']],
        )).rows[0].count,
        3,
      );
    });

    await t.test('an uncommitted document insert completes before deletion and causes 409', async () => {
      await insertSource(control, { id: 'source-insert-first' });
      const insertClient = await control.connect();
      try {
        await insertClient.query('BEGIN');
        await insertClient.query(
          `INSERT INTO documents(id, tenant_id, site_id, type, title, source_id)
           VALUES ('document-insert-first', 'tenant-main', 'site-main', 'manual',
             'Synthetic concurrent document', 'source-insert-first')`,
        );
        const deletion = service.deleteItKnowledgeTemplateDraft(deleteInput('source-insert-first'));
        const deletionRejected = assert.rejects(deletion, isHttpStatus(409));
        await eventually(async () => {
          const result = await control.query(
            `SELECT 1
             FROM pg_stat_activity
             WHERE application_name = 'it-template-delete-service'
               AND query LIKE '%FOR UPDATE%'
               AND wait_event_type = 'Lock'`,
          );
          return result.rowCount === 1;
        });
        await insertClient.query('COMMIT');
        await deletionRejected;
      } finally {
        await insertClient.query('ROLLBACK').catch(() => {});
        insertClient.release();
      }
      const state = await control.query(
        `SELECT d.source_id, EXISTS(
           SELECT 1 FROM knowledge_sources WHERE id = 'source-insert-first'
         ) AS source_exists
         FROM documents d
         WHERE d.id = 'document-insert-first'`,
      );
      assert.deepEqual(state.rows[0], {
        source_id: 'source-insert-first',
        source_exists: true,
      });
    });

    await t.test('an insert that starts after the source lock cannot create an orphan', async () => {
      await insertSource(control, { id: 'source-delete-first' });
      const gated = createGatedDatabase(postgres.databaseUrl);
      gatedDatabase = gated.database;
      const gatedService = new ItKnowledgeTemplateImportService(gatedDatabase, {}, {});
      insertPool = new Pool({
        connectionString: withApplicationName(
          postgres.databaseUrl,
          'it-template-delete-insert-after-lock',
        ),
        max: 1,
      });

      const deletion = gatedService.deleteItKnowledgeTemplateDraft(deleteInput('source-delete-first'));
      await gated.locked;
      const insertAttempt = insertPool.query(
        `INSERT INTO documents(id, tenant_id, site_id, type, title, source_id)
         VALUES ('document-delete-first', 'tenant-main', 'site-main', 'manual',
           'Synthetic blocked document', 'source-delete-first')`,
      );
      const insertRejected = assert.rejects(
        () => insertAttempt,
        (error) => error?.code === '23503',
      );
      await eventually(async () => {
        const result = await control.query(
          `SELECT 1
           FROM pg_stat_activity
           WHERE application_name = 'it-template-delete-insert-after-lock'
             AND wait_event_type = 'Lock'`,
        );
        return result.rowCount === 1;
      });
      gated.release();

      assert.equal((await deletion).ok, true);
      await insertRejected;
      const finalState = await control.query(
        `SELECT
           EXISTS(SELECT 1 FROM knowledge_sources WHERE id = 'source-delete-first') AS source_exists,
           EXISTS(SELECT 1 FROM documents WHERE id = 'document-delete-first') AS document_exists`,
      );
      assert.deepEqual(finalState.rows[0], {
        source_exists: false,
        document_exists: false,
      });
    });
  } catch (error) {
    primaryError = error;
  } finally {
    const cleanupFailures = [];
    for (const resource of [insertPool, gatedDatabase?.pool, database?.pool, control]) {
      try {
        await resource?.end();
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    try {
      await rm(tempRoot, { recursive: true, force: true });
    } catch (error) {
      cleanupFailures.push(error);
    }
    try {
      await cleanupPostgres(postgres.container, postgres.volumeNames);
    } catch (error) {
      cleanupFailures.push(error);
    }
    if (cleanupFailures.length > 0) {
      const cleanupError = new AggregateError(
        cleanupFailures,
        'Template delete test cleanup failed',
      );
      if (primaryError && typeof primaryError === 'object') {
        primaryError.cleanupError = cleanupError;
      } else if (!primaryError) {
        primaryError = cleanupError;
      }
    }
  }

  if (primaryError) throw primaryError;
});
