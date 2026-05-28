const test = require('node:test');
const assert = require('node:assert/strict');
const { HealthController } = require('../dist/health.controller.js');

function responseStub() {
  return {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

async function withEnv(values, callback) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  try {
    return await callback();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

function createController({ databaseOk = true, redisPong = 'PONG' } = {}) {
  const db = {
    async query() {
      if (!databaseOk) throw new Error('db unavailable');
      return { rows: [] };
    },
  };
  const rateLimit = {
    async ping() {
      return redisPong;
    },
  };

  return new HealthController(db, rateLimit);
}

test('HealthController returns safe build commit metadata from APP_COMMIT_SHA', async () => {
  const controller = createController();
  const response = responseStub();
  const commit = '4542b0992e6cde0f3813c87038a997ea34d07335';

  const result = await withEnv(
    {
      APP_VERSION: 'v-test',
      APP_COMMIT_SHA: commit,
      BUILD_COMMIT: undefined,
      GIT_COMMIT: undefined,
      REDIS_URL: 'redis://localhost:6379',
      OPENAI_API_KEY: 'secret-value-that-must-not-leak',
    },
    () => controller.healthz(response),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(result.status, 'ok');
  assert.equal(result.service, 'api');
  assert.equal(result.version, 'v-test');
  assert.equal(result.commit, commit);
  assert.equal(result.database, 'ok');
  assert.equal(result.redis, 'ok');
  assert.equal(JSON.stringify(result).includes('secret-value-that-must-not-leak'), false);
});

test('HealthController falls back to unknown commit when build env is missing', async () => {
  const controller = createController();
  const response = responseStub();

  const result = await withEnv(
    {
      APP_COMMIT_SHA: undefined,
      BUILD_COMMIT: undefined,
      GIT_COMMIT: undefined,
      REDIS_URL: undefined,
    },
    () => controller.healthz(response),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(result.commit, 'unknown');
  assert.equal(result.redis, 'skipped');
});

test('HealthController keeps existing unhealthy response semantics', async () => {
  const controller = createController({ databaseOk: false });
  const response = responseStub();
  const commit = 'abcdef1234567890';

  const result = await withEnv(
    {
      APP_COMMIT_SHA: commit,
      REDIS_URL: 'redis://localhost:6379',
    },
    () => controller.healthz(response),
  );

  assert.equal(response.statusCode, 503);
  assert.equal(result.status, 'error');
  assert.equal(result.database, 'error');
  assert.equal(result.redis, 'ok');
  assert.equal(result.commit, commit);
});

test('HealthController does not echo non-sha commit env values', async () => {
  const controller = createController();
  const response = responseStub();

  const result = await withEnv(
    {
      APP_COMMIT_SHA: 'not-a-commit-value',
      BUILD_COMMIT: undefined,
      GIT_COMMIT: undefined,
      REDIS_URL: undefined,
    },
    () => controller.healthz(response),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(result.commit, 'unknown');
  assert.equal(JSON.stringify(result).includes('not-a-commit-value'), false);
});
