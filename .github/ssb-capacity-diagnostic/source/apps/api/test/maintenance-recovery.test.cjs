const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { MaintenanceState } = require('../dist/maintenance/maintenance-state');

function fixture(t, empty = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-recovery-'));
  fs.chmodSync(root, 0o700);
  const binding = { root, service: 'synthetic-api', generation: 'g1' };
  const state = new MaintenanceState(binding);
  state.initializeClosed();
  if (empty) {
    const file = path.join(root, 'runtime-state.json'), data = JSON.parse(fs.readFileSync(file));
    data.legacy = 'new-empty-service'; data.phase = 'open';
    fs.writeFileSync(file, JSON.stringify(data));
  }
  const owner = 'a'.repeat(64);
  fs.mkdirSync(path.join(root, 'maintenance-window'), { mode: 0o700 });
  fs.writeFileSync(path.join(root, 'maintenance-window/owner.json'), JSON.stringify({ version: 1, owner }), { mode: 0o600 });
  t.after(() => fs.rmSync(root, { recursive: true }));
  return { root, binding, state, owner };
}

function admitted(f) {
  fs.renameSync(path.join(f.root, 'maintenance-window'), path.join(f.root, 'held-window'));
  const id = f.state.begin('provider');
  fs.renameSync(path.join(f.root, 'held-window'), path.join(f.root, 'maintenance-window'));
  return id;
}

function receiptWithFailedAccounting(f) {
  const id = admitted(f);
  fs.mkdirSync(path.join(f.root, 'runtime-state-mutex'), { mode: 0o700 });
  assert.throws(() => f.state.end(id), /EEXIST/);
  fs.rmdirSync(path.join(f.root, 'runtime-state-mutex'));
  return id;
}

test('first bootstrap is unverified and closed, cannot overwrite state or admit old work', t => {
  const f = fixture(t);
  assert.equal(f.state.snapshot().legacy, 'unverified');
  assert.throws(() => f.state.initializeClosed(), /EEXIST/);
  assert.throws(() => f.state.begin('http'));
  f.state.admitGeneration(f.owner, 0, 'g2');
  for (const generation of ['g2', 'g1']) {
    const next = new MaintenanceState({ ...f.binding, generation });
    assert.equal(next.snapshot().phase, 'closed');
    assert.throws(() => next.open(f.owner, 0));
    assert.throws(() => next.begin('worker'));
  }
});

test('durable successful completion reconciles once in the held window without reopening or replay', t => {
  const f = fixture(t, true), id = receiptWithFailedAccounting(f), epoch = f.state.close(f.owner);
  assert.throws(() => f.state.drained(f.owner, epoch));
  assert.deepEqual(f.state.recoverCompleted(f.owner, epoch, id), { id, recovered: true, alreadyApplied: false });
  assert.equal(f.state.recoverCompleted(f.owner, epoch, id).alreadyApplied, true);
  assert.equal(f.state.snapshot().phase, 'closed');
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
  f.state.open(f.owner, epoch);
  assert.throws(() => f.state.begin('provider')); // Process-local latch is NOT reset by recovery.
  assert.throws(() => f.state.begin('http')); // Window is still held.
});

test('foreign, incomplete, stale and reused completion proofs fail closed', t => {
  const f = fixture(t, true), id = receiptWithFailedAccounting(f), epoch = f.state.close(f.owner);
  const file = path.join(f.root, `completion-${id}.json`), original = fs.readFileSync(file);
  assert.throws(() => f.state.recoverCompleted('b'.repeat(64), epoch, id));
  assert.throws(() => f.state.recoverCompleted(f.owner, epoch + 1, id));
  for (const change of [{ service: 'foreign' }, { generation: 'g0' }, { process: 'foreign' }, { outcome: 'unknown' }, { id: 'foreign' }]) {
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(original), ...change }));
    assert.throws(() => f.state.recoverCompleted(f.owner, epoch, id));
  }
  fs.writeFileSync(file, original);
  f.state.recoverCompleted(f.owner, epoch, id);
  fs.writeFileSync(path.join(f.root, 'maintenance-window/owner.json'), JSON.stringify({ version: 1, owner: 'b'.repeat(64) }));
  assert.throws(() => f.state.recoverCompleted('b'.repeat(64), epoch, id), e => e.code === 'completion_reused');
});

test('unknown provider outcome has no completion receipt and stays blocked in successor and rollback', t => {
  const f = fixture(t, true), id = admitted(f);
  f.state.end(id, true);
  const epoch = f.state.close(f.owner);
  assert.throws(() => f.state.recoverCompleted(f.owner, epoch, id), e => e.code === 'completion_missing');
  f.state.admitGeneration(f.owner, epoch, 'g2');
  for (const generation of ['g2', 'g1']) {
    const next = new MaintenanceState({ ...f.binding, generation });
    assert.equal(next.snapshot().work[id].state, 'uncertain');
    assert.throws(() => next.drained(f.owner, epoch));
    assert.throws(() => next.begin('provider'));
  }
});

test('real process loss after receipt publication before accounting preserves evidence for explicit recovery', t => {
  const f = fixture(t, true);
  fs.renameSync(path.join(f.root, 'maintenance-window'), path.join(f.root, 'held-window'));
  const modulePath = require.resolve('../dist/maintenance/maintenance-state');
  const child = cp.spawnSync(process.execPath, ['-e', `
    const fs=require('fs');const {MaintenanceState}=require(${JSON.stringify(modulePath)});
    const s=new MaintenanceState(${JSON.stringify(f.binding)}),id=s.begin('provider');
    process.stdout.write(id); const mkdir=fs.mkdirSync;
    fs.mkdirSync=(name,...args)=>{if(name.endsWith('runtime-state-mutex'))process.exit(73);return mkdir(name,...args)};
    s.end(id);
  `], { encoding: 'utf8', timeout: 5000 });
  assert.equal(child.status, 73);
  const id = child.stdout;
  fs.renameSync(path.join(f.root, 'held-window'), path.join(f.root, 'maintenance-window'));
  assert.equal(f.state.snapshot().work[id].state, 'running');
  const epoch = f.state.close(f.owner);
  f.state.recoverCompleted(f.owner, epoch, id);
  const restarted = new MaintenanceState(f.binding);
  assert.equal(restarted.recoverCompleted(f.owner, epoch, id).alreadyApplied, true);
  assert.equal(restarted.snapshot().phase, 'closed');
});

test('loss inside the journal critical section is not recovered by deleting its mutex', t => {
  const f = fixture(t, true), id = receiptWithFailedAccounting(f), epoch = f.state.close(f.owner);
  fs.mkdirSync(path.join(f.root, 'runtime-state-mutex'), { mode: 0o700 });
  assert.throws(() => f.state.recoverCompleted(f.owner, epoch, id), /EEXIST/);
  assert.equal(fs.statSync(path.join(f.root, 'runtime-state-mutex')).isDirectory(), true);
});

function runtimeFixture(t) {
  const f = fixture(t, true), names = ['APP_ENV', 'MAINTENANCE_STATE_ROOT', 'MAINTENANCE_SERVICE', 'MAINTENANCE_GENERATION'];
  const prior = names.map(name => process.env[name]), fetch = globalThis.fetch;
  Object.assign(process.env, { APP_ENV: 'production', MAINTENANCE_STATE_ROOT: f.root,
    MAINTENANCE_SERVICE: f.binding.service, MAINTENANCE_GENERATION: f.binding.generation });
  t.after(() => { globalThis.fetch = fetch; names.forEach((name, i) => prior[i] === undefined ? delete process.env[name] : process.env[name] = prior[i]); });
  return { ...f, runtime: require('../dist/maintenance/maintenance-runtime') };
}

// First completion really contends on the journal; a later erroneous end(true) would succeed.
function failFirstCompletion(state, root) {
  const end = state.end.bind(state), mutex = path.join(root, 'runtime-state-mutex');
  let attempts = 0;
  state.end = (...args) => {
    if (++attempts !== 1) return end(...args);
    fs.mkdirSync(mutex, { mode: 0o700 });
    try { return end(...args); }
    finally { fs.rmdirSync(mutex); }
  };
  return () => attempts;
}

for (const body of ['synthetic completed body', null]) {
  test(`successful Fetch ${body === null ? 'bodyless' : 'EOF'} remains recoverable after completion accounting fails`, async t => {
    const f = runtimeFixture(t);
    fs.renameSync(path.join(f.root, 'maintenance-window'), path.join(f.root, 'held-window'));
    const actual = f.runtime.runtimeState(), attempts = failFirstCompletion(actual, f.root);
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(body); };
    await assert.rejects(async () => { const response = await f.runtime.maintenanceFetch('https://synthetic.example.test'); await response.text(); }, { code: 'EEXIST' });
    fs.renameSync(path.join(f.root, 'held-window'), path.join(f.root, 'maintenance-window'));
    assert.equal(attempts(), 1);
    const [id] = Object.keys(f.state.snapshot().work), epoch = f.state.close(f.owner);
    assert.equal(f.state.snapshot().work[id].state, 'running');
    f.state.recoverCompleted(f.owner, epoch, id);
    assert.equal(f.state.drained(f.owner, epoch).completed, true);
    assert.throws(() => actual.begin('provider'));
    assert.equal(calls, 1);
  });
}

test('successful owner effect is receipted before fallible completion accounting, without action replay', async t => {
  const f = fixture(t, true), epoch = f.state.close(f.owner);
  const { MaintenanceExecutor } = require('../../../scripts/ops/maintenance-executor.cjs');
  const executor = new MaintenanceExecutor(f.binding), attempts = failFirstCompletion(executor.state, f.root);
  let effects = 0;
  await assert.rejects(executor.mutate(f.owner, epoch, 'configuration', async () => { effects++; return 'synthetic'; }), { code: 'EEXIST' });
  assert.equal(attempts(), 1);
  const [id] = Object.keys(f.state.snapshot().work);
  f.state.recoverCompleted(f.owner, epoch, id);
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
  assert.equal(effects, 1);
});

test('successful owner effect retains its receipt but stale post-action epoch never commits completion', async t => {
  const f = fixture(t, true), epoch = f.state.close(f.owner);
  const { MaintenanceExecutor } = require('../../../scripts/ops/maintenance-executor.cjs');
  const executor = new MaintenanceExecutor(f.binding);
  await assert.rejects(executor.mutate(f.owner, epoch, 'configuration', async () => {
    const file = path.join(f.root, 'runtime-state.json'), data = JSON.parse(fs.readFileSync(file));
    data.epoch++;
    fs.writeFileSync(file, JSON.stringify(data));
  }), { code: 'epoch_changed' });
  const snapshot = f.state.snapshot(), [id] = Object.keys(snapshot.work);
  assert.equal(snapshot.work[id].state, 'running');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, `completion-${id}.json`))).outcome, 'completed');
  assert.throws(() => f.state.drained(f.owner, epoch));
  assert.throws(() => f.state.recoverCompleted(f.owner, epoch, id));
});

test('completed journal with receipt cleanup failure reconciles idempotently in one window', t => {
  const f = fixture(t, true), id = admitted(f), unlink = fs.unlinkSync;
  fs.unlinkSync = (file, ...args) => {
    if (file === path.join(f.root, `completion-${id}.json`)) throw Object.assign(Error('synthetic receipt cleanup'), { code: 'EIO' });
    return unlink(file, ...args);
  };
  try { assert.throws(() => f.state.end(id), { code: 'EIO' }); }
  finally { fs.unlinkSync = unlink; }
  const epoch = f.state.close(f.owner);
  assert.equal(f.state.snapshot().work[id].state, 'completed');
  assert.equal(f.state.recoverCompleted(f.owner, epoch, id).alreadyApplied, true);
  assert.equal(new MaintenanceState(f.binding).recoverCompleted(f.owner, epoch, id).alreadyApplied, true);
});

test('process loss after normal completion before receipt deletion preserves idempotent recovery', t => {
  const f = fixture(t, true);
  fs.renameSync(path.join(f.root, 'maintenance-window'), path.join(f.root, 'held-window'));
  const child = cp.spawnSync(process.execPath, ['-e', `
    const fs=require('fs');const {MaintenanceState}=require(${JSON.stringify(require.resolve('../dist/maintenance/maintenance-state'))});
    const s=new MaintenanceState(${JSON.stringify(f.binding)}),id=s.begin('provider');process.stdout.write(id);
    const unlink=fs.unlinkSync;fs.unlinkSync=(name,...args)=>{if(name.endsWith('completion-'+id+'.json'))process.exit(74);return unlink(name,...args)};
    s.end(id);
  `], { encoding: 'utf8', timeout: 5000 });
  assert.equal(child.status, 74);
  fs.renameSync(path.join(f.root, 'held-window'), path.join(f.root, 'maintenance-window'));
  const epoch = f.state.close(f.owner);
  assert.equal(f.state.recoverCompleted(f.owner, epoch, child.stdout).alreadyApplied, true);
  assert.equal(f.state.snapshot().phase, 'closed');
});

test('uncertain completion cannot be replaced with a success receipt after failed accounting', t => {
  const f = fixture(t, true), id = admitted(f);
  fs.mkdirSync(path.join(f.root, 'runtime-state-mutex'), { mode: 0o700 });
  assert.throws(() => f.state.end(id, true));
  fs.rmdirSync(path.join(f.root, 'runtime-state-mutex'));
  f.state.end(id);
  assert.equal(f.state.snapshot().work[id].state, 'uncertain');
  assert.equal(fs.existsSync(path.join(f.root, `completion-${id}.json`)), false);
});
