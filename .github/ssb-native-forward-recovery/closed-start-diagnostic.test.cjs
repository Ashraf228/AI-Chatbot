'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),{createRequire}=require('node:module');
const privateMarker='SYNTHETIC_PRIVATE_DO_NOT_EXPORT';
if(process.env.SSB_CLOSED_OFFLINE){
 const cfg=JSON.parse(process.env.SSB_CLOSED_OFFLINE),Module=require('node:module'),assert=require('node:assert/strict');
 let ticks=0,queries=0,ends=0,requests=0;
 const fail=()=>{if(cfg.kind==='json')return new SyntaxError(privateMarker);if(cfg.kind==='type')return new TypeError(privateMarker);if(cfg.kind==='assertion')return new assert.AssertionError({actual:privateMarker,expected:'synthetic'});return Object.assign(Error(privateMarker),{code:cfg.code||'EIO'});};
 Object.defineProperty(globalThis,'performance',{value:{now:()=>ticks}});
 const oldTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{if(ms===50){ticks+=2000;return oldTimeout(fn,0,...args);}return oldTimeout(fn,ms,...args);};
 const load=Module._load;Module._load=function(id,parent,...rest){
  if(id==='/app/node_modules/pg')return{Pool:class{
   constructor(){if(cfg.fault==='pool-create')throw fail();}
   async query(){queries++;if(cfg.fault==='closed-before'||cfg.fault==='closed-after'&&queries>2)throw fail();return{rows:queries>2&&cfg.fault==='closed-sites'&&queries%2===1?[{private:privateMarker}]:queries>2&&cfg.fault==='closed-receipts'&&queries%2===0?[{private:privateMarker}]:[]};}
   async end(){ends++;fs.writeFileSync(cfg.counts,JSON.stringify({queries,ends,requests}));if(cfg.endFailure)throw Object.assign(Error(privateMarker),{code:'ECONNRESET'});}
  }};
  return load.call(this,id,parent,...rest);
 };
 for(const name of ['node:net','node:tls','node:http','node:https','node:dgram']){const m=require(name);for(const k of ['connect','createConnection','request','get','createSocket'])if(typeof m[k]==='function')m[k]=()=>{throw Error('NETWORK_NOT_AUTHORIZED');};}
 for(const k of ['spawn','exec','execSync','execFile','execFileSync','fork'])cp[k]=()=>{throw Error('PROCESS_NOT_AUTHORIZED');};
 globalThis.fetch=async(url,options)=>{
  const host=new URL(url).hostname,step={'api':'closed-api','admin-writer':'closed-writer','dashboard':'closed-dashboard'}[host];assert.ok(step);assert.equal(options.redirect,'manual');requests++;
  if(cfg.fault===step&&cfg.kind)throw fail();
  return{status:cfg.fault===step?418:503,headers:new Headers(),text:async()=>privateMarker};
 };
 const write=fs.writeSync;fs.writeSync=(fd,bytes,...a)=>{
  if(fd===2&&String(bytes).startsWith('SSB_INIT_PROBE_')){
   if(cfg.output==='missing')return Buffer.byteLength(bytes);
   if(cfg.output==='write-failure')throw Object.assign(Error(privateMarker),{code:'ENOSPC'});
   if(cfg.output==='truncated')bytes=bytes.slice(0,-8);
   if(cfg.output==='json')bytes='SSB_INIT_PROBE_DIAGNOSTIC_V1 {\n';
   if(cfg.output==='call')bytes=bytes.replace(/"call":"[a-f0-9]{64}"/,'"call":"'+'0'.repeat(64)+'"');
   if(cfg.output==='private')bytes=bytes.replace('"version":1','"private":"'+privateMarker+'","version":1');
  }
  return write(fd,bytes,...a);
 };
}else{
 const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),E=require('node:events').EventEmitter;
 const {sha,GateError}=require('./common.cjs'),{Native}=require('./native.cjs'),{publicFailure,probeCallsInFailure,validateProbe}=require('./diagnostics.cjs'),{main,SOURCE}=require('./controller.cjs'),{parseReceipts}=require('./evidence.cjs');
 const shutdownFixture=require('./dashboard-shutdown-fixture.cjs');
 assert.equal(process.version,'v24.17.0');
 function load(name,overrides={},rewrite=s=>s){const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname,__filename:file,require:k=>Object.hasOwn(overrides,k)?overrides[k]:req(k),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};vm.compileFunction(rewrite(fs.readFileSync(file,'utf8')),Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;}
 const {generationHarness}=load('start-diagnostic.test.cjs',{'node:test':()=>{}},s=>s.replace('return{...h,calls,operations,stopped,stateCalls};','return{...h,calls,operations,stopped,stateCalls,transport};').replace('module.exports={load,setup,invoke};','module.exports={generationHarness};'));
 const {nativeEvidence}=load('offline.test.cjs',{'node:test':()=>{}},s=>s+'\nmodule.exports={nativeEvidence};');
 const {receiver}=load('init-diagnostic.test.cjs',{'node:test':()=>{}},s=>s+'\nmodule.exports={receiver};');
 const opts={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};
 const pm=()=>sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json')));
 function child(code=1){const c=new E();c.stdout=new E();c.stderr=new E();c.stdin=new E();c.stdin.end=()=>queueMicrotask(()=>{c.stderr.emit('data',Buffer.from(privateMarker));c.emit('close',code,null);});return c;}
 function harness(t,config={}){
  const h=generationHarness(t,{readiness:config.readiness||3,closureFault:config.closureFault||'',writeFailure:!!config.rawWriteFailure}),priorCalls=h.n.proc.calls;
  let fired=false,closing=false,diagnosticStarted=false;const counts=path.join(h.root,'counts.json');
  const procFS={...fs,writeFileSync(p,...a){if(diagnosticStarted&&config.rawWriteFailure&&/process-\d+\.(stdout|stderr)$/.test(p))throw Object.assign(Error(privateMarker),{code:'ENOSPC'});return fs.writeFileSync(p,...a);}};
  const transport={spawn(bin,args,options){
   if(bin==='/usr/bin/docker'){
    const a=args.slice(2);closing=!!h.n.closureDeadline;
    if(!closing&&a[0]==='exec'&&a[1]==='-i'){diagnosticStarted=true;return cp.spawn(process.execPath,['--require',__filename,path.join(__dirname,'probe.cjs')],{...options,env:{PATH:process.env.PATH,SSB_CLOSED_OFFLINE:JSON.stringify({...config,counts})}});}
    const target=config.operation;
    if(!closing&&!fired&&(target==='running-limit'&&a[0]==='container'&&a[1]==='ls'||target==='mount-readability'&&a[0]==='exec'&&a[1]!=='-i'||target==='reporter-closed-inspect'&&a[1]==='inspect'&&a[2]===sha('reporter'))){fired=true;return child();}
    if(closing&&config.stopFailure&&a[0]==='stop')return child();
    if(closing&&config.preExited&&a[1]==='inspect')h.stopped.add(a[2]);
   }
   return h.transport.spawn(bin,args,options);
  }};
  const P=load('common.cjs',{'node:child_process':transport,'node:fs':procFS}).Processes;
  h.n.proc=new P({deadline:h.n.deadline,privateRoot:path.join(h.root,'raw')});h.n.proc.calls=priorCalls;
  h.n.probeContainer={id:sha('probe')};h.n.probe=Native.prototype.probe.bind(h.n);
  const oldState=h.n.state;h.n.state=async action=>{if(config.operation==='state-'+action)throw new GateError('state_operation_failed');return oldState(action);};
  if(config.preHelperFailure){const call=h.n.privilegedStart.bind(h.n);h.n.privilegedStart=async(plan,binding,entry)=>{if(binding.operation===config.preHelperFailure)h.n.resources=()=>{throw new GateError('disk_floor');};return call(plan,binding,entry);};}
  return{...h,counts};
 }
 async function receiptFailure(t,config={}){
  const h=harness(t,config),lines=[],values=nativeEvidence(),execute=h.n.execute.bind(h.n);let primary;
  values.builds.ids=['api','dashboard','reporter','widget','admin-writer'].map(k=>h.n.images[k]);
  shutdownFixture.attach(values,opts.run);
  if(['forward','normal'].includes(config.generation)){
   // Match the already simulated successful cohorts with their retained closure evidence.
   const close=h.n.close.bind(h.n),prefix=values.closure.detail.outcomes.slice(0,3+5*['release','forward','normal'].indexOf(config.generation));
   h.n.close=async failed=>{const r=await close(failed),count=prefix.length;shutdownFixture.observeClosure(values.closure);return{...r,counts:[r.counts[0]+count,r.counts[1]+count,r.counts[2]],ids:[...prefix.map(o=>o.id),...r.ids],detail:{...r.detail,outcomes:[...prefix,...r.detail.outcomes]}};};
  }
  h.n.execute=async p=>p==='release-start'?execute(p):{verified:true,...values[p]};
  await assert.rejects(main({...opts,output:l=>{if(config.receiptFailure&&lines.length===5)throw Object.assign(Error(privateMarker),{code:'ENOSPC'});lines.push(l);}},h.n),e=>{primary=e;return true;});h.n.proc.assertClosed();
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),failed=rows.find(r=>r.phase==='release-start');
  assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|postgresql:|ownerSha256|ssb-start-offline|"stack"/);
  if(!config.receiptFailure){assert.equal(failed.ok,false);const r=receiver(lines.join('\n'));r.invoke();assert.equal(JSON.parse(r.output[0]).status,'PARTIAL_FAILURE_RECEIVED');assert.equal(parseReceipts(lines.join('\n'),opts.run,SOURCE,opts,{partial:true}).proof.publicationManifest,pm());}
  return{...h,rows,lines,failed,primary};
 }
 for(const operation of ['running-limit','mount-readability','reporter-closed-inspect','state-snapshot','state-open'])for(const readiness of [1,4,7])test(`actual startGeneration attribution independent of readiness count: ${operation}/${readiness}`,async t=>{
  const h=await receiptFailure(t,{operation,readiness}),b=h.failed.detail.failure.operation;assert.equal(b.operation,operation);assert.equal(b.phase,'release-start');assert.equal(b.generation,'release');assert.equal(b.service,operation.startsWith('state-')?'generation':operation.startsWith('reporter-')?'reporter':'api');
 });
 for(const fault of ['closed-before','closed-api','closed-writer','closed-dashboard','closed-after','closed-sites','closed-receipts','pool-create'])test('actual child stdin -> probe -> process -> controller -> receipt -> receiver: '+fault,async t=>{
  const h=await receiptFailure(t,{fault}),d=probeCallsInFailure(h.failed.detail.failure)[0];assert.ok(d);assert.equal(d.primary.step,fault);assert.equal(d.binding.generation,'release');assert.equal(h.failed.detail.failure.operation.operation,'closed-ready');
  if(['closed-api','closed-writer','closed-dashboard'].includes(fault)){assert.equal(d.primary.httpStatus,418);assert.equal(d.primary.assertionCode,'ERR_ASSERTION');}
  else assert.equal(d.primary.httpStatus,null);
  if(fault!=='pool-create')assert.equal(JSON.parse(fs.readFileSync(h.counts)).ends,1);
 });
 for(const [kind,code,expected]of [['type',undefined,'TypeError'],['json',undefined,'SyntaxError'],['error','EACCES','Error'],['error','PRIVATE_UNKNOWN','Error']])test('bounded error classes/codes, no raw details: '+kind+'/'+code,async t=>{
  const h=await receiptFailure(t,{fault:'closed-before',kind,code}),d=probeCallsInFailure(h.failed.detail.failure)[0];assert.equal(d.primary.errorClass,expected);assert.equal(d.primary.nodeCode,code==='EACCES'?'EACCES':'unknown');
 });
 for(const output of ['missing','truncated','json','call','private','write-failure'])test('bad child diagnosis never permits success: '+output,async t=>{
  const h=await receiptFailure(t,{fault:'closed-api',output});assert.equal(probeCallsInFailure(h.failed.detail.failure).length,0);assert.match(JSON.stringify(h.failed.detail.failure),/probe_diagnostic_(missing|invalid|misbound)/);
 });
 test('successful closed-ready completely awaited; all five old safety assertions and pool close retained',async t=>{
  const h=harness(t),r=await h.n.startGeneration('release');assert.deepEqual(r.counts,[5,5,0]);assert.deepEqual(JSON.parse(fs.readFileSync(h.counts)),{queries:4,ends:1,requests:3});assert.deepEqual(h.stateCalls,['snapshot','open']);h.n.proc.assertClosed();
 });
 test('primary assertion survives pool-close, raw-write and closure errors through receiver',async t=>{
  const h=await receiptFailure(t,{fault:'closed-api',endFailure:true,rawWriteFailure:true,closureFault:'137'}),d=probeCallsInFailure(h.failed.detail.failure)[0];assert.equal(d.primary.step,'closed-api');assert.equal(d.primary.httpStatus,418);assert.equal(d.cleanup[0].step,'pool-close');assert.equal(d.cleanup[0].nodeCode,'ECONNRESET');assert.equal(h.rows.at(-1).ok,false);assert.ok(h.rows.at(-1).detail.outcomes.some(x=>x.exit===137&&x.state==='exited_unclean'));
 });
 test('receipt write error preserves primary without falsely receiving incomplete evidence',async t=>{
  const h=await receiptFailure(t,{fault:'closed-writer',receiptFailure:true});assert.equal(probeCallsInFailure(publicFailure(h.primary))[0].primary.step,'closed-writer');assert.throws(()=>receiver(h.lines.join('\n')).invoke());
 });
 for(const preExited of [false,true])test('closure distinguishes prior exit from requested stop: '+preExited,async t=>{
  const h=await receiptFailure(t,{fault:'closed-api',preExited}),rows=h.rows.at(-1).detail.outcomes;assert.equal(rows.length,5);
  for(const o of rows){assert.equal(o.observation.before.status,preExited?'exited':'running');assert.equal(o.observation.stop.requested,!preExited);assert.equal(o.observation.stop.completed,!preExited);assert.equal(o.observation.after.status,'exited');assert.notEqual(o.state,'graceful');}
 });
 test('failed stop is requested but never completed; no invented after observation',async t=>{
  const h=await receiptFailure(t,{fault:'closed-api',stopFailure:true});for(const o of h.rows.at(-1).detail.outcomes){assert.equal(o.state,'unverified');assert.equal(o.observation.stop.requested,true);assert.equal(o.observation.stop.completed,false);assert.equal(o.observation.after,null);}assert.equal(probeCallsInFailure(h.failed.detail.failure)[0].primary.step,'closed-api');
 });
 function rechain(rows){let prev='0'.repeat(64);return rows.map((r,seq)=>{const b=JSON.stringify({...r,seq,previous:prev});prev=sha(b);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(b).toString('base64')+' '+prev;}).join('\n');}
 for(const preHelperFailure of ['activation-helper','participant-helper'])test('helper resource refusal before process spawn retains operation: '+preHelperFailure,async t=>{
  const h=await receiptFailure(t,{preHelperFailure}),f=h.failed.detail.failure;assert.equal(f.code,'disk_floor');assert.equal(f.operation.operation,preHelperFailure);assert.equal(f.operation.service,preHelperFailure==='activation-helper'?'generation':'api');assert.equal(f.process,null);
 });
 test('receiver requires exact call/action/generation association also across aggregates',async t=>{
  const h=await receiptFailure(t,{fault:'closed-api',rawWriteFailure:true}),f=h.failed.detail.failure;
  assert.equal(f.operation.call,probeCallsInFailure(f)[0].binding.call);
  for(const alter of [v=>delete v.operation,v=>{v.operation.operation='mount-readability';v.operation.action='mount-readability';v.operation.service='api';},v=>v.operation.call='f'.repeat(64),v=>v.causes[0].operation={...v.operation,call:'f'.repeat(64)}]){const rows=structuredClone(h.rows);alter(rows[5].detail.failure);assert.throws(()=>receiver(rechain(rows)).invoke());}
 });
 test('receiver requires closure observations and rejects false never-started evidence',async t=>{
  const h=await receiptFailure(t,{fault:'closed-api'});
  for(const alter of [o=>delete o.observation,o=>{o.observation.before.status='exited';o.observation.before.running=true;},o=>{o.state='never_started';o.exit=null;o.observation.stop={requested:false,completed:false};for(const s of [o.observation.before,o.observation.after])Object.assign(s,{status:'created',running:false,exit:137,startedAt:'0001-01-01T00:00:00Z',finishedAt:'0001-01-01T00:00:00Z'});}]){const rows=structuredClone(h.rows);alter(rows.at(-1).detail.outcomes[0]);assert.throws(()=>receiver(rechain(rows)).invoke());}
 });
 test('receiver rejects false phase, manifest, HTTP, extra private field and closure contradictions',async t=>{
  const h=await receiptFailure(t,{fault:'closed-api'});
  for(const alter of [d=>d.binding.generation='normal',d=>d.binding.publication='f'.repeat(64),d=>d.primary.httpStatus='418',d=>d.primary.message=privateMarker]){const rows=structuredClone(h.rows);alter(probeCallsInFailure(rows[5].detail.failure)[0]);assert.throws(()=>receiver(rechain(rows)).invoke());}
  for(const alter of [o=>o.observation.stop.requested=false,o=>o.observation.after.exit=137,o=>o.observation.before.private=privateMarker]){const rows=structuredClone(h.rows);alter(rows.at(-1).detail.outcomes[0]);assert.throws(()=>receiver(rechain(rows)).invoke());}
 });
}
