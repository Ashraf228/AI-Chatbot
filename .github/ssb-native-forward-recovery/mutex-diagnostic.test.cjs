'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),{createRequire}=require('node:module');
if(process.env.SSB_MUTEX_DIAGNOSTIC_CHILD){
 const cfg=JSON.parse(process.env.SSB_MUTEX_DIAGNOSTIC_CHILD),Module=require('node:module');let time=0,calls=0,attempts=0;
 const failure=code=>Object.assign(Error('SYNTHETIC_PRIVATE_NOT_EXPORT'),{code});
 const load=Module._load;Module._load=function(id,...args){if(id==='node:perf_hooks')return{performance:{now(){return cfg.fault==='initial-deadline'&&calls++>0?50:time;}}};return load.call(this,id,...args);};
 Atomics.wait=(_a,_i,_v,ms)=>{time+=ms;return'timed-out';};
 const mkdir=fs.mkdirSync,open=fs.opendirSync,remove=fs.rmdirSync;
 fs.mkdirSync=function(p,...args){
  const s=String(p);if(s.endsWith('/runtime-state-mutex')){attempts++;fs.appendFileSync(cfg.events,'mutex-attempt\n');if(cfg.fault==='mutex-access')throw failure('EACCES');}
  if(s.includes('/runtime-state-wait-')&&!/\/[0-9]+$/.test(s)&&cfg.fault==='waiter-collision')throw failure('EEXIST');
  if(/\/runtime-state-wait-[^/]+\/[0-9]+$/.test(s)&&cfg.fault==='ticket-collision')throw failure('EEXIST');
  const out=mkdir.call(fs,p,...args);if(s.endsWith('/runtime-state-mutex')&&cfg.fault==='after-create-deadline')time=50;
  if(/\/runtime-state-wait-[^/]+\/[0-9]+$/.test(s)&&cfg.fault==='ticket-deadline')time=50;return out;
 };
 fs.opendirSync=function(p,...args){if(String(p)==='/run/ssb-maintenance'){
  if(cfg.fault==='scan-access')throw failure('EACCES');if(cfg.fault==='scan-deadline')time=50;
 }return open.call(fs,p,...args);};
 fs.rmdirSync=function(p,...args){if(cfg.fault==='queue-cleanup'&&/\/runtime-state-wait-[^/]+$/.test(String(p)))throw failure('EIO');return remove.call(fs,p,...args);};
 process.once('exit',()=>fs.appendFileSync(cfg.events,JSON.stringify({time,attempts})+'\n'));
}else{
 const test=require('node:test'),assert=require('node:assert/strict'),proto=require('./reporter-contract.cjs'),{sha}=require('./common.cjs'),{main}=require('./controller.cjs');
 assert.equal(process.version,'v24.17.0');
 function exportsOf(name,tail=''){
  const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname,__filename:file,require:id=>id==='node:test'?()=>{}:req(id),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};
  vm.compileFunction(fs.readFileSync(file,'utf8')+tail,Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;
 }
 const h=exportsOf('reporter-diagnostic.test.cjs'),options=h.globalOptions(),publication=sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),binding=proto.binding(options.run,'release',publication),children=new Map();
 function child(t,fault,{baseline=false,writeFailure=false,generation='release'}={}){
  const f=h.fixture(t,writeFailure?'mutex-timeout-write':'');
  const expected=proto.binding(options.run,generation,publication);f.env.SSB_REPORTER_DIAGNOSTIC_BINDING=JSON.stringify(expected);f.env.MAINTENANCE_GENERATION=generation;
  const statePath=path.join(f.state,'runtime-state.json'),state=JSON.parse(fs.readFileSync(statePath));state.generations=[generation];fs.writeFileSync(statePath,JSON.stringify(state));
  // The earlier waiter is synthetic and remains untouched by the new participant.
  if(fault.startsWith('queue-')){const peer=path.join(f.state,'runtime-state-wait-11111111-1111-1111-1111-111111111111');fs.mkdirSync(peer,{mode:0o700});if(fault!=='queue-unpublished')fs.mkdirSync(path.join(peer,'1'),{mode:0o700});}
  if(baseline){
   const ts=require(path.join(process.env.SSB_REPORTER_TEST_DEPS,'typescript')),old=path.resolve(__dirname,'../../../baseline/.github/ssb-native-forward-recovery/reporter-overlay');
   for(const name of ['maintenance-state','maintenance-mutex']){let out=ts.transpileModule(fs.readFileSync(path.join(old,'apps/api/src/maintenance',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;if(name==='maintenance-state')out=out.replace('require("./maintenance-mutex")','require("./maintenance-mutex.cjs")');fs.writeFileSync(path.join(f.dist,name+'.cjs'),out);}
   fs.writeFileSync(path.join(f.dist,'maintenance.js'),ts.transpileModule(fs.readFileSync(path.join(old,'apps/reporter/src/maintenance.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2021}}).outputText);
   fs.copyFileSync(path.join(old,'apps/reporter/scripts/reporter-entry.cjs'),path.join(f.dist,'reporter-entry.cjs'));
  }
  f.env.SSB_MUTEX_DIAGNOSTIC_CHILD=JSON.stringify({fault,events:f.events});f.args.splice(2,0,'--require',__filename);
  const r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1,r.stderr);assert.equal(r.signal,null);assert.equal(r.error,undefined);
  const d=proto.decode(r.stdout,r.stderr,expected),events=fs.readFileSync(f.events,'utf8');assert.doesNotMatch(r.stdout+r.stderr,/SYNTHETIC_PRIVATE|\/Users\/|\/run\/|ssb-reporter-offline|stack|password|cookie/i);
  assert.doesNotMatch(events,/external-denied/);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.state,'runtime-state.json'))).work,{});
  return{...r,d,f,events};
 }
 test('before: actual historical child drops zero-attempt queue deadline detail',t=>{
  const r=child(t,'queue-ticket',{baseline:true});assert.deepEqual(r.d.primary,{step:'admission',lastConfirmed:'maintenance-construct',errorClass:'Error',nodeCode:'EEXIST',gate:'unknown'});assert.match(r.events,/"time":50,"attempts":0/);
 });
 const cases=[['queue-ticket','deadline','queue-wait',0,50,'EEXIST'],['queue-unpublished','deadline','queue-wait',0,50,'EEXIST'],['initial-deadline','deadline','initial-check',0,50,'EEXIST'],['scan-deadline','deadline','queue-scan',0,50,'EEXIST'],['ticket-deadline','deadline','ticket-create',0,50,'EEXIST'],['after-create-deadline','deadline','mutex-create',1,50,'EEXIST'],['waiter-collision','filesystem','waiter-create',0,0,'EEXIST'],['ticket-collision','filesystem','ticket-create',0,0,'EEXIST'],['scan-access','filesystem','queue-scan',0,0,'EACCES'],['mutex-access','filesystem','mutex-create',1,0,'EACCES']];
 for(const[fault,origin,stage,attempts,elapsedMs,code]of cases)test('actual Reporter child -> strict decode: '+fault,t=>{
  const r=child(t,fault);assert.equal(r.d.primary.nodeCode,code);assert.deepEqual(r.d.primary.mutex,{origin,stage,attempts,elapsedMs,limitMs:50});assert.equal(r.d.primary.step,'admission');assert.equal(r.d.primary.lastConfirmed,'maintenance-construct');
  if(origin==='deadline')assert.equal(r.d.primary.stateIo,undefined);
  if(fault.startsWith('queue-'))assert.deepEqual(fs.readdirSync(r.f.state).sort(),['runtime-state-wait-11111111-1111-1111-1111-111111111111','runtime-state.json']);
  children.set(fault,r);
 });
 test('queue deadline and separate cleanup failure retain primary and exact cleanup stage',t=>{
  const r=child(t,'queue-cleanup');assert.equal(r.d.primary.mutex.origin,'deadline');assert.equal(r.d.primary.nodeCode,'EEXIST');assert.equal(r.d.cleanup[0].nodeCode,'EIO');assert.equal(r.d.cleanup[0].mutex.stage,'waiter-cleanup');assert.equal(r.d.cleanup[0].mutex.origin,'filesystem');children.set('queue-cleanup',r);
 });
 test('queue timeout survives stderr write failure without raw output',t=>{
  const r=child(t,'queue-ticket',{writeFailure:true});assert.equal(r.d.primary.mutex.attempts,0);assert.equal(r.d.delivery.channel,'stdout-fallback');assert.equal(r.d.delivery.writeError.nodeCode,'EPIPE');children.set('queue-write',r);
 });
 for(const[fault,mode]of [['queue-ticket',{}],['ticket-deadline',{}],['waiter-collision',{}],['queue-cleanup',{}],['queue-write',{}],['queue-ticket',{writeFailure:true}],['queue-ticket',{closureFailure:true}]])test('actual controller -> receipt -> receiver '+fault+JSON.stringify(mode),async t=>{
  const c=children.get(fault),f=h.harness(t,c,mode),lines=[];await assert.rejects(main({...options,output:l=>lines.push(l)},f.n));f.n.proc.assertClosed();
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),failure=rows.find(r=>r.phase==='release-start').detail.failure;assert.deepEqual(failure.reporter.record,c.d);assert.equal(rows.at(-1).ok,!mode.closureFailure);
  const received=h.receiver(lines.join('\n'));received.invoke();assert.equal(JSON.parse(received.output[0]).status,'PARTIAL_FAILURE_RECEIVED');
 });
 const mutations={origin:p=>p.mutex.origin='PRIVATE',stage:p=>p.mutex.stage='PRIVATE',attempts:p=>p.mutex.attempts=-1,type:p=>p.mutex.attempts='0',early:p=>p.mutex.elapsedMs=49,limit:p=>p.mutex.limitMs=500,private:p=>p.mutex.path='/PRIVATE',missing:p=>delete p.mutex.origin,code:p=>p.nodeCode='EACCES',misstep:p=>p.step='entry-import',physical:p=>p.mutex.origin='filesystem',io:p=>p.stateIo={operation:'mutex-acquire',resource:'state-mutex',attempts:1,elapsedMs:50,limitMs:50}};
 for(const[name,mutate]of Object.entries(mutations))test('receiver rejects malformed or contradictory mutex detail: '+name,async t=>{
  const f=h.harness(t,children.get('queue-ticket')),lines=[];await assert.rejects(main({...options,output:l=>lines.push(l)},f.n));const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));mutate(rows.find(r=>r.phase==='release-start').detail.failure.reporter.record.primary);
  let prev='0'.repeat(64);const logs=rows.map(r=>{r.previous=prev;const bytes=JSON.stringify(r);prev=sha(bytes);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(bytes).toString('base64')+' '+prev;}).join('\n');assert.throws(()=>h.receiver(logs).invoke());
 });
 for(const fault of ['initial-deadline','waiter-collision','ticket-collision','ticket-deadline'])test('receiver rejects fabricated positive attempts before mutex stage: '+fault,async t=>{
  const f=h.harness(t,children.get(fault)),lines=[];await assert.rejects(main({...options,output:l=>lines.push(l)},f.n));const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
  rows.find(r=>r.phase==='release-start').detail.failure.reporter.record.primary.mutex.attempts=1;
  let prev='0'.repeat(64);const logs=rows.map(r=>{r.previous=prev;const bytes=JSON.stringify(r);prev=sha(bytes);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(bytes).toString('base64')+' '+prev;}).join('\n');assert.throws(()=>h.receiver(logs).invoke());
 });
 for(const mode of ['reader-throws','reader-invalid'])test('diagnostic failure explicitly unavailable; write failures cannot replace primary '+mode,()=>{
  const p=new proto.Progress(binding),e=Object.assign(Error('PRIVATE'),{code:'EEXIST'});p.enter('admission');p.useMutexReader(()=>{if(mode==='reader-throws')throw Error('PRIVATE');return{path:'/PRIVATE'};});
  assert.throws(()=>proto.emit(p,e,()=>{throw Object.assign(Error('PRIVATE'),{code:'ENOSPC'});}),x=>x instanceof AggregateError&&x.errors[0]===e);assert.equal(p.result().primary.mutex,'unavailable');assert.equal(p.result().primary.nodeCode,'EEXIST');assert.doesNotMatch(JSON.stringify(p.result()),/PRIVATE/);
 });
 test('public receipt write failure preserves diagnostic primary, incomplete receiver rejects',async t=>{
  const f=h.harness(t,children.get('queue-ticket')),lines=[];let primary;const start=f.n.startGeneration.bind(f.n);f.n.startGeneration=async g=>{try{return await start(g);}catch(e){primary=e;throw e;}};
  await assert.rejects(main({...options,output:l=>{if(JSON.parse(Buffer.from(l.split(' ')[1],'base64')).phase==='release-start')throw Object.assign(Error('PRIVATE'),{code:'ENOSPC'});lines.push(l);}},f.n),e=>{const contains=x=>x===primary||x instanceof AggregateError&&x.errors.some(contains);return contains(e);});
  assert.equal(primary.reporterDiagnostic.record.primary.mutex.origin,'deadline');f.n.proc.assertClosed();assert.throws(()=>h.receiver(lines.join('\n')).invoke());
 });
 for(const generation of ['release','forward','normal'])test('exact reporter-closed-inspect failure path and generation binding: '+generation,async t=>{
  const c=child(t,'queue-ticket',{generation}),f=h.harness(t,c,{generation,delayedReporterExit:true}),lines=[];
  await assert.rejects(main({...options,output:l=>lines.push(l)},f.n));f.n.proc.assertClosed();
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),failure=rows.find(r=>r.phase===generation+'-start').detail.failure;
  assert.equal(failure.code,'reporter_closed_start_failed');assert.equal(failure.operation.operation,'reporter-closed-inspect');assert.equal(failure.operation.generation,generation);assert.deepEqual(failure.reporter.record,c.d);
  const received=h.receiver(lines.join('\n'));received.invoke();assert.equal(JSON.parse(received.output[0]).status,'PARTIAL_FAILURE_RECEIVED');
 });
}
