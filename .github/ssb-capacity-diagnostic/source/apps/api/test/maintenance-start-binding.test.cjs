const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {fixture}=require('./helpers/start-binding-fixture.cjs');
const {composeParticipant}=require('../../../scripts/ops/maintenance-executor.cjs');
function setup(t,service='api') {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'start-state-'));fs.chmodSync(root,0o700);
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const binding={root,service:'synthetic',generation:'candidate'};
  return {binding,...fixture(t,binding,service)};
}
for(const service of ['api','admin-writer','dashboard','reporter','widget'])test(`bound ${service}: exact start only, not readiness`,async t=>{
  const f=setup(t,service);const result=await composeParticipant(f.binding,f.c,async()=>{},f.execute);
  assert.deepEqual(result,{commandCompleted:true,runtimeVerified:false,containerId:f.container.Id,predecessorsRetained:true});
  const create=f.calls.filter(c=>c.args.includes('create'));assert.equal(create.length,1);assert.equal(create[0].args.at(-1),service);
  assert.ok(create[0].args.includes('--no-recreate'));assert.equal(f.calls.filter(c=>c.args[3]==='start').length,1);
  assert.equal(f.calls.some(c=>c.args.some(a=>['--force-recreate','rm','down','restart'].includes(a))),false);
  assert.ok(f.calls.every(c=>c.options.timeout>0&&c.options.timeout<=1000));
});
const cases={
  'missing pilot binding':f=>delete f.config.services.api.environment.SITE_PILOT_ACCESS_RULES_JSON,
  'lost pilot restriction':f=>f.config.services.api.environment.SITE_PILOT_ACCESS_RULES_JSON='[]',
  'missing integration key':f=>delete f.config.services.api.environment.INTEGRATION_SECRET_KEY,
  'lost previous key':f=>delete f.config.services.api.environment.INTEGRATION_SECRET_KEY_PREVIOUS,
  'missing public API target':f=>delete f.config.services.api.environment.PUBLIC_API_BASE_URL,
  'missing bundle target':f=>delete f.config.services.api.environment.PUBLIC_WIDGET_BUNDLE_URL,
  'missing mail transport':f=>delete f.config.services.api.environment.SMTP_HOST,
  'changed operating binding':f=>f.config.services.api.environment.OPENAI_MODEL='other-model',
  'legacy contract':f=>delete f.c.version,
  'reused generation name':f=>f.config.services.api.container_name='previous-api',
  'missing shutdown identity':f=>delete f.config.services.api.environment.MAINTENANCE_PARTICIPANT_ID,
  'missing runtime role':f=>delete f.c.roles.runtime,
  'superuser fallback':f=>f.config.services.api.environment.DATABASE_URL='postgresql://postgres:x@db:5432/synthetic',
  'ambient pg':f=>f.config.services.api.environment.PGUSER='postgres',
  'node preloader':f=>f.config.services.api.environment.NODE_OPTIONS='--import=data:text/javascript,void%200',
  'image preloader':f=>f.inspect[0].Config.Env=['NODE_OPTIONS=--import=data:text/javascript,void%200'],
  'post start code':f=>f.config.services.api.post_start=[{command:['sh'],user:'root'}],
  'alternate healthcheck':f=>f.config.services.api.healthcheck={test:['CMD','sh']},
  'secret in shared state':f=>f.c.mountFiles.writerDb.path=path.join(f.binding.root,'writer-db'),
  'aliased physical networks':f=>f.c.networks.widget_api.id=f.c.networks.internal.id,
  'migration credential':f=>f.config.services.api.environment.MIGRATOR_DATABASE_URL_FILE='/private/db',
  'startup migrations':f=>f.config.services.api.environment.RUN_MIGRATIONS_ON_STARTUP='true',
  'missing runtime mount':f=>f.config.services.api.volumes.pop(),
  'extra secret mount':f=>f.config.services.api.volumes.push({type:'bind',source:'/private',target:'/private'}),
  'writable runtime mount':f=>f.config.services.api.volumes[1].read_only=false,
  'automatic mount creation':f=>f.config.services.api.volumes[0].bind.create_host_path=true,
  'wrong uid':f=>f.config.services.api.user='root',
  'wrong generation':f=>f.config.services.api.environment.MAINTENANCE_GENERATION='previous',
  'changed image':f=>f.inspect[0].Id='sha256:'+'f'.repeat(64),
  'arm64':f=>f.inspect[0].Architecture='arm64',
  'old protocol':f=>delete f.inspect[0].Config.Labels['com.ssb.maintenance-protocol'],
  'old shutdown protocol':f=>delete f.inspect[0].Config.Labels['com.ssb.shutdown-protocol'],
  'forced stop signal':f=>f.inspect[0].Config.StopSignal='SIGKILL',
  'changed command':f=>f.config.services.api.command=['sh'],
  'extra network':f=>f.config.services.api.networks.extra=null,
  'host network':f=>f.config.services.api.network_mode='host',
  'public port':f=>f.config.services.api.ports=[{target:5000,published:'5000'}],
  'restart successor':f=>f.config.services.api.restart='always',
  'wrong reporter token':f=>f.config.services.reporter.environment.REPORTER_API_TOKEN='different',
  'wrong reporter scope':f=>f.config.services.reporter.environment.REPORTER_SITE_BINDINGS='[]',
  'file drift':f=>fs.appendFileSync(f.c.mountFiles.runtime.path,' '),
  'weak key permissions':f=>fs.chmodSync(f.c.mountFiles.writerKey.path,0o644),
  'hardlink':f=>fs.linkSync(f.c.mountFiles.writerKey.path,path.join(f.dir,'alias')),
};
for(const [name,change] of Object.entries(cases))test(`deny before start: ${name}`,async t=>{
  const f=setup(t);change(f);await assert.rejects(composeParticipant(f.binding,f.c,async()=>{},f.execute));
  assert.equal(f.calls.some(c=>c.args.includes('create')||c.args.includes('start')),false);
});
for(const service of ['admin-writer','dashboard','reporter'])test(`${service} refuses missing binding and inherited authority`,async t=>{
  const f=setup(t,service);f.config.services[service].environment.DATABASE_URL='postgresql://postgres:x@db/synthetic';
  await assert.rejects(composeParticipant(f.binding,f.c,async()=>{},f.execute));
  assert.equal(f.calls.some(c=>c.args.includes('create')||c.args.includes('start')),false);
});
test('old one-shot reporter image cannot enter retained recovery',async t=>{
  const f=setup(t,'reporter');delete f.inspect[0].Config.Labels['com.ssb.reporter-lifecycle'];
  await assert.rejects(composeParticipant(f.binding,f.c,async()=>{},f.execute),{code:'image_reporter_lifecycle_missing'});
  assert.equal(f.calls.some(c=>c.args.includes('create')||c.args.includes('start')),false);
});
test('wrong daemon and network identity cannot reach compose up',async t=>{
  const f=setup(t);await assert.rejects(composeParticipant(f.binding,f.c,async()=>{},async(bin,args,opts)=>{
    const r=await f.execute(bin,args,opts);if(args.includes('info'))r.stdout=JSON.stringify({ID:'other',OSType:'linux',Architecture:'amd64'});return r;
  }),{code:'daemon_binding_invalid'});assert.equal(f.calls.length,1);
});
test('revoked owner and late file drift block the actual final effect',async t=>{
  const f=setup(t);let checks=0;
  await assert.rejects(composeParticipant(f.binding,f.c,async()=>{
    if(++checks===7)fs.appendFileSync(f.c.files[0].path,' ');
  },f.execute));assert.equal(f.calls.some(c=>c.args.includes('start')),false);
});
for(const key of ['DASHBOARD_PUBLIC_URL','REDIS_URL','OPERATOR_PANEL_PASSWORD_HASH'])test(`dashboard refuses missing ${key}`,async t=>{
  const f=setup(t,'dashboard');delete f.config.services.dashboard.environment[key];
  await assert.rejects(composeParticipant(f.binding,f.c,async()=>{},f.execute));
  assert.equal(f.calls.some(c=>c.args.includes('up')),false);
});
test('API consumers retain the explicit pilot, public URLs and integration key',async t=>{
  const f=setup(t),env=f.config.services.api.environment;
  for(const [k,v] of Object.entries(env)) {const old=process.env[k];process.env[k]=v;t.after(()=>{if(old===undefined)delete process.env[k];else process.env[k]=old;});}
  const {readSitePilotAccessRules,assertSitePilotAccess}=require('../dist/utils/site-pilot-access');
  assert.equal(readSitePilotAccessRules()[0].siteId,'synthetic-site');
  assert.throws(()=>assertSitePilotAccess({tenantId:'synthetic-tenant',siteId:'synthetic-site'},{}));
  const {WidgetConfigService}=require('../dist/modules/widget/services/widget-config.service');
  const config=new WidgetConfigService({query:async()=>({rows:[{id:'synthetic-site',site_key:'synthetic-key',
    tenant_id:'synthetic-tenant',is_active:true,name:'Synthetic',welcome_message:'Synthetic',widget_bundle_url:''}]})});
  const response=await config.getPublicConfig('synthetic-key');
  assert.equal(response.apiBase,env.PUBLIC_API_BASE_URL);assert.equal(response.widgetBundleUrl,env.PUBLIC_WIDGET_BUNDLE_URL);
  const {IntegrationSecretsService}=require('../dist/integrations/integration-secrets.service');
  const service=new IntegrationSecretsService();assert.equal(service.isConfigured(),true);
  assert.deepEqual(service.decryptRecord(service.encryptRecord({synthetic:'marker'}),true),{synthetic:'marker'});
});
test('dashboard rendered binding reads a persistent login lock via the real consumer',async t=>{
  const f=setup(t,'dashboard'),env=f.config.services.dashboard.environment;
  const previous=process.env.REDIS_URL;process.env.REDIS_URL=env.REDIS_URL;
  const cached=globalThis.__dashboardRedisClient__;delete globalThis.__dashboardRedisClient__;
  t.after(()=>{if(previous===undefined)delete process.env.REDIS_URL;else process.env.REDIS_URL=previous;
    if(cached===undefined)delete globalThis.__dashboardRedisClient__;else globalThis.__dashboardRedisClient__=cached;});
  const ts=require('typescript'),Module=require('node:module'),calls=[];
  const transport={status:'ready',on(){},async connect(){},async get(k){calls.push(k);return '5';},async pttl(){return 60000;}};
  function load(name,dependencies){const file=path.resolve(__dirname,'../../dashboard/lib',name+'.ts');
    const m=new Module(file,module);m.filename=file;m.paths=module.paths;
    m.require=id=>Object.hasOwn(dependencies,id)?dependencies[id]:module.require(id);
    m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);return m.exports;}
  const redis=load('redis',{ioredis:class {constructor(url){assert.equal(url,env.REDIS_URL);return transport;}}});
  const limiter=load('login-rate-limit',{'@/lib/redis':redis});
  assert.equal(await limiter.isLoginRateLimited('synthetic-existing-lock'),true);
  assert.deepEqual(calls,['admin-login-attempts:synthetic-existing-lock']);
});
