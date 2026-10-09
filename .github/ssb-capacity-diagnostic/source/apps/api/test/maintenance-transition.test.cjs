const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { createHash, randomBytes } = require('node:crypto');
const { MaintenanceState } = require('../dist/maintenance/maintenance-state');
const runtime = require('../dist/maintenance/maintenance-runtime');
const { assertSitePilotAccess } = require('../dist/utils/site-pilot-access');
const { EmbeddingService } = require('../dist/vector/embedding.service');
const { LlmService } = require('../dist/vector/llm.service');
const hash = value => createHash('sha256').update(value).digest('hex');

async function fixture(t, uncertain) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-transition-'));
  fs.chmodSync(root, 0o700);
  const binding = { root, service: 'synthetic-api', generation: 'candidate' }, owner = randomBytes(32).toString('hex');
  const state = new MaintenanceState(binding);
  state.initializeClosed();
  fs.mkdirSync(path.join(root, 'maintenance-window'), { mode: 0o700 });
  fs.writeFileSync(path.join(root, 'maintenance-window/owner.json'), JSON.stringify({ version: 1, owner }), { mode: 0o600 });
  const child = fork(path.join(__dirname, 'helpers/maintenance-legacy-observer.cjs'), [], { execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  t.after(async () => {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    fs.rmSync(root, { recursive: true });
  });
  async function send(message) {
    const next = once(child, 'message'); child.send(message);
    const [result] = await next; assert.equal(result.error, undefined); return result;
  }
  await send({ action: 'accept', binding, owner });
  assert.throws(() => state.drained(owner, 0), { code: 'drain_unproven' });
  await send({ action: 'fence' });
  assert.equal((await send({ action: 'new-work' })).denied, true);
  const { digest, proof } = await send({ action: 'complete', uncertain });
  const token = randomBytes(32).toString('hex');
  const contract = { tenantId: 'synthetic-tenant', siteId: 'synthetic-site', siteKey: 'synthetic-key',
    tokenSha256: hash(`synthetic-tenant\0synthetic-site\0${token}`), questionSha256: hash('synthetic question'),
    validFrom: proof.closedAt, expiresAt: new Date(Date.parse(proof.closedAt) + 25 * 60 * 1000).toISOString(),
    embeddingModel: 'text-embedding-3-small', llmModel: 'gpt-5.4-mini' };
  const request = (route = '/widget/session') => ({ method: 'POST', route, siteKey: contract.siteKey, token, message: 'synthetic question' });
  return { root, binding, state, owner, contract, token, digest, proof, request };
}

test('connected legacy completion, closed successor, one scoped SDK pair and closed cleanup', async t => {
  const f = await fixture(t);
  assert.equal(f.state.acceptLegacyCompletion(f.owner, 0, 'observer', f.digest).operations, 8);
  const env = { ...process.env }, fetch = globalThis.fetch;
  Object.assign(process.env, { APP_ENV: 'production', NODE_ENV: 'production', MAINTENANCE_STATE_ROOT: f.root,
    MAINTENANCE_SERVICE: f.binding.service, MAINTENANCE_GENERATION: f.binding.generation,
    OPENAI_API_KEY: 'synthetic-not-a-credential', OPENAI_MODEL: f.contract.llmModel });
  const rule = Object.fromEntries(['tenantId', 'siteId', 'tokenSha256', 'validFrom', 'expiresAt'].map(key => [key, f.contract[key]]));
  process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([rule]);
  t.after(() => { globalThis.fetch = fetch; for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); });
  runtime.assertMaintenanceBootstrap();
  assert.equal(runtime.runtimeState().snapshot().phase, 'closed');
  let transports = 0, grants = 0, writes = 0;
  globalThis.fetch = async (url) => {
    transports++;
    assert.equal(new URL(String(url)).origin, 'https://api.openai.com');
    return new Response(JSON.stringify(String(url).endsWith('/embeddings') ? { data: [{ embedding: [1, 2] }] }
      : { choices: [{ message: { content: 'synthetic answer' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
    { headers: { 'content-type': 'application/json' } });
  };
  const llm = new LlmService({ query: async () => ({ rows: [{ id: f.contract.siteId }] }) }, {
    evaluateSiteRuntimeLlmGenerationApprovalFromStorage: async () => { grants++; return { allowed: true, decisionCode: 'allowed', policy: {
      scopeKind: 'site_runtime', tenantId: f.contract.tenantId, siteId: f.contract.siteId, environment: 'production',
      provider: 'openai', model: f.contract.llmModel, purpose: 'llm_generation', sourceId: null, sourceTypes: [], usageContexts: ['llm_generation'],
    } }; },
  });
  const express = require('express'), app = express(), handlerErrors = [];
  app.use(express.json({ limit: '1mb' })); app.use(runtime.maintenanceIngress);
  app.post(['/widget/session', '/widget/chat/message'], async (req, res, next) => {
    try {
      const value = await runtime.maintenanceWork('handler', async () => {
        assertSitePilotAccess({ tenantId: f.contract.tenantId, siteId: f.contract.siteId }, req);
        await runtime.maintenanceWork('database', async () => { writes++; });
        if (req.path === '/widget/session') return 'synthetic-session';
        await new EmbeddingService().embedWithResolvedConfig(req.body.message, { providerKey: 'openai', model: f.contract.embeddingModel }, async () => { grants++; });
        return (await llm.answer('synthetic system', req.body.message, { tenantId: f.contract.tenantId, siteId: f.contract.siteId })).text;
      });
      res.json({ value });
    } catch (error) { handlerErrors.push(error); next(error); }
  });
  app.use((error, _req, res, _next) => res.status(error.getStatus?.() || 503).end());
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = (route, extra = {}) => new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: server.address().port, method: 'POST', path: route,
      headers: { 'content-type': 'application/json', 'x-site-pilot-token': f.token } }, response => {
      let text = ''; response.on('data', bytes => text += bytes); response.on('end', () => resolve({ status: response.statusCode, text }));
    });
    request.on('error', reject); request.end(JSON.stringify({ siteKey: f.contract.siteKey, message: 'synthetic question', ...extra }));
  });
  assert.equal((await post('/widget/session')).status, 503);
  f.state.openPilot(f.owner, 0, f.contract);
  assert.equal((await post('/widget/session', { siteKey: 'foreign' })).status, 503);
  for (const kind of ['worker', 'import', 'grant', 'migration', 'deployment', 'configuration']) {
    assert.throws(() => f.state.begin(kind));
    assert.throws(() => f.state.begin(kind, undefined, f.owner, 0));
  }
  assert.equal((await post('/widget/session')).status, 200);
  assert.equal((await post('/widget/chat/stream')).status, 503);
  assert.deepEqual(await post('/widget/chat/message'), { status: 200, text: '{"value":"synthetic answer"}' }, handlerErrors.map(error => error.stack).join('\n'));
  assert.equal((await post('/widget/chat/message')).status, 503);
  assert.equal(transports, 2); assert.equal(grants, 2); assert.equal(writes, 2);
  f.state.closePilot(f.owner, 0);
  assert.equal(f.state.drained(f.owner, 0).completed, true);
  assert.throws(() => f.state.open(f.owner, 0));
  assert.throws(() => f.state.openPilot(f.owner, 0, f.contract));
  assert.equal((await post('/widget/session')).status, 503);
  assert.equal(f.state.snapshot().phase, 'closed');
  assert.equal(fs.existsSync(path.join(f.root, 'maintenance-window/owner.json')), true);
});

test('unknown legacy provider completion cannot be converted into a successful transition', async t => {
  const f = await fixture(t, 'provider');
  assert.throws(() => f.state.acceptLegacyCompletion(f.owner, 0, 'observer', f.digest), { code: 'legacy_completion_invalid' });
  assert.throws(() => f.state.openPilot(f.owner, 0, f.contract));
});

test('wrong digest, stale owner and stale epoch never establish legacy completion', async t => {
  const f = await fixture(t);
  assert.throws(() => f.state.acceptLegacyCompletion(f.owner, 0, 'observer', '0'.repeat(64)), { code: 'legacy_evidence_invalid' });
  assert.throws(() => f.state.acceptLegacyCompletion('f'.repeat(64), 0, 'observer', f.digest), { code: 'owner_stale' });
  assert.throws(() => f.state.acceptLegacyCompletion(f.owner, 1, 'observer', f.digest), { code: 'legacy_transition_invalid' });
  assert.equal(f.state.snapshot().legacy, 'unverified');
});

test('missing evidence leaves the transition blocked without deleting its uncertainty mutex', async t => {
  const f = await fixture(t);
  assert.throws(() => f.state.acceptLegacyCompletion(f.owner, 0, 'missing', f.digest), { code: 'ENOENT' });
  assert.equal(fs.statSync(path.join(f.root, 'runtime-state-mutex')).isDirectory(), true);
  assert.throws(() => f.state.openPilot(f.owner, 0, f.contract));
});

test('expired and foreign-generation legacy proofs cannot open the candidate', async t => {
  const f = await fixture(t);
  for (const [name, change] of [['expired', { expiresAt: f.proof.closedAt }], ['generation', { generation: 'foreign' }]]) {
    const bytes = JSON.stringify({ ...f.proof, ...change });
    fs.writeFileSync(path.join(f.root, `legacy-${name}.json`), bytes, { mode: 0o600 });
    assert.throws(() => f.state.acceptLegacyCompletion(f.owner, 0, name, hash(bytes)), { code: 'legacy_evidence_invalid' });
  }
  assert.equal(f.state.snapshot().legacy, 'unverified');
});

test('controlled recovery generation retains the same proof and admits only its single scoped window', async t => {
  const f = await fixture(t);
  f.state.acceptLegacyCompletion(f.owner, 0, 'observer', f.digest);
  f.state.admitGeneration(f.owner, 0, 'recovery');
  const recovery = new MaintenanceState({ ...f.binding, generation: 'recovery' });
  assert.throws(() => f.state.openPilot(f.owner, 0, f.contract));
  assert.throws(() => f.state.begin('configuration', undefined, f.owner, 0), { code: 'generation_retired' });
  assert.equal(recovery.snapshot().transition.digest, f.digest);
  recovery.openPilot(f.owner, 0, f.contract);
  assert.throws(() => recovery.admitGeneration(f.owner, 0, 'another'), { code: 'pilot_close_required' });
  const session = recovery.beginPilotRequest(f.request()); recovery.end(session);
  const restarted = new MaintenanceState({ ...f.binding, generation: 'recovery' });
  assert.throws(() => restarted.beginPilotRequest(f.request()));
  recovery.closePilot(f.owner, 0);
  assert.equal(recovery.snapshot().phase, 'closed');
});

test('loaded tenant/site and classified purpose/model are mandatory even with a valid transport token', async t => {
  const f = await fixture(t);
  f.state.acceptLegacyCompletion(f.owner, 0, 'observer', f.digest); f.state.openPilot(f.owner, 0, f.contract);
  const session = f.state.beginPilotRequest(f.request()); f.state.end(session);
  const chat = f.state.beginPilotRequest(f.request('/widget/chat/message'));
  assert.throws(() => f.state.beginDispatch(chat, undefined, { purpose: 'query_embedding', model: f.contract.embeddingModel }));
  assert.throws(() => f.state.confirmPilotScope(chat, 'foreign', f.contract.siteId));
  f.state.confirmPilotScope(chat, f.contract.tenantId, f.contract.siteId);
  assert.throws(() => f.state.beginDispatch(chat, undefined, { purpose: 'query_embedding', model: 'wrong' }));
  const dispatch = f.state.beginDispatch(chat, undefined, { purpose: 'query_embedding', model: f.contract.embeddingModel });
  f.state.end(dispatch, true); f.state.end(chat); f.state.closePilot(f.owner, 0);
  assert.throws(() => f.state.drained(f.owner, 0), { code: 'drain_unproven' });
  assert.throws(() => new MaintenanceState(f.binding).beginPilotRequest(f.request('/widget/chat/message')));
});

test('pilot deadlines cannot extend legacy window and elapsed admission deadline stays closed', async t => {
  const f = await fixture(t); f.state.acceptLegacyCompletion(f.owner, 0, 'observer', f.digest);
  assert.throws(() => f.state.openPilot(f.owner, 0, { ...f.contract, expiresAt: f.proof.expiresAt }));
  f.state.openPilot(f.owner, 0, f.contract);
  const now = Date.now;
  try {
    Date.now = () => Date.parse(f.proof.closedAt) + 15 * 60 * 1000;
    assert.throws(() => f.state.beginPilotRequest(f.request()));
    assert.equal(f.state.snapshot().phase, 'closed');
  } finally { Date.now = now; }
});

test('D2 generation changes cannot overtake a running privileged writer', async t => {
  const f = await fixture(t); f.state.acceptLegacyCompletion(f.owner, 0, 'observer', f.digest);
  const writer = f.state.begin('configuration', undefined, f.owner, 0);
  assert.throws(() => f.state.admitGeneration(f.owner, 0, 'recovery'), { code: 'writer_generation_change_blocked' });
  f.state.assertEpoch(f.owner, 0); f.state.end(writer, false, f.owner, 0);
  f.state.admitGeneration(f.owner, 0, 'recovery');
  assert.throws(() => f.state.assertEpoch(f.owner, 0), { code: 'generation_retired' });
});

for (const elapsed of [80, 120]) test(`D3 command timeout subtracts asynchronous checks (${elapsed}ms)`, async t => {
  const {composeParticipant}=require('../../../scripts/ops/maintenance-executor.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maintenance-deadline-'));fs.chmodSync(root,0o700);
  t.after(()=>fs.rmSync(root,{recursive:true}));
  const binding={root,service:'synthetic',generation:'candidate'};
  const f=require('./helpers/start-binding-fixture.cjs').fixture(t,binding);
  f.c.timeoutMs=100;let checks=0,commands=0,createTimeout;
  const run=composeParticipant(binding,f.c,async()=>{if(++checks===7)await new Promise(r=>setTimeout(r,elapsed));},
    async(bin,args,options)=>{commands++;if(args.includes('create'))createTimeout=options.timeout;return f.execute(bin,args,options);});
  if(elapsed>100){await assert.rejects(run,{code:'deployment_deadline'});assert.equal(commands,6);}
  else{await run;assert.equal(commands,11);assert.ok(createTimeout>0&&createTimeout<=30,`remaining=${createTimeout}`);}
});

test('D3 the shared operator deadline aborts an already running command process',async t=>{
  const {composeParticipant}=require('../../../scripts/ops/maintenance-executor.cjs');
  const {execFile}=require('node:child_process'),{promisify}=require('node:util');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maintenance-command-abort-'));fs.chmodSync(root,0o700);
  t.after(()=>fs.rmSync(root,{recursive:true}));
  const binding={root,service:'synthetic',generation:'candidate'};
  const f=require('./helpers/start-binding-fixture.cjs').fixture(t,binding);
  const controller=new AbortController();let closed,timer,commands=0;t.after(()=>clearTimeout(timer));
  const run=composeParticipant(binding,f.c,async()=>{},(_bin,_args,options)=>{
    commands++;assert.equal(options.signal,controller.signal);
    const command=promisify(execFile)(process.execPath,['-e','setTimeout(()=>{},5000)'],options);
    closed=new Promise(resolve=>command.child.once('close',(_code,signal)=>resolve(signal)));
    timer=setTimeout(()=>controller.abort(),20);return command;
  },{signal:controller.signal});
  await assert.rejects(run,{name:'AbortError'});assert.equal(await closed,'SIGTERM');assert.equal(commands,1);
});

async function consumed(t) {
  const f = await fixture(t);
  f.state.acceptLegacyCompletion(f.owner, 0, 'observer', f.digest);
  f.state.openPilot(f.owner, 0, f.contract);
  const session = f.state.beginPilotRequest(f.request()); f.state.end(session);
  const chat = f.state.beginPilotRequest(f.request('/widget/chat/message')); f.state.end(chat);
  f.state.closePilot(f.owner, 0);
  return f;
}

function cleanupProof(f, change = {}) {
  const binding = f.state.cleanupBinding(f.owner, 0), now = new Date().toISOString();
  const proof = { version: 1, ...binding, completedAt: now, observations:
    ['grants', 'traces', 'rule', 'opt-in', 'token', 'test-data'].map(kind => ({ kind,
      pilotSha256: binding.pilotSha256, inventorySha256: hash(`synthetic-inventory:${kind}`),
      absenceSha256: hash(`synthetic-absence:${kind}`), verifiedAt: now,
      outcome: kind === 'grants' ? 'revoked' : 'absent',
      ...(kind === 'traces' ? { producerGeneration: f.binding.generation, beforeRecreate: true } : {}) })), ...change };
  const bytes = JSON.stringify(proof), name = `proof-${require('node:crypto').randomUUID()}`;
  fs.writeFileSync(path.join(f.root, `cleanup-${name}.json`), bytes, {mode:0o600});
  return { proof, name, digest: hash(bytes) };
}

function assertConsumedRequest(state, f, request) {
  const id = state.beginPilotRequest(request);
  try { assert.throws(() => state.confirmPilotScope(id, f.contract.tenantId, f.contract.siteId), {code:'pilot_consumed'}); }
  finally { state.end(id); }
}

test('terminal normal work resumes but consumed admission stays denied across restart and forward recovery', async t => {
  const f = await consumed(t), proof = cleanupProof(f);
  assert.deepEqual(f.state.sealCleanup(f.owner, 0, proof.name, proof.digest), {sealed:true,alreadyApplied:false});
  assert.throws(() => f.state.begin('configuration', undefined, f.owner, 0), {code:'cleanup_sealed'});
  assert.throws(() => f.state.begin('http'), {code:'admission_closed'});
  const restarted = new MaintenanceState(f.binding);
  assert.deepEqual(restarted.sealCleanup(f.owner, 0, proof.name, proof.digest), {sealed:true,alreadyApplied:true});
  restarted.admitGeneration(f.owner, 0, 'terminal-recovery');
  const recovery = new MaintenanceState({...f.binding,generation:'terminal-recovery'});
  assert.throws(() => restarted.releaseTerminal(f.owner, 0), {code:'terminal_release_invalid'});
  recovery.releaseTerminal(f.owner, 0);
  assert.equal(recovery.releaseTerminal(f.owner, 0).released, true);
  for (const state of [recovery, new MaintenanceState({...f.binding,generation:'terminal-recovery'})]) {
    assertConsumedRequest(state, f, f.request('/widget/chat/message'));
    assertConsumedRequest(state, f, {...f.request('/widget/chat/message'),token:undefined});
    const id=state.beginPilotRequest({method:'GET',route:'/health'}); state.end(id);
    const worker=state.begin('worker'), job=state.begin('job',worker); state.end(job); state.end(worker);
    assert.equal(state.snapshot().pilot.chatUsed,true);
    assert.equal(state.snapshot().phase,'open');
  }
});

test('terminal release rejects stale, foreign, incomplete and generation-mismatched observations', async t => {
  const f=await consumed(t);
  const mutations = [p=>({...p,completedAt:new Date(Date.now()-6*60*1000).toISOString()}),
    p=>({...p,window:'0'.repeat(64)}), p=>({...p,observations:p.observations.slice(1)}),
    p=>({...p,generation:'foreign'}), p=>({...p,observations:p.observations.map(o=>o.kind==='traces'?{...o,beforeRecreate:false}:o)})];
  for (const mutate of mutations) {
    const {proof}=cleanupProof(f), altered=mutate(proof), name=require('node:crypto').randomUUID(), bytes=JSON.stringify(altered);
    fs.writeFileSync(path.join(f.root,`cleanup-${name}.json`),bytes,{mode:0o600});
    assert.throws(()=>f.state.sealCleanup(f.owner,0,name,hash(bytes)), e=>e.code?.startsWith('cleanup_'));
    assert.equal(f.state.snapshot().phase,'closed');
  }
  const stale=cleanupProof(f), writer=f.state.begin('configuration',undefined,f.owner,0);
  assert.throws(()=>f.state.sealCleanup(f.owner,0,stale.name,stale.digest),{code:'cleanup_not_ready'});
  f.state.end(writer,false,f.owner,0);
  assert.throws(()=>f.state.sealCleanup(f.owner,0,stale.name,stale.digest),{code:'cleanup_evidence_invalid'});
  const fresh=cleanupProof(f); f.state.sealCleanup(f.owner,0,fresh.name,fresh.digest); f.state.releaseTerminal(f.owner,0);
  assert.equal(f.state.snapshot().phase,'open');
});

test('interrupted release after durable terminal/open accounting stays closed until bound retirement resumes', async t => {
  const f=await consumed(t), proof=cleanupProof(f);
  f.state.sealCleanup(f.owner,0,proof.name,proof.digest);
  const rename=fs.renameSync;
  try {
    fs.renameSync=(from,to)=>{if(from===path.join(f.root,'maintenance-window')) throw Object.assign(Error('synthetic retirement interruption'),{code:'EIO'});return rename(from,to);};
    assert.throws(()=>f.state.releaseTerminal(f.owner,0),{code:'EIO'});
  } finally {fs.renameSync=rename;}
  const restart=new MaintenanceState(f.binding);
  assert.equal(restart.snapshot().phase,'open');
  assert.throws(()=>restart.begin('http'),{code:'admission_closed'});
  assert.throws(()=>restart.releaseTerminal('f'.repeat(64),0),{code:'terminal_release_invalid'});
  restart.releaseTerminal(f.owner,0);
  const normal=restart.begin('http');restart.end(normal);
  assertConsumedRequest(restart, f, f.request());
});

test('removing the window without terminal evidence does not open a consumed pilot', async t => {
  const f=await consumed(t);
  fs.renameSync(path.join(f.root,'maintenance-window'),path.join(f.root,'simulated-bad-operator-removal'));
  assert.throws(()=>new MaintenanceState(f.binding).begin('http'),{code:'admission_closed'});
  assert.equal(f.state.snapshot().pilot.chatUsed,true);
});

test('T1 consumed identity survives a site-key change and restart without denying another site', async t => {
  const f = await consumed(t), proof = cleanupProof(f);
  f.state.sealCleanup(f.owner, 0, proof.name, proof.digest);
  f.state.releaseTerminal(f.owner, 0);
  for (const state of [f.state, new MaintenanceState(f.binding)]) {
    for (const request of [f.request(), {...f.request('/widget/chat/message'), token: undefined}]) {
      const root = state.beginPilotRequest({...request, siteKey: 'renamed-key'});
      const child = state.begin('handler', root);
      assert.throws(() => state.confirmPilotScope(child, f.contract.tenantId, f.contract.siteId), {code:'pilot_consumed'});
      state.end(child); state.end(root);
    }
    const other = state.beginPilotRequest({...f.request('/widget/chat/message'),siteKey:'other',token:undefined});
    state.confirmPilotScope(other, f.contract.tenantId, 'other-site'); state.end(other);
  }
});

test('T2 terminal retirement serializes a concurrent close and privileged writer', async t => {
  const f = await consumed(t), proof = cleanupProof(f), competitor = new MaintenanceState(f.binding);
  f.state.sealCleanup(f.owner, 0, proof.name, proof.digest);
  const rename = fs.renameSync; let attempted = false;
  try {
    fs.renameSync = (from, to) => {
      if (from === path.join(f.root, 'maintenance-window')) {
        attempted = true;
        assert.throws(() => competitor.close(f.owner), {code:'EEXIST'});
      }
      return rename(from, to);
    };
    f.state.releaseTerminal(f.owner, 0);
  } finally { fs.renameSync = rename; }
  assert.equal(attempted, true);
  assert.equal(f.state.snapshot().epoch, 0);
  assert.throws(() => competitor.begin('configuration', undefined, f.owner, 0));
  const normal = f.state.begin('http'); f.state.end(normal);
});

test('T1-R reassigning the historical key never blocks another loaded site', async t => {
  const f = await consumed(t), proof = cleanupProof(f);
  f.state.sealCleanup(f.owner, 0, proof.name, proof.digest); f.state.releaseTerminal(f.owner, 0);
  for (const state of [f.state, new MaintenanceState(f.binding)]) {
    const id = state.beginPilotRequest({...f.request('/widget/chat/message'),token:undefined});
    state.confirmPilotScope(id, 'other-tenant', 'other-site'); state.end(id);
  }
});

test('H1 cleanup observation freshness uses now, not two cumulative five-minute intervals', async t => {
  const f = await consumed(t), {proof} = cleanupProof(f), t0 = Date.parse(f.proof.closedAt);
  proof.completedAt = new Date(t0 + 6 * 60000).toISOString();
  for (const o of proof.observations) o.verifiedAt = new Date(t0 + 2 * 60000).toISOString();
  const bytes = JSON.stringify(proof), name = 'combined-age';
  fs.writeFileSync(path.join(f.root,`cleanup-${name}.json`),bytes,{mode:0o600});
  const now = Date.now;
  try {
    Date.now = () => t0 + 10 * 60000;
    assert.throws(() => f.state.sealCleanup(f.owner,0,name,hash(bytes)),{code:'cleanup_observation_invalid'});
  } finally {Date.now = now;}
  assert.equal(f.state.snapshot().terminal,undefined);
});
