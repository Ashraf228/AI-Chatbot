const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { sourceLoader } = require('./helpers/reporter-source.cjs');
const { MaintenanceState } = sourceLoader(path.resolve(__dirname, '../../..'))('apps/api/src/maintenance/maintenance-state.ts');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-lifecycle-')));
  fs.chmodSync(root, 0o700);
  fs.writeFileSync(path.join(root, 'runtime-state.json'), JSON.stringify({ version: 1, service: 'synthetic',
    generations: ['release'], epoch: 0, phase: 'closed', legacy: 'new-empty-service', work: {} }), { mode: 0o600 });
  const owner = 'b'.repeat(64);
  const window = () => {
    fs.mkdirSync(path.join(root, 'maintenance-window'), { mode: 0o700 });
    fs.writeFileSync(path.join(root, 'maintenance-window/owner.json'), JSON.stringify({ version: 1, owner }), { mode: 0o600 });
  };
  window();
  const state = generation => new MaintenanceState({ root, service: 'synthetic', generation });
  const open = generation => {
    const s = state(generation); s.open(owner, s.snapshot().epoch);
    fs.unlinkSync(path.join(root, 'maintenance-window/owner.json')); fs.rmdirSync(path.join(root, 'maintenance-window'));
  };
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, owner, state, open, window };
}
function child(t, f, mode = 'success', generation = 'release', missing = false) {
  const env = { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH, NODE_OPTIONS: '',
    APP_ENV: 'production', NODE_ENV: 'production', MAINTENANCE_STATE_ROOT: f.root,
    MAINTENANCE_SERVICE: 'synthetic', MAINTENANCE_GENERATION: generation,
    REPORTER_API_BASE_URL: 'https://synthetic.invalid', REPORTER_API_TOKEN: 's'.repeat(64),
    REPORTER_SITE_BINDINGS: '[{"tenantId":"synthetic-tenant","siteId":"synthetic-site"}]',
    SMTP_HOST: 'synthetic.invalid', SMTP_USER: 'synthetic', SMTP_PASS: 'synthetic' };
  if (missing) delete env.MAINTENANCE_SERVICE;
  const p = spawn(process.execPath, [path.join(__dirname, 'helpers/reporter-lifecycle-child.cjs'), mode], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stdout = '', stderr = ''; const messages = [], waiters = [];
  p.stdout.on('data', b => { stdout += b; }); p.stderr.on('data', b => { stderr += b; });
  p.on('message', m => { messages.push(m); for (const w of waiters) if (w.predicate(m)) w.resolve(m); });
  const exit = new Promise((resolve, reject) => { p.on('error', reject); p.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr })); });
  const next = predicate => messages.find(predicate) ? Promise.resolve(messages.find(predicate)) : Promise.race([
    new Promise(resolve => waiters.push({ predicate, resolve })), exit.then(r => { throw Error('early reporter exit: ' + JSON.stringify(r)); }),
  ]);
  t.after(async () => { if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL'); await exit; });
  return { p, exit, next, messages };
}
const counters = r => JSON.parse(r.stdout.trim().split('\n').at(-1));
test('real reporter main: release -> recovery -> normal remains closed, transport-free and stoppable', { timeout: 7000 }, async t => {
  const f = fixture(t); let previous = 'release';
  for (const generation of ['release', 'recovery', 'normal']) {
    if (generation !== previous) f.state(previous).activateGeneration(f.owner, f.state(previous).snapshot().epoch, generation);
    const c = child(t, f, 'success', generation); await c.next(m => m.waiting);
    await delay(60); assert.equal(c.p.exitCode, null); assert.equal(c.messages.some(m => m.transport), false);
    c.p.kill('SIGTERM'); const r = await c.exit;
    assert.equal(r.code, 0); assert.equal(r.signal, null); assert.match(r.stdout, /reporter_shutdown_complete/);
    assert.equal(counters(r).requests, 0); assert.equal(counters(r).sends, 0);
    assert.equal(f.state(generation).snapshot().phase, 'closed'); assert.equal(f.state(generation).drained(f.owner, f.state(generation).snapshot().epoch).completed, true);
    previous = generation;
  }
});
test('real reporter starts its existing weekly job only after explicit journal release', { timeout: 5000 }, async t => {
  const f = fixture(t), c = child(t, f); await c.next(m => m.waiting);
  f.open('release'); const r = await c.exit;
  assert.equal(r.code, 0); assert.equal(counters(r).requests, 7); assert.equal(counters(r).sends, 2);
  assert.ok(Object.values(f.state('release').snapshot().work).every(w => w.state === 'completed'));
});
test('SIGTERM finishes an admitted synthetic SMTP job, never starts the next queued job', { timeout: 5000 }, async t => {
  const f = fixture(t), c = child(t, f, 'drain-smtp'); await c.next(m => m.waiting); f.open('release');
  await c.next(m => m.smtp); c.p.kill('SIGTERM'); const r = await c.exit;
  assert.equal(r.code, 0); assert.equal(counters(r).requests, 4); assert.equal(counters(r).sends, 1);
  assert.ok(Object.values(f.state('release').snapshot().work).every(w => w.state === 'completed'));
});
test('SIGTERM drains the admitted API body and prevents subsequent reporter jobs', { timeout: 5000 }, async t => {
  const f = fixture(t), c = child(t, f, 'drain'); await c.next(m => m.waiting); f.open('release');
  await c.next(m => m.transport); c.p.kill('SIGTERM'); await delay(30); c.p.kill('SIGINT');
  const r = await c.exit; assert.equal(r.code, 0); assert.equal(counters(r).completedBodies, 1); assert.equal(counters(r).sends, 0);
  assert.equal(f.state('release').snapshot().phase, 'closed'); assert.ok(Object.values(f.state('release').snapshot().work).every(w => w.state === 'completed'));
});
for (const mode of ['admission-shaped-action-error', 'smtp-failure', 'stop-error', 'hang']) test(`real reporter failure is not converted to success: ${mode}`, { timeout: 10000 }, async t => {
  const f = fixture(t), c = child(t, f, mode); await c.next(m => m.waiting);
  if (mode !== 'stop-error') { f.open('release'); await c.next(m => m.transport); }
  const at = performance.now();
  if (mode === 'stop-error' || mode === 'hang') c.p.kill('SIGTERM');
  const r = await c.exit; assert.equal(r.code, 1); assert.equal(r.signal, null); assert.ok(performance.now() - at < 8500);
  assert.doesNotMatch(r.stdout, /reporter_shutdown_complete/); assert.match(r.stderr, /"graceful":false/); assert.doesNotMatch(r.stderr, /synthetic-private/);
  if (mode !== 'stop-error') assert.ok(Object.values(f.state('release').snapshot().work).some(w => w.state !== 'completed'));
});
test('missing production maintenance binding fails before transport', { timeout: 4000 }, async t => {
  const f = fixture(t), c = child(t, f, 'success', 'release', true), r = await c.exit;
  assert.equal(r.code, 1); assert.equal(counters(r).requests, 0); assert.equal(counters(r).sends, 0);
});
test('retired reporter generation fails instead of waiting or dispatching', { timeout: 4000 }, async t => {
  const f = fixture(t); f.state('release').activateGeneration(f.owner, 0, 'recovery');
  const c = child(t, f), r = await c.exit; assert.equal(r.code, 1); assert.equal(counters(r).requests, 0);
});
