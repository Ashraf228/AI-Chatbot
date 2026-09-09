const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
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
  const sessionQueries = [];
  const transactions = [];
  const releases = [];
  const lockResults = [...(options.lockResults || [true])];
  const db = {
    async withReservedSession(callback) {
      let unusable;
      const session = {
        async query(sql, params) {
          sessionQueries.push({ sql, params });
          if (/pg_try_advisory_lock/i.test(sql)) {
            const acquired = lockResults.shift();
            if (acquired instanceof Error) throw acquired;
            return { rows: [{ acquired }] };
          }
          if (/pg_advisory_unlock/i.test(sql)) {
            const released = options.unlockResult === undefined ? true : options.unlockResult;
            if (released instanceof Error) throw released;
            return { rows: [{ released }] };
          }
          if (/SELECT version\s+FROM schema_migrations/i.test(sql)) {
            return { rows: options.appliedRows || [] };
          }
          return { rows: [] };
        },
        async transaction(transactionCallback) {
          const queries = [];
          transactions.push(queries);
          return transactionCallback({
            async query(sql, params) {
              queries.push({ sql, params });
              const failure = options.failWhen?.(sql, params);
              if (failure) throw failure;
              return { rows: [] };
            },
          });
        },
        markUnusable(error) {
          unusable = error;
        },
      };
      try {
        return await callback(session);
      } finally {
        releases.push(unusable);
      }
    },
  };
  return { db, sessionQueries, transactions, releases };
}

test('each pending migration and its tracking insert use one reserved session', async () => {
  const { db, sessionQueries, transactions } = createMigrationDatabase();
  const service = new DatabaseMigrationsService(db);

  await service.runPendingMigrations();

  assert.ok(transactions.length > 0);
  assert.match(sessionQueries[0].sql, /pg_try_advisory_lock/i);
  assert.ok(sessionQueries.some(({ sql }) => /CREATE TABLE IF NOT EXISTS schema_migrations/i.test(sql)));
  assert.ok(sessionQueries.some(({ sql }) => /SELECT version\s+FROM schema_migrations/i.test(sql)));
  assert.equal(sessionQueries.some(({ sql }) => /INSERT INTO schema_migrations/i.test(sql)), false);
  assert.match(sessionQueries.at(-1).sql, /pg_advisory_unlock/i);

  for (const queries of transactions) {
    assert.equal(queries.length, 2);
    assert.match(queries[1].sql, /INSERT INTO schema_migrations/i);
  }
});

test('migration lock polls serially before table initialization', async () => {
  const { db, sessionQueries } = createMigrationDatabase({ lockResults: [false, false, true] });
  const service = new DatabaseMigrationsService(db);
  let now = 0;
  const delays = [];
  service.migrationLockTiming = {
    now: () => now,
    async sleep(delay) {
      delays.push(delay);
      now += delay;
    },
  };

  await service.runPendingMigrations();

  assert.deepEqual(delays, [250, 250]);
  assert.match(sessionQueries[0].sql, /pg_try_advisory_lock/i);
  assert.match(sessionQueries[1].sql, /pg_try_advisory_lock/i);
  assert.match(sessionQueries[2].sql, /pg_try_advisory_lock/i);
  assert.match(sessionQueries[3].sql, /CREATE TABLE IF NOT EXISTS schema_migrations/i);
});

test('migration lock timeout is fail-closed before schema queries', async () => {
  const { db, sessionQueries, transactions } = createMigrationDatabase({ lockResults: [false, false] });
  const service = new DatabaseMigrationsService(db);
  let now = 0;
  service.migrationLockTiming = {
    now: () => now,
    async sleep() {
      now = 120000;
    },
  };

  await assert.rejects(() => service.runPendingMigrations(), /timed out/);
  assert.equal(sessionQueries.some(({ sql }) => /schema_migrations/i.test(sql)), false);
  assert.equal(transactions.length, 0);
});

test('unexpected lock and unlock results fail closed and discard the session', async () => {
  const lock = createMigrationDatabase({ lockResults: [null] });
  await assert.rejects(
    () => new DatabaseMigrationsService(lock.db).runPendingMigrations(),
    /unexpected result/,
  );
  assert.ok(lock.releases[0] instanceof Error);

  const unlock = createMigrationDatabase({ unlockResult: false });
  await assert.rejects(
    () => new DatabaseMigrationsService(unlock.db).runPendingMigrations(),
    /release was not confirmed/,
  );
  assert.ok(unlock.releases[0] instanceof Error);
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

test('a migration error remains primary when unlock also fails', async () => {
  const migrationError = new Error('migration failed');
  const unlockError = new Error('unlock failed');
  const { db, releases } = createMigrationDatabase({
    failWhen(sql) {
      return /CREATE EXTENSION IF NOT EXISTS vector/i.test(sql) ? migrationError : null;
    },
    unlockResult: unlockError,
  });

  await assert.rejects(() => new DatabaseMigrationsService(db).runPendingMigrations(), migrationError);
  assert.equal(releases.length, 1);
  assert.ok(releases[0] instanceof Error);
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

function createReusableClient() {
  const client = new EventEmitter();
  client.calls = [];
  client.releases = [];
  client.query = async (sql) => {
    client.calls.push(sql);
    const failure = client.failWhen?.(sql);
    if (failure) throw failure;
    return { rows: [] };
  };
  client.release = (error) => {
    client.releases.push(error);
  };
  return client;
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function nextTurn() {
  await new Promise((resolve) => setImmediate(resolve));
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

test('DatabaseService sessions reject every operation after release', async () => {
  const client = createReusableClient();
  const service = createDatabaseServiceWithClient(client);
  let session;

  await service.withReservedSession(async (reservedSession) => {
    session = reservedSession;
  });

  assert.equal(client.releases.length, 1);
  await assert.rejects(() => session.query('SELECT after_release'), /session has ended/);
  await assert.rejects(
    () => session.transaction(async () => {
      throw new Error('callback must not run');
    }),
    /session has ended/,
  );
  assert.throws(() => session.markUnusable(new Error('too late')), /session has ended/);
  assert.deepEqual(client.calls, []);
  assert.equal(client.releases.length, 1);
});

test('DatabaseService drains an unawaited query before releasing the reserved client', async () => {
  const client = createReusableClient();
  const pending = createDeferred();
  client.query = async (sql) => {
    client.calls.push(sql);
    return pending.promise;
  };
  const service = createDatabaseServiceWithClient(client);
  let session;
  const owner = service.withReservedSession(async (reservedSession) => {
    session = reservedSession;
    void session.query('SELECT pending');
  });

  await nextTurn();
  assert.deepEqual(client.calls, ['SELECT pending']);
  assert.equal(client.releases.length, 0);
  assert.equal(client.listenerCount('error'), 1);
  await assert.rejects(() => session.query('SELECT rejected_while_draining'), /not accepting/);
  assert.deepEqual(client.calls, ['SELECT pending']);

  pending.resolve({ rows: [] });
  await owner;
  assert.equal(client.releases.length, 1);
  assert.equal(client.listenerCount('error'), 0);
});

test('DatabaseService waits for every admitted operation and surfaces an unawaited failure', async () => {
  const client = createReusableClient();
  const first = createDeferred();
  const second = createDeferred();
  const pending = [first, second];
  client.query = async (sql) => {
    client.calls.push(sql);
    return pending.shift().promise;
  };
  const service = createDatabaseServiceWithClient(client);
  const owner = service.withReservedSession(async (session) => {
    void session.query('SELECT first');
    void session.query('SELECT second');
  });

  await nextTurn();
  assert.equal(client.releases.length, 0);
  first.resolve({ rows: [] });
  await nextTurn();
  assert.equal(client.releases.length, 0);
  second.reject(new Error('unawaited query failed'));
  await assert.rejects(() => owner, /unawaited query failed/);
  assert.equal(client.releases.length, 1);
});

test('DatabaseService surfaces an unawaited operation failure that settles before draining', async () => {
  const client = createReusableClient();
  client.query = async () => {
    throw new Error('already failed query');
  };
  const service = createDatabaseServiceWithClient(client);

  await assert.rejects(
    () => service.withReservedSession(async (session) => {
      void session.query('SELECT already_failed');
      await nextTurn();
    }),
    /already failed query/,
  );
  assert.equal(client.releases.length, 1);
});

test('DatabaseService preserves a callback error while draining its outstanding query', async () => {
  const client = createReusableClient();
  const pending = createDeferred();
  client.query = async (sql) => {
    client.calls.push(sql);
    return pending.promise;
  };
  const service = createDatabaseServiceWithClient(client);
  const callbackError = new Error('callback failed first');
  const owner = service.withReservedSession(async (session) => {
    void session.query('SELECT pending_after_callback_error');
    throw callbackError;
  });

  await nextTurn();
  assert.equal(client.releases.length, 0);
  pending.reject(new Error('secondary query failed'));
  await assert.rejects(() => owner, callbackError);
  assert.equal(client.releases.length, 1);
});

test('DatabaseService drains an unawaited transaction before release', async () => {
  const client = createReusableClient();
  const commit = createDeferred();
  client.query = async (sql) => {
    client.calls.push(sql);
    if (sql === 'COMMIT') return commit.promise;
    return { rows: [] };
  };
  const service = createDatabaseServiceWithClient(client);
  const owner = service.withReservedSession(async (session) => {
    void session.transaction(async () => {});
  });

  await nextTurn();
  await nextTurn();
  assert.deepEqual(client.calls, ['BEGIN', 'COMMIT']);
  assert.equal(client.releases.length, 0);
  commit.resolve({ rows: [] });
  await owner;
  assert.equal(client.releases.length, 1);
});

test('DatabaseService keeps the error listener active while draining', async () => {
  const client = createReusableClient();
  const pending = createDeferred();
  client.query = async (sql) => {
    client.calls.push(sql);
    return pending.promise;
  };
  const service = createDatabaseServiceWithClient(client);
  const owner = service.withReservedSession(async (session) => {
    void session.query('SELECT pending_during_client_error');
  });

  await nextTurn();
  assert.equal(client.listenerCount('error'), 1);
  const connectionError = new Error('connection lost while draining');
  client.emit('error', connectionError);
  pending.resolve({ rows: [] });
  await owner;
  assert.equal(client.releases.length, 1);
  assert.equal(client.releases[0], connectionError);
  assert.equal(client.listenerCount('error'), 0);
});

test('DatabaseService removes only its session error listener after every release path', async () => {
  const client = createReusableClient();
  const foreignListener = () => {};
  client.on('error', foreignListener);
  const service = createDatabaseServiceWithClient(client);

  await service.withReservedSession(async () => {
    assert.equal(client.listenerCount('error'), 2);
  });
  assert.equal(client.listenerCount('error'), 1);

  await assert.rejects(
    () => service.withReservedSession(async () => {
      assert.equal(client.listenerCount('error'), 2);
      throw new Error('callback failed');
    }),
    /callback failed/,
  );
  assert.equal(client.listenerCount('error'), 1);

  await service.withReservedSession(async (session) => {
    client.emit('error', new Error('connection lost'));
    await assert.rejects(() => session.query('SELECT blocked'), /unavailable/);
  });
  assert.equal(client.listenerCount('error'), 1);
  await assert.rejects(
    () => service.transaction(async () => {
      throw new Error('transaction callback failed');
    }),
    /transaction callback failed/,
  );
  assert.equal(client.listenerCount('error'), 1);

  client.failWhen = (sql) => (sql === 'ROLLBACK' ? new Error('rollback failed') : undefined);
  await assert.rejects(
    () => service.transaction(async () => {
      throw new Error('transaction failed');
    }),
    /transaction failed/,
  );
  assert.equal(client.listenerCount('error'), 1);
  assert.equal(client.releases.length, 5);
  assert.ok(client.releases.at(-1) instanceof Error);
  assert.equal(client.listeners('error')[0], foreignListener);
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
