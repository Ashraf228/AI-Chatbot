const test = require('node:test');
const assert = require('node:assert/strict');
const { VectorService } = require('../dist/vector/vector.service.js');

test('VectorService adds demo and synthetic filters only for evaluation retrieval', async () => {
  const calls = [];
  const vector = new VectorService({
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  });

  await vector.search('tenant-1', 'site-1', [0.1, 0.2], 6);
  await vector.search('tenant-1', 'site-1', [0.1, 0.2], 6, undefined, { demoOnly: true });

  assert.equal(calls[0].params[5], false);
  assert.equal(calls[1].params[5], true);
  assert.match(calls[1].sql, /c\.metadata->>'demo' = 'true'/);
  assert.match(calls[1].sql, /c\.metadata->>'synthetic' = 'true'/);
  assert.match(calls[1].sql, /ks\.config->>'demo'/);
  assert.match(calls[1].sql, /ks\.config->>'synthetic'/);
});
