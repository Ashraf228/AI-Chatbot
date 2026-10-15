'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),{createRequire}=require('node:module');
const proto=require('./reporter-contract.cjs'),{sha}=require('./common.cjs'),{main}=require('./controller.cjs');
assert.equal(process.version,'v24.17.0');
function helpers(){
 const file=path.join(__dirname,'reporter-diagnostic.test.cjs'),m={exports:{}},req=createRequire(file);
 const scope={module:m,exports:m.exports,__dirname,__filename:file,require:id=>id==='node:test'?()=>{}:req(id),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};
 vm.compileFunction(fs.readFileSync(file,'utf8'),Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;
}
const h=helpers(),options=h.globalOptions(),publication=sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),binding=proto.binding(options.run,'release',publication);
const children=new Map();
function loadState(file,replacements={},globals={}){
 const ts=require(path.join(process.env.SSB_REPORTER_TEST_DEPS,'typescript')),cache=new Map();
 const load=target=>{
  if(cache.has(target))return cache.get(target).exports;
  const m={exports:{}},req=createRequire(target);cache.set(target,m);
  const scope={module:m,exports:m.exports,require:id=>Object.hasOwn(replacements,id)?replacements[id]:id==='./maintenance-mutex'?load(path.join(path.dirname(target),'maintenance-mutex.ts')):req(id),process,...(typeof globals==='function'?globals(target):globals)};
  const code=ts.transpileModule(fs.readFileSync(target,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
  vm.compileFunction(code,Object.keys(scope),{filename:target})(...Object.values(scope));return m.exports;
 };return load(file);
}
for(const [fault,operation,code]of [['mutex-timeout','mutex-acquire','EEXIST'],['mutex-file','mutex-acquire','EEXIST'],['mutex-access','mutex-acquire','EACCES'],['temp-collision','state-temp-create','EEXIST'],['mutex-release','mutex-release','EIO'],['mutex-timeout-write','mutex-acquire','EEXIST']]){
 test('actual Reporter bootstrap / filesystem / strict diagnostic: '+fault,t=>{
  const f=h.fixture(t,fault),r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});
  assert.equal(r.status,1);assert.equal(r.signal,null);assert.equal(r.error,undefined);
  const d=proto.decode(r.stdout,r.stderr,binding),point=fault==='mutex-release'?d.cleanup[0]:d.primary;
  assert.equal(point.nodeCode,code);assert.equal(point.stateIo.operation,operation);assert.equal(point.step,'admission');assert.equal(point.lastConfirmed,'maintenance-construct');
  assert.equal(point.stateIo.resource,operation==='state-temp-create'?'state-temp':'state-mutex');
  if(operation==='mutex-acquire'){
   assert.ok(point.stateIo.attempts>=1);assert.equal(point.stateIo.limitMs,50);
   if(code==='EEXIST')assert.ok(point.stateIo.elapsedMs>=50);else assert.equal(point.stateIo.attempts,1);
  }else assert.deepEqual([point.stateIo.attempts,point.stateIo.elapsedMs,point.stateIo.limitMs],[null,null,null]);
  if(fault==='mutex-release'){assert.equal(d.primary.gate,'admission_closed');assert.equal(d.primary.errorClass,'MaintenanceDenied');assert.equal(d.primary.stateIo,undefined);}
  if(fault==='mutex-timeout-write')assert.equal(d.delivery.writeError.nodeCode,'EPIPE');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.state,'runtime-state.json'))).work,{});
  if(code==='EEXIST')assert.ok(fs.existsSync(path.join(f.state,'runtime-state-mutex')));
  assert.doesNotMatch(r.stdout+r.stderr,/SYNTHETIC_PRIVATE|\/Users\/|\/run\/|ssb-reporter-offline|stack|password|cookie/i);
  assert.doesNotMatch(fs.readFileSync(f.events,'utf8'),/external-denied/);
  children.set(fault,{stdout:r.stdout,stderr:r.stderr,d});
 });
}
for(const mode of [{},{writeFailure:true},{closureFailure:true}])test('state I/O detail survives process -> Native -> receipt -> actual receiver '+JSON.stringify(mode),async t=>{
 const child=children.get(mode.writeFailure?'mutex-timeout-write':'temp-collision'),fixture=h.harness(t,child,mode),lines=[];
 await assert.rejects(main({...options,output:l=>lines.push(l)},fixture.n));fixture.n.proc.assertClosed();
 const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),error=rows.find(r=>r.phase==='release-start').detail.failure;
 assert.deepEqual(error.reporter.record,child.d);assert.equal(rows.at(-1).ok,!mode.closureFailure);
 const received=h.receiver(lines.join('\n'));received.invoke();assert.equal(JSON.parse(received.output[0]).status,'PARTIAL_FAILURE_RECEIVED');
 assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|\/Users\/|ssb-reporter-offline|stack|password|cookie/i);
});
test('public receipt write failure retains primary and state I/O; incomplete receiver rejects',async t=>{
 const fixture=h.harness(t,children.get('mutex-timeout')),lines=[];let original;
 const start=fixture.n.startGeneration.bind(fixture.n);fixture.n.startGeneration=async g=>{try{return await start(g);}catch(e){original=e;throw e;}};
 await assert.rejects(main({...options,output:l=>{if(JSON.parse(Buffer.from(l.split(' ')[1],'base64')).phase==='release-start')throw Object.assign(Error('PRIVATE'),{code:'ENOSPC'});lines.push(l);}},fixture.n),e=>{
  const contains=x=>x===original||x instanceof AggregateError&&x.errors.some(contains);return contains(e);
 });
 assert.equal(original.reporterDiagnostic.record.primary.stateIo.operation,'mutex-acquire');fixture.n.proc.assertClosed();assert.throws(()=>h.receiver(lines.join('\n')).invoke());
});
for(const field of ['operation','resource','attempts','elapsedMs','limitMs','path','null','missing','early-eexist','wrong-step'])test('receiver rejects invalid state I/O '+field,async t=>{
 const fixture=h.harness(t,children.get('mutex-timeout')),lines=[];await assert.rejects(main({...options,output:l=>lines.push(l)},fixture.n));
 const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),p=rows.find(r=>r.phase==='release-start').detail.failure.reporter.record.primary;
 if(field==='operation')p.stateIo.operation='PRIVATE';if(field==='resource')p.stateIo.resource='state-temp';if(field==='attempts')p.stateIo.attempts='1';if(field==='elapsedMs')p.stateIo.elapsedMs=-1;if(field==='limitMs')p.stateIo.limitMs=500;
  if(field==='path')p.stateIo.path='/PRIVATE';if(field==='null')p.stateIo=null;if(field==='missing')delete p.stateIo.resource;
 if(field==='early-eexist')p.stateIo.elapsedMs=49;if(field==='wrong-step')p.step='entry-import';
 let previous='0'.repeat(64);const logs=rows.map(r=>{r.previous=previous;const bytes=JSON.stringify(r);previous=sha(bytes);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(bytes).toString('base64')+' '+previous;}).join('\n');
 assert.throws(()=>h.receiver(logs).invoke());
});
for(const broken of ['maintenance-mutex.ts','maintenance-state.ts'])test('diagnostic storage and emission faults preserve primary at '+broken,t=>{
 const f=h.fixture(t),file=path.join(__dirname,'reporter-overlay/apps/api/src/maintenance/maintenance-state.ts');
 const original=Object.assign(Error('PRIVATE'),{code:'EACCES'}),fake={...fs,mkdirSync(p,...args){if(p.endsWith('/runtime-state-mutex'))throw original;return fs.mkdirSync(p,...args);}};
 const writes={'maintenance-mutex.ts':0,'maintenance-state.ts':0};
 const code=loadState(file,{'node:fs':fake},target=>({WeakMap:class extends WeakMap{
  set(key,value){const name=path.basename(target);writes[name]++;if(name===broken)throw Error('PRIVATE');return super.set(key,value);}
 }}));
 const state=new code.MaintenanceState({root:f.state,service:binding.service+'-'+binding.run,generation:'release'});
 assert.throws(()=>state.begin('worker'),e=>e===original);assert.equal(code.readStateIoFailure(original),undefined);
 // Both the legacy I/O map and the new provenance map may fail independently.
 assert.deepEqual(writes,{'maintenance-mutex.ts':2,'maintenance-state.ts':broken==='maintenance-state.ts'?2:0});
 assert.equal(code.readMutexDiagnostic(original),undefined);
 const p=new proto.Progress(binding);p.useStateIoReader(code.readStateIoFailure);p.enter('admission');
 assert.throws(()=>proto.emit(p,original,()=>{throw Object.assign(Error('PRIVATE'),{code:'EPIPE'});}),e=>e instanceof AggregateError&&e.errors[0]===original);
 assert.equal(p.result().primary.nodeCode,'EACCES');assert.equal(p.result().primary.stateIo,undefined);
});
for(const transient of [false,true])test('actual old/new state implementations preserve 50 ms lock policy '+transient,t=>{
 const traces=[];
 for(const file of [path.join(process.env.SSB_PROBE_TEST_SOURCE,'apps/api/src/maintenance/maintenance-state.ts'),path.join(__dirname,'reporter-overlay/apps/api/src/maintenance/maintenance-state.ts')]){
  const f=h.fixture(t),error=Object.assign(Error('PRIVATE'),{code:'EEXIST'}),trace=[];let time=0,attempts=0;
  const fake={...fs,mkdirSync(p,...args){if(p.endsWith('/runtime-state-mutex')){trace.push(['mkdir',++attempts]);if(!transient||attempts<=3)throw error;}return fs.mkdirSync(p,...args);}};
  const code=loadState(file,{'node:fs':fake,'node:perf_hooks':{performance:{now:()=>time}}},{Atomics:{wait(_a,_b,_c,ms){trace.push(['wait',ms]);time+=ms;}}});
  const before=fs.readFileSync(path.join(f.state,'runtime-state.json')),state=new code.MaintenanceState({root:f.state,service:'ssb-native-'+binding.run,generation:'release'});
  assert.throws(()=>state.begin('worker'),e=>transient?e instanceof code.MaintenanceDenied&&e.code==='admission_closed':e===error);
  assert.deepEqual(fs.readFileSync(path.join(f.state,'runtime-state.json')),before);assert.equal(fs.existsSync(path.join(f.state,'runtime-state-mutex')),false);
  const ordered=file.includes('reporter-overlay');
  assert.equal(fs.readdirSync(f.state).some(name=>name.startsWith('runtime-state-wait-')),false);
  if(!transient){assert.equal(time,50);assert.equal(attempts,ordered?50:51);if(code.readStateIoFailure)assert.deepEqual(code.readStateIoFailure(error),{operation:'mutex-acquire',resource:'state-mutex',attempts:50,elapsedMs:50,limitMs:50});}
  else{assert.equal(time,3);assert.equal(attempts,4);}
  traces.push(trace);
 }assert.deepEqual(transient?traces[0]:traces[0].slice(0,-1),traces[1]);
});
