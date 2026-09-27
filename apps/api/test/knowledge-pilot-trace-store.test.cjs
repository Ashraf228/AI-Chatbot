const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const store = require('../dist/ai/chat-pipeline/knowledge-pilot-trace-store');
const { runKnowledgePilotTraceCommand } = require('../dist/ai/chat-pipeline/knowledge-pilot-trace-cli');
const { beginKnowledgePilotTrace } = require('../dist/ai/chat-pipeline/knowledge-pilot-trace');

const TMPFS = 0x01021994;
const nativeTmpfs = process.platform === 'linux' && fs.existsSync('/dev/shm') && fs.statfsSync('/dev/shm').type === TMPFS;
const scope = { tenantId: 'synthetic-tenant', siteId: 'synthetic-site' };
function fixture(t, { disk = false } = {}) {
  const base = !disk && nativeTmpfs ? '/dev/shm' : fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(base, 'knowledge-trace-test-'));
  const before = process.env.KNOWLEDGE_PILOT_TRACE_DIR;
  process.env.KNOWLEDGE_PILOT_TRACE_DIR = dir;
  // Portable file-safety unit tests; the Linux integration below uses real tmpfs.
  if (!disk && !nativeTmpfs) t.mock.method(fs, 'statfsSync', () => ({ type: TMPFS }));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (before === undefined) delete process.env.KNOWLEDGE_PILOT_TRACE_DIR;
    else process.env.KNOWLEDGE_PILOT_TRACE_DIR = before;
  });
  const identity = { ...scope, traceId: randomUUID() };
  const event = { schemaVersion: 1, ...identity, conversationId: 'conversation-1', sessionId: 'session-1',
    mode: 'normal', at: new Date().toISOString(), phase: 'prepared' };
  return { dir, identity, event };
}

test('private store writes ordered stages, scopes lookup and deletes only the exact trace', (t) => {
  const { dir, identity, event } = fixture(t);
  const one = store.createKnowledgePilotTraceSink(identity);
  assert.equal(one.write(event), true);
  assert.equal(one.write({ ...event, phase: 'validated' }), true);
  const other = { ...identity, tenantId: 'other-tenant', traceId: randomUUID() };
  assert.equal(store.createKnowledgePilotTraceSink(other).write({ ...event, ...other }), true);
  const otherBefore = store.readKnowledgePilotTrace(other);
  assert.deepEqual(store.listKnowledgePilotTraces(scope, 'session-1'), { traces: [{ traceId: identity.traceId, events: 2 }] });
  assert.deepEqual(store.listKnowledgePilotTraces(scope, 'other-session'), { traces: [] });
  assert.deepEqual(store.listKnowledgePilotTraces({ ...scope, siteId: 'other-site' }, 'session-1'), { traces: [] });
  assert.throws(() => store.readKnowledgePilotTrace({ ...identity, tenantId: 'other-tenant' }));
  assert.deepEqual(store.deleteKnowledgePilotTrace({ ...identity, siteId: 'other-site' }), { deleted: false, absent: true });
  assert.deepEqual(store.readKnowledgePilotTrace(identity).events.map((entry) => entry.phase), ['prepared', 'validated']);
  for (const file of fs.readdirSync(dir)) assert.equal(fs.statSync(path.join(dir, file)).mode & 0o7777, 0o600);
  assert.deepEqual(store.deleteKnowledgePilotTrace(identity), { deleted: true, absent: true });
  assert.throws(() => store.readKnowledgePilotTrace(identity), { code: 'ENOENT' });
  assert.deepEqual(store.deleteKnowledgePilotTrace(identity), { deleted: false, absent: true });
  assert.deepEqual(store.readKnowledgePilotTrace(other), otherBefore);
  assert.equal(fs.readdirSync(dir).length, 1);
});

test('deletion before generation completes never recreates the file', (t) => {
  const { dir, identity, event } = fixture(t);
  const sink = store.createKnowledgePilotTraceSink(identity);
  assert.equal(sink.write(event), true);
  assert.equal(store.deleteKnowledgePilotTrace(identity).deleted, true);
  assert.equal(sink.write({ ...event, phase: 'validated' }), false);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('an existing trace is never overwritten and a replaced file is not appended to', (t) => {
  const { dir, identity, event } = fixture(t);
  const sink = store.createKnowledgePilotTraceSink(identity);
  assert.equal(sink.write(event), true);
  const filename = path.join(dir, fs.readdirSync(dir)[0]);
  const before = fs.readFileSync(filename);
  assert.equal(store.createKnowledgePilotTraceSink(identity).write(event), false);
  assert.deepEqual(fs.readFileSync(filename), before);
  // Keep the original inode open so the replacement cannot immediately reuse it.
  const held = fs.openSync(filename, 'r');
  try {
    fs.unlinkSync(filename);
    fs.writeFileSync(filename, 'SYNTHETIC_REPLACEMENT', { mode: 0o600 });
    assert.equal(sink.write({ ...event, phase: 'validated' }), false);
    assert.equal(fs.readFileSync(filename, 'utf8'), 'SYNTHETIC_REPLACEMENT');
  } finally { fs.closeSync(held); }
});

test('missing configuration and persistent filesystem never enable a trace sink', (t) => {
  const { dir, identity } = fixture(t, { disk: true });
  t.mock.method(fs, 'statfsSync', () => ({ type: 0xEF53 }));
  assert.equal(store.knowledgePilotTraceStatus().ready, false);
  assert.throws(() => store.createKnowledgePilotTraceSink(identity));
  delete process.env.KNOWLEDGE_PILOT_TRACE_DIR;
  assert.equal(store.knowledgePilotTraceStatus().ready, false);
  assert.throws(() => store.createKnowledgePilotTraceSink(identity));
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('partial first write removes only its newly created file and never logs an error payload', (t) => {
  const { dir, identity, event } = fixture(t);
  const other = { ...identity, traceId: randomUUID() };
  assert.equal(store.createKnowledgePilotTraceSink(other).write({ ...event, ...other }), true);
  const before = fs.readdirSync(dir);
  t.mock.method(fs, 'writeSync', () => 0);
  const log = t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  assert.equal(store.createKnowledgePilotTraceSink(identity).write(event), false);
  assert.deepEqual(fs.readdirSync(dir), before);
  assert.equal(log.mock.callCount(), 0);
  assert.equal(error.mock.callCount(), 0);
});

test('a replaced storage directory cannot receive a late generation stage', (t) => {
  const { dir, identity, event } = fixture(t);
  const sink = store.createKnowledgePilotTraceSink(identity);
  assert.equal(sink.write(event), true);
  const retired = `${dir}-retired`;
  fs.renameSync(dir, retired);
  t.after(() => fs.rmSync(retired, { recursive: true, force: true }));
  fs.mkdirSync(dir, 0o700);
  assert.equal(sink.write({ ...event, phase: 'validated' }), false);
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.equal(fs.readdirSync(retired).length, 1);
});

test('unsafe directory permissions, aliases, missing paths and writable ancestors fail closed', (t) => {
  const { dir, identity } = fixture(t);
  fs.chmodSync(dir, 0o755);
  assert.throws(() => store.createKnowledgePilotTraceSink(identity));
  fs.chmodSync(dir, 0o700);
  for (const unsafe of ['relative-directory', `${dir}/../${path.basename(dir)}`, `${dir}/missing`]) {
    process.env.KNOWLEDGE_PILOT_TRACE_DIR = unsafe;
    assert.throws(() => store.createKnowledgePilotTraceSink(identity));
  }
  const child = path.join(dir, 'child'); fs.mkdirSync(child, 0o700);
  fs.chmodSync(dir, 0o777);
  process.env.KNOWLEDGE_PILOT_TRACE_DIR = child;
  assert.throws(() => store.createKnowledgePilotTraceSink(identity));
  fs.chmodSync(dir, 0o700);
  const alias = path.join(dir, 'alias'); fs.symlinkSync(child, alias);
  process.env.KNOWLEDGE_PILOT_TRACE_DIR = alias;
  assert.throws(() => store.createKnowledgePilotTraceSink(identity));
});

for (const attack of ['symlink', 'hardlink', 'permissions']) test(`${attack} cannot redirect trace reads, writes or deletion`, (t) => {
  const { dir, identity, event } = fixture(t);
  const sink = store.createKnowledgePilotTraceSink(identity);
  assert.equal(sink.write(event), true);
  const filename = path.join(dir, fs.readdirSync(dir)[0]);
  const outside = `${dir}-external`;
  fs.writeFileSync(outside, 'UNRELATED_SYNTHETIC_FILE', { mode: 0o600 });
  t.after(() => fs.rmSync(outside, { force: true }));
  if (attack === 'permissions') fs.chmodSync(filename, 0o644);
  else { fs.unlinkSync(filename); if (attack === 'symlink') fs.symlinkSync(outside, filename); else fs.linkSync(outside, filename); }
  assert.equal(sink.write({ ...event, phase: 'validated' }), false);
  assert.throws(() => store.readKnowledgePilotTrace(identity));
  assert.throws(() => store.deleteKnowledgePilotTrace(identity));
  assert.equal(fs.readFileSync(outside, 'utf8'), 'UNRELATED_SYNTHETIC_FILE');
});

test('scope and attempt identifiers cannot become paths or broad deletion patterns', (t) => {
  const { identity, event } = fixture(t);
  for (const bad of [{ ...identity, tenantId: '../escape' }, { ...identity, siteId: '*' },
    { ...identity, traceId: '../../anything' }, { ...identity, traceId: '*' }, { ...identity, tenantId: undefined }]) {
    assert.throws(() => store.createKnowledgePilotTraceSink(bad));
    assert.throws(() => store.readKnowledgePilotTrace(bad));
    assert.throws(() => store.deleteKnowledgePilotTrace(bad));
  }
  const sink = store.createKnowledgePilotTraceSink(identity);
  assert.equal(sink.write({ ...event, tenantId: 'other-tenant' }), false);
});

test('event, file and directory bounds stop writes without truncating existing evidence', (t) => {
  const { dir, identity, event } = fixture(t);
  assert.equal(store.createKnowledgePilotTraceSink(identity).write({ ...event, oversized: 'x'.repeat(65536) }), false);
  assert.deepEqual(fs.readdirSync(dir), []);
  const sink = store.createKnowledgePilotTraceSink(identity);
  assert.equal(sink.write(event), true);
  assert.equal(sink.write({ ...event, phase: 'validated' }), true);
  assert.equal(sink.write({ ...event, phase: 'generation_failed' }), false);
  for (let i = 1; i < 32; i++) {
    const next = { ...identity, traceId: randomUUID() };
    assert.equal(store.createKnowledgePilotTraceSink(next).write({ ...event, ...next }), true);
  }
  const last = { ...identity, traceId: randomUUID() };
  assert.equal(store.createKnowledgePilotTraceSink(last).write({ ...event, ...last }), false);
  assert.equal(fs.readdirSync(dir).length, 32);
  assert.equal(store.knowledgePilotTraceStatus().ready, false);
  assert.deepEqual(store.readKnowledgePilotTrace(identity).events.map((entry) => entry.phase), ['prepared', 'validated']);
});

test('corrupt or mismatched evidence is not exported but an owned partial file can be deleted', (t) => {
  const { dir, identity, event } = fixture(t);
  assert.equal(store.createKnowledgePilotTraceSink(identity).write(event), true);
  const filename = path.join(dir, fs.readdirSync(dir)[0]);
  const before = fs.readFileSync(filename, 'utf8');
  fs.writeFileSync(filename, before.replaceAll(scope.tenantId, 'other-tenant'));
  assert.throws(() => store.readKnowledgePilotTrace(identity));
  fs.writeFileSync(filename, '{incomplete');
  assert.throws(() => store.readKnowledgePilotTrace(identity));
  assert.deepEqual(store.deleteKnowledgePilotTrace(identity), { deleted: true, absent: true });
});

test('provider-free probe verifies write/read/delete on its own file and preserves other traces', (t) => {
  const { dir, identity, event } = fixture(t);
  assert.equal(store.createKnowledgePilotTraceSink(identity).write(event), true);
  const files = fs.readdirSync(dir);
  assert.deepEqual(store.probeKnowledgePilotTraceStore(scope), { ready: true, readBack: true, deleted: true, absent: true });
  assert.deepEqual(fs.readdirSync(dir), files);
  assert.deepEqual(store.readKnowledgePilotTrace(identity).events, [event]);
});

test('real diagnostic helper persists allowlisted metadata without stdout/stderr and deletes precisely', (t) => {
  const { dir } = fixture(t);
  const before = process.env.SITE_PILOT_ACCESS_RULES_JSON;
  const now = Date.now();
  process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([{ ...scope, tokenSha256: 'a'.repeat(64),
    validFrom: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(), traceKnowledgeSelection: true }]);
  t.after(() => { if (before === undefined) delete process.env.SITE_PILOT_ACCESS_RULES_JSON; else process.env.SITE_PILOT_ACCESS_RULES_JSON = before; });
  const log = t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  const hit = { id: 'chunk-1', document_id: 'document-1', source_id: 'source-1', score: 0.7,
    content: 'PRIVATE_DOCUMENT_TEXT', title: 'PRIVATE_TITLE', source_url: 'PRIVATE_URL', metadata: { secret: 'PRIVATE_METADATA' } };
  const trace = beginKnowledgePilotTrace({ ...scope, sessionId: 'session-1', conversationId: 'conversation-1', mode: 'normal' }, [hit], [hit]);
  assert.ok(trace);
  trace.validated([hit], true);
  const [{ traceId }] = store.listKnowledgePilotTraces(scope, 'session-1').traces;
  const identity = { ...scope, traceId };
  const stored = store.readKnowledgePilotTrace(identity);
  assert.deepEqual(stored.events.map((entry) => entry.phase), ['prepared', 'validated']);
  assert.equal(JSON.stringify(stored).includes('PRIVATE_'), false);
  assert.equal(log.mock.callCount(), 0);
  assert.equal(error.mock.callCount(), 0);
  assert.equal(store.deleteKnowledgePilotTrace(identity).absent, true);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('operator CLI requires exact commands and scope options', (t) => {
  const { identity, event } = fixture(t);
  assert.equal(store.createKnowledgePilotTraceSink(identity).write(event), true);
  const args = ['--tenant-id', scope.tenantId, '--site-id', scope.siteId, '--trace-id', identity.traceId];
  assert.equal(runKnowledgePilotTraceCommand(['status']).ready, true);
  assert.equal(runKnowledgePilotTraceCommand(['read', ...args]).traceId, identity.traceId);
  for (const bad of [['delete'], ['delete', ...args, '--all', 'true'], ['delete', ...args.slice(0, -2)],
    ['delete', '--tenant-id', scope.tenantId, '--tenant-id', scope.tenantId, '--trace-id', identity.traceId], ['unknown']]) {
    assert.throws(() => runKnowledgePilotTraceCommand(bad));
  }
  assert.equal(runKnowledgePilotTraceCommand(['delete', ...args]).deleted, true);
});

test('packaged CLI reports storage failure without filesystem or input content', (t) => {
  fixture(t);
  const result = spawnSync(process.execPath, [path.join(__dirname, '../dist/ai/chat-pipeline/knowledge-pilot-trace-cli.js'),
    'read', '--tenant-id', scope.tenantId, '--site-id', scope.siteId, '--trace-id', randomUUID()], {
    encoding: 'utf8', env: { ...process.env, KNOWLEDGE_PILOT_TRACE_DIR: '/PRIVATE_TRACE_PATH/does-not-exist' }, timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Knowledge pilot trace operation failed.\n');
  assert.equal((result.stdout + result.stderr).includes('PRIVATE_TRACE_PATH'), false);
});

test('Linux CLI probe exercises real tmpfs with no mocked filesystem and no retained file', { skip: !nativeTmpfs }, (t) => {
  const { dir } = fixture(t);
  const result = spawnSync(process.execPath, [path.join(__dirname, '../dist/ai/chat-pipeline/knowledge-pilot-trace-cli.js'),
    'probe', '--tenant-id', scope.tenantId, '--site-id', scope.siteId], { encoding: 'utf8', env: { ...process.env }, timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ready: true, readBack: true, deleted: true, absent: true });
  assert.equal(result.stderr, '');
  assert.deepEqual(fs.readdirSync(dir), []);
});
