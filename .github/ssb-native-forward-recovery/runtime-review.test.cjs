'use strict';
// node --experimental-vm-modules --test runtime-review.test.cjs
// RUNTIME_REVIEW_TARGET may point at immutable MbrHoB for the before comparison.
// All filesystem writes, HTTP, SQL, service dependencies and process identity are mocked.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire,stripTypeScriptTypes}=require('node:module'),crypto=require('node:crypto');
const target=process.env.RUNTIME_REVIEW_TARGET||__dirname;
const workspace=path.resolve(__dirname,'../../../..');
const source=path.join(workspace,'ssb-native-e1-recovery-preparation-20261009.j8EmJx/release-source');
const plain=value=>JSON.parse(JSON.stringify(value));
const forbidden=()=>{throw Error('Unexpected external effect');};
const input={passwords:{},generation:'release',service:'offline-review',replayId:'11111111-1111-4111-8111-111111111111',writerKey:'a'.repeat(64),session:'b'.repeat(64),reporter:'c'.repeat(64),admin:'d'.repeat(64),password:'synthetic',source:'e'.repeat(40),buildDate:'2026-10-09T00:00:00Z'};

function loadCjs(file,modules={},globals={}){
  const module={exports:{}},realRequire=createRequire(file);
  const requireMock=id=>Object.hasOwn(modules,id)?modules[id]:id.startsWith('node:')&&!['node:assert/strict','node:crypto','node:path','node:vm'].includes(id)?forbidden():realRequire(id);
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:requireMock,__dirname:path.dirname(file),Buffer,URL,AbortSignal,performance,setTimeout,clearTimeout,fetch:forbidden,...globals},{filename:file});
  return module.exports;
}

function memoryFs(){
  let sequence=1;const entries=new Map(),fds=new Map(),fail=code=>{throw Object.assign(Error(code),{code});};
  const entry=file=>entries.get(typeof file==='number'?fds.get(file):file)||fail('ENOENT');
  const make=(file,dir,mode)=>{if(entries.has(file))fail('EEXIST');entries.set(file,{dir,mode,ino:sequence++,data:Buffer.alloc(0),uid:1000});};
  const stat=e=>({ino:e.ino,dev:1,uid:e.uid,mode:e.mode,nlink:1,size:e.data.length,isFile:()=>!e.dir,isDirectory:()=>e.dir});
  const api={constants:fs.constants,entries,
    mkdirSync(file,options={}){make(file,true,options.mode||0o700);},
    writeFileSync(file,data,options={}){if(typeof file!=='number'&&!entries.has(file))make(file,false,options.mode||0o600);else if(options.flag==='wx')fail('EEXIST');entry(file).data=Buffer.from(data);},
    readFileSync(file,encoding){const data=entry(file).data;return encoding?data.toString(encoding):Buffer.from(data);},
    openSync(file,flags,mode){if(flags&fs.constants.O_CREAT){if(entries.has(file)&&flags&fs.constants.O_EXCL)fail('EEXIST');if(!entries.has(file))make(file,false,mode);}entry(file);const fd=sequence++;fds.set(fd,file);return fd;},
    lstatSync(file){return stat(entry(file));},fstatSync(fd){return stat(entry(fd));},
    closeSync(fd){fds.delete(fd);},fsyncSync(){},chownSync(file,uid){entry(file).uid=uid;},
    renameSync(from,to){entries.set(to,entry(from));entries.delete(from);},
    unlinkSync(file){entry(file);entries.delete(file);},rmdirSync(file){entry(file);entries.delete(file);},
    existsSync(file){return entries.has(file);},
  };
  return api;
}

class HttpException extends Error{
  constructor(message,status){super(message);this.status=status;}getStatus(){return this.status;}getResponse(){return this.message;}
}
const nest={HttpException,Injectable:()=>()=>{},CallHandler:class{},ExecutionContext:class{},NestInterceptor:class{}};
for(const [name,status] of Object.entries({UnauthorizedException:401,BadRequestException:400,ForbiddenException:403,NotFoundException:404,ConflictException:409,ServiceUnavailableException:503}))nest[name]=class extends HttpException{constructor(message){super(message,status);}};

async function releaseHarness({closed=false,retired=false,inactive=false}={}){
  const mem=memoryFs();mem.mkdirSync('/state',{mode:0o700});
  const state={version:1,service:input.service,generations:retired?['release','forward']:['release'],epoch:0,phase:closed?'closed':'open',legacy:'new-empty-service',work:{}};
  if(retired)state.deployment={previousGeneration:'release',generation:'forward',epoch:0,ownerSha256:'a'.repeat(64),bootstrap:false};
  mem.writeFileSync('/state/runtime-state.json',JSON.stringify(state),{mode:0o600});
  const context=vm.createContext({Buffer,URL,performance,setTimeout,clearTimeout,structuredClone,SharedArrayBuffer,Atomics,Int32Array,console,
    process:{env:{APP_ENV:'production',NODE_ENV:'production',MAINTENANCE_STATE_ROOT:'/state',MAINTENANCE_SERVICE:input.service,MAINTENANCE_GENERATION:retired?'forward':'release',PUBLIC_API_BASE_URL:'https://api.synthetic.invalid',PUBLIC_WIDGET_BUNDLE_URL:'https://widget.synthetic.invalid/widget.js'},getuid:()=>1000},require:{main:null},module:{}});
  const cached=new Map();
  function synthetic(id,exports){
    if(cached.has(id))return cached.get(id);
    const mod=new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context,identifier:id});cached.set(id,mod);return mod;
  }
  const actual=new Set(['admin-writer/server.ts','admin-writer/admin-writer.ts','admin-writer/protocol.ts','utils/admin-scope.service.ts','maintenance/maintenance-runtime.ts','maintenance/maintenance-state.ts','modules/widget/services/widget-config.service.ts']);
  class SitesService{constructor(db){this.db=db;}async updateSite(id,body){await this.db.query('UPDATE sites SET name=$2 WHERE id=$1',[id,body.name]);return{};}}
  const inert=new Set(['TenantsService','SubscriptionService','UsageLimitService','AuditLogService','KnowledgeSourcesService','TenantUsersService']);
  async function load(file){
    if(cached.has(file))return cached.get(file);
    // Strip only Injectable's DI metadata; all authorization and maintenance method bodies execute unchanged.
    const ts=fs.readFileSync(file,'utf8').replace(/^@Injectable\(\)\s*$/gm,'');
    // Node retains legacy value-style type imports that the TypeScript compiler elides.
    const code=stripTypeScriptTypes(ts,{mode:'transform'}).replace(/, (WorkKind|DashboardAuthContext|WriterRequest) }/g,' }');
    const mod=new vm.SourceTextModule(code,{context,identifier:file});cached.set(file,mod);
    await mod.link(async(id,parent)=>{
      if(id==='node:fs')return synthetic(id,mem);
      if(id==='node:http')return synthetic(id,{createServer:forbidden,IncomingMessage:class{},ServerResponse:class{}});
      if(['node:path','node:crypto','node:perf_hooks','node:async_hooks'].includes(id))return synthetic(id,require(id));
      if(id==='@nestjs/common')return synthetic(id,nest);
      if(id==='reflect-metadata')return synthetic(id,{});
      if(id==='pg')return synthetic(id,{Pool:forbidden,PoolClient:class{}});
      if(id==='rxjs')return synthetic(id,{Observable:class{}});
      if(id==='class-transformer')return synthetic(id,{plainToInstance:(_type,body)=>body,ClassConstructor:class{}});
      if(id==='class-validator')return synthetic(id,{validate:async()=>[]});
      const resolved=path.resolve(path.dirname(parent.identifier),id+'.ts');
      if(actual.has(path.relative(path.join(source,'apps/api/src'),resolved)))return load(resolved);
      if(id==='../sites/sites.service')return synthetic(resolved,{SitesService});
      const original=fs.readFileSync(parent.identifier,'utf8');
      const declaration=[...original.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)].find(m=>m[2]===id);
      assert.ok(declaration,'Unexpected source dependency: '+id);
      const names=declaration[1].split(',').map(x=>x.trim().replace(/^type\s+/,''));
      return synthetic(resolved,Object.fromEntries(names.map(name=>[name,inert.has(name)?class{}:forbidden])));
    });
    return mod;
  }
  const server=await load(path.join(source,'apps/api/src/admin-writer/server.ts'));await server.evaluate();
  const widget=await load(path.join(source,'apps/api/src/modules/widget/services/widget-config.service.ts'));await widget.evaluate();
  const {MaintenanceState}=cached.get(path.join(source,'apps/api/src/maintenance/maintenance-state.ts')).namespace;
  const {AdminWriter}=cached.get(path.join(source,'apps/api/src/admin-writer/admin-writer.ts')).namespace;
  const {verifyWriterRequest}=cached.get(path.join(source,'apps/api/src/admin-writer/protocol.ts')).namespace;
  const db={sites:[{id:'foreign-site',tenant_id:'foreign-tenant',name:'Foreign'},{id:'synthetic-site',tenant_id:'synthetic-tenant',name:'Synthetic'}],receipts:[]};
  const query=async(sql,args=[])=>{
    if(sql.startsWith('SELECT row_to_json'))return{rows:plain(db.sites.map(row=>({row})))};
    if(sql.startsWith('SELECT id,request_sha256'))return{rows:plain([...db.receipts].sort((a,b)=>a.id.localeCompare(b.id)))};
    if(sql.startsWith('SELECT name'))return{rows:[{name:db.sites.find(s=>s.id==='synthetic-site').name}]};
    if(sql.startsWith('SELECT count(*)')&&sql.includes('writer_receipts'))return{rows:[{n:db.receipts.filter(r=>r.id===args[0]).length}]};
    if(sql.includes('pg_stat_activity'))return{rows:[{usename:'ssb_runtime',n:1},{usename:'ssb_admin_writer',n:1}]};
    if(sql.includes('SELECT id FROM tenant_users'))return{rows:!inactive&&args[0]==='synthetic-operator'&&args[1]==='synthetic-tenant'?[{id:args[0]}]:[]};
    if(sql.startsWith('SELECT id FROM sites'))return{rows:db.sites.filter(s=>s.id===args[0]).map(s=>({id:s.id}))};
    if(sql.startsWith('SELECT id, tenant_id'))return{rows:plain(db.sites.filter(s=>s.id===args[0]).map(s=>({id:s.id,tenant_id:s.tenant_id})))};
    if(sql.startsWith('UPDATE sites SET name')){db.sites.find(s=>s.id===args[0]).name=args[1];return{rows:[]};}
    if(sql.includes('INSERT INTO maintenance_admin.writer_receipts')){
      if(db.receipts.some(r=>r.id===args[0]))return{rows:[]};db.receipts.push({id:args[0],request_sha256:args[1],completed_at:'synthetic'});return{rows:[{id:args[0]}]};
    }
    if(sql.startsWith('SET LOCAL')||sql.includes('pg_advisory_xact_lock'))return{rows:[]};
    throw Error('Unexpected mock SQL: '+sql);
  };
  let serial=Promise.resolve(),poolEnds=0;
  class Pool{
    async query(...args){return query(...args);}
    async connect(){
      const wait=serial;let release;serial=new Promise(resolve=>{release=resolve;});await wait;
      let before;
      return{on(){},removeListener(){},release,
        async query(sql,args){if(sql==='BEGIN'){before=plain(db);return{rows:[]};}if(sql==='ROLLBACK'){Object.assign(db,before);return{rows:[]};}if(sql==='COMMIT')return{command:'COMMIT',rows:[]};return query(sql,args);}};
    }
    async end(){poolEnds++;}
  }
  const writer=server.namespace.writerHandler(new AdminWriter(new Pool(),input.writerKey));
  async function writerHttp(options={}){
    let status,body;await writer({method:'POST',url:'/v1/write',headers:options.headers||{},async *[Symbol.asyncIterator](){yield Buffer.from(options.body||'{}');}},
      {setHeader(){},writeHead(n){status=n;},end(value){body=value;}});
    return new Response(body,{status,headers:{'content-type':'application/json'}});
  }
  const configService=new widget.namespace.WidgetConfigService({query:forbidden});
  configService.getSiteByKey=async()=>({id:'synthetic-site',siteKey:'synthetic-key',name:db.sites[1].name,publicKey:'',domain:'synthetic.invalid',isActive:true,welcomeMessage:'Synthetic widget greeting',consentRequired:true,leadCaptureEnabled:true,companyName:'Synthetic',botName:'Synthetic',logoUrl:'',brandColor:'#123456',accentColor:'#ffffff',fontFamily:'system',suggestedQuestionsByPath:{},privacyUrl:'',systemPrompt:'synthetic-private-prompt',tenantId:'synthetic-tenant',leadNotificationEmail:'private@example.invalid',conversationFlow:{syntheticPrivate:true}});
  return{mem,MaintenanceState,db,Pool,writerHttp,verifyWriterRequest,config:()=>configService.getPublicConfig('synthetic-key'),poolEnds:()=>poolEnds};
}

function transport(h,mutation={}){
  const calls=[],reply=(body,status=200,headers={})=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers});
  const fetch=async(url,options={})=>{
    calls.push({url,options});const u=new URL(url),cookie=options.headers?.cookie;
    if(u.pathname==='/api/auth/login'){
      const headers=new Headers();for(const name of ['ssb_admin','ssb_writer_session'])headers.append('set-cookie',name+'=synthetic; Path=/; HttpOnly; Secure; SameSite=Strict');return reply({role:'admin'},200,headers);
    }
    if(u.pathname==='/api/auth/logout'){
      const headers=new Headers({location:'https://synthetic.invalid/login?loggedOut=1'});
      for(const name of ['ssb_admin','ssb_writer_session'])headers.append('set-cookie',name+'=; Path='+(mutation.logoutPath||'/')+(mutation.logoutDomain?'; Domain=synthetic.invalid':'')+'; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict');return reply('',303,headers);
    }
    if(u.pathname==='/api/auth/session'||u.pathname==='/api/sites')return reply([],cookie?200:401);
    if(u.pathname==='/api/sites/synthetic-site'){h.db.sites[1].name=JSON.parse(options.body).name;return reply({});}
    if(u.pathname==='/v1/write'){
      const request=JSON.parse(options.body||'{}'),foreign=request.path?.endsWith('/foreign-site');
      if(foreign&&mutation.allowForeign){h.db.sites[0].name=request.body.name;return reply({});}
      const response=await h.writerHttp(options);
      if(foreign&&mutation.foreignEffect==='sites')h.db.sites[0].name='mutated despite denial';
      if(foreign&&mutation.foreignEffect==='receipts')h.db.receipts.push({id:request.id,request_sha256:'invalid',completed_at:'synthetic'});
      if(mutation.closedEffect==='sites')h.db.sites[1].name='mutated despite maintenance';
      if(mutation.closedEffect==='receipts')h.db.receipts.push({id:crypto.randomUUID(),request_sha256:'invalid',completed_at:'synthetic'});
      return response;
    }
    if(u.pathname==='/login')return reply('login');
    if(u.pathname==='/admin/widget/report-subscriptions')return reply([],options.method==='POST'||u.searchParams.get('siteId')==='foreign-site'?403:200);
    if(u.pathname==='/admin/sites'||u.pathname==='/admin/sites/synthetic-site')return reply({},mutation.closed?503:403);
    if(u.pathname==='/healthz')return reply('ok');
    if(u.pathname==='/version.json')return reply({ok:true,service:'widget',commit:input.source,buildTime:input.buildDate});
    if(['/widget.js','/loader.js'].includes(u.pathname))return reply('/*'+'synthetic'.repeat(20)+'*/',200,{'content-type':'application/javascript','x-content-type-options':'nosniff'});
    if(u.pathname==='/widget/config'){
      assert.equal(u.searchParams.get('siteKey'),'synthetic-key');assert.equal(options.headers.origin,'https://synthetic.invalid');
      const config=plain(await h.config());if(mutation.config)mutation.config(config,u.hostname);
      return reply(config,mutation.configStatus||200,{'content-type':'application/json'});
    }
    if(['/widget/__ssb_e1_no_provider__','/__ssb_e1_missing__'].includes(u.pathname))return reply({message:'missing'},404);
    throw Error('Unexpected mock URL: '+url);
  };
  return{fetch,calls};
}
function probes(h,wire){
  const widget=loadCjs(path.join(target,'widget-proof.cjs'),{}, {fetch:wire.fetch});let ticks=0;
  const probe=loadCjs(path.join(target,'probe.cjs'),{'node:fs':h.mem,'/app/node_modules/pg':{Pool:h.Pool},'./widget-proof.cjs':widget,'/app/dist/maintenance/maintenance-state':{MaintenanceState:h.MaintenanceState}},
    {fetch:wire.fetch,performance:{now:()=>ticks+=1000},setTimeout:fn=>fn()});
  return{probe,widget};
}

test('closed-ready reaches real writer maintenance admission with valid signed payload and zero DB/ledger effects',async()=>{
  const h=await releaseHarness({closed:true}),wire=transport(h,{closed:true}),{probe}=probes(h,wire),before=plain(h.db);
  assert.equal((await h.writerHttp()).status,401);
  const result=await probe.main({...input,action:'closed-ready'});
  assert.deepEqual(plain(result),{verified:true,counts:[3,2]});assert.deepEqual(h.db,before);assert.equal(h.poolEnds(),1);
  const request=wire.calls.find(c=>c.url.includes('/v1/write')).options;
  assert.equal(h.verifyWriterRequest(request.body,request.headers['x-admin-writer-signature'],input.writerKey).path,'/admin/sites/synthetic-site');
});
for(const effect of ['sites','receipts'])test('closed-ready rejects 503 that changes '+effect,async()=>{
  const h=await releaseHarness({closed:true}),wire=transport(h,{closed:true,closedEffect:effect}),{probe}=probes(h,wire);
  await assert.rejects(probe.main({...input,action:'closed-ready'}));
  assert.ok(wire.calls.some(c=>c.url.includes('/v1/write')&&c.options.headers?.['x-admin-writer-signature']));assert.equal(h.poolEnds(),1);
});

test('actual fixture Compose bytes escape dollars while raw config and operating digests round-trip',()=>{
  const mem=memoryFs(),fixtures=loadCjs(path.join(target,'fixtures.cjs'),{'node:fs':mem});
  const policy=loadCjs(path.join(__dirname,'adapters/scripts/ops/maintenance-start-contract.cjs'),{'node:fs':mem,'../../apps/api/dist/maintenance/maintenance-state':{MaintenanceDenied:class extends Error{}}});
  const values=fixtures.secrets(),salt=Buffer.alloc(16,0xaa);
  values.passwordHash='scrypt$'+salt.toString('hex')+'$'+crypto.scryptSync(values.password,salt,64).toString('hex');
  const native={privateRoot:'/private-fixture',stateRoot:'/state',prefix:'offline-review',synthetic:values,options:{run:'123'},docker:'/not-invoked',daemonId:'not-invoked',images:Object.fromEntries(fixtures.services.map((s,i)=>[s,'sha256:'+String(i+1).repeat(64)])),networks:Object.fromEntries(fixtures.networks.map((s,i)=>[s,{name:s,id:String(i+1).repeat(64),internal:true}]))};
  const g=fixtures.generation(native,'release','seed',[],policy),bytes=mem.readFileSync(g.common.files[0].path,'utf8'),serialized=JSON.parse(bytes);
  assert.equal(g.config.services.dashboard.environment.ADMIN_PANEL_PASSWORD_HASH,values.passwordHash);
  assert.equal(serialized.services.dashboard.environment.ADMIN_PANEL_PASSWORD_HASH,values.passwordHash.replace(/\$/g,()=> '$$'));
  const interpolate=v=>typeof v==='string'?v.replace(/\$\$|\$\{[^}]+\}|\$[a-zA-Z_][a-zA-Z_0-9]*/g,x=>x==='$$'?'$':'UNEXPECTED_INTERPOLATION'):Array.isArray(v)?v.map(interpolate):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,interpolate(x)])):v;
  const resolved=interpolate(serialized);assert.deepEqual(resolved,plain(g.config));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),g.common.files[0].sha256);
  for(const service of fixtures.services)assert.equal(policy.operatingDigest(service,resolved.services[service].environment||{}),g.common.operatingEnvironmentSha256[service]);
});

test('E1 positive path covers real scoped dispatch, applied logout jar and widget config with exact [11,7]',async()=>{
  const h=await releaseHarness(),wire=transport(h),{probe}=probes(h,wire),result=await probe.e1(input);
  assert.deepEqual(plain(result.counts),[11,7]);assert.equal(result.verified,true);assert.equal(result.hashes.length,2);
  const writes=wire.calls.filter(c=>c.url.includes('/v1/write')).map(c=>JSON.parse(c.options.body));
  const scoped=writes.filter(w=>w.session.role==='operator');assert.equal(scoped.length,2);
  assert.ok(scoped.some(w=>w.path==='/admin/sites/foreign-site'));assert.equal(h.db.sites[0].name,'Foreign');assert.equal(h.db.sites[1].name,'Synthetic scoped release');
  for(const request of scoped){const claims=JSON.parse(Buffer.from(request.authorization.slice(7).split('.')[0],'base64url'));for(const field of ['role','sub','exp','tenantId','tenantUserId'])assert.equal(claims[field],request.session[field]);}
  const after=wire.calls.slice(wire.calls.findIndex(c=>c.url.endsWith('/api/auth/logout'))+1).filter(c=>c.url.endsWith('/api/auth/session')||c.url.endsWith('/api/sites'));
  assert.equal(after.length,2);for(const c of after)assert.equal(c.options.headers.cookie,'');
  assert.equal(wire.calls.filter(c=>c.url.includes('/widget/config?')).length,2);assert.equal(h.poolEnds(),1);
});
for(const mutation of [{logoutPath:'/wrong-scope'},{logoutDomain:true}])test('logout rejects mismatched deletion scope '+JSON.stringify(mutation),async()=>{
  const h=await releaseHarness(),wire=transport(h,mutation),{probe}=probes(h,wire);await assert.rejects(probe.e1(input));
  assert.ok(wire.calls.some(c=>c.url.endsWith('/api/auth/logout')));assert.ok(!wire.calls.some(c=>c.url.endsWith('/api/auth/session')));
});
for(const mutation of [{allowForeign:true},{foreignEffect:'sites'},{foreignEffect:'receipts'}])test('scoped writer rejects cross-tenant counterexample '+JSON.stringify(mutation),async()=>{
  const h=await releaseHarness(),wire=transport(h,mutation),{probe}=probes(h,wire);await assert.rejects(probe.e1(input));
  assert.ok(wire.calls.some(c=>c.url.includes('/v1/write')&&JSON.parse(c.options.body).path==='/admin/sites/foreign-site'));assert.equal(h.poolEnds(),1);
});
test('scoped writer requires active principal and fails if own write is not allowed',async()=>{
  const h=await releaseHarness({inactive:true}),wire=transport(h),{probe}=probes(h,wire);await assert.rejects(probe.e1(input));
  const scoped=wire.calls.filter(c=>c.url.includes('/v1/write')).map(c=>JSON.parse(c.options.body)).filter(w=>w.session.role==='operator');
  assert.equal(scoped.length,1);assert.equal(h.db.receipts.some(r=>r.id===scoped[0].id),false);
});

for(const [name,mutation]of [
  ['non-200',{configStatus:500}],
  ['missing public field',{config:c=>{delete c.siteKey;}}],
  ['private field',{config:c=>{c.systemPrompt='private';}}],
  ['nested private field',{config:c=>{c.theme.tenantId='foreign';}}],
  ['wrong public type',{config:c=>{c.leadCaptureEnabled='true';}}],
  ['private value',{config:c=>{c.title='synthetic-private-prompt';}}],
  ['proxy divergence',{config:(c,host)=>{if(host==='widget')c.title='Different';}}],
])test('widget rejects '+name,async()=>{
  const h=await releaseHarness(),wire=transport(h,mutation),{widget}=probes(h,wire);
  await assert.rejects(widget.verifyWidget({fetchImpl:wire.fetch,base:'http://widget:80',api:'http://api:5000',commit:input.source,buildDate:input.buildDate}));
  assert.ok(wire.calls.some(c=>c.url.startsWith('http://widget:80/widget/config?')));
});

for(const via of ['probe','state-agent'])test(via+' proves eight actual old-generation denials while current generation admits work',async()=>{
  const h=await releaseHarness({retired:true}),attempts=[];
  class ObservedState extends h.MaintenanceState{begin(kind,...args){attempts.push([this.binding.generation,kind]);return super.begin(kind,...args);}}
  const {probe}=probes({...h,MaintenanceState:ObservedState},transport(h));
  const request={...input,action:'retired-admission',generation:'forward',retiredGeneration:'release',binding:{root:'/state',service:input.service,generation:'forward'},toolsRoot:'/tools'};
  const agent=loadCjs(path.join(target,'state-agent.cjs'),{'node:fs':h.mem,'/tools/apps/api/dist/maintenance/maintenance-state.js':{MaintenanceState:ObservedState},'./probe.cjs':probe},{process:{getuid:()=>1000}});
  const result=await(via==='probe'?probe.main(request):agent.run(request));
  assert.deepEqual(plain(result),{verified:true,counts:[8,1],generation:'forward',retiredGeneration:'release',code:'generation_retired'});
  assert.deepEqual(attempts,[['forward','http'],...['http','handler','import','worker','job','database','provider','configuration'].map(k=>['release',k])]);
  const state=new h.MaintenanceState(request.binding).snapshot();assert.equal(state.phase,'open');assert.ok(Object.values(state.work).every(w=>w.generation==='forward'&&w.state==='completed'));
});
test('retired action rejects closed current generation, unknown old generation and wrong refusal code',async()=>{
  const h=await releaseHarness({retired:true}),wire=transport(h),{probe}=probes(h,wire),request={...input,action:'retired-admission',generation:'forward',retiredGeneration:'release'};
  assert.equal(typeof probe.retiredAdmission,'function');
  await assert.rejects(probe.main({...request,retiredGeneration:'missing'}));
  class WrongCode extends h.MaintenanceState{begin(kind,...args){if(this.binding.generation==='release'&&kind==='provider')throw Object.assign(Error('wrong refusal'),{code:'admission_closed'});return super.begin(kind,...args);}}
  assert.throws(()=>probe.retiredAdmission(request,WrongCode));
  const state=JSON.parse(h.mem.readFileSync('/state/runtime-state.json','utf8'));state.phase='closed';h.mem.writeFileSync('/state/runtime-state.json',JSON.stringify(state));
  await assert.rejects(probe.main(request));
});

test('initialize seeds scoped principal and private/public widget config without changing [34,4,1]',async()=>{
  const queries=[],mem={readdirSync:()=>Array.from({length:34},(_,i)=>String(i+1).padStart(3,'0')+'_mock.sql'),readFileSync:()=> '-- offline SQL fixture'};
  const query=async(sql,args)=>{queries.push({sql,args});return{rows:sql.includes("current_setting('server_version_num')")?[{version:'160013',vector:'synthetic-vector',migrations:34}]:[]};};
  class Pool{query=query;async connect(){return{query,release(){}};}async end(){}}
  const probe=loadCjs(path.join(target,'probe.cjs'),{'node:fs':mem,'/app/node_modules/pg':{Pool}});
  const result=await probe.main({...input,action:'initialize',passwords:Object.fromEntries(['ssb_runtime','ssb_admin_writer','ssb_reporter','ssb_migrator'].map(r=>[r,'a'.repeat(64)]))});
  assert.deepEqual(plain(result.counts),[34,4,1]);
  assert.ok(queries.some(q=>q.sql.includes('INSERT INTO tenant_users')&&q.sql.includes("'synthetic-operator','synthetic-tenant'")&&q.sql.includes("'editor',true")));
  const config=queries.find(q=>q.sql.startsWith('UPDATE sites SET config='));assert.ok(config);assert.equal(JSON.parse(config.args[0]).welcomeMessage,'Synthetic widget greeting');assert.equal(JSON.parse(config.args[0]).systemPrompt,'synthetic-private-prompt');
});
