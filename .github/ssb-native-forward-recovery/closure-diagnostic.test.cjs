'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {Native}=require('./native.cjs'),{main,SOURCE}=require('./controller.cjs');
const {GateError,sha}=require('./common.cjs'),{parseReceipts,Receipts}=require('./evidence.cjs');
const {publicFailure,validateFailure}=require('./diagnostics.cjs');
const options={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};
const marker='SYNTHETIC_PRIVATE_CLOSURE_CONTENT';
function load(file,replacements={},suffix=''){
 const m={exports:{}},req=createRequire(file),g={module:m,exports:m.exports,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),__dirname:path.dirname(file),Buffer,console,performance,setTimeout,clearTimeout,Error,TypeError,AggregateError,process,structuredClone};
 vm.compileFunction(fs.readFileSync(file,'utf8')+suffix,Object.keys(g),{filename:file})(...Object.values(g));return m.exports;
}
// Reuse the existing synthetic evidence catalogue; do not execute its registered tests.
const fixtureModule=load(path.join(__dirname,'evidence-review.test.cjs'),{'node:test':()=>{}},'\nmodule.exports={fixture,receiverHarness,rechain};');
const {fixture,receiverHarness,rechain}=fixtureModule;
function harness(config={}){
 assert.equal(process.version,'v24.17.0');
 const data=fixture(),n=new Native(options),calls=[],states=new Map();
 n.initial={containers:[]};n.proc={calls,assertClosed(){if(config.processFailure)throw config.processFailure;}};
 n.networks=Object.fromEntries(data.inventory.ids.slice(19).map((id,i)=>['net'+i,{id}]));
 n.owned=data.closure.detail.outcomes.map((o,i)=>{
  const entry={id:o.id,name:'synthetic-'+i,image:'sha256:'+'f'.repeat(64),role:o.role,generation:o.generation,startRequested:true,orderedShutdown:o.state==='graceful'};
  const exit=i===config.index?(config.exit||0):0;
  const x={Id:entry.id,Name:'/'+entry.name,Image:entry.image,Config:{Labels:{'com.ssb.native-run':options.run}},RestartCount:0,State:{Status:'exited',Running:false,Paused:false,Restarting:false,Dead:false,OOMKilled:false,Error:'',Pid:0,ExitCode:exit,StartedAt:'2026-10-14T00:00:00Z',FinishedAt:'2026-10-14T00:00:01Z'}};
  if(i===config.index&&config.running)Object.assign(x.State,{Status:'running',Running:true,Pid:10,FinishedAt:'0001-01-01T00:00:00Z'});
  if(i===config.index&&config.mutateInspect)config.mutateInspect(x);
  states.set(entry.id,x);return entry;
 });
 n.d=async(args,opts)=>{
  assert.equal(opts.closure,true);calls.push({args,closed:true});
  assert.ok(['container','stop','logs'].includes(args[0]),'offline transport rejects other operations');
  const id=args.at(-1),x=states.get(id);assert.ok(x);
  if(config.inspectError&&args[0]==='container'&&id===n.owned[config.index].id)throw config.inspectError;
  if(args[0]==='stop')Object.assign(x.State,{Status:'exited',Running:false,Pid:0,FinishedAt:'2026-10-14T00:00:02Z'});
  const stdout=args[0]==='container'?JSON.stringify([x]):args[0]==='logs'?'database system is shut down':id;
  return{stdout:Buffer.from(stdout),stderr:Buffer.alloc(0)};
 };
 n.execute=async phase=>{if(phase===config.failPhase)throw config.primary;return{verified:true,...data[phase]};};
 const close=n.close.bind(n);
 n.close=async failed=>{const result=await close(failed);if(config.afterClose)config.afterClose(result);return result;};
 return{n,calls,data};
}
async function run(config={}){
 const h=harness(config),lines=[];let error,writes=0;
 const controller=config.old?load(path.resolve(__dirname,'../../../baseline/.github/ssb-native-forward-recovery/controller.cjs')):{main};
 try{await controller.main({...options,output:line=>{
  const r=JSON.parse(Buffer.from(line.split(' ')[1],'base64'));
  if(r.phase==='closure'&&config.outputError&&(!writes++||config.alwaysFailOutput))throw config.outputError;
  lines.push(line);
 }},h.n);}catch(e){error=e;}
 const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
 assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|"stack"|"message"/);
 return{...h,lines,rows,error,writes};
}
const codes=d=>d?[d.code,...d.causes.flatMap(codes)]:[];
const contains=(e,target)=>e===target||e&&([...(e.errors||[]),...(e.cause?[e.cause]:[])].some(x=>contains(x,target)));
function received(h){
 assert.ok(h.error);assert.equal(h.rows.at(-1).ok,false);assert.equal(h.rows.at(-1).phase,'closure');
 assert.throws(()=>parseReceipts(h.lines.join('\n'),options.run,SOURCE,options));
 const p=parseReceipts(h.lines.join('\n'),options.run,SOURCE,options,{partial:true});assert.equal(p.proof.status,'PARTIAL_FAILURE_RECEIVED');
 const r=receiverHarness(h.lines.join('\n'),{conclusion:'failure'},{conclusion:'failure'});r.invoke();
 assert.equal(JSON.parse(r.files.get('Empfang.json')).status,'PARTIAL_FAILURE_RECEIVED');
 assert.equal(r.files.get('receipts.txt'),h.lines.join('\n')+'\n');
 return h.rows.at(-1);
}
test('actual Native.close and controller retain the unchanged all-zero successful contract',async()=>{
 const h=await run();assert.ifError(h.error);assert.equal(h.rows.at(-1).phase,'complete');
 assert.equal(parseReceipts(h.lines.join('\n'),options.run,SOURCE,options).proof.status,'RECEIVED_AND_VERIFIED');
 assert.equal(h.calls.filter(c=>c.args[0]==='container').length,38);assert.equal(h.calls.filter(c=>c.args[0]==='logs').length,2);
});
for(const exit of [143,137])test('actual close -> strict final validation: exit '+exit+' remains failed with retained observations',async()=>{
 const old=await run({old:true,index:5,exit}),next=await run({index:5,exit});
 assert.ok(old.error);assert.deepEqual(old.rows.at(-1).detail.outcomes,[]);assert.equal(old.rows.at(-1).detail.failure.code,'unclassified');
 const r=received(next);assert.equal(r.detail.closure.stage,'validation');assert.ok(codes(r.detail.failure).includes('closure_not_clean'));
 assert.equal(r.detail.outcomes.length,19);assert.equal(r.detail.outcomes[5].exit,exit);assert.equal(r.detail.outcomes[5].state,'exited_unclean');
 assert.deepEqual(next.calls.map(c=>c.args),old.calls.map(c=>c.args));
});
test('generation shutdown contradiction retains observations but never becomes successful shutdown',async()=>{
 const h=await run({afterClose:r=>{r.detail.outcomes[3].state='exited';}}),r=received(h);
 assert.ok(codes(r.detail.failure).includes('closure_generation_shutdown'));assert.equal(r.detail.outcomes[3].state,'exited');
});
for(const code of ['EACCES','ENOSPC','PRIVATE_UNKNOWN'])test('validated backend outcomes survive receipt output failure: '+code,async()=>{
 const original=Object.assign(Error(marker),{code}),h=await run({outputError:original});
 assert.equal(h.error,original);const r=received(h);assert.equal(r.detail.closure.stage,'output');assert.equal(r.detail.outcomes.length,19);
 assert.ok(codes(r.detail.failure).includes(code==='PRIVATE_UNKNOWN'?'unclassified':code));assert.doesNotMatch(JSON.stringify(r),/PRIVATE_UNKNOWN/);
});
test('a second output failure preserves both original errors without claiming receipt delivery',async()=>{
 const original=Object.assign(Error(marker),{code:'ENOSPC'}),h=await run({outputError:original,alwaysFailOutput:true});
 assert.ok(contains(h.error,original));assert.equal(h.writes,2);assert.equal(h.rows.at(-1).phase,'inventory');
 assert.throws(()=>parseReceipts(h.lines.join('\n'),options.run,SOURCE,options,{partial:true}));
});
for(const code of ['command_timeout','cleanup_ownership','PRIVATE_UNKNOWN'])test('backend close failure remains distinct and retains checked partial observations: '+code,async()=>{
 const original=Object.assign(Error(marker),{code}),h=await run({index:5,inspectError:original}),r=received(h);
 assert.ok(contains(h.error,original));assert.equal(r.detail.closure.stage,'backend');assert.equal(r.detail.outcomes.length,19);assert.equal(r.detail.outcomes[5].state,'unverified');
 assert.equal(r.detail.outcomes[5].code,code==='PRIVATE_UNKNOWN'?'unclassified':code);assert.equal(r.detail.outcomes[5].observation.after,null);
});
test('prior work error remains primary through close failure and secondary receipt write failure',async()=>{
 const primary=new GateError('state_operation_failed'),closeError=new GateError('process_completion_unverified'),outputError=Object.assign(Error(marker),{code:'ENOSPC'});
 const h=await run({failPhase:'roles',primary,processFailure:closeError,outputError,alwaysFailOutput:true});
 assert.ok(contains(h.error,primary));assert.ok(contains(h.error,closeError));assert.ok(contains(h.error,outputError));assert.equal(h.rows.at(-1).phase,'roles');
});
for(const [name,mutate]of [
 ['missing after',r=>{r.detail.outcomes[5].observation.after=null;}],
 ['invalid state',r=>{r.detail.outcomes[5].state='PRIVATE_UNKNOWN';}],
 ['extra private field',r=>{r.detail.outcomes[5].private=marker;}],
 ['wrong identity',r=>{r.detail.outcomes[5].id='e'.repeat(64);}],
 ['duplicate identity',r=>{r.detail.outcomes[5].id=r.detail.outcomes[4].id;}],
 ['unknown outcome code',r=>{r.detail.outcomes[5].code='PRIVATE_UNKNOWN';}],
 ['missing outcome',r=>{r.detail.outcomes.pop();}],
 ['false graceful generation',r=>{r.detail.outcomes[3].generation='normal';}],
])test('invalid observations are rejected rather than exported or accepted: '+name,async()=>{
 const h=await run({afterClose:mutate}),r=received(h);assert.equal(r.detail.closure.stage,'validation');
 assert.equal(r.detail.closure.observations,'rejected');assert.notEqual(r.detail.closure.rejectedBy,null);assert.deepEqual(r.detail.outcomes,[]);assert.deepEqual(r.counts,[]);
});
test('running before stop, requested stop and observed final state stay separate',async()=>{
 const h=await run({index:5,running:true,exit:143}),r=received(h),o=r.detail.outcomes[5];
 assert.equal(o.observation.before.status,'running');assert.deepEqual(o.observation.stop,{requested:true,completed:true});assert.equal(o.observation.after.status,'exited');assert.equal(o.exit,143);
 assert.deepEqual(h.calls.filter(c=>c.args[0]==='stop').map(c=>c.args.slice(0,3)),[['stop','--time','8']]);
});
test('missing final state cannot become successful termination',async()=>{
 const h=await run({index:5,mutateInspect:x=>{delete x.State.Status;}}),r=received(h);assert.equal(r.detail.closure.stage,'backend');assert.equal(r.detail.outcomes[5].state,'unverified');
});
test('ordinary backend exception with no observation payload stays explicitly unobserved',async()=>{
 const lines=[],original=new TypeError(marker),b={execute:async()=>{throw new GateError('state_operation_failed');},close:async()=>{throw original;}};
 await assert.rejects(main({...options,output:x=>lines.push(x)},b),e=>contains(e,original));
 const r=JSON.parse(Buffer.from(lines.at(-1).split(' ')[1],'base64'));assert.equal(r.detail.closure.stage,'backend');assert.deepEqual(r.detail.outcomes,[]);assert.ok(codes(r.detail.failure).includes('unclassified'));
 parseReceipts(lines.join('\n'),options.run,SOURCE,options,{partial:true});
});
test('preflight manifest and elapsed/resource limits remain bound; check has no output or mutation',()=>{
 const lines=[],w=new Receipts(options.run,SOURCE,options,x=>lines.push(x)),data=fixture().preflight;
 w.check('preflight',true,data);assert.deepEqual(w.records,[]);assert.equal(w.bytes,0);assert.deepEqual(lines,[]);
 assert.throws(()=>w.check('preflight',true,{...data,elapsedMs:990001}),/receipt_time/);
 w.emit('preflight',true,data);assert.equal(w.records[0].hashes[0],sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))));
});
test('receiver rejects tampered failure codes, binding and closure states even with a new hash chain',async()=>{
 const h=await run({index:5,exit:143});received(h);
 for(const mutate of [r=>{r.at(-1).detail.failure.code='PRIVATE_UNKNOWN';},r=>{r.at(-1).run='12345679';},r=>{r.at(-1).detail.outcomes[5].state='graceful';},r=>{r[0].hashes[0]='f'.repeat(64);}]){
  const rows=structuredClone(h.rows);mutate(rows);const rx=receiverHarness(rechain(rows),{conclusion:'failure'},{conclusion:'failure'});assert.throws(()=>rx.invoke());assert.equal(rx.files.size,0);
 }
});
test('fixed diagnostic codes preserve no raw messages, stacks or arbitrary codes',()=>{
 for(const code of ['closure_not_clean','closure_generation_shutdown','closure_unverified','receipt_limit','EACCES','PRIVATE_UNKNOWN']){
  const d=publicFailure(Object.assign(Error(marker),{code}));validateFailure(d);assert.equal(d.code,code==='PRIVATE_UNKNOWN'?'unclassified':code);assert.doesNotMatch(JSON.stringify(d),/SYNTHETIC_PRIVATE|PRIVATE_UNKNOWN|stack/);
 }
});
for(const value of [null,undefined,false,0,''])test('falsy closure exception is preserved and never permits complete: '+String(value),async()=>{
 const data=fixture(),lines=[];let caught=false,actual;
 const backend={execute:async phase=>({verified:true,...data[phase]}),close:async()=>{throw value;}};
 try{await main({...options,output:x=>lines.push(x)},backend);}catch(e){caught=true;actual=e;}
 assert.equal(caught,true);assert.equal(actual,value);
 const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
 assert.equal(rows.at(-1).detail.closure.stage,'backend');assert.equal(rows.at(-1).detail.closure.observations,'unavailable');
 assert.equal(parseReceipts(lines.join('\n'),options.run,SOURCE,options,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
 assert.equal(rows.some(r=>r.phase==='complete'),false);
});
test('failure sanitization errors cannot replace the primary closure exception',async()=>{
 const data=fixture(),primary=Error(marker);primary.startOperation={private:marker};let actual;
 try{await main({...options,output:()=>{}},{execute:async phase=>({verified:true,...data[phase]}),close:async()=>{throw primary;}});}catch(e){actual=e;}
 assert.ok(actual instanceof AggregateError);assert.equal(actual.errors[0],primary);assert.equal(actual.errors[1].code,'start_binding_invalid');
});
