'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const vm=require('node:vm'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
const {sha,GateError}=require('./common.cjs'),{main,SOURCE,reportFailure}=require('./controller.cjs');
const {parseReceipts,Receipts,dispatchTitle}=require('./evidence.cjs'),diagnostic=require('./dashboard-shutdown-diagnostic.cjs');
const contract=require('./dashboard-shutdown-contract.cjs');
assert.equal(process.version,'v24.17.0');
const options={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};
const PRIVATE='SYNTHETIC_PRIVATE_PASSWORD_PATH',roles=['api','admin-writer','dashboard','reporter','widget'];
function load(name,replacements={},tail='',extra={}){
  const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file);
  const scope={module:m,exports:m.exports,__dirname:path.dirname(file),__filename:file,
    require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,console,performance,
    setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,structuredClone,URL,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError,...extra};
  vm.compileFunction(fs.readFileSync(file,'utf8')+tail,Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;
}
const {nativeEvidence}=load('offline.test.cjs',{'node:test':()=>{}},'\nmodule.exports={nativeEvidence};');
const tmp=t=>{const p=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-dashboard-shutdown-flow-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;};
const fault=code=>Object.assign(Error(PRIVATE),{code});
const rows=lines=>lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
const contains=(e,target)=>e===target||e?.cause&&contains(e.cause,target)||Array.isArray(e?.errors)&&e.errors.some(c=>contains(c,target));
function harness(t,config={}){
  const root=tmp(t),raw=path.join(root,'raw'),stateRoot=path.join(root,'state');fs.mkdirSync(raw);fs.mkdirSync(stateRoot);
  const values=nativeEvidence(),generation=config.generation||'release',prefix='ssb-native-'+options.run;
  const lifetime={StartedAt:'2026-10-14T00:00:00Z',FinishedAt:'2026-10-14T00:00:02Z'};
  // This transport's container lifetimes are independent of the shared evidence fixture dates.
  for(const g of ['release','forward','normal']){
    const row=values[g+'-shutdown'];row.detail.dashboardShutdown.recordedAt='2026-10-14T00:00:01.000Z';
    row.hashes[2]=sha(JSON.stringify(row.detail.dashboardShutdown));
  }
  const binding={version:1,run:options.run,source:SOURCE,publication:values.preflight.hashes[0],service:prefix,generation,participant:`${prefix}-${generation}-dashboard`,imageId:values.builds.ids[1]};
  const good={...structuredClone(values[generation+'-shutdown'].detail.dashboardShutdown),binding};
  const record=config.record||{...good,status:'failed',nextClosed:false,failure:{stage:'next',code:'next_close_failed'},secondary:[{stage:'receipt',code:'ENOSPC'}]};
  const policy=load('adapters/scripts/ops/maintenance-start-contract.cjs',{'../../apps/api/dist/maintenance/maintenance-state':{MaintenanceDenied:GateError}});
  const toolsRoot=path.join(__dirname,'adapters');
  const readFS=config.readError?{...fs,openSync(p,...args){if(String(p).endsWith('-dashboard.json'))throw fault(config.readError);return fs.openSync(p,...args);}}:fs;
  const diag=config.readError?load('dashboard-shutdown-diagnostic.cjs',{'node:fs':readFS}):diagnostic;
  const C=load('native.cjs',{'./dashboard-shutdown-diagnostic.cjs':diag,[path.join(toolsRoot,'scripts/ops/maintenance-start-contract.cjs')]:policy}).Native;
  const n=new C(options),calls=[];Object.assign(n,{privateRoot:root,stateRoot,toolsRoot,prefix,docker:'/usr/bin/docker',initial:{containers:[]},probeDeadline:performance.now()+90000,verifiedPublicationManifest:binding.publication,images:{dashboard:binding.imageId}});
  n.current={generation,binding:{root:stateRoot,service:prefix,generation},common:{run:options.run,publication:binding.publication,fileUid:process.getuid()}};
  n.owned=values.closure.detail.outcomes.slice(0,8+5*['release','forward','normal'].indexOf(generation)).map(o=>({
    role:o.role,generation:o.generation,id:o.id,image:o.role==='dashboard'?binding.imageId:'sha256:'+sha(o.role),
    name:o.generation==='seed'?`${prefix}-${o.role}`:`${prefix}-${o.generation}-${o.role}`,project:o.generation==='seed'?undefined:`${prefix}-${o.generation}`,
  }));
  const target=n.owned.find(e=>e.role==='dashboard'&&e.generation===generation),file=path.join(stateRoot,`shutdown-${target.name}.json`);
  for(const e of n.owned.filter(e=>e.generation===generation&&['api','admin-writer'].includes(e.role))){
    const r={version:1,status:'graceful',component:e.role,service:prefix,generation,participant:e.name,imageId:e.image,remainingWork:0,poolsClosed:true,elapsedMs:100,recordedAt:good.recordedAt};
    fs.writeFileSync(path.join(stateRoot,`shutdown-${e.name}.json`),JSON.stringify(r),{mode:0o600});
  }
  if(config.file!==false)fs.writeFileSync(file,config.bytes??JSON.stringify(record),{mode:0o600});
  const transport={spawn(bin,args){
    assert.equal(bin,'/usr/bin/docker');assert.deepEqual(args.slice(0,2),['--host','unix:///var/run/docker.sock']);const a=args.slice(2);calls.push(a);
    let stdout='',stderr='',status=0;
    if(a[0]==='stop'){
      assert.equal(a[1],'--time');assert.equal(a[2],'8');assert(n.owned.some(e=>e.id===a[3]));
      if(config.stopError&&a[3]===target.id)status=1;
      if(config.expire)n.probeDeadline=performance.now()+30000;
    }else if(a[0]==='logs'){
      assert.deepEqual(a,['logs','--tail','4',target.id]);stdout=config.stdout??PRIVATE+'\n';
      stderr=config.stderr??diagnostic.MARKER+JSON.stringify(record)+'\n';if(config.logError)status=1;
    }else if(a[0]==='container'&&a[1]==='inspect'){
      const e=n.owned.find(e=>e.id===a[2]);assert(e);
      stdout=JSON.stringify([{Id:e.id,Name:'/'+e.name,Image:e.image,Config:{Labels:{'com.ssb.native-run':options.run,'com.docker.compose.project':e.project,'com.docker.compose.service':e.role}},HostConfig:{RestartPolicy:{Name:'no'}},RestartCount:0,
        State:{Status:'exited',Running:false,Paused:false,Restarting:false,Dead:false,OOMKilled:false,Error:'',Pid:0,ExitCode:e.id===target.id&&config.exit!==undefined?config.exit:0,...lifetime}}]);
    }else assert.fail('unapproved simulated Docker command');
    const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();
    c.stdin.end=()=>queueMicrotask(()=>{if(stdout)c.stdout.emit('data',Buffer.from(stdout));if(stderr)c.stderr.emit('data',Buffer.from(stderr));c.emit('close',status,null);});return c;
  }};
  const P=load('common.cjs',{'node:child_process':transport,'node:fs':{...fs,writeFileSync(p,...args){
    if(config.processWriteError&&calls.at(-1)?.[0]===config.processWriteError)throw fault('ENOSPC');return fs.writeFileSync(p,...args);
  }}}).Processes;
  n.proc=new P({deadline:n.deadline,privateRoot:raw});n.resources=()=>{if(config.resourceError)throw fault('resource_floor_observed');};
  n.state=async action=>{assert.equal(action,'drained');return{completed:true};};n.probe=async action=>{assert.equal(action,'database');if(config.databaseError)throw fault('command_failed');return{verified:true};};
  let original;const execute=n.execute.bind(n);n.execute=async phase=>{
    if(phase!==generation+'-shutdown')return{verified:true,...values[phase]};
    try{return await execute(phase);}catch(error){original=error;throw error;}
  };
  return{n,calls,record,good,binding,target,file,values,root,policy,get original(){return original;}};
}
function receiver(t,log,{writeError,conclusion='failure'}={}){
  const destination=path.join(tmp(t),'received'),output=[],job='87654321';
  const api=(bin,args)=>{
    assert.equal(bin,'gh');const route=args[1];
    if(route.endsWith('/actions/runs/'+options.run))return JSON.stringify({id:Number(options.run),event:'workflow_dispatch',run_attempt:1,head_sha:options.workflowHead,display_title:dispatchTitle(options.workflowHead,options.dispatchNonce),status:'completed',conclusion,path:'.github/workflows/ssb-native-forward-recovery.yml'});
    if(route.endsWith('/actions/jobs/'+job))return JSON.stringify({id:Number(job),run_id:Number(options.run),conclusion,name:'Native forward recovery',labels:['ubuntu-24.04']});
    if(route.endsWith('/logs'))return PRIVATE+'\n'+log;assert.fail('unapproved simulated receiver API');
  };
  const r=load('receive.cjs',{'node:child_process':{execFileSync:api},'node:fs':{...fs,writeFileSync(p,...args){if(path.basename(p)===writeError)throw fault('ENOSPC');return fs.writeFileSync(p,...args);}}},'',{console:{log:x=>output.push(x)}});
  return{destination,output,invoke:()=>r.main([options.run,job,options.workflowHead,options.dispatchNonce,destination])};
}
async function run(t,config={}){
  const h=harness(t,config),lines=[];let error;
  try{await main({...options,output:l=>lines.push(l)},h.n);}catch(e){error=e;}
  assert(error);assert(contains(error,h.original));h.n.proc.assertClosed();
  const decoded=rows(lines),failed=decoded.find(r=>r.phase===h.binding.generation+'-shutdown');assert.equal(failed.ok,false);
  assert(!decoded.some(r=>r.phase==='complete'));assert(h.n.owned.every(e=>!e.orderedShutdown));
  assert.equal(h.n.previousGeneration,'seed');assert.equal(h.n.dashboardPredecessors,undefined);
  assert.doesNotMatch(JSON.stringify(decoded),/SYNTHETIC_PRIVATE|\/Users\/|stack|password/i);
  assert.equal(parseReceipts(lines.join('\n'),options.run,SOURCE,options,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
  assert.throws(()=>parseReceipts(lines.join('\n'),options.run,SOURCE,options));
  const received=receiver(t,lines.join('\n'));received.invoke();assert.equal(JSON.parse(received.output[0]).status,'PARTIAL_FAILURE_RECEIVED');
  assert.doesNotMatch(fs.readFileSync(path.join(received.destination,'receipts.txt'),'utf8'),/SYNTHETIC_PRIVATE/);
  return{...h,lines,decoded,error,failure:failed.detail.failure};
}
for(const generation of ['release','forward','normal'])test('failed exact receipt -> Native -> controller -> regular receiver: '+generation,async t=>{
  const h=await run(t,{generation,exit:1});assert.equal(h.failure.code,'predecessor_not_stopped');
  assert.equal(h.failure.dashboardShutdown.origin,'file');assert.deepEqual(h.failure.dashboardShutdown.record,h.record);
  assert.equal(h.calls.filter(a=>a[0]==='logs').length,0);assert.equal(h.calls.filter(a=>a[0]==='stop').length,5);
});
test('missing file recovers exact bounded runtime FAILED line, not raw logs',async t=>{
  const h=await run(t,{file:false});assert.equal(h.failure.code,'ENOENT');assert.equal(h.failure.dashboardShutdown.origin,'logs');
  assert.deepEqual(h.failure.dashboardShutdown.record.failure,{stage:'next',code:'next_close_failed'});
  assert.deepEqual(h.failure.dashboardShutdown.record.secondary,[{stage:'receipt',code:'ENOSPC'}]);
  assert.equal(h.calls.filter(a=>a[0]==='logs').length,1);
});
for(const file of [true,false])test('stop error retains process failure and Dashboard diagnostic; file='+file,async t=>{
  const h=await run(t,{file,stopError:true});assert.equal(h.failure.code,'stop_failed');assert.equal(h.failure.causes[0].code,'command_failed');
  assert.equal(h.failure.causes[0].process.exit,1);assert.equal(h.failure.dashboardShutdown.origin,file?'file':'logs');
});
for(const kind of ['missing','truncated','duplicate','prefixed','private-field','oversize','wrong-binding'])test('bad logs remain failure without exporting untrusted fields: '+kind,async t=>{
  const f=harness(t,{file:false}),r=structuredClone(f.record);if(kind==='private-field')r.failure.message=PRIVATE;if(kind==='wrong-binding')r.binding.publication='f'.repeat(64);
  const line=diagnostic.MARKER+JSON.stringify(r)+'\n';
  const stderr=kind==='missing'?PRIVATE:kind==='truncated'?line.slice(0,-1):kind==='duplicate'?line+line:kind==='prefixed'?'prefix '+line:kind==='oversize'?'x'.repeat(8193):line;
  const h=await run(t,{file:false,stderr});assert.equal(h.failure.code,'ENOENT');assert.equal(h.failure.dashboardShutdown,undefined);assert(h.failure.dashboardShutdownError);
});
for(const kind of ['corrupt','oversize','misbound','symlink'])test('invalid exact file is never replaced by a successful log receipt: '+kind,async t=>{
  const h=harness(t),r=structuredClone(h.record);r.binding.publication='f'.repeat(64);
  if(kind==='symlink'){fs.renameSync(h.file,h.file+'.target');fs.symlinkSync(h.file+'.target',h.file);}
  else fs.writeFileSync(h.file,kind==='corrupt'?'{':kind==='oversize'?'x'.repeat(4097):JSON.stringify(r));
  await assert.rejects(h.n.shutdown(),e=>{assert.equal(e.dashboardShutdown,undefined);assert(e.dashboardShutdownError);return true;});
  assert.equal(h.calls.filter(a=>a[0]==='logs').length,0);assert(h.n.owned.every(e=>!e.orderedShutdown));
});
for(const config of [{file:false,logError:true},{file:false,processWriteError:'logs'},{file:false,processWriteError:'stop'},{readError:'EACCES'},{readError:'EIO'},{file:false,expire:true},{file:false,resourceError:true}])test('secondary read/process/resource failure never masks primary: '+JSON.stringify(config),async t=>{
  const h=await run(t,config);
  if(config.processWriteError==='stop'){assert.equal(h.failure.code,'stop_failed');assert.equal(h.failure.dashboardShutdown.origin,'logs');}
  else{assert(h.failure.dashboardShutdownError);assert.equal(h.failure.dashboardShutdown,undefined);}
  if(config.processWriteError==='logs')assert.equal(h.failure.dashboardShutdownError,'evidence_write_failed');
  if(config.processWriteError==='stop')assert.equal(h.failure.causes[0].code,'evidence_write_failed');
  if(config.readError)assert.equal(h.failure.code,config.readError);
  if(config.expire)assert.equal(h.calls.filter(a=>a[0]==='logs').length,0);
});
test('one graceful exact receipt marks ordered only after Redis and database verification',async t=>{
  const h=harness(t);fs.writeFileSync(h.file,JSON.stringify(h.good));let checked=false;
  h.n.probe=async()=>{assert(h.n.owned.every(e=>!e.orderedShutdown));assert.equal(h.n.previousGeneration,'seed');checked=true;};
  const r=await h.n.shutdown();assert(checked);assert.equal(r.verified,true);assert.equal(h.n.owned.filter(e=>e.orderedShutdown).length,3);
  assert.equal(r.hashes[2],sha(JSON.stringify(h.good)));assert.deepEqual(r.detail.dashboardShutdown,h.good);
});
for(const clients of [0,2])test('Redis client count '+clients+' cannot mark ordered or authorize graceful closure',async t=>{
  const f=harness(t);const h=await run(t,{record:{...f.good,redisClients:clients}});assert.equal(h.failure.code,'dashboard_shutdown_unverified');
  assert.equal(h.failure.dashboardShutdown.record.status,'graceful');assert(h.decoded.at(-1).detail.outcomes.every(o=>o.state!=='graceful'));
});
test('graceful log cannot substitute for missing exact receipt',async t=>{
  const f=harness(t);const h=await run(t,{file:false,record:f.good});assert.equal(h.failure.code,'ENOENT');assert.equal(h.failure.dashboardShutdown.record.status,'graceful');
});
test('late database verification failure never marks an otherwise graceful Dashboard ordered',async t=>{
  const f=harness(t);const h=await run(t,{record:f.good,databaseError:true});assert.equal(h.failure.code,'command_failed');assert.equal(h.failure.dashboardShutdown.record.status,'graceful');
});
test('FAILED exact file with a zero exit still cannot become PASS',async t=>{
  const h=await run(t);assert.equal(h.failure.code,'dashboard_shutdown_unverified');assert.equal(h.failure.dashboardShutdown.record.status,'failed');
});
test('fallback uses only unused ten-second stop budget and at most 1500 ms',async t=>{
  const h=harness(t,{file:false}),calls=[],original=h.n.d.bind(h.n);const started=performance.now();
  h.n.d=async(a,o)=>{if(a[0]==='logs'){calls.push(o);assert(o.ms>250&&o.ms<=1500);assert(performance.now()+o.ms<=started+10000);assert.equal(o.closure,undefined);}return original(a,o);};
  await assert.rejects(h.n.shutdown());assert.equal(calls.length,1);
});
test('exhausted stop window never gains a fresh diagnostic budget',async t=>{
  let now=0;const h=harness(t,{file:false}),fakeCommon={...require('./common.cjs'),clock:()=>now};
  const diag=load('dashboard-shutdown-diagnostic.cjs',{'./common.cjs':fakeCommon});
  const C=load('native.cjs',{'./common.cjs':fakeCommon,'./dashboard-shutdown-diagnostic.cjs':diag,[path.join(h.n.toolsRoot,'scripts/ops/maintenance-start-contract.cjs')]:h.policy}).Native;
  const original=h.n.d.bind(h.n);h.n.d=async(a,o)=>{assert.notEqual(a[0],'logs');const result=await original(a,o);if(a[0]==='stop')now=10000;return result;};
  await assert.rejects(C.prototype.shutdown.call(h.n),e=>{assert.equal(e.code,'ENOENT');assert.equal(e.dashboardShutdownError,'deadline');return true;});
});
test('minimal state/probe diagnostics do not require the host-only shutdown decoder',()=>{
  const replacements={};Object.defineProperty(replacements,'./dashboard-shutdown-diagnostic.cjs',{get(){assert.fail('host-only decoder loaded in state/probe path');}});
  const d=load('diagnostics.cjs',replacements),failure=d.publicFailure(new GateError('command_failed'));
  d.validateFailure(failure);d.startProtocol();assert.equal(failure.code,'command_failed');
});
test('unexpected collector failure cannot replace original shutdown error',async t=>{
  const h=harness(t,{file:false}),original=fault('EIO');
  const C=load('native.cjs',{'./dashboard-shutdown-diagnostic.cjs':{...diagnostic,collect:async()=>{throw fault('ENOSPC');}}}).Native;
  h.n.d=async()=>{throw original;};
  await assert.rejects(C.prototype.shutdown.call(h.n),e=>{assert.equal(e.code,'stop_failed');assert(e.errors.every(c=>c===original));return true;});
});
test('own-ID binding rejects foreign/preexisting Dashboard before any log request',async t=>{
  const h=harness(t,{file:false});h.n.initial.containers=[h.target.id];
  await assert.rejects(h.n.shutdown(),e=>{assert.equal(e.code,'ENOENT');assert.equal(e.dashboardShutdownError,'identity');return true;});
  assert.equal(h.calls.filter(a=>a[0]==='logs').length,0);
});
function rechain(rs){let previous='0'.repeat(64);return rs.map((r,seq)=>{r.seq=seq;r.previous=previous;const b=JSON.stringify(r);previous=sha(b);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(b).toString('base64')+' '+previous;}).join('\n');}
for(const field of ['run','source','publication','generation','imageId','container','participant','service','private-field','wrong-phase'])test('regular emitter and receiver reject rebound diagnostic: '+field,async t=>{
  const h=await run(t,{file:false}),rs=rows(h.lines),row=rs.find(r=>r.phase==='release-shutdown'),d=row.detail.failure.dashboardShutdown;
  if(field==='container')d.container='f'.repeat(64);
  else if(field==='private-field')d.record.failure.message=PRIVATE;
  else if(field==='wrong-phase')row.phase='release-drain';
  else{d.binding[field]=field==='run'?'12345679':field==='generation'?'forward':field==='imageId'?'sha256:'+'f'.repeat(64):field==='source'?'f'.repeat(40):field==='publication'?'f'.repeat(64):'foreign';
    if(field==='run'){d.binding.service='ssb-native-'+d.binding.run;d.binding.participant=d.binding.service+'-release-dashboard';}
    if(field==='generation')d.binding.participant=d.binding.service+'-forward-dashboard';
    d.record.binding=structuredClone(d.binding);
  }
  const receipts=new Receipts(options.run,SOURCE,options,()=>{});
  for(const r of rs.slice(0,row.seq))receipts.emit(r.phase,r.ok,{counts:r.counts,ids:r.ids,hashes:r.hashes,detail:r.detail,elapsedMs:r.elapsedMs});
  assert.throws(()=>receipts.check(row.phase,row.ok,{detail:row.detail,elapsedMs:row.elapsedMs}));
  const received=receiver(t,rechain(rs));assert.throws(received.invoke);assert.equal(received.output.length,0);assert(!fs.existsSync(received.destination));
});
for(const file of ['receipts.txt','Empfang.json'])test('receiver write failure never acknowledges acceptance: '+file,async t=>{
  const h=await run(t,{file:false}),r=receiver(t,h.lines.join('\n'),{writeError:file});assert.throws(r.invoke);assert.equal(r.output.length,0);
});
test('public receipt and private failure writes preserve original error; incomplete receipt rejected',async t=>{
  const h=harness(t,{file:false}),lines=[];let rejected;
  await assert.rejects(main({...options,output:l=>{if(rows([l])[0].phase==='release-shutdown')throw fault('ENOSPC');lines.push(l);}},h.n),e=>{rejected=e;return contains(e,h.original);});
  assert.equal(h.original.code,'ENOENT');assert.equal(h.original.dashboardShutdown.record.status,'failed');
  h.n.recordFailure=async()=>{throw fault('EIO');};const output=[];await reportFailure(h.n,rejected,l=>output.push(l));assert.equal(output[0],'SSB_PRIVATE_DIAGNOSTIC_NOT_PERSISTED');
  const r=receiver(t,lines.join('\n'));assert.throws(r.invoke);assert.equal(r.output.length,0);
});

function startHarness(config={}){
  const prefix='ssb-native-'+options.run,generation=config.generation||'release',events=[],plans=[];
  const current={generation,root:'/synthetic-start',binding:{root:'/synthetic-state',service:prefix,generation},common:{},project:prefix+'-'+generation,
    names:Object.fromEntries(roles.map(role=>[role,`${prefix}-${generation}-${role}`]))};
  const fixtures={...require('./fixtures.cjs'),generation:()=>current,write:(p,b)=>{plans.push(JSON.parse(b));return{path:p,sha256:sha(b)};}};
  const toolsRoot='/synthetic-tools',policy={assertPlan(){},verifyFiles(){},assertImage(){}};
  const C=load('native.cjs',{'./fixtures.cjs':fixtures,[path.join(toolsRoot,'scripts/ops/maintenance-start-contract.cjs')]:policy}).Native;
  const n=new C(options);Object.assign(n,{prefix,toolsRoot,synthetic:{owner:'a'.repeat(64)},verifiedPublicationManifest:'c'.repeat(64),
    images:Object.fromEntries(roles.map(role=>[role,'sha256:'+sha(role)])),imageMetadata:{}});
  n.privilegedStart=async(_p,_b,e)=>{if(e)e.id=sha(e.name);};
  n.inspect=async id=>{const e=n.owned.find(e=>e.name===id||e.id===id);assert(e);return[{Id:e.id,Image:e.image,State:{Running:true}}];};
  n.runningLimit=async()=>{};n.probe=async action=>{events.push(['probe',action]);return{verified:true};};
  n.state=async action=>{events.push(['state',action]);return{phase:'closed',work:{}};};
  n.d=async args=>{
    assert.deepEqual([args[0],args[2],args[3]],['exec','node','-e']);assert.equal(args.length,5);
    const e=n.owned.find(e=>e.id===args[1]);assert(e);const role=e.role,bad=role===(config.role||'dashboard')?config.fault:null;
    const record={version:1,service:prefix,generations:[generation],phase:'closed'};
    if(bad==='service')record.service='foreign';if(bad==='generation')record.generations=['foreign'];if(bad==='open')record.phase='open';if(bad==='version')record.version=2;
    const env={MAINTENANCE_STATE_ROOT:'/run/ssb-maintenance',MAINTENANCE_SERVICE:prefix,MAINTENANCE_GENERATION:generation};
    if(bad==='environment')env.MAINTENANCE_GENERATION='foreign';
    const allowed=role==='admin-writer'?['/run/ssb-writer-db','/run/ssb-writer-signing-key']:role==='dashboard'?['/run/ssb-writer-signing-key']:[];
    if(bad==='writer-db-readable')allowed.push('/run/ssb-writer-db');if(bad==='writer-key-readable')allowed.push('/run/ssb-writer-signing-key');
    if(bad==='runtime-readable')allowed.push('/run/ssb-runtime-contract.json');
    const fakeFS={constants:fs.constants,
      readFileSync(p){events.push([role,'read',p]);if(p===42)return bad==='invalid-json'?'{':JSON.stringify(record);
        if(!allowed.includes(p)||bad==='writer-key-missing'&&p==='/run/ssb-writer-signing-key'||bad==='writer-db-missing'&&p==='/run/ssb-writer-db')throw fault('EACCES');return Buffer.from(PRIVATE);},
      lstatSync(p){assert.equal(p,'/run/ssb-maintenance');return{isDirectory:()=>bad!=='directory-type',isSymbolicLink:()=>bad==='directory-link',uid:bad==='directory-owner'?0:1000,mode:bad==='directory-mode'?0o755:0o700};},
      accessSync(p,mode){assert.equal(p,'/run/ssb-maintenance');assert.equal(mode,fs.constants.R_OK|fs.constants.W_OK|fs.constants.X_OK);events.push([role,'access']);if(bad==='directory-readonly')throw fault('EROFS');},
      openSync(p,flags){assert.equal(p,'/run/ssb-maintenance/runtime-state.json');assert.equal(flags,fs.constants.O_RDWR|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);events.push([role,'open']);if(['readonly','missing','file-link'].includes(bad))throw fault(bad==='readonly'?'EROFS':bad==='missing'?'ENOENT':'ELOOP');return 42;},
      fstatSync(fd){assert.equal(fd,42);return{isFile:()=>bad!=='file-type',nlink:bad==='hardlink'?2:1,uid:bad==='file-owner'?0:1000,mode:bad==='file-mode'?0o644:0o600,size:bad==='oversize'?8*1024*1024+1:bad==='empty'?0:100};},
      closeSync(fd){assert.equal(fd,42);events.push([role,'close']);},
    };
    vm.runInNewContext(args[4],{require:id=>{assert(['fs','assert'].includes(id));return id==='fs'?fakeFS:assert;},process:{getuid:()=>bad==='uid'?0:1000,env}},{timeout:1000});
    return{stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)};
  };
  return{n,events,plans,generation};
}
for(const generation of ['release','forward','normal'])test('actual Native.startGeneration executes bound Dashboard RW proof: '+generation,async()=>{
  const h=startHarness({generation}),r=await h.n.startGeneration(generation);assert.equal(r.verified,true);assert.equal(h.n.owned.length,5);
  assert.deepEqual(h.events.filter(e=>e[0]==='dashboard').map(e=>e[1]),['read','read','read','access','open','read','close']);
  assert(h.events.some(e=>e[0]==='state'&&e[1]==='open'));assert.equal(h.plans.length,6);
  assert(!h.events.some(e=>['api','reporter'].includes(e[0])&&e[1]==='open'));
});
for(const fault of ['uid','environment','directory-type','directory-link','directory-mode','directory-owner','directory-readonly','readonly','missing','file-link','file-type','file-mode','file-owner','hardlink','empty','oversize','invalid-json','version','service','generation','open','writer-db-readable','runtime-readable','writer-key-missing'])test('actual start path rejects invalid Dashboard mount proof: '+fault,async()=>{
  const h=startHarness({fault});await assert.rejects(h.n.startGeneration(h.generation),e=>e.startOperation?.operation==='mount-readability'&&e.startOperation.service==='dashboard');
  assert(!h.events.some(e=>e[0]==='state'&&e[1]==='open'));
});
for(const [role,fault] of [['api','writer-db-readable'],['api','writer-key-readable'],['reporter','writer-db-readable'],['reporter','writer-key-readable'],['admin-writer','writer-db-missing'],['admin-writer','writer-key-missing']])test('actual start path preserves other mount checks: '+role+'/'+fault,async()=>{
  const h=startHarness({role,fault});await assert.rejects(h.n.startGeneration(h.generation),e=>e.startOperation?.operation==='mount-readability'&&e.startOperation.service===role);
});

function timedEvidence(){
  const data=nativeEvidence();
  for(const [i,g] of ['release','forward','normal'].entries()){
    const row=data[g+'-shutdown'],d=row.detail.dashboardShutdown,minute=String(i).padStart(2,'0');
    d.recordedAt=`2026-10-14T00:${minute}:01.000Z`;row.hashes[2]=sha(JSON.stringify(d));
    const o=data.closure.detail.outcomes.find(o=>o.role==='dashboard'&&o.generation===g);
    for(const s of [o.observation.before,o.observation.after])Object.assign(s,{startedAt:`2026-10-14T00:${minute}:00Z`,finishedAt:`2026-10-14T00:${minute}:02Z`,observedAt:'auto'});
  }
  return data;
}
function publish(data){
  const lines=[],receipts=new Receipts(options.run,SOURCE,options,l=>lines.push(l));
  for(const phase of require('./evidence.cjs').phases){
    if(phase==='closure')for(const o of data.closure.detail.outcomes)for(const s of [o.observation.before,o.observation.after])if(s?.observedAt==='auto')s.observedAt=new Date().toISOString();
    receipts.emit(phase,true,data[phase]);
  }
  return lines;
}
test('complete producer -> regular receiver accepts exact Dashboard lifetime bindings',t=>{
  const lines=publish(timedEvidence()),r=receiver(t,lines.join('\n'),{conclusion:'success'});r.invoke();assert.equal(JSON.parse(r.output[0]).status,'RECEIVED_AND_VERIFIED');
});
const lifetimeMutations={
  future:(row)=>{row.detail.dashboardShutdown.recordedAt='2099-01-01T00:00:00.000Z';},
  stale:(row)=>{row.detail.dashboardShutdown.recordedAt='2026-10-13T00:00:00.000Z';},
  'after-exit':(row)=>{row.detail.dashboardShutdown.recordedAt='2026-10-14T00:00:03.000Z';},
  'missing-start':(_row,o)=>{o.observation.before.startedAt=o.observation.after.startedAt=null;},
  'missing-finish':(_row,o)=>{o.observation.before.finishedAt=o.observation.after.finishedAt=null;},
  'missing-before':(_row,o)=>{o.observation.before=null;},
  'missing-after':(_row,o)=>{o.observation.after=null;},
  'zero-lifetime':(_row,o)=>{for(const s of [o.observation.before,o.observation.after])s.startedAt=s.finishedAt='0001-01-01T00:00:00Z';},
  'inverted-lifetime':(_row,o)=>{for(const s of [o.observation.before,o.observation.after]){s.startedAt='2026-10-14T00:00:02Z';s.finishedAt='2026-10-14T00:00:00Z';}},
  'changed-start':(_row,o)=>{o.observation.after.startedAt='2026-10-13T23:59:59Z';},
  'changed-finish':(_row,o)=>{o.observation.after.finishedAt='2026-10-14T00:00:03Z';},
  'future-finish':(_row,o)=>{for(const s of [o.observation.before,o.observation.after])s.finishedAt='2099-01-01T00:00:00Z';},
  'observation-before-shutdown':(_row,o)=>{for(const s of [o.observation.before,o.observation.after])s.observedAt='2026-10-14T00:00:02Z';},
  'future-observation':(_row,o)=>{for(const s of [o.observation.before,o.observation.after])s.observedAt='2099-01-01T00:00:00Z';},
  'foreign-container-lifetime':(_row,o,closure)=>{const other=closure.detail.outcomes.find(x=>x.role==='dashboard'&&x.generation==='forward');[o.observation,other.observation]=[other.observation,o.observation];},
};
for(const [name,mutate] of Object.entries(lifetimeMutations))test('producer and receiver reject recomputed Dashboard time contradiction: '+name,t=>{
  const data=timedEvidence(),target=data.closure.detail.outcomes.find(o=>o.role==='dashboard'&&o.generation==='release');
  mutate(data['release-shutdown'],target,data.closure);data['release-shutdown'].hashes[2]=sha(JSON.stringify(data['release-shutdown'].detail.dashboardShutdown));
  assert.throws(()=>publish(data));
  const rs=rows(publish(timedEvidence())),row=rs.find(r=>r.phase==='release-shutdown'),closure=rs.find(r=>r.phase==='closure'),o=closure.detail.outcomes.find(o=>o.role==='dashboard'&&o.generation==='release');
  mutate(row,o,closure);row.hashes[2]=sha(JSON.stringify(row.detail.dashboardShutdown));
  const r=receiver(t,rechain(rs),{conclusion:'success'});assert.throws(r.invoke);assert.equal(r.output.length,0);assert(!fs.existsSync(r.destination));
});
