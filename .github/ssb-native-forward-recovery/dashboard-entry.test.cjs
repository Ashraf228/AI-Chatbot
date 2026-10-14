'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const contract=require('./dashboard-shutdown-contract.cjs'),{createLifecycle}=require('./dashboard-overlay/scripts/dashboard-lifecycle.cjs');
const binding={version:1,run:'12345678',source:contract.SOURCE,publication:'a'.repeat(64),service:'ssb-native-12345678',generation:'release',participant:'ssb-native-12345678-release-dashboard',imageId:'sha256:'+'b'.repeat(64)};
test('actual entry retains listen failure across later SIGTERM with live initialized client',async()=>{
 const signals={},written=[],exits=[],output=[];let lifecycle;
 const server=new EventEmitter();server.listening=false;server.listen=()=>queueMicrotask(()=>server.emit('error',Object.assign(Error('PRIVATE'),{code:'EADDRINUSE'})));server.close=()=>assert.fail('never listened');
 const fakeProcess={version:'v24.17.0',env:{NODE_ENV:'production',APP_ENV:'production',HOSTNAME:'0.0.0.0',PORT:'3000',MAINTENANCE_STATE_ROOT:'/run/ssb-maintenance',MAINTENANCE_SERVICE:binding.service,MAINTENANCE_GENERATION:'release',SSB_DASHBOARD_SHUTDOWN_BINDING:JSON.stringify(binding)},chdir(){},on(n,f){signals[n]=f;},stderr:{write(s){output.push(s);}}};
 const internal={createInternalWaitUntil(){},onServerClose(){}},wrapper={server:internal,close:async()=>{}};
 const m={exports:{}},req=id=>{
  if(id==='node:fs')return{lstatSync(){throw Object.assign(Error(),{code:'ENOENT'});},readFileSync(){return'{"config":{"output":"standalone"}}';}};
  if(id==='node:http')return{createServer:()=>server};
  if(id==='./maintenance-state.cjs')return{MaintenanceState:class{constructor(b){this.binding=b;}stopAdmission(){}processWorkStatus(){return{running:0,uncertain:0};}}};
  if(id==='./dashboard-shutdown-contract.cjs')return contract;
  if(id==='./dashboard-next-close.cjs')return{bindWaitUntil(){},bindErrorSink(){},closeNextStrict:()=>wrapper.close()};
  if(id==='./dashboard-lifecycle.cjs')return{createLifecycle(args){lifecycle=createLifecycle({...args,write:(_p,r)=>written.push(structuredClone(r)),output:s=>output.push(s),exit:c=>exits.push(c)});const client=new EventEmitter();client.status='ready';client.quit=async()=>{client.status='end';client.emit('end');return'OK';};lifecycle.registerRedis(client);return lifecycle;}};
  if(id==='next/package.json')return{version:'16.3.8'};
  if(id==='next/dist/server/lib/start-server')return{getRequestHandlers:async()=>({requestHandler(){},upgradeHandler(){},closeUpgraded(){},server:wrapper})};
  if(id==='next/dist/server/after/awaiter')return{AwaiterOnce:class{}};
  if(id==='next/dist/server/lib/async-callback-set')return{AsyncCallbackSet:class{}};
  return require(id);
 };req.main=m;
 const file=path.join(__dirname,'dashboard-overlay/scripts/dashboard-entry.cjs');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,require:req,__dirname:'/app/app/scripts',process:fakeProcess,globalThis:{}});
 await new Promise(r=>setImmediate(r));assert.equal(fakeProcess.exitCode,1);assert.deepEqual(exits,[]);
 signals.SIGTERM();await lifecycle.stop('SIGTERM');assert.deepEqual(exits,[1]);assert.equal(written[0].failure.stage,'startup');assert.equal(written[0].status,'failed');assert(!output.join('').includes('PRIVATE'));
});
test('actual pinned callback rejection is captured before another cleanup callback settles',async()=>{
 const {AsyncCallbackSet}=require(path.join(process.env.SSB_DASHBOARD_TEST_NEXT,'dist/server/lib/async-callback-set'));
 const {closeNextStrict}=require('./dashboard-overlay/scripts/dashboard-next-close.cjs'),callbacks=new AsyncCallbackSet(),captured=[];let release;
 callbacks.add(async()=>{throw Error('PRIVATE');});callbacks.add(()=>new Promise(resolve=>release=resolve));
 const wrapper={server:{cleanupListeners:callbacks},close:()=>callbacks.runAll()};
 const closing=closeNextStrict(wrapper,AsyncCallbackSet,(e,stage)=>captured.push([e.code,stage]));
 await new Promise(r=>setImmediate(r));assert.deepEqual(captured,[['next_close_failed','next']]);release();await assert.rejects(closing);assert(!Object.hasOwn(callbacks,'runAll'));
});
test('pinned AfterContext swallowed rejection is captured through fixed process error sink',async()=>{
 const file=path.join(process.env.SSB_DASHBOARD_TEST_NEXT,'dist/server/after/after-context.js'),m={exports:{}},target={error(){}},captured=[],output=[];
 const {bindErrorSink}=require('./dashboard-overlay/scripts/dashboard-next-close.cjs');
 bindErrorSink(target,(e,s)=>captured.push([e.code,s]),s=>output.push(s));
 const localRequire=require('node:module').createRequire(file);
 vm.runInNewContext('(function(require,module,exports){'+fs.readFileSync(file,'utf8')+'\n})',{console:target})(localRequire,m,m.exports);
 const {AfterContext}=m.exports;let task;
 const context=new AfterContext({waitUntil:p=>{task=p;},onClose(){}});
 context.addThenable(Promise.reject(Error('PRIVATE TOKEN /private/path')));await task;
 assert.deepEqual(captured,[['next_task_failed','next']]);assert.deepEqual(output,['SSB_DASHBOARD_TASK_FAILED\n']);
 context.reportTaskError('function',Error('PRIVATE'));assert.equal(captured.length,2);assert(!output.join('').includes('PRIVATE'));
 assert.throws(()=>{target.error=()=>{};});
});
test('error sink never inspects raw arguments and preserves primary on output failure',()=>{
 const target={error(){}},captured=[];require('./dashboard-overlay/scripts/dashboard-next-close.cjs').bindErrorSink(target,(e,s)=>captured.push([e.code,s]),()=>{throw Object.assign(Error('PRIVATE'),{code:'EIO'});});
 target.error({get message(){assert.fail('must never inspect');}});assert.deepEqual(captured,[['next_task_failed','next'],['EIO','receipt']]);
});
for(const mode of ['full','short','throw'])test('default synchronous receipt output '+mode+' preserves primary and requires complete bytes',async()=>{
 const file=path.join(__dirname,'dashboard-overlay/scripts/dashboard-lifecycle.cjs'),m={exports:{}},exits=[],output=[];
 const localRequire=require('node:module').createRequire(file),fakeFs={...fs,writeSync(fd,b){assert.equal(fd,2);assert(Buffer.isBuffer(b));output.push(b.toString());if(mode==='throw')throw Object.assign(Error('PRIVATE'),{code:'EIO'});return mode==='short'?b.length-1:b.length;}};
 vm.runInNewContext('(function(require,module,exports){'+fs.readFileSync(file,'utf8')+'\n})',{Buffer,process,setTimeout,clearTimeout})(id=>id==='node:fs'?fakeFs:localRequire(id),m,m.exports);
 const f=m.exports.createLifecycle({binding,receipt:'/unused',state:{stopAdmission(){},processWorkStatus(){return{running:0,uncertain:0};}},server:{listening:false},handle(){},upgrade(){},closeNext:async()=>{},write(){},exit:c=>exits.push(c)});
 const receipt=await f.stop('SIGTERM');assert.deepEqual(exits,[mode==='full'?0:1]);assert.equal(output.length,1);assert(!output[0].includes('PRIVATE'));if(mode!=='full')assert.equal(receipt.failure.code,mode==='short'?'receipt_failed':'EIO');
});
