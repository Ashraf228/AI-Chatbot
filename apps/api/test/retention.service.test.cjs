const test = require('node:test');
const assert = require('node:assert/strict');
const { RetentionService } = require('../dist/retention/retention.service.js');

function withEnv(value, callback) {
  const previous = process.env.RETENTION_CLEANUP_ENABLED;
  if (value === undefined) {
    delete process.env.RETENTION_CLEANUP_ENABLED;
  } else {
    process.env.RETENTION_CLEANUP_ENABLED = value;
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previous === undefined) {
        delete process.env.RETENTION_CLEANUP_ENABLED;
      } else {
        process.env.RETENTION_CLEANUP_ENABLED = previous;
      }
    });
}

test('RetentionService cleanup is disabled unless explicitly enabled', async () => {
  const calls = [];
  const service = new RetentionService({
    async query(sql, params = []) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  });

  const result = await withEnv(undefined, () => service.cleanup());

  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0);
});

test('RetentionService cleanup executes only when RETENTION_CLEANUP_ENABLED=true', async () => {
  const calls = [];
  const service = new RetentionService({
    async query(sql, params = []) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  });

  const result = await withEnv('true', () => service.cleanup());

  assert.equal(result.skipped, false);
  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /DELETE FROM conversations/i);
  assert.match(calls[1].sql, /DELETE FROM widget_leads/i);
  assert.match(calls[2].sql, /DELETE FROM report_runs/i);
});

test('RetentionService cleanup keeps delete statements site-scoped', async () => {
  const calls = [];
  const service = new RetentionService({
    async query(sql, params = []) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  });

  await withEnv('true', () => service.cleanup());

  assert.equal(calls.length, 3);
  assert.equal(calls.every((call) => /USING sites s/i.test(call.sql)), true);
  assert.equal(calls.every((call) => /s\.id\s*=\s*\w+\.site_id/i.test(call.sql)), true);
});

test('RetentionService dryRun counts site-scoped candidates without deleting data', async () => {
  const calls = [];
  const service = new RetentionService({
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/FROM conversations/i.test(sql)) return { rows: [{ count: '2' }] };
      if (/FROM widget_leads/i.test(sql)) return { rows: [{ count: '3' }] };
      if (/FROM report_runs/i.test(sql)) return { rows: [{ count: '4' }] };
      return { rows: [{ count: '0' }] };
    },
  });

  const result = await service.dryRun('site-a');

  assert.deepEqual(result.deletable, {
    conversations: 2,
    leads: 3,
    reports: 4,
  });
  assert.equal(calls.length, 3);
  assert.equal(calls.every((call) => call.params[0] === 'site-a'), true);
  assert.equal(calls.every((call) => !/DELETE|UPDATE|INSERT/i.test(call.sql)), true);
});
