const test = require('node:test'), assert = require('node:assert/strict');
const { EventEmitter } = require('node:events'), { PassThrough } = require('node:stream');
const path = require('node:path'), Redis = require('ioredis');
const { closeHandler } = require('ioredis/built/redis/event_handler');
const { sourceLoader } = require('./helpers/reporter-source.cjs');
const { RateLimitService } = sourceLoader(path.resolve(__dirname, '../../..'), {
  '@nestjs/common': { Injectable: () => target => target }, ioredis: Redis,
})('apps/api/src/utils/rate-limit.service.ts');
const turn = () => new Promise(resolve => setImmediate(resolve));
function service(redis) { const s = Object.create(RateLimitService.prototype); s.redis = redis; return s; }
test('real ioredis: end before QUIT rejection retains cause and rejects the lifecycle', async () => {
  const redis = new Redis({ lazyConnect: true });
  redis.status = 'ready'; redis.condition = { select: 0 }; redis.stream = new PassThrough();
  const quit = redis.quit.bind(redis); let cause;
  redis.quit = () => { const p = quit(); p.catch(e => { cause = e; }); return p; };
  const s = service(redis), closing = s.onModuleDestroy();
  const assertion = assert.rejects(closing, error => error.code === 'redis_quit_failed' && error.cause === cause && /Connection is closed/.test(cause.message));
  assert.equal(s.onModuleDestroy(), closing); assert.equal(redis.commandQueue.length, 1);
  closeHandler(redis)(); await assertion;
  assert.equal(redis.status, 'end'); assert.equal(redis.listenerCount('end'), 0);
});
for (const order of ['quit-first', 'end-first']) test(`successful shutdown waits for both boundaries: ${order}`, async () => {
  const redis = new EventEmitter(); let ok, calls = 0, finished = false;
  redis.quit = () => { calls++; return new Promise(resolve => { ok = resolve; }); };
  const s = service(redis), closing = s.onModuleDestroy().then(() => { finished = true; });
  if (order === 'quit-first') ok('OK'); else redis.emit('end');
  await turn(); assert.equal(finished, false);
  if (order === 'quit-first') redis.emit('end'); else ok('OK');
  await closing; await s.onModuleDestroy(); assert.equal(calls, 1); assert.equal(redis.listenerCount('end'), 0);
});
for (const synchronous of [true, false]) test(`QUIT error preserves original cause and stack, sync=${synchronous}`, async () => {
  const redis = new EventEmitter(), cause = Object.assign(Error('synthetic-private-error'), { code: 'ECONNRESET' });
  redis.quit = () => { if (synchronous) throw cause; return Promise.reject(cause); };
  await assert.rejects(service(redis).onModuleDestroy(), e => e.code === 'redis_quit_failed' && e.cause === cause && e.cause.stack === cause.stack);
  assert.equal(redis.listenerCount('end'), 0);
});
