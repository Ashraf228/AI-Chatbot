'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID,createHash,createHmac}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
const kinds=['http','handler','import','worker','job','database','provider','configuration'];
let phase='input';
async function http(url,options={}){
  const u=new URL(url);assert.ok(['api','dashboard','admin-writer','widget'].includes(u.hostname));assert.equal(u.protocol,'http:');
  const r=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(3500)}),text=await r.text();assert.ok(Buffer.byteLength(text)<2*1024*1024);
  return{status:r.status,headers:r.headers,text};
}
function pool(input,role='postgres',host='db'){const {Pool}=require('/app/node_modules/pg');return new Pool({host,port:5432,user:role,password:input.passwords[role],database:'synthetic',connectionTimeoutMillis:2500,statement_timeout:3000,max:2});}
function writerRequest(input,route,id=randomUUID(),principal={role:'admin',sub:'dashboard-admin'},body={name:'Synthetic retained'}){
  const now=Date.now(),session={...principal,exp:now+60000};
  const encoded=Buffer.from(JSON.stringify({...session,iat:now,sessionIssuedAt:new Date(now).toISOString(),sessionExpiresAt:new Date(session.exp).toISOString(),jti:randomUUID()})).toString('base64url');
  const token=encoded+'.'+createHmac('sha256',input.session).update(encoded).digest('base64url');
  const payload=JSON.stringify({version:1,id,issuedAt:now,expiresAt:now+30000,method:'PATCH',path:route,body,session,authorization:'Bearer '+token,sessionProof:createHmac('sha256',input.writerKey).update('writer-session-v1:'+token).digest('hex')});
  return{body:payload,headers:{'content-type':'application/json','x-admin-writer-signature':createHmac('sha256',input.writerKey).update(payload).digest('hex')},method:'POST'};
}
async function writerEffects(p){
  return{sites:(await p.query('SELECT row_to_json(s) AS row FROM sites s ORDER BY id')).rows,
    receipts:(await p.query('SELECT id,request_sha256,completed_at FROM maintenance_admin.writer_receipts ORDER BY id')).rows};
}
const sessionCookieNames=['ssb_admin','ssb_writer_session'];
function sessionCookie(line){
  const [pair,...parts]=line.split(';'),index=pair.indexOf('=');assert.ok(index>0);
  const name=pair.slice(0,index),value=pair.slice(index+1),attrs={};
  assert.ok(sessionCookieNames.includes(name));
  for(const part of parts){const [key,...rest]=part.trim().split('='),k=key.toLowerCase();assert.ok(!Object.hasOwn(attrs,k));attrs[k]=rest.length?rest.join('='):true;}
  assert.equal(attrs.path,'/');assert.equal(attrs.httponly,true);assert.equal(attrs.secure,true);assert.equal(String(attrs.samesite).toLowerCase(),'strict');
  const domain=attrs.domain===undefined?null:String(attrs.domain).replace(/^\./,'').toLowerCase();
  assert.ok(domain===null||domain==='synthetic.invalid');
  return{name,value,attrs,scope:JSON.stringify([name,domain,attrs.path])};
}
class SessionCookieJar{
  constructor(lines){
    assert.equal(lines.length,2);this.cookies=new Map();
    for(const line of lines){const c=sessionCookie(line);assert.ok(c.value);assert.ok(!this.cookies.has(c.name));this.cookies.set(c.name,c);}
  }
  header(){return [...this.cookies.values()].map(c=>c.name+'='+c.value).join('; ');}
  logout(lines){
    assert.equal(lines.length,2);
    for(const line of lines){const c=sessionCookie(line),login=this.cookies.get(c.name);assert.ok(login);assert.equal(c.scope,login.scope);assert.equal(c.value,'');assert.equal(c.attrs['max-age'],'0');assert.equal(Date.parse(c.attrs.expires),0);this.cookies.delete(c.name);}
    assert.equal(this.cookies.size,0);
  }
}
function retiredAdmission(input,MaintenanceState){
  const binding=input.binding||{root:'/state',service:input.service,generation:input.generation};
  assert.equal(typeof input.retiredGeneration,'string');assert.notEqual(input.retiredGeneration,binding.generation);
  const current=new MaintenanceState(binding),before=current.snapshot();
  assert.equal(before.phase,'open');assert.equal(before.deployment.generation,binding.generation);assert.ok(before.generations.includes(input.retiredGeneration));
  // A positive witness prevents a closed current generation from masquerading as retirement proof.
  const id=current.begin('http');current.end(id);
  const old=new MaintenanceState({...binding,generation:input.retiredGeneration});
  const retiredWork=s=>Object.entries(s.work).filter(([,w])=>w.generation===input.retiredGeneration);
  const prior=retiredWork(current.snapshot());
  for(const kind of kinds)assert.throws(()=>old.begin(kind),e=>e.code==='generation_retired');
  const after=current.snapshot();assert.equal(after.phase,'open');assert.equal(after.epoch,before.epoch);assert.deepEqual(after.deployment,before.deployment);assert.deepEqual(retiredWork(after),prior);
  return{verified:true,counts:[8,1],generation:binding.generation,retiredGeneration:input.retiredGeneration,code:'generation_retired'};
}
async function initialize(input){
  const {ProbeProgress,probeMigrations}=require('./diagnostics.cjs'),{need,bound}=require('./common.cjs');
  const trace=new ProbeProgress(input.diagnostic);let p,result,primary;
  const step=async(name,fn,migration=null)=>{trace.enter(name,migration);const value=await fn();trace.confirm();return value;};
  const cleanup=async(name,fn,migration=null)=>{try{await step(name,fn,migration);}catch(error){trace.capture(error);primary=primary?new AggregateError([primary,error],'probe_cleanup_failed'):error;}};
  try{
    const pm=fs.readFileSync(path.join(__dirname,'publication-manifest.json'));
    need(input.action==='initialize'&&input.source===trace.binding.source&&input.service==='ssb-native-'+trace.binding.run&&sha(pm)===trace.binding.publication,'probe_binding_invalid');
    const manifest=JSON.parse(pm),binding=manifest.files.find(f=>f.path==='.github/ssb-native-forward-recovery/release-source-manifest.json');
    need(binding,'probe_manifest_invalid');bound(path.join(__dirname,'release-source-manifest.json'),binding);trace.confirm();
    p=await step('pool-create',()=>pool(input));
    trace.enter('migration-list');
    const files=fs.readdirSync('/source/apps/api/migrations').filter(x=>/^\d{3}_[a-zA-Z0-9_-]+\.sql$/.test(x)).sort();assert.equal(files.length,34);
    const migrations=probeMigrations();need(JSON.stringify(files)===JSON.stringify(migrations.map(f=>path.basename(f.path))),'probe_migration_invalid');trace.confirm();
    await step('schema-ledger',()=>p.query('CREATE TABLE schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())'));
    for(const file of files){const number=Number(file.slice(0,3)),c=await step('migration-connect',()=>p.connect(),number);
      try{
        await step('migration-begin',()=>c.query('BEGIN'),number);
        const sql=await step('migration-read',()=>bound('/source/apps/api/migrations/'+file,migrations.find(f=>path.basename(f.path)===file)).toString('utf8'),number);
        await step('migration-execute',()=>c.query(sql),number);
        await step('migration-record',()=>c.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]),number);
        await step('migration-commit',()=>c.query('COMMIT'),number);
      }catch(error){trace.capture(error);primary=error;}
      await cleanup('client-release',()=>c.release(),number);if(primary)break;
    }
    if(primary)throw primary;
    const rolesSql=await step('roles-read',()=>fs.readFileSync('/proof/adapters/scripts/ops/admin-writer-roles.sql','utf8'));
    await step('roles-apply',()=>p.query(rolesSql));
    for(const role of ['ssb_runtime','ssb_admin_writer','ssb_reporter','ssb_migrator']){
      trace.enter('role-password-check');assert.match(input.passwords[role],/^[a-f0-9]{64}$/);trace.confirm();
      trace.enter('role-password-apply');await p.query(`ALTER ROLE ${role} ${['ssb_runtime','ssb_admin_writer'].includes(role)?'LOGIN':'NOLOGIN'} PASSWORD '${input.passwords[role]}'`);trace.confirm();
    }
    trace.enter('tenant-site-fixture');
    await p.query("INSERT INTO tenants(id,name) VALUES('synthetic-tenant','Synthetic'),('foreign-tenant','Foreign synthetic'); INSERT INTO sites(id,tenant_id,name,site_key,allowed_domains) VALUES('synthetic-site','synthetic-tenant','Synthetic','synthetic-key',ARRAY['synthetic.invalid']),('foreign-site','foreign-tenant','Foreign','foreign-key',ARRAY['foreign.invalid'])");
    trace.confirm();trace.enter('user-fixture');
    await p.query("INSERT INTO tenant_users(id,tenant_id,email,display_name,role,is_active) VALUES('synthetic-operator','synthetic-tenant','operator@example.invalid','Synthetic operator','editor',true)");
    trace.confirm();trace.enter('site-config-fixture');
    await p.query("UPDATE sites SET config=$1::jsonb WHERE id='synthetic-site'",[JSON.stringify({welcomeMessage:'Synthetic widget greeting',brandColor:'#123456',systemPrompt:'synthetic-private-prompt',leadNotificationEmail:'private@example.invalid',conversationFlow:{syntheticPrivate:true}})]);
    trace.confirm();trace.enter('database-readback');
    const row=(await p.query("SELECT current_setting('server_version_num') AS version,(SELECT extversion FROM pg_extension WHERE extname='vector') AS vector,(SELECT count(*)::integer FROM schema_migrations) AS migrations")).rows[0];
    trace.confirm();trace.enter('database-assertions');
    assert.equal(row.version,'160013');assert.ok(row.vector);assert.equal(row.migrations,34);
    trace.confirm();result={verified:true,counts:[34,4,1],hashes:[sha(row.vector)]};
  }catch(error){if(!trace.primary)trace.capture(error);if(!primary)primary=error;}
  if(p)await cleanup('pool-close',()=>p.end());
  if(primary){const error=new Error('probe_initialize_failed',{cause:primary});error.probeDiagnostic=trace.diagnostic();throw error;}return result;
}
async function e1(input){
  const p=pool(input);let checks=0;const check=async(name,fn)=>{phase=name;await fn();checks++;};
  try{
    let cookies,jar;
    await check('login',async()=>{const r=await http('http://dashboard:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://synthetic.invalid'},body:JSON.stringify({mode:'admin',password:input.password})});assert.equal(r.status,200);assert.equal(JSON.parse(r.text).role,'admin');jar=new SessionCookieJar(r.headers.getSetCookie());cookies=jar.header();});
    await check('sites-read',async()=>assert.equal((await http('http://dashboard:3000/api/sites',{headers:{cookie:cookies}})).status,200));
    await check('dashboard-writer',async()=>{const r=await http('http://dashboard:3000/api/sites/synthetic-site',{method:'PATCH',headers:{cookie:cookies,'content-type':'application/json',origin:'https://synthetic.invalid'},body:JSON.stringify({name:'Synthetic '+input.generation})});assert.equal(r.status,200);assert.equal((await p.query("SELECT name FROM sites WHERE id='synthetic-site'")).rows[0].name,'Synthetic '+input.generation);});
    await check('transaction-replay',async()=>{const req=writerRequest(input,'/admin/sites/synthetic-site',input.replayId);const r=await http('http://admin-writer:3011/v1/write',req);assert.equal(r.status,input.generation==='release'?200:409);assert.equal((await http('http://admin-writer:3011/v1/write',req)).status,409);assert.equal((await p.query('SELECT count(*)::integer n FROM maintenance_admin.writer_receipts WHERE id=$1',[input.replayId])).rows[0].n,1);});
    await check('atomic-failed-write',async()=>{const id=randomUUID();assert.equal((await http('http://admin-writer:3011/v1/write',writerRequest(input,'/admin/sites/nonexistent',id))).status,404);assert.equal((await p.query('SELECT count(*)::integer n FROM maintenance_admin.writer_receipts WHERE id=$1',[id])).rows[0].n,0);});
    await check('concurrent-replay',async()=>{const id=randomUUID(),req=writerRequest(input,'/admin/sites/synthetic-site',id);assert.deepEqual((await Promise.all([http('http://admin-writer:3011/v1/write',req),http('http://admin-writer:3011/v1/write',req)])).map(r=>r.status).sort(),[200,409]);});
    await check('writer-tenant-site-scope',async()=>{
      // The writer allows operator site PATCHes, not customer PATCHes; personal principals must exist.
      const principal={role:'operator',sub:'synthetic-operator',tenantId:'synthetic-tenant',tenantUserId:'synthetic-operator'},ownId=randomUUID(),name='Synthetic scoped '+input.generation;
      assert.equal((await http('http://admin-writer:3011/v1/write',writerRequest(input,'/admin/sites/synthetic-site',ownId,principal,{name}))).status,200);
      assert.equal((await p.query("SELECT name FROM sites WHERE id='synthetic-site'")).rows[0].name,name);
      assert.equal((await p.query('SELECT count(*)::integer n FROM maintenance_admin.writer_receipts WHERE id=$1',[ownId])).rows[0].n,1);
      const before=await writerEffects(p),foreignId=randomUUID();
      assert.equal((await http('http://admin-writer:3011/v1/write',writerRequest(input,'/admin/sites/foreign-site',foreignId,principal,{name:'Denied foreign mutation'}))).status,403);
      assert.deepEqual(await writerEffects(p),before);
      assert.equal((await p.query('SELECT count(*)::integer n FROM maintenance_admin.writer_receipts WHERE id=$1',[foreignId])).rows[0].n,0);
    });
    await check('reporter-scope',async()=>{for(const [url,status] of [['/admin/widget/report-subscriptions?siteId=synthetic-site',200],['/admin/widget/report-subscriptions?siteId=foreign-site',403],['/admin/sites',403]])assert.equal((await http('http://api:5000'+url,{headers:{'x-reporter-token':input.reporter}})).status,status);assert.equal((await http('http://api:5000/admin/widget/report-subscriptions?siteId=synthetic-site',{method:'POST',headers:{'x-reporter-token':input.reporter}})).status,403);});
    await check('runtime-write-denied',async()=>assert.equal((await http('http://api:5000/admin/sites/synthetic-site',{method:'PATCH',headers:{'x-admin-key':input.admin,'content-type':'application/json'},body:JSON.stringify({name:'denied'})})).status,403));
    await check('logout-contract',async()=>{const r=await http('http://dashboard:3000/api/auth/logout',{method:'POST',headers:{cookie:jar.header(),origin:'https://synthetic.invalid','x-forwarded-host':'synthetic.invalid','x-forwarded-proto':'https'}});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'https://synthetic.invalid/login?loggedOut=1');jar.logout(r.headers.getSetCookie());for(const u of ['/api/auth/session','/api/sites'])assert.ok([401,403].includes((await http('http://dashboard:3000'+u,{headers:{cookie:jar.header()}})).status));});
    await check('active-pools',async()=>{const rows=(await p.query("SELECT usename,count(*)::integer n FROM pg_stat_activity WHERE datname='synthetic' AND usename IN('ssb_runtime','ssb_admin_writer') GROUP BY usename")).rows;for(const role of ['ssb_runtime','ssb_admin_writer'])assert.ok(rows.find(r=>r.usename===role&&r.n>0));});
    phase='widget';const widget=await require('./widget-proof.cjs').verifyWidget({base:'http://widget:80',api:'http://api:5000',commit:input.source,buildDate:input.buildDate});assert.equal(widget.type,'SSB_WIDGET_VERIFIED');assert.equal(widget.checks.length,7);assert.equal(widget.config,200);
    return{verified:true,counts:[checks,7],hashes:widget.assets?.map(x=>x.sha256)||[]};
  }finally{await p.end();}
}
async function drain(input){
  const {MaintenanceState}=require('/app/dist/maintenance/maintenance-state'),state=new MaintenanceState({root:'/state',service:input.service,generation:input.generation});
  const held=[];for(const kind of kinds.filter(k=>k!=='configuration'))held.push(state.begin(kind));
  const p=pool(input),c=await p.connect();let pending;
  try{
    await c.query('BEGIN');await c.query('LOCK TABLE public.sites IN ACCESS EXCLUSIVE MODE');
    pending=http('http://api:5000/admin/sites',{headers:{'x-admin-key':input.admin}});pending.catch(()=>{});
    const until=performance.now()+1800;let active=false;
    while(performance.now()<until){active=(await p.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ssb_runtime' AND wait_event_type='Lock') ok")).rows[0].ok;if(active)break;await new Promise(r=>setTimeout(r,10));}assert.equal(active,true);
    fs.mkdirSync('/state/maintenance-window',{mode:0o700});fs.writeFileSync('/state/maintenance-window/owner.json',JSON.stringify({version:1,owner:input.owner}),{flag:'wx',mode:0o600});
    const epoch=state.close(input.owner);assert.throws(()=>state.drained(input.owner,epoch),e=>e.code==='drain_unproven');
    for(const kind of kinds)assert.throws(()=>state.begin(kind));
    assert.equal((await http('http://api:5000/admin/sites',{headers:{'x-admin-key':input.admin}})).status,503);
    assert.equal((await http('http://admin-writer:3011/v1/write',writerRequest(input,'/admin/sites/synthetic-site'))).status,503);
    await c.query('COMMIT');assert.equal((await pending).status,200);for(const id of held)state.end(id);
    const finish=performance.now()+1000;while(Object.values(state.snapshot().work).some(w=>w.state!=='completed')&&performance.now()<finish)await new Promise(r=>setTimeout(r,10));
    assert.equal(state.drained(input.owner,epoch).completed,true);
    return{verified:true,counts:[kinds.length,1,held.length],epoch};
  }finally{await c.query('ROLLBACK').catch(()=>{});c.release();await p.end();}
}
async function database(input){
  const p=pool(input,'postgres',input.host||'db');try{
    const snapshot={};
    snapshot.migrations=(await p.query('SELECT version FROM schema_migrations ORDER BY version')).rows;
    snapshot.roles=(await p.query("SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname LIKE 'ssb_%' ORDER BY rolname")).rows;
    snapshot.tables=(await p.query("SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) owner,c.relacl::text acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','maintenance_admin') AND c.relkind IN('r','p','S') ORDER BY 1,2")).rows;
    snapshot.constraints=(await p.query("SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','maintenance_admin') ORDER BY 1,2,3")).rows;
    snapshot.markers=(await p.query("SELECT id,tenant_id,name FROM sites WHERE id IN('synthetic-site','foreign-site') ORDER BY id")).rows;
    snapshot.receipts=(await p.query('SELECT id,request_sha256,completed_at FROM maintenance_admin.writer_receipts ORDER BY id')).rows;
    assert.equal((await p.query('SELECT count(*)::integer n FROM provider_approval_grants')).rows[0].n,0);
    assert.equal(snapshot.migrations.length,34);assert.equal(snapshot.roles.length,4);assert.equal(snapshot.markers.length,2);assert.ok(snapshot.receipts.length>=4);
    if(input.noPools)assert.equal((await p.query("SELECT count(*)::integer n FROM pg_stat_activity WHERE usename IN('ssb_runtime','ssb_admin_writer')")).rows[0].n,0);
    const digest=sha(JSON.stringify(snapshot));if(input.expected)assert.equal(digest,input.expected);
    return{verified:true,counts:[34,4,snapshot.receipts.length],hashes:[digest]};
  }finally{await p.end();}
}
async function main(input){
  phase=input.action;
  if(input.action==='restore-logins'){
    assert.equal(input.host,'restore-db');const admin=pool(input,'postgres','restore-db');
    try{for(const role of ['ssb_runtime','ssb_admin_writer']){
      assert.match(input.passwords[role],/^[a-f0-9]{64}$/);await admin.query(`ALTER ROLE ${role} PASSWORD '${input.passwords[role]}'`);
      const p=pool(input,role,'restore-db');try{assert.equal((await p.query('SELECT session_user AS name')).rows[0].name,role);await assert.rejects(p.query('SET ROLE postgres'),e=>e.code==='42501');}finally{await p.end();}
    }return{verified:true,counts:[2,2]};}finally{await admin.end();}
  }
  if(input.action==='closed-ready'){
    const p=pool(input);try{
    const before=await writerEffects(p),until=performance.now()+4500;let last;
    while(performance.now()<until){try{
      assert.equal((await http('http://api:5000/admin/sites',{headers:{'x-admin-key':input.admin}})).status,503);
      assert.equal((await http('http://admin-writer:3011/v1/write',writerRequest(input,'/admin/sites/synthetic-site'))).status,503);
      assert.equal((await http('http://dashboard:3000/login')).status,200);
      const after=await writerEffects(p);assert.deepEqual(after.sites,before.sites);assert.deepEqual(after.receipts,before.receipts);
      return{verified:true,counts:[3,2]};
    }catch(e){last=e;await new Promise(r=>setTimeout(r,50));}}
    throw last||Error('readiness deadline');
    }finally{await p.end();}
  }
  if(input.action==='retired-admission')return retiredAdmission(input,require('/app/dist/maintenance/maintenance-state').MaintenanceState);
  if(input.action==='postgres-ready-init'||input.action==='postgres-ready-restore')return require('./postgres-readiness.cjs').check(input);
  if(input.action==='initialize')return initialize(input);
  if(input.action==='roles'){const r=await require('./real-pools.cjs')({...input,host:'db'});assert.equal(r.status,'PASS');assert.equal(r.poolCleanup.completed,true);assert.equal(r.checks.length,32);return{verified:true,counts:[32]};}
  if(input.action==='e1')return e1(input);
  if(input.action==='drain')return drain(input);
  if(input.action==='database')return database(input);
  throw Error('unsupported proof');
}
if(require.main===module){let b='';process.stdin.on('data',x=>{b+=x;if(b.length>65536)throw Error('input limit');});process.stdin.on('end',async()=>{try{const r=await main(JSON.parse(b));process.stdout.write('\nSSB_PROOF_JSON '+JSON.stringify(r)+'\n');}catch(e){
 process.exitCode=1;
 // A diagnostic write failure never replaces the primary error or produces raw stderr.
 try{if(e.probeDiagnostic){const d=require('./diagnostics.cjs');fs.writeSync(2,d.probeMarker+JSON.stringify(d.validateProbe(e.probeDiagnostic))+'\n');}
 else fs.writeSync(2,JSON.stringify({status:'FAIL',phase:/^[a-z-]{1,40}$/.test(phase)?phase:'invalid',kind:e instanceof assert.AssertionError?'assertion':'operation',code:phase!=='initialize'&&typeof e.code==='string'&&/^[A-Z0-9_]{1,24}$/.test(e.code)?e.code:null})+'\n');}catch{}
}});}
module.exports={main,drain,e1,http,kinds,writerRequest,SessionCookieJar,retiredAdmission};
