const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DatabaseMigrationsService,
  shouldRunMigrationsOnStartup,
} = require('../dist/db/database-migrations.service.js');
const { DatabaseService } = require('../dist/db/database.service.js');

function withEnv(env, fn) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    RUN_MIGRATIONS_ON_STARTUP: process.env.RUN_MIGRATIONS_ON_STARTUP,
    ALLOW_PRODUCTION_AUTO_MIGRATIONS: process.env.ALLOW_PRODUCTION_AUTO_MIGRATIONS,
    DATABASE_URL: process.env.DATABASE_URL,
  };

  for (const key of Object.keys(previous)) {
    delete process.env[key];
  }

  Object.assign(process.env, env);

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(previous)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

function createService() {
  const service = new DatabaseMigrationsService({
    query() {
      throw new Error('query should not be called');
    },
  });
  const logs = [];
  service.logger = {
    log(message, metadata) {
      logs.push({ message, metadata });
    },
  };
  return { service, logs };
}

test('production default disables startup migrations before database writes', async () => {
  await withEnv({ NODE_ENV: 'production' }, async () => {
    const { service, logs } = createService();
    let didRun = false;
    service.runPendingMigrations = async () => {
      didRun = true;
    };

    await service.onModuleInit();

    assert.equal(didRun, false);
    assert.equal(logs[0].message, 'Database auto-migrations skipped');
    assert.equal(logs[0].metadata.reason, 'production-auto-migrations-disabled');
  });
});

test('production requires both startup flags for automatic migrations', () => {
  assert.deepEqual(
    shouldRunMigrationsOnStartup({
      nodeEnv: 'production',
      runMigrationsOnStartup: 'true',
      allowProductionAutoMigrations: undefined,
    }),
    { allowed: false, reason: 'production-auto-migrations-disabled' },
  );

  assert.deepEqual(
    shouldRunMigrationsOnStartup({
      nodeEnv: 'production',
      runMigrationsOnStartup: 'true',
      allowProductionAutoMigrations: 'true',
    }),
    { allowed: true, reason: 'production-explicitly-enabled' },
  );
});

test('development default remains enabled and can be disabled explicitly', () => {
  assert.deepEqual(
    shouldRunMigrationsOnStartup({
      nodeEnv: 'development',
      runMigrationsOnStartup: undefined,
    }),
    { allowed: true, reason: 'non-production-default' },
  );

  assert.deepEqual(
    shouldRunMigrationsOnStartup({
      nodeEnv: 'development',
      runMigrationsOnStartup: 'false',
    }),
    { allowed: false, reason: 'startup-migrations-disabled' },
  );
});

test('enabled startup path calls explicit migration runner', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      RUN_MIGRATIONS_ON_STARTUP: 'true',
      ALLOW_PRODUCTION_AUTO_MIGRATIONS: 'true',
    },
    async () => {
      const { service, logs } = createService();
      let didRun = false;
      service.runPendingMigrations = async () => {
        didRun = true;
      };

      await service.onModuleInit();

      assert.equal(didRun, true);
      assert.equal(logs[0].message, 'Database auto-migrations enabled');
      assert.equal(logs[0].metadata.reason, 'production-explicitly-enabled');
    },
  );
});

test('skipped log does not include secret or database URL values', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:secret@example.invalid/db',
    },
    async () => {
      const { service, logs } = createService();
      service.runPendingMigrations = async () => {
        throw new Error('runPendingMigrations should not be called');
      };

      await service.onModuleInit();

      const serialized = JSON.stringify(logs);
      assert.doesNotMatch(serialized, /postgres:\/\//);
      assert.doesNotMatch(serialized, /secret/);
      assert.doesNotMatch(serialized, /DATABASE_URL/);
    },
  );
});

function createMigrationDatabase(options = {}) {
  const rootQueries = [];
  const transactions = [];
  const db = {
    async query(sql, params) {
      rootQueries.push({ sql, params });
      if (/SELECT version\s+FROM schema_migrations/i.test(sql)) {
        return { rows: options.appliedRows || [] };
      }
      return { rows: [] };
    },
    async transaction(callback) {
      const queries = [];
      transactions.push(queries);
      return callback({
        async query(sql, params) {
          queries.push({ sql, params });
          const failure = options.failWhen?.(sql, params);
          if (failure) {
            throw failure;
          }
          return { rows: [] };
        },
      });
    },
  };
  return { db, rootQueries, transactions };
}

test('each pending migration and its tracking insert use one transaction client', async () => {
  const { db, rootQueries, transactions } = createMigrationDatabase();
  const service = new DatabaseMigrationsService(db);

  await service.runPendingMigrations();

  assert.ok(transactions.length > 0);
  assert.ok(rootQueries.some(({ sql }) => /CREATE TABLE IF NOT EXISTS schema_migrations/i.test(sql)));
  assert.ok(rootQueries.some(({ sql }) => /SELECT version\s+FROM schema_migrations/i.test(sql)));
  assert.equal(rootQueries.some(({ sql }) => /INSERT INTO schema_migrations/i.test(sql)), false);

  for (const queries of transactions) {
    assert.equal(queries.length, 2);
    assert.match(queries[1].sql, /INSERT INTO schema_migrations/i);
  }
});

test('a failed migration stops subsequent migrations without a tracking insert', async () => {
  const expected = new Error('migration statement failed');
  const { db, transactions } = createMigrationDatabase({
    failWhen(sql) {
      return /CREATE EXTENSION IF NOT EXISTS vector/i.test(sql) ? expected : null;
    },
  });
  const service = new DatabaseMigrationsService(db);

  await assert.rejects(() => service.runPendingMigrations(), expected);

  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].some(({ sql }) => /INSERT INTO schema_migrations/i.test(sql)), false);
});

test('a failed migration tracking insert stops subsequent migrations', async () => {
  const { db, transactions } = createMigrationDatabase({
    failWhen(sql) {
      return /INSERT INTO schema_migrations/i.test(sql)
        ? new Error('tracking insert failed')
        : null;
    },
  });
  const service = new DatabaseMigrationsService(db);

  await assert.rejects(
    () => service.runPendingMigrations(),
    /tracking insert failed/,
  );

  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].length, 2);
  assert.match(transactions[0][1].sql, /INSERT INTO schema_migrations/i);
});

function createDatabaseServiceWithClient(client) {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  const service = new DatabaseService();
  if (previous === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previous;
  }
  service.pool = {
    async connect() {
      return client;
    },
  };
  return service;
}

test('DatabaseService transaction releases one client after commit', async () => {
  const calls = [];
  let releases = 0;
  const service = createDatabaseServiceWithClient({
    async query(sql) {
      calls.push(sql);
      return { rows: [] };
    },
    release() {
      releases += 1;
    },
  });

  await service.transaction(async (tx) => tx.query('SELECT 1'));

  assert.deepEqual(calls, ['BEGIN', 'SELECT 1', 'COMMIT']);
  assert.equal(releases, 1);
});

test('DatabaseService transaction releases the client when BEGIN fails', async () => {
  const expected = new Error('begin failed');
  const calls = [];
  let releases = 0;
  const service = createDatabaseServiceWithClient({
    async query(sql) {
      calls.push(sql);
      if (sql === 'BEGIN') {
        throw expected;
      }
      return { rows: [] };
    },
    release() {
      releases += 1;
    },
  });

  await assert.rejects(() => service.transaction(async () => {}), expected);

  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK']);
  assert.equal(releases, 1);
});

test('DatabaseService transaction rolls back and releases the client after a statement error', async () => {
  const expected = new Error('statement failed');
  const calls = [];
  let releases = 0;
  const service = createDatabaseServiceWithClient({
    async query(sql) {
      calls.push(sql);
      if (sql === 'SELECT broken') {
        throw expected;
      }
      return { rows: [] };
    },
    release() {
      releases += 1;
    },
  });

  await assert.rejects(
    () => service.transaction(async (tx) => tx.query('SELECT broken')),
    expected,
  );

  assert.deepEqual(calls, ['BEGIN', 'SELECT broken', 'ROLLBACK']);
  assert.equal(releases, 1);
});

test('DatabaseService transaction preserves a COMMIT error and releases the client', async () => {
  const expected = new Error('commit failed');
  const calls = [];
  let releases = 0;
  const service = createDatabaseServiceWithClient({
    async query(sql) {
      calls.push(sql);
      if (sql === 'COMMIT') {
        throw expected;
      }
      return { rows: [] };
    },
    release() {
      releases += 1;
    },
  });

  await assert.rejects(() => service.transaction(async () => {}), expected);

  assert.deepEqual(calls, ['BEGIN', 'COMMIT', 'ROLLBACK']);
  assert.equal(releases, 1);
});

test('DatabaseService transaction preserves the original error and releases the client when rollback fails', async () => {
  const expected = new Error('operation failed');
  const rollbackError = Object.assign(new Error('rollback failed'), { code: 'ECONNRESET' });
  const calls = [];
  const releaseArgs = [];
  const logs = [];
  const service = createDatabaseServiceWithClient({
    async query(sql) {
      calls.push(sql);
      if (sql === 'ROLLBACK') {
        throw rollbackError;
      }
      return { rows: [] };
    },
    release(error) {
      releaseArgs.push(error);
    },
  });

  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    await assert.rejects(() => service.transaction(async () => {
      throw expected;
    }), expected);
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(releaseArgs, [rollbackError]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[database_transaction_rollback_failed]');
  assert.match(logs[0][1], /"phase":"rollback"/);
  assert.match(logs[0][1], /"errorCode":"ECONNRESET"/);
  assert.match(logs[0][1], /"clientDiscarded":true/);
});
