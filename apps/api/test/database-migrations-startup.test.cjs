const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DatabaseMigrationsService,
  shouldRunMigrationsOnStartup,
} = require('../dist/db/database-migrations.service.js');

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
