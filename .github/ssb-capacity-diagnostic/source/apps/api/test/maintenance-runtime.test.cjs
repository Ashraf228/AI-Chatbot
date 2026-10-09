const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const { once } = require('node:events');
const { from } = require('rxjs');
const { spawn, spawnSync } = require('node:child_process');
const { MaintenanceState } = require('../dist/maintenance/maintenance-state');
const runtime = require('../dist/maintenance/maintenance-runtime');
const { MaintenanceExecutor } = require('../../../scripts/ops/maintenance-executor.cjs');
const { EmbeddingService } = require('../dist/vector/embedding.service');
const { IngestionEmbeddingService } = require('../dist/ingest/ingestion-embedding.service');
const { EmailJobsService } = require('../dist/modules/widget/services/email-jobs.service');
const { WebhookJobsService } = require('../dist/tools/webhook-jobs.service');
const { RetentionService } = require('../dist/retention/retention.service');
const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service');
const { LlmService } = require('../dist/vector/llm.service');
const { SitesService } = require('../dist/sites/sites.service');
const { SiteModulesService } = require('../dist/site-modules/site-modules.service');
const { WidgetAdminSiteService } = require('../dist/modules/widget/services/widget-admin-site.service');
const { IntegrationsService } = require('../dist/integrations/integrations.service');
const { SiteRuntimeGrantWriteService, SiteRuntimeLlmGrantWriteService } = require('../dist/knowledge-sources/site-runtime-grant-write.service');

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const hash = (b) => createHash('sha256').update(b).digest('hex');

function fixture(t, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-integration-'));
  fs.chmodSync(root, 0o700);
  const binding = { root, service: 'synthetic-api', generation: 'generation-1' };
  fs.writeFileSync(path.join(root, 'runtime-state.json'), JSON.stringify({ version: 1, service: binding.service,
    generations: ['generation-1', 'generation-2'], epoch: 0, phase: 'open', legacy: 'new-empty-service', work: {}, ...extra }), { mode: 0o600 });
  const env = { ...process.env }, fetch = globalThis.fetch;
  Object.assign(process.env, { APP_ENV: 'production', MAINTENANCE_STATE_ROOT: root,
    MAINTENANCE_SERVICE: binding.service, MAINTENANCE_GENERATION: binding.generation, OPENAI_API_KEY: 'synthetic-not-a-credential' });
  t.after(() => {
    globalThis.fetch = fetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    fs.rmSync(root, { recursive: true });
  });
  const state = runtime.runtimeState();
  const owner = randomBytes(32).toString('hex');
  function acquire() {
    fs.mkdirSync(path.join(root, 'maintenance-window'), { mode: 0o700 });
    fs.writeFileSync(path.join(root, 'maintenance-window', 'owner.json'), JSON.stringify({ version: 1, owner, pid: process.pid }), { mode: 0o600 });
    return state.close(owner);
  }
  return { root, binding, state, owner, acquire };
}

test('actual HTTP middleware atomically registers before close and rejects the next request', async (t) => {
  const f = fixture(t), req = new EventEmitter(), res = new EventEmitter();
  let admitted = 0, denied;
  runtime.maintenanceIngress(req, res, (error) => { assert.equal(error, undefined); admitted++; });
  const epoch = f.acquire();
  assert.equal(admitted, 1);
  assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  runtime.maintenanceIngress(new EventEmitter(), new EventEmitter(), (error) => { denied = error; });
  assert.equal(denied.getStatus(), 503);
  res.writableFinished = true; res.emit('finish');
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('client abort stays uncertain after response close and cannot produce drain or retry', async (t) => {
  const f = fixture(t), req = new EventEmitter(), res = new EventEmitter();
  runtime.maintenanceIngress(req, res, () => {});
  req.emit('aborted'); res.emit('close');
  const epoch = f.acquire();
  assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  assert.equal(Object.values(f.state.snapshot().work)[0].state, 'uncertain');
});

test('a detached child from admitted work survives parent completion and blocks drain', async (t) => {
  const f = fixture(t), done = deferred(); let child;
  await runtime.maintenanceWork('handler', async () => { child = runtime.maintenanceWork('import', () => done.promise); });
  const epoch = f.acquire();
  assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  done.resolve(); await child;
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('late detached starts cannot reuse a completed parent', async (t) => {
  const f = fixture(t), release = deferred(); let child;
  await runtime.maintenanceWork('handler', async () => {
    child = release.promise.then(() => runtime.maintenanceWork('import', async () => assert.fail('must not run')));
  });
  release.resolve();
  await assert.rejects(child, { code: 'parent_not_active' });
  assert.equal(Object.keys(f.state.snapshot().work).length, 1);
});

test('real SDK query embedding keeps body pending across close; fresh authorization remains required', async (t) => {
  const f = fixture(t), started = deferred(), finish = deferred(); let requests = 0, grants = 0;
  globalThis.fetch = async () => {
    requests++; started.resolve();
    return new Response(new ReadableStream({ async start(controller) {
      await finish.promise;
      controller.enqueue(new TextEncoder().encode(JSON.stringify({ data: [{ embedding: [1, 2] }] })));
      controller.close();
    } }), { headers: { 'content-type': 'application/json' } });
  };
  const promise = new EmbeddingService().embedWithResolvedConfig('synthetic prompt', { providerKey: 'openai', model: 'text-embedding-3-small' }, async () => { grants++; });
  await started.promise;
  const epoch = f.acquire();
  assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  finish.resolve(); assert.deepEqual(await promise, [1, 2]);
  assert.equal(requests, 1); assert.equal(grants, 1);
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('real SDK lost response stays uncertain and no second transport is dispatched', async (t) => {
  const f = fixture(t); let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('synthetic response lost'); };
  const service = new EmbeddingService();
  const call = () => service.embedWithResolvedConfig('synthetic', { providerKey: 'openai', model: 'text-embedding-3-small' }, async () => {});
  await assert.rejects(call());
  await assert.rejects(call());
  assert.equal(requests, 1);
  assert.ok(Object.values(f.state.snapshot().work).some((w) => w.kind === 'provider' && w.state === 'uncertain'));
  const epoch = f.acquire(); assert.throws(() => f.state.drained(f.owner, epoch));
});

test('body read error and cancel do not count as provider completion', async (t) => {
  const f = fixture(t);
  globalThis.fetch = async () => new Response(new ReadableStream({ pull(controller) { controller.error(new Error('synthetic truncated')); } }));
  const response = await runtime.maintenanceFetch('https://synthetic.invalid');
  await assert.rejects(response.text());
  assert.equal(Object.values(f.state.snapshot().work)[0].state, 'uncertain');
});

for (const type of ['email', 'webhook', 'retention']) test(`actual ${type} worker rejects before DB claim/mutation while closed`, async (t) => {
  const f = fixture(t); f.acquire(); let queries = 0;
  const db = { query() { queries++; throw Error('must not reach DB'); } };
  const service = type === 'email' ? new EmailJobsService(db, {}) : type === 'webhook' ? new WebhookJobsService(db, {}) : new RetentionService(db);
  await assert.rejects(type === 'retention' ? service.cleanup() : service.processPendingJobs(), { code: 'admission_closed' });
  assert.equal(queries, 0);
});

test('worker accepted before close stays registered until its real job-selection promise settles', async (t) => {
  const f = fixture(t), query = deferred(); let calls = 0;
  const service = new EmailJobsService({ query: () => { calls++; return query.promise; } }, {});
  const pending = service.processPendingJobs();
  const epoch = f.acquire(); assert.equal(calls, 1);
  assert.throws(() => f.state.drained(f.owner, epoch));
  query.resolve({ rows: [] }); await pending;
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('ingestion transport is blocked before source/grant lookup or provider dispatch', async (t) => {
  const f = fixture(t); f.acquire(); let calls = 0;
  globalThis.fetch = async () => { calls++; assert.fail('provider'); };
  const service = new IngestionEmbeddingService({ query() { assert.fail('DB'); } }, {});
  await assert.rejects(service.embed('synthetic', { tenantId: 'synthetic-tenant', siteId: 'synthetic-site', sourceId: 'synthetic-source', purpose: 'knowledge_reindex' }), { code: 'admission_closed' });
  assert.equal(calls, 0);
});

test('both real grant writer entrypoints reject before their transaction; migration CLI runner also rejects', async (t) => {
  const f = fixture(t); f.acquire(); let mutations = 0;
  const db = { transaction() { mutations++; assert.fail('transaction'); }, withReservedSession() { mutations++; assert.fail('session'); } };
  for (const Type of [SiteRuntimeGrantWriteService, SiteRuntimeLlmGrantWriteService]) {
    const writer = new Type(db, {}, {});
    await assert.rejects(writer.create({}, {}), { code: 'admission_closed' });
    await assert.rejects(writer.revoke({}, {}), { code: 'admission_closed' });
  }
  await assert.rejects(new DatabaseMigrationsService(db).runPendingMigrations(), { code: 'admission_closed' });
  assert.equal(mutations, 0);
});

test('successor, restart and rollback generation respect the persistent closed state', (t) => {
  const f = fixture(t), epoch = f.acquire();
  for (const generation of ['generation-1', 'generation-2']) {
    const next = new MaintenanceState({ ...f.binding, generation });
    assert.throws(() => next.begin('http'), { code: 'admission_closed' });
    assert.throws(() => next.begin('worker'), { code: 'admission_closed' });
  }
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
  assert.throws(() => new MaintenanceState({ ...f.binding, generation: 'old-binding' }).snapshot(), { code: 'state_binding_invalid' });
});

test('missing/malformed binding, state and stale owner fail closed', (t) => {
  const f = fixture(t); f.acquire();
  assert.throws(() => f.state.assertOwner('a'.repeat(64)), { code: 'owner_stale' });
  delete process.env.MAINTENANCE_GENERATION;
  assert.throws(() => runtime.assertMaintenanceBootstrap(), { code: 'binding_missing' });
  fs.unlinkSync(path.join(f.root, 'runtime-state.json'));
  assert.throws(() => f.state.begin('http'));
});

test('old unobserved work cannot be laundered into zero by first-generation bootstrap', (t) => {
  const f = fixture(t, { legacy: 'unverified' });
  assert.throws(() => f.state.begin('http'), { code: 'legacy_completion_unverified' });
  const epoch = f.acquire();
  assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  assert.throws(() => f.state.open(f.owner, epoch), { code: 'drain_unproven' });
});

test('real child process death leaves its accepted work visible to the next process', (t) => {
  const f = fixture(t);
  const modulePath = require.resolve('../dist/maintenance/maintenance-state');
  const child = spawnSync(process.execPath, ['-e', `const {MaintenanceState}=require(${JSON.stringify(modulePath)});new MaintenanceState(JSON.parse(process.argv[1])).begin('provider');process.exit(17)`, JSON.stringify(f.binding)]);
  assert.equal(child.status, 17);
  const epoch = f.acquire(); assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  assert.equal(Object.values(f.state.snapshot().work)[0].state, 'running');
});

test('lost provider work from a terminated process prevents transport dispatch after restart', async (t) => {
  const f = fixture(t), modulePath = require.resolve('../dist/maintenance/maintenance-state');
  const child = spawnSync(process.execPath, ['-e', `const {MaintenanceState}=require(${JSON.stringify(modulePath)});new MaintenanceState(JSON.parse(process.argv[1])).begin('provider');process.exit(17)`, JSON.stringify(f.binding)]);
  assert.equal(child.status, 17);
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('synthetic'); };
  await assert.rejects(runtime.maintenanceFetch('https://synthetic.invalid'), { code: 'external_work_uncertain' });
  assert.equal(calls, 0);
});

test('foreign host writer is denied before actual config mutation; owner change and exact recovery work', async (t) => {
  const f = fixture(t), epoch = f.acquire(), file = path.join(f.root, 'synthetic-config');
  const before = Buffer.from('OTHER=unchanged\nOPENAI_API_KEY=synthetic-old\n'); fs.writeFileSync(file, before, { mode: 0o600 });
  const executor = new MaintenanceExecutor(f.binding);
  await assert.rejects(executor.replaceSecretField('a'.repeat(64), epoch, file, hash(before), 'synthetic-new'));
  assert.deepEqual(fs.readFileSync(file), before);
  await executor.replaceSecretField(f.owner, epoch, file, hash(before), 'synthetic-new');
  const changed = fs.readFileSync(file); assert.match(changed.toString(), /OTHER=unchanged/);
  await executor.replaceSecretField(f.owner, epoch, file, hash(changed), 'synthetic-old');
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(f.state.snapshot().phase, 'closed');
});

test('owner configuration change cannot overtake a previously admitted running request', async (t) => {
  const f = fixture(t), id = f.state.begin('http'), epoch = f.acquire(); let invoked = false;
  await assert.rejects(new MaintenanceExecutor(f.binding).mutate(f.owner, epoch, 'configuration', async () => { invoked = true; }));
  assert.equal(invoked, false); f.state.end(id);
});

test('real command boundary failure retains barrier and records uncertain deployment', async (t) => {
  const f=fixture(t),epoch=f.acquire();activateForStart(f,epoch);
  const bound=require('./helpers/start-binding-fixture.cjs').fixture(t,f.binding);
  let received;
  await assert.rejects(new MaintenanceExecutor(f.binding).composeApi(f.owner,epoch,bound.c,async(bin,args,options)=>{
    if(args.includes('create')){received=args;throw Error('synthetic switch failed');}
    return bound.execute(bin,args,options);
  }),/synthetic switch failed/);
  assert.deepEqual(received.slice(-6),['create','--no-build','--no-recreate','--pull','never','api']);
  assert.equal(f.state.snapshot().phase,'closed');
  assert.throws(()=>f.state.drained(f.owner,epoch),{code:'drain_unproven'});
});

test('actual compose adapter refuses an old rollback image before any start command',async t=>{
  const f=fixture(t),epoch=f.acquire();activateForStart(f,epoch);
  const bound=require('./helpers/start-binding-fixture.cjs').fixture(t,f.binding);
  delete bound.inspect[0].Config.Labels['com.ssb.maintenance-protocol'];
  await assert.rejects(new MaintenanceExecutor(f.binding).composeApi(f.owner,epoch,bound.c,bound.execute),{code:'image_not_instrumented'});
  assert.equal(bound.calls.some(c=>c.args.includes('create')||c.args.includes('start')),false);
  assert.equal(f.state.snapshot().phase,'closed');
});

for(const change of ['matching','command','entrypoint','database','restart'])test(`reporter exact job binding: ${change}`,async t=>{
  const f=fixture(t),epoch=f.acquire();activateForStart(f,epoch);
  const bound=require('./helpers/start-binding-fixture.cjs').fixture(t,f.binding,'reporter');
  const reporter=bound.config.services.reporter;
  if(change==='command')reporter.command=['sh'];
  if(change==='entrypoint')reporter.entrypoint=['sh'];
  if(change==='database')reporter.environment.DATABASE_URL='synthetic-forbidden';
  if(change==='restart')reporter.restart='always';
  const run=new MaintenanceExecutor(f.binding).composeApi(f.owner,epoch,bound.c,bound.execute);
  if(change==='matching'){assert.equal((await run).commandCompleted,true);assert.equal(bound.calls.filter(c=>c.args.includes('create')).length,1);}
  else{await assert.rejects(run);assert.equal(bound.calls.some(c=>c.args.includes('create')||c.args.includes('start')),false);}
});

function activateForStart(f,epoch) {
  f.state.activateGeneration(f.owner,epoch,'retained-candidate');
  f.binding={...f.binding,generation:'retained-candidate'};
  f.state=new MaintenanceState(f.binding);
}

test('owner is not an exception for new HTTP/import/provider/worker work', async (t) => {
  const f = fixture(t); f.acquire();
  for (const kind of ['http', 'import', 'provider', 'worker', 'handler']) {
    assert.throws(() => f.state.begin(kind, undefined, f.owner), { code: 'owner_operation_not_allowed' });
  }
});

test('stale epoch is rejected atomically at writer registration', (t) => {
  const f = fixture(t), epoch = f.acquire();
  assert.throws(() => f.state.begin('configuration', undefined, f.owner, epoch - 1), { code: 'epoch_changed' });
  const id = f.state.begin('configuration', undefined, f.owner, epoch);
  assert.equal(f.state.close(f.owner), epoch);
  assert.throws(() => f.state.open(f.owner, epoch), { code: 'drain_unproven' });
  f.state.end(id);
});

test('completed subtrees are compacted without dropping live or uncertain work', (t) => {
  const f = fixture(t), live = f.state.begin('import');
  for (let i = 0; i < 140; i++) { const id = f.state.begin('handler', live); f.state.end(id); }
  const state = f.state.snapshot();
  assert.ok(Object.keys(state.work).length < 128);
  assert.equal(state.work[live].state, 'running');
  const epoch = f.acquire(); assert.throws(() => f.state.drained(f.owner, epoch));
});

test('early secret-temp fsync failure cleans the temporary file and preserves the original error', async (t) => {
  const f = fixture(t), epoch = f.acquire(), file = path.join(f.root, 'synthetic-config');
  const before = Buffer.from('OPENAI_API_KEY=synthetic-old\n'); fs.writeFileSync(file, before, { mode: 0o600 });
  const originalOpen = fs.openSync, originalSync = fs.fsyncSync; let target;
  fs.openSync = function (name, ...args) { const fd = originalOpen.call(this, name, ...args); if (String(name).startsWith(file + '.maintenance-')) target = fd; return fd; };
  fs.fsyncSync = function (fd) { if (fd === target) { target = undefined; throw Error('synthetic fsync failure'); } return originalSync.call(this, fd); };
  try { await assert.rejects(new MaintenanceExecutor(f.binding).replaceSecretField(f.owner, epoch, file, hash(before), 'synthetic-new'), /synthetic fsync failure/); }
  finally { fs.openSync = originalOpen; fs.fsyncSync = originalSync; }
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.readdirSync(f.root).filter((name) => name.startsWith('synthetic-config.maintenance-')).length, 0);
});

test('public and internal HTTP requests cross the same actual middleware on a loopback server', async (t) => {
  const f = fixture(t); let handled = 0;
  const server = http.createServer((req, res) => runtime.maintenanceIngress(req, res, (error) => {
    if (error) { res.writeHead(error.getStatus()); res.end('unavailable'); return; }
    handled++; res.end('synthetic');
  }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await (await fetch(url + '/public')).text(), 'synthetic');
    f.acquire();
    for (const route of ['/public', '/internal/admin', '/internal/import']) assert.equal((await fetch(url + route, { method: 'POST' })).status, 503);
    assert.equal(handled, 1);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('the actual Nest interceptor tracks a controller promise beyond client unsubscribe', async (t) => {
  const f = fixture(t), job = deferred();
  const observable = new runtime.MaintenanceInterceptor().intercept({}, { handle: () => from(job.promise) });
  const subscription = observable.subscribe();
  subscription.unsubscribe();
  const epoch = f.acquire();
  assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  job.resolve('synthetic'); await new Promise(setImmediate);
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('configuration writers including lazy secret encryption are denied before any DB or secret access', async (t) => {
  const f = fixture(t); f.acquire(); let queries = 0;
  const db = { query() { queries++; assert.fail('DB mutation'); } };
  const sites = new SitesService(db, {}, {}, {});
  const modules = new SiteModulesService(db, sites);
  const widget = new WidgetAdminSiteService(db);
  const integrations = new IntegrationsService(db, sites, {});
  for (const operation of [() => sites.createSite({}), () => sites.updateSite('synthetic', {}),
    () => sites.markLive('synthetic'), () => sites.deleteSite('synthetic'),
    () => modules.updateForSite('synthetic', []), () => widget.updateWidgetConfig('synthetic', {}),
    () => widget.updateBranding('synthetic', {}), () => integrations.maybeEncryptStoredSecrets({}),
    () => integrations.rotateSecretsForSite('synthetic'), () => integrations.updateForSite('synthetic', []),
    () => integrations.createForSite('synthetic', {}), () => integrations.patchForSite('synthetic', 'synthetic', {}),
    () => integrations.deleteForSite('synthetic', 'synthetic')]) {
    await assert.rejects(operation(), { code: 'admission_closed' });
  }
  assert.equal(queries, 0);
});

test('a real LLM SDK call keeps the entire delayed body counted and preserves the fresh grant boundary', async (t) => {
  const f = fixture(t), started = deferred(), finish = deferred(); let calls = 0, approvals = 0;
  process.env.NODE_ENV = 'production'; process.env.OPENAI_MODEL = 'gpt-5.4-mini';
  const service = new LlmService({ async query() { return { rows: [{ id: 'synthetic-site' }] }; } }, {
    async evaluateSiteRuntimeLlmGenerationApprovalFromStorage() { approvals++; return { allowed: true, decisionCode: 'allowed', policy: {
      scopeKind: 'site_runtime', tenantId: 'synthetic-tenant', siteId: 'synthetic-site', environment: 'production',
      provider: 'openai', model: 'gpt-5.4-mini', purpose: 'llm_generation', sourceId: null, sourceTypes: [], usageContexts: ['llm_generation'],
    } }; },
  });
  globalThis.fetch = async () => {
    calls++; started.resolve();
    return new Response(new ReadableStream({ async start(controller) {
      await finish.promise;
      controller.enqueue(new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: 'synthetic answer' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })));
      controller.close();
    } }), { headers: { 'content-type': 'application/json' } });
  };
  const answer = service.answer('synthetic system', 'synthetic question', { tenantId: 'synthetic-tenant', siteId: 'synthetic-site' });
  await started.promise; const epoch = f.acquire();
  assert.throws(() => f.state.drained(f.owner, epoch));
  finish.resolve(); assert.equal((await answer).text, 'synthetic answer');
  assert.equal(calls, 1); assert.equal(approvals, 1);
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('an owner permit allows the actual grant service but never supplies missing role/scope authorization', async (t) => {
  const f = fixture(t); f.acquire();
  const service = new SiteRuntimeGrantWriteService({ query: () => assert.fail('invalid context must not access DB') }, {}, {});
  const result = await runtime.withMaintenanceOwner(f.owner, () => service.create({}, {}));
  assert.equal(result.kind, 'invalid_context');
  await assert.rejects(runtime.withMaintenanceOwner('a'.repeat(64), () => service.create({}, {})), { code: 'owner_stale' });
});

test('provider error bodies also prevent unknown remote work from being retried', async (t) => {
  const f = fixture(t); let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('synthetic failure', { status: 500 }); };
  await (await runtime.maintenanceFetch('https://synthetic.invalid')).text();
  await assert.rejects(runtime.maintenanceFetch('https://synthetic.invalid'), { code: 'external_work_uncertain' });
  assert.equal(calls, 1); assert.equal(Object.values(f.state.snapshot().work)[0].state, 'uncertain');
});

test('separate processes racing admission against close never create unregistered work', async (t) => {
  const f = fixture(t), modulePath = require.resolve('../dist/maintenance/maintenance-state');
  const child = spawn(process.execPath, ['-e', `
    const {MaintenanceState}=require(${JSON.stringify(modulePath)});
    const state=new MaintenanceState(JSON.parse(process.argv[1]));
    process.on('message',()=>{try {process.send({id:state.begin('http')});} catch(e) {process.send({denied:true});} process.disconnect();});
    process.send({ready:true});`, JSON.stringify(f.binding)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  await once(child, 'message');
  const result = once(child, 'message'), exited = once(child, 'exit'); child.send('go');
  let epoch;
  try { epoch = f.acquire(); } catch (error) { assert.equal(error.code, 'EEXIST'); }
  const [answer] = await result; await exited;
  if (!epoch) epoch = f.state.close(f.owner);
  const work = f.state.snapshot().work;
  if (answer.id) {
    assert.equal(work[answer.id].state, 'running');
    assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
  } else { assert.equal(answer.denied, true); assert.equal(Object.keys(work).length, 0); }
  assert.throws(() => f.state.begin('worker'), { code: 'admission_closed' });
});

test('an orphaned state mutex and a released owner never silently reopen the service', (t) => {
  const f = fixture(t), epoch = f.acquire();
  fs.unlinkSync(path.join(f.root, 'maintenance-window', 'owner.json'));
  fs.rmdirSync(path.join(f.root, 'maintenance-window'));
  assert.throws(() => f.state.begin('http'), { code: 'admission_closed' });
  assert.throws(() => f.state.open(f.owner, epoch));
  assert.equal(fs.existsSync(path.join(f.root, 'runtime-state-mutex')), true);
  assert.throws(() => f.state.begin('http'), { code: 'EEXIST' });
});

test('completion waits through a short real cross-process metadata collision without stealing the mutex', async (t) => {
  const f = fixture(t), id = f.state.begin('handler');
  const mutex = path.join(f.root, 'runtime-state-mutex');
  const child = spawn(process.execPath, ['-e', `
    const fs=require('node:fs'); fs.mkdirSync(process.argv[1],{mode:0o700});
    process.send('held');setTimeout(()=>{fs.rmdirSync(process.argv[1]);process.disconnect()},10);`, mutex], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const exited = once(child, 'exit'); await once(child, 'message');
  f.state.end(id);
  await exited;
  assert.equal(f.state.snapshot().work[id].state, 'completed');
});

test('state publication preserves primary I/O and close errors and never reports completion', (t) => {
  const f = fixture(t), originalOpen = fs.openSync, originalSync = fs.fsyncSync, originalClose = fs.closeSync;
  const io = new Error('synthetic publication failure'), cleanup = new Error('synthetic descriptor failure');
  let target;
  fs.openSync = function (name, ...args) {
    const fd = originalOpen.call(this, name, ...args);
    if (path.basename(String(name)).startsWith('state-')) target = fd;
    return fd;
  };
  fs.fsyncSync = function (fd) { if (fd === target) throw io; return originalSync.call(this, fd); };
  fs.closeSync = function (fd) { originalClose.call(this, fd); if (fd === target) { target = undefined; throw cleanup; } };
  try { assert.throws(() => f.state.begin('http'), (error) => error instanceof AggregateError && error.errors[0] === io && error.errors[1] === cleanup); }
  finally { fs.openSync = originalOpen; fs.fsyncSync = originalSync; fs.closeSync = originalClose; }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root, 'runtime-state.json'))).work, {});
  assert.equal(fs.readdirSync(f.root).some((name) => name.endsWith('.tmp')), false);
  assert.equal(fs.existsSync(path.join(f.root, 'runtime-state-mutex')), true);
  assert.throws(() => f.state.begin('http'), { code: 'EEXIST' });
});

test('R1 restart is refused before command dispatch without a proven existing-container binding', async (t) => {
  const f = fixture(t), epoch = f.acquire(), file = path.join(f.root, 'compose-synthetic');
  fs.writeFileSync(file, 'services: {}\n'); let calls = 0;
  await assert.rejects(new MaintenanceExecutor(f.binding).composeApi(f.owner, epoch, {
    service: 'api', project: f.binding.service, docker: '/synthetic/docker',
    files: [{ path: file, sha256: hash(fs.readFileSync(file)) }], imageId: 'sha256:' + '1'.repeat(64),
    containerRoot: '/maintenance', action: 'restart', timeoutMs: 1000,
  }, async () => { calls++; return { stdout: '[]' }; }), { code: 'deployment_contract_invalid' });
  assert.equal(calls, 0);
});

function integrationResponseFixture(status, calls) {
  const service = new IntegrationsService({}, {}, { decryptRecord: () => ({}) });
  service.findRowById = async () => ({ id: 'synthetic-integration', provider_key: 'webhook', connection_key: 'primary',
    config: { url: 'https://synthetic.invalid' }, secrets: {}, signing_mode: 'legacy_secret_header' });
  service.validateConnectionConfig = async () => {};
  service.patchTestState = async () => ({ id: 'synthetic-integration' });
  globalThis.fetch = async () => { calls.value++; return new Response('synthetic response body', { status }); };
  return service;
}

test('R2 actual integration test drains successful bodies before reporting completion', async (t) => {
  const f = fixture(t), calls = { value: 0 }, service = integrationResponseFixture(200, calls);
  const result = await runtime.maintenanceWork('handler', () => service.testForSite('synthetic-site', 'synthetic-integration'));
  assert.equal(result.status, 'success'); assert.equal(calls.value, 1);
  const epoch = f.acquire(); assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('R2 unread error headers deny another integration dispatch in the same handler', async (t) => {
  const f = fixture(t), calls = { value: 0 }, service = integrationResponseFixture(500, calls);
  await runtime.maintenanceWork('handler', async () => {
    for (let i = 0; i < 2; i++) assert.equal((await service.testForSite('synthetic-site', 'synthetic-integration')).status, 'failed');
  });
  assert.equal(calls.value, 1);
  assert.equal(Object.values(f.state.snapshot().work).filter(w => w.kind === 'provider' && w.state === 'uncertain').length, 1);
});

test('R3 failed abort accounting cannot be downgraded by a later finish', (t) => {
  const f = fixture(t), req = new EventEmitter(), res = new EventEmitter();
  runtime.maintenanceIngress(req, res, error => assert.equal(error, undefined));
  const mutex = path.join(f.root, 'runtime-state-mutex'); fs.mkdirSync(mutex, { mode: 0o700 });
  try { req.emit('aborted'); } finally { fs.rmdirSync(mutex); }
  assert.equal(Object.values(f.state.snapshot().work)[0].state, 'running');
  res.writableFinished = true; res.emit('finish');
  assert.equal(Object.values(f.state.snapshot().work)[0].state, 'uncertain');
  const epoch = f.acquire(); assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
});

test('R4 post-rename directory fsync and close errors are both preserved in order', async (t) => {
  const f = fixture(t), epoch = f.acquire(), file = path.join(f.root, 'synthetic-secret');
  const before = Buffer.from('OPENAI_API_KEY=synthetic-old\n'); fs.writeFileSync(file, before, { mode: 0o600 });
  const originalOpen = fs.openSync, originalSync = fs.fsyncSync, originalClose = fs.closeSync;
  const primary = new Error('synthetic-secret-directory-sync'), cleanup = new Error('synthetic-secret-directory-close');
  let target, injected = false;
  fs.openSync = function (name, ...args) {
    const fd = originalOpen.call(this, name, ...args);
    if (!injected && name === f.root && fs.readFileSync(file, 'utf8').includes('synthetic-new')) target = fd;
    return fd;
  };
  fs.fsyncSync = function (fd) { if (fd === target) throw primary; return originalSync.call(this, fd); };
  fs.closeSync = function (fd) { originalClose.call(this, fd); if (fd === target) { target = undefined; injected = true; throw cleanup; } };
  try {
    await assert.rejects(new MaintenanceExecutor(f.binding).replaceSecretField(f.owner, epoch, file, hash(before), 'synthetic-new'),
      error => error instanceof AggregateError && error.errors[0] === primary && error.errors[1] === cleanup);
  } finally { fs.openSync = originalOpen; fs.fsyncSync = originalSync; fs.closeSync = originalClose; }
  assert.match(fs.readFileSync(file, 'utf8'), /synthetic-new/);
  assert.throws(() => f.state.drained(f.owner, epoch), { code: 'drain_unproven' });
});

for (const Type of [EmailJobsService, WebhookJobsService]) test(`R5 ${Type.name} finishes its active job without claiming the next after close`, async (t) => {
  const f = fixture(t), waiting = deferred(), started = deferred(); let picks = 0, dispatches = 0, picksAfterClose = 0;
  const db = { async query(sql) {
    if (!sql.includes('WITH next_job')) return { rows: [] };
    picks++;
    if (f.state.snapshot().phase === 'closed') picksAfterClose++;
    return { rows: picks <= 2 ? [{ id: `synthetic-${picks}`, endpoint_url: 'https://synthetic.invalid',
      method: 'POST', payload: {}, signing_mode: 'legacy_secret_header', headers: {} }] : [] };
  } };
  const deliver = async () => { dispatches++; if (dispatches === 1) { started.resolve(); await waiting.promise; } return new Response('synthetic'); };
  globalThis.fetch = deliver;
  const service = new Type(db, { send: deliver });
  const pending = service.processPendingJobs(); await started.promise;
  const epoch = f.acquire(); waiting.resolve(); await pending;
  assert.equal(dispatches, 1); assert.equal(picksAfterClose, 0); assert.equal(picks, 1);
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

for (const sdk of [false, true]) test(`S1 failed uncertainty publication blocks a second ${sdk ? 'real SDK' : 'direct transport'} dispatch`, async (t) => {
  const f = fixture(t), mutex = path.join(f.root, 'runtime-state-mutex'); let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) { fs.mkdirSync(mutex, { mode: 0o700 }); return new Response('synthetic failure', { status: 500 }); }
    return new Response(JSON.stringify({ data: [{ embedding: [1, 2] }] }), { headers: { 'content-type': 'application/json' } });
  };
  const service = new EmbeddingService();
  const call = sdk
    ? () => service.embedWithResolvedConfig('synthetic', { providerKey: 'openai', model: 'text-embedding-3-small' }, async () => {})
    : () => runtime.maintenanceFetch('https://synthetic.invalid');
  try { await assert.rejects(call()); } finally { fs.rmdirSync(mutex); }
  assert.ok(Object.values(f.state.snapshot().work).some(work => work.kind === 'provider' && work.state === 'running'));
  await assert.rejects(call());
  assert.equal(calls, 1);
  const epoch = f.acquire(); assert.throws(() => f.state.drained(f.owner, epoch));
});

test('S1 provider decorator and fetch share the same fail-closed publication latch', async (t) => {
  const f = fixture(t), mutex = path.join(f.root, 'runtime-state-mutex'); let calls = 0;
  try {
    await assert.rejects(runtime.maintenanceWork('provider', async () => {
      fs.mkdirSync(mutex, { mode: 0o700 }); throw new Error('synthetic mail outcome unknown');
    }, true));
  } finally { fs.rmdirSync(mutex); }
  globalThis.fetch = async () => { calls++; return new Response('synthetic'); };
  await assert.rejects(runtime.maintenanceFetch('https://synthetic.invalid'));
  await assert.rejects(runtime.maintenanceWork('provider', async () => { calls++; }, true));
  assert.equal(calls, 0);
});
