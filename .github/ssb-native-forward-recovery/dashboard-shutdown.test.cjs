'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const contract=require('./dashboard-shutdown-contract.cjs');
const {createLifecycle,persist}=require('./dashboard-overlay/scripts/dashboard-lifecycle.cjs');
const binding=()=>({version:1,run:'12345678',source:contract.SOURCE,publication:'a'.repeat(64),service:'ssb-native-12345678',generation:'release',participant:'ssb-native-12345678-release-dashboard',imageId:'sha256:'+'b'.repeat(64)});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(options={}) {
  let closed=false,id=0;const running=new Set(),uncertain=new Set(),written=[],outputs=[],exits=[],events=[];
  const state={begin(){if(closed)throw Object.assign(Error(),{code:'admission_closed'});const v=++id;running.add(v);return v;},end(v,bad){running.delete(v);if(bad)uncertain.add(v);},stopAdmission(){events.push('admission');closed=true;},processWorkStatus(){return{running:running.size,uncertain:uncertain.size};}};
  const server={close(cb){events.push('http');cb();}};
  const args={binding:binding(),state,server,receipt:'/synthetic',handle:async(_req,res)=>{res.writableFinished=true;res.emit('finish');},upgrade:async()=>{},closeNext:async()=>{events.push('next');},write:(_p,v)=>written.push(structuredClone(v)),output:l=>outputs.push(l),exit:c=>exits.push(c),...options};
  const lifecycle=createLifecycle(args);
  const response=()=>{const r=new EventEmitter();r.setHeader=()=>{};r.end=()=>{r.writableFinished=true;r.emit('finish');};r.destroy=()=>{r.destroyed=true;r.emit('close');};return r;};
  return{lifecycle,args,response,state,events,written,outputs,exits,running,uncertain};
}
function redis(options={}) {const c=new EventEmitter();c.status='ready';c.quit=async()=>{c.status='end';c.emit('end');return'OK';};c.disconnect=()=>{c.status='end';c.emit('end');};return Object.assign(c,options);}
test('empty shutdown has full receipt and explicit exit 0 after closes',async()=>{const f=fixture();await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.events,['admission','http','next']);assert.deepEqual(f.exits,[0]);contract.validate(f.written[0],binding());});
test('active request is awaited; new requests denied; no duplicate completion',async()=>{
  let release;const f=fixture({handle:async(_q,r)=>{await new Promise(resolve=>{release=resolve;});r.writableFinished=true;r.emit('finish');}});
  f.lifecycle.request({},f.response());await tick();assert.equal(f.lifecycle.active,1);
  const one=f.lifecycle.stop('SIGTERM'),two=f.lifecycle.stop('SIGINT');assert.equal(one,two);
  const denied=f.response();f.lifecycle.request({},denied);assert.equal(denied.statusCode,503);assert.equal(f.exits.length,0);
  release();await one;assert.deepEqual(f.exits,[0]);assert.equal(f.written.length,1);assert.equal(f.running.size,0);
});
test('response finished but handler still active cannot pass',async()=>{
 let release;const f=fixture({handle:async(_q,r)=>{r.writableFinished=true;r.emit('finish');await new Promise(resolve=>release=resolve);}});
 f.lifecycle.request({},f.response());const stop=f.lifecycle.stop('SIGTERM');await tick();assert.equal(f.exits.length,0);release();await stop;assert.deepEqual(f.exits,[0]);
});
for(const kind of ['HTTP','Next','Redis QUIT','Redis response','work uncertain','request abort'])test(kind+' error remains failed',async()=>{
 const f=fixture(kind==='HTTP'?{server:{close(cb){cb(Error('private'));}}}:kind==='Next'?{closeNext:async()=>{throw Error('private');}}:{});
 if(kind==='Redis QUIT')f.lifecycle.registerRedis(redis({quit:async()=>{throw Error('private');}}));
 if(kind==='Redis response')f.lifecycle.registerRedis(redis({quit:async()=> 'NOT_OK'}));
 if(kind==='work uncertain')f.uncertain.add(1);
 if(kind==='request abort'){f.args.handle=async()=>{};const g=fixture({handle:async(_q,r)=>r.destroy()});g.lifecycle.request({},g.response());await tick();await g.lifecycle.stop('SIGTERM');assert.deepEqual(g.exits,[1]);return;}
 await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[1]);assert.equal(f.written[0].status,'failed');assert(!f.outputs.join('').includes('private'));
});
test('actual used Redis client quit and end must both complete',async()=>{
 let end;const c=redis({quit:async()=>{await new Promise(resolve=>end=resolve);c.status='end';c.emit('end');return'OK';}}),f=fixture();
 f.lifecycle.registerRedis(c);const p=f.lifecycle.stop('SIGTERM');await tick();assert.equal(f.exits.length,0);end();await p;assert.equal(f.written[0].redisClients,1);assert.deepEqual(f.exits,[0]);
});
test('unused lazy client is disconnected without issuing network work',async()=>{const f=fixture(),c=redis({status:'wait',quit:async()=>{throw Error('must not connect');}});f.lifecycle.registerRedis(c);await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[0]);});
test('deadline never becomes success; original error retained on receipt/output failure',async()=>{
 let t=0;const f=fixture({now:()=>t,closeNext:async()=>{t=7000;},write:()=>{throw Object.assign(Error('private path'),{code:'EACCES'});}});
 await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[1]);const r=JSON.parse(f.outputs[0].slice('SSB_DASHBOARD_SHUTDOWN '.length));assert.equal(r.failure.code,'deadline');assert(r.secondary.some(x=>x.code==='EACCES'));assert(!f.outputs[0].includes('private'));
});
test('primary remains before additional write failures; no successful receipt on failed close',async()=>{
 const f=fixture({closeNext:async()=>{throw Error('secret');},write:()=>{throw Object.assign(Error('secret'),{code:'ENOSPC'});}});
 await f.lifecycle.stop('SIGTERM');const r=JSON.parse(f.outputs[0].slice('SSB_DASHBOARD_SHUTDOWN '.length));assert.equal(r.failure.code,'next_close_failed');assert.equal(r.secondary[0].code,'ENOSPC');assert.deepEqual(f.exits,[1]);
});
test('receipt output failure cannot return successful exit',async()=>{const f=fixture({output:()=>{throw Error('output');}});await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[1]);});
test('missing lifecycle binding and invalid signal are denied',()=>{assert.throws(()=>createLifecycle({binding:{}}));const f=fixture();assert.throws(()=>f.lifecycle.stop('SIGHUP'));assert.equal(f.exits.length,0);});
test('durable receipt refuses replacement and symlinks',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-dashboard-receipt-')),file=path.join(root,'receipt');persist(file,{synthetic:true});assert.equal(fs.statSync(file).mode&511,384);assert.throws(()=>persist(file,{}));fs.symlinkSync(file,path.join(root,'link'));assert.throws(()=>persist(path.join(root,'link'),{}));
});
const good=()=>({version:1,binding:binding(),status:'graceful',signal:'SIGTERM',admissionClosed:true,remainingWork:0,httpClosed:true,nextClosed:true,redisClosed:true,redisClients:1,recordedAt:'2026-10-14T00:00:01.000Z',elapsedMs:100,failure:null,secondary:[]});
const end=()=>({Status:'exited',Running:false,Paused:false,Restarting:false,OOMKilled:false,Dead:false,Error:'',ExitCode:0,StartedAt:'2026-10-14T00:00:00Z',FinishedAt:'2026-10-14T00:00:02Z'});
test('complete exact bound receipt and observed state pass',()=>contract.completed(good(),binding(),end()));
for(const field of ['run','publication','generation','participant','imageId'])test('foreign '+field+' denied',()=>{const r=good();r.binding[field]='wrong';assert.throws(()=>contract.completed(r,binding(),end()));});
for(const field of ['admissionClosed','httpClosed','nextClosed','redisClosed'])test('unconfirmed '+field+' denied',()=>{const r=good();r[field]=false;assert.throws(()=>contract.completed(r,binding(),end()));});
for(const exit of [1,137,143])test('exit '+exit+' never substitutes for lifecycle',()=>assert.throws(()=>contract.completed(good(),binding(),{...end(),ExitCode:exit})));
for(const mutate of [r=>delete r.remainingWork,r=>r.remainingWork=1,r=>r.elapsedMs=7000,r=>r.private='secret',r=>r.failure={stage:'http',code:'unknown'},r=>r.recordedAt='2026-10-13T00:00:00.000Z'])test('incomplete or mismatched receipt rejected '+String(mutate),()=>{const r=good();mutate(r);assert.throws(()=>contract.completed(r,binding(),end()));});
test('closed maintenance state rejects before app invocation',async()=>{let invoked=0;const f=fixture({handle:async()=>{invoked++;}});f.state.stopAdmission();const r=f.response();f.lifecycle.request({},r);assert.equal(r.statusCode,503);assert.equal(invoked,0);await f.lifecycle.stop('SIGTERM');});
test('actual entry binds Node/Next runtime and owns server without Next signal wrapper',async()=>{
 const file=path.join(__dirname,'dashboard-overlay/scripts/dashboard-entry.cjs'),events=[],handlers={},server={on(n,f){handlers[n]=f;},once(){},listen(p,h,done){events.push(['listen',p,h]);done();},close(cb){cb();}};
 const fakeProcess={version:'v24.17.0',env:{NODE_ENV:'production',APP_ENV:'production',HOSTNAME:'0.0.0.0',PORT:'3000',MAINTENANCE_STATE_ROOT:'/run/ssb-maintenance',MAINTENANCE_SERVICE:binding().service,MAINTENANCE_GENERATION:'release',SSB_DASHBOARD_SHUTDOWN_BINDING:JSON.stringify(binding())},chdir(){},on(n){events.push(['signal',n]);}};
 const m={exports:{}},req=id=>{
   if(id==='node:fs')return{lstatSync(){throw Object.assign(Error(),{code:'ENOENT'});},readFileSync(){return'{"config":{"output":"standalone"}}';}};
   if(id==='node:http')return{createServer:()=>server};
   if(id==='./maintenance-state.cjs')return{MaintenanceState:class{constructor(b){this.binding=b;}}};
   if(id==='./dashboard-shutdown-contract.cjs')return contract;
   if(id==='./dashboard-next-close.cjs')return{bindWaitUntil(){},bindErrorSink(){},closeNextStrict(){}};
   if(id==='next/dist/server/after/awaiter')return{AwaiterOnce:class{}};
   if(id==='./dashboard-lifecycle.cjs')return{createLifecycle(args){return{request(){},upgraded(){},stop(){},stopping:false};}};
   if(id==='next/package.json')return{version:'16.3.8'};
   if(id==='next/dist/server/lib/start-server')return{getRequestHandlers:async o=>{events.push(['next',o.isDev,o.hostname,o.port]);return{requestHandler(){},upgradeHandler(){},closeUpgraded(){},server:{close(){}}};},startServer(){throw Error('forbidden signal owner');}};
   return require(id);
 };
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,require:req,__dirname:'/app/app/scripts',process:fakeProcess,globalThis:{}},{filename:file});
 await m.exports.main();assert.deepEqual(events,[['signal','SIGTERM'],['signal','SIGINT'],['next',false,'0.0.0.0',3000],['listen',3000,'0.0.0.0']]);
});
module.exports={binding,good,end};
test('early aborted request remains primary while handler hangs until bounded completion',async()=>{
 let resolve;const f=fixture({handle:()=>new Promise(r=>resolve=r)}),res=f.response();f.lifecycle.request({},res);res.destroy();
 f.lifecycle.capture(Object.assign(Error(),{code:'deadline'}),'next');resolve();await tick();await f.lifecycle.stop('SIGTERM');
 assert.equal(f.written[0].failure.code,'request_failed');assert.deepEqual(f.exits,[1]);
});
test('one Redis failure does not skip other registered clients',async()=>{
 const f=fixture(),other=redis();f.lifecycle.registerRedis(redis({status:'end'}));f.lifecycle.registerRedis(other);
 await f.lifecycle.stop('SIGTERM');assert.equal(other.status,'end');assert.deepEqual(f.exits,[1]);assert.equal(f.written[0].redisClosed,false);
});
test('captured error vetoes graceful proof without silently closing application admission',async()=>{
 const f=fixture();f.lifecycle.capture(Object.assign(Error(),{code:'next_task_failed'}),'next');
 const response=f.response();f.lifecycle.request({},response);await tick();assert.equal(response.writableFinished,true);assert.notEqual(response.statusCode,503);
 await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[1]);assert.equal(f.written[0].failure.code,'next_task_failed');
 const denied=f.response();f.lifecycle.request({},denied);assert.equal(denied.statusCode,503);
});
test('real Node signal and full seven-second deadline produce distinct process outcomes',async()=>{
 const {spawn}=require('node:child_process');
 for(const mode of ['success','primary-hang']){
  const child=spawn(process.execPath,[path.join(__dirname,'dashboard-shutdown-child.cjs'),mode],{stdio:['ignore','pipe','pipe']}),started=performance.now();let stderr='',sent=false;
  child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>{if(b.toString().includes('READY')&&!sent){sent=true;child.kill('SIGTERM');}});
  const watchdog=setTimeout(()=>child.kill('SIGKILL'),9000);
  const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});clearTimeout(watchdog);
  const elapsed=performance.now()-started;assert(sent);assert.equal(result.signal,null);assert.equal(result.code,mode==='success'?0:1);
  const receipt=JSON.parse(stderr.slice('SSB_DASHBOARD_SHUTDOWN '.length));contract.validate(receipt,binding());
  assert.equal(receipt.status,mode==='success'?'graceful':'failed');if(mode==='primary-hang'){assert(elapsed>=7000&&elapsed<9000);assert.equal(receipt.failure.code,'request_failed');assert(receipt.secondary.some(x=>x.code==='deadline'));}
 }
});
for(const step of ['write','output'])test('deadline includes '+step+' publication',async()=>{
 let time=0;const f=fixture({now:()=>time,...(step==='write'?{write:()=>{time=8001;}}:{output:()=>{time=8001;}})});
 await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[1]);
});
test('never-listened server still closes initialized resources',async()=>{
 const f=fixture({server:{listening:false,close(){assert.fail('must not close nonexistent listener');}}});f.lifecycle.registerRedis(redis());
 await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[0]);assert(f.events.includes('next'));assert(f.written[0].redisClosed);
});
test('early HTTP close failure retained while later close rejects',async()=>{
 const f=fixture({server:{close(cb){cb(Error('private'));}},closeUpgraded:async()=>{throw Object.assign(Error(),{code:'deadline'});}});
 await f.lifecycle.stop('SIGTERM');assert.equal(f.written[0].failure.code,'http_close_failed');assert.equal(f.written[0].secondary[0].code,'deadline');assert(f.events.includes('next'));
});
test('Next pending work may register first Redis client and it must close',async()=>{
 let f;const c=redis();f=fixture({closeNext:async()=>f.lifecycle.registerRedis(c)});await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[0]);assert.equal(f.written[0].redisClients,1);assert.equal(c.status,'end');
});
test('premature Redis disconnection is not successful cleanup',async()=>{const f=fixture();f.lifecycle.registerRedis(redis({status:'end'}));await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[1]);});
const nextRoot=process.env.SSB_DASHBOARD_TEST_NEXT;
test('pinned actual Next cleanup and waitUntil failures cannot be swallowed',async()=>{
 assert.ok(nextRoot,'bound Next implementation required');assert.equal(require(path.join(nextRoot,'package.json')).version,'16.3.8');
 const {AsyncCallbackSet}=require(path.join(nextRoot,'dist/server/lib/async-callback-set'));
 const {AwaiterOnce}=require(path.join(nextRoot,'dist/server/after/awaiter'));
 const {closeNextStrict,bindWaitUntil}=require('./dashboard-overlay/scripts/dashboard-next-close.cjs');
 for(const kind of ['callback','waitUntil','success']){
  class Internal{constructor(){this.cleanupListeners=new AsyncCallbackSet();}createInternalWaitUntil(){}onServerClose(fn){this.cleanupListeners.add(fn);}}
  const internal=new Internal(),wrapper={server:internal,close:()=>internal.cleanupListeners.runAll()};
  const f=fixture({closeNext:()=>closeNextStrict(wrapper,AsyncCallbackSet)});bindWaitUntil(wrapper,AwaiterOnce,f.lifecycle.capture);
  if(kind==='callback')internal.onServerClose(()=>{throw Error('PRIVATE');});
  if(kind==='waitUntil'){internal.internalWaitUntil=internal.createInternalWaitUntil();internal.internalWaitUntil(Promise.reject(Error('PRIVATE')));}
  await tick();await f.lifecycle.stop('SIGTERM');assert.deepEqual(f.exits,[kind==='success'?0:1]);assert(!f.outputs.join('').includes('PRIVATE'));
 }
});
