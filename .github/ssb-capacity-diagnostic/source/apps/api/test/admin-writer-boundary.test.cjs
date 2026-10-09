const test=require('node:test'),assert=require('node:assert/strict');
const {randomBytes,createHmac,randomUUID}=require('node:crypto');
const {writerRoute,verifyWriterRequest}=require('../dist/admin-writer/protocol');
const {runtimeAdminBoundary}=require('../dist/admin-writer/runtime-boundary');
const {reporterAccess}=require('../dist/utils/reporter-access');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');

test('writer signature, independent session proof, expiry and closed operation vocabulary',()=>{
 const key=randomBytes(32).toString('hex'),now=Date.now(),session={role:'admin',sub:'synthetic',exp:now+60000};
 const token=Buffer.from(JSON.stringify(session)).toString('base64url')+'.synthetic';
 const value={version:1,id:randomUUID(),issuedAt:now,expiresAt:now+20000,method:'DELETE',path:'/admin/sites/site-1',body:{confirmation:'synthetic'},session,
 authorization:`Bearer ${token}`,sessionProof:createHmac('sha256',key).update(`writer-session-v1:${token}`).digest('hex')};
 const verify=v=>{const p=JSON.stringify(v);return verifyWriterRequest(p,createHmac('sha256',key).update(p).digest('hex'),key)};
 assert.equal(verify(value).path,value.path);
 for(const delta of [{sessionProof:undefined},{sessionProof:'0'.repeat(64)},{authorization:`Bearer ${token}forged`},
  {expiresAt:now-1},{issuedAt:now-40000},{path:'/sql'},{path:'/admin/sites/site-1',owner:'forged'},
  {session:{...session,role:'operator'}},{path:'/internal/site-runtime-grants/t/s/preview'}]) assert.throws(()=>verify({...value,...delta}));
 assert.equal(writerRoute('DELETE','/admin/sites/a%2Fb'),true);
 assert.equal(writerRoute('DELETE','/admin/sites/a%XX'),false);
});

test('legacy API rejects case and encoded-ID writer routes before handlers, preserving read routes',()=>{
 for(const url of ['/admin/sites/site-1','/ADMIN/SITES/SITE-1/','/admin/sites/a%2Fb?x=1','/admin/ingest/knowledge/doc']){
  let status,called=false;const res={status(n){status=n;return this},json(){}};
  runtimeAdminBoundary({method:'DELETE',url,originalUrl:url},res,()=>{called=true});
  assert.equal(status,403);assert.equal(called,false);
 }
 let called=false;runtimeAdminBoundary({method:'GET',url:'/admin/sites/site-1'}, {},()=>{called=true});assert.equal(called,true);
});

test('private runtime metadata supports disabled providers and rejects drift without receiving a provider credential',t=>{
 const saved={...process.env},root=fs.mkdtempSync(path.join(os.tmpdir(),'writer-binding-'));
 t.after(()=>{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);fs.rmSync(root,{recursive:true})});
 Object.assign(process.env,{NODE_ENV:'production',APP_ENV:'production',MAINTENANCE_STATE_ROOT:root,MAINTENANCE_SERVICE:'synthetic-api',MAINTENANCE_GENERATION:'one',ADMIN_WRITER_RUNTIME_FILE:path.join(root,'binding.json')});
 delete process.env.OPENAI_API_KEY;delete process.env.OPENAI_EMBED_PROVIDER;delete process.env.OPENAI_EMBED_MODEL;
 const binding={version:1,service:'synthetic-api',generation:'one',environment:'production',
  query_embedding:{providerKey:'openai',model:'text-embedding-3-small',supported:true},llm_generation:{providerKey:'openai',model:'',supported:false}};
 const write=value=>fs.writeFileSync(process.env.ADMIN_WRITER_RUNTIME_FILE,JSON.stringify(value),{mode:0o600});
 const {assertRuntimeGrantBinding,writerRuntimeContract}=require('../dist/admin-writer/runtime-contract');
 write(binding);assertRuntimeGrantBinding();assert.equal(writerRuntimeContract('llm_generation').supported,false);
 for(const changed of [{...binding,generation:'other'},{...binding,environment:'non_production'},
  {...binding,query_embedding:{...binding.query_embedding,model:'other'}},{...binding,llm_generation:{...binding.llm_generation,supported:true}}]){
  write(changed);assert.throws(assertRuntimeGrantBinding);
 }
});

test('reporter credential grants only its explicit GET tenant/site bindings, never an admin fallback',t=>{
 const saved={...process.env},token=randomBytes(32).toString('hex');
 t.after(()=>{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)});
 process.env.REPORTER_API_TOKEN=token;process.env.REPORTER_SITE_BINDINGS=JSON.stringify([{tenantId:'tenant-1',siteId:'site-1'}]);
 const request=(method,url,credential=token)=>({method,url,headers:{'x-reporter-token':credential,'x-admin-key':'forged'}});
 for(const url of ['/admin/widget/sites/site-1','/admin/widget/events/summary?siteId=site-1','/admin/widget/optimization?siteId=site-1','/admin/widget/report-subscriptions?siteId=site-1']){
  const auth=reporterAccess(request('GET',url));assert.equal(auth.tenantId,'tenant-1');assert.equal(auth.authMode,'reporter-read-only');
  assert.throws(()=>reporterAccess(request('POST',url)),e=>e.getStatus()===403);
 }
 for(const url of ['/admin/sites/site-1','/admin/widget/sites/site-2','/admin/widget/report-subscriptions','/admin/widget/report-subscriptions?siteId=site-1&siteId=site-2','/admin/widget/events/summary?siteId=site-1&tenantId=tenant-2'])assert.throws(()=>reporterAccess(request('GET',url)),e=>e.getStatus()===403);
 assert.throws(()=>reporterAccess(request('GET','/admin/widget/sites/site-1','é'.repeat(64))),e=>e.getStatus()===401);
});
