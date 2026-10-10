'use strict';
// Offline transport only. Real Native.initialize/main/receipt/receiver code; no Docker or GitHub process.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
const common=require('./common.cjs'),{sha,GateError}=common,{main,SOURCE,reportFailure}=require('./controller.cjs');
const {parseReceipts,dispatchTitle}=require('./evidence.cjs'),{publicFailure,validateFailure,validateInit,InitProgress,initSteps}=require('./diagnostics.cjs');
const fixtures=require('./fixtures.cjs'),opts={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)},job='87654321';
const marker='SYNTHETIC_PRIVATE_MARKER',tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ssb-init-diagnostic-'));
function load(file,replacements={},globals={}){const m={exports:{}},req=createRequire(file);const globalsForModule={module:m,exports:m.exports,__dirname:path.dirname(file),__filename:file,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,performance,setTimeout,clearTimeout,setInterval,clearInterval,console,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError,...globals};vm.compileFunction(fs.readFileSync(file,'utf8'),Object.keys(globalsForModule),{filename:file})(...Object.values(globalsForModule));return m.exports;}
function harness({fault=null,old=false,processFailure=null}={}){
 const root=tmp(),raw=path.join(root,'raw'),state=path.join(root,'state');fs.mkdirSync(raw);fs.mkdirSync(state);
 const calls=[],snapshots=new Map(),nets=new Map(),volumes=[],hit=(name)=>{if(fault?.at===name)throw fault.error;},id=i=>i.toString(16).padStart(64,'0');let serial=10;
 const fakeFS={...fs,mkdirSync(p,o){hit('mkdir');return fs.mkdirSync(p,o);},chmodSync(p,m){hit('chmod');return fs.chmodSync(p,m);}};
 const fakeFixtures={...fixtures,write(p,b){hit('env');fs.writeFileSync(p,b,{flag:'wx',mode:0o600});return{path:p,sha256:sha(b)};}};
 const file=path.join(old?path.resolve(__dirname,old==='diagnostic'?'../../../../ssb-init-diagnostic-followup-20261010.HV5QFt/publication/.github/ssb-native-forward-recovery':'../../../../ssb-helper-access-binding-followup-20261010.2oRmpy/publication/.github/ssb-native-forward-recovery'):__dirname,'native.cjs');
 const C=load(file,{'node:fs':fakeFS,'./fixtures.cjs':fakeFixtures}).Native,n=new C(opts);
 Object.assign(n,{privateRoot:root,toolsRoot:path.join(root,'tools'),stateRoot:state,stateEntry:path.join(__dirname,'state-agent.cjs'),source:path.join(root,'source'),prefix:'ssb-native-'+opts.run,docker:'/usr/bin/docker',synthetic:{owner:marker,passwords:{postgres:marker}},images:{api:'sha256:'+id(100)},initial:{containers:[],volumes:[]},proc:{calls:[],assertClosed(){assert.ok(this.calls.every(x=>x.closed));}}});
 if(!old){assert.equal(n.start,C.prototype.start);assert.equal(Object.hasOwn(n,'start'),false);assert.equal(typeof n.startedAt,'number');}
 const response=(stdout='',code=0)=>({stdout:Buffer.from(stdout),stderr:Buffer.alloc(0),code,signal:null,closed:true});
 n.command=async(bin,args,o={})=>{
  calls.push({bin,args,o});n.proc.calls.push({closed:true});
  if(bin===process.execPath){
   assert.equal(args.at(-2),n.stateEntry);assert.equal(o.uid,1000);assert.equal(o.gid,1000);assert.equal(o.ms,1000);const input=JSON.parse(o.input);
   if(args.at(-1)==='load-runtime'){hit('load');return response(JSON.stringify({loaded:true,uid:1000,gid:1000,node:'v24.17.0',modules:8,runtime:true}));}
   assert.equal(args.at(-1),'run');assert.equal(input.action,'initialize');assert.equal(input.binding.root,state);hit('state');if(processFailure)return processFailure(n,args,o);
   return response(JSON.stringify({epoch:0,syntheticNewService:true}));
  }
  assert.equal(bin,'/usr/bin/docker');assert.deepEqual(Array.from(args.slice(0,2)),['--host','unix:///var/run/docker.sock']);const a=Array.from(args.slice(2));
  if(a[0]==='network'&&a[1]==='create'){hit('network-create');const key=id(serial++);nets.set(key,{Id:key,Name:a.at(-1),Internal:true,Driver:'bridge'});return response(key);}
  if(a[0]==='network'&&a[1]==='inspect'){hit('network-inspect');return response(fault?.at==='network-json'?'{':fault?.at==='network-empty'?'[]':JSON.stringify([nets.get(a[2])]));}
  if(a[0]==='volume'&&a[1]==='ls')return response(volumes.join('\n'));
  if(a[0]==='volume'&&a[1]==='create'){volumes.push(a.at(-1));return response(a.at(-1));}
  if(a[0]==='volume'&&a[1]==='inspect')return response(JSON.stringify([{Name:a[2],Driver:'local',Scope:'local',Labels:{'com.ssb.native-run':opts.run},Options:{}}]));
  if(a[0]==='create'){
   hit('create');const key=id(serial++),name=a[a.indexOf('--name')+1],image=a.find(x=>x.startsWith('sha256:'));
   snapshots.set(key,{Id:key,Name:'/'+name,Image:image,Config:{Labels:{'com.ssb.native-run':opts.run}},HostConfig:{Privileged:false,PortBindings:{},PublishAllPorts:false},RestartCount:0,State:{Status:'created',Running:false,Paused:false,Restarting:false,Dead:false,OOMKilled:false,Error:'',Pid:0,ExitCode:0,StartedAt:'0001-01-01T00:00:00Z',FinishedAt:'0001-01-01T00:00:00Z'}});return response(key);
  }
  if(a[0]==='container'&&a[1]==='inspect')return response(JSON.stringify([snapshots.get(a[2])]));
  if(a[0]==='container'&&a[1]==='ls')return response([...snapshots].filter(x=>x[1].State.Running).map(x=>x[0]).join('\n'));
  if(a[0]==='network'&&a[1]==='connect'){hit('connect');return response();}
  if(a[0]==='cp'){hit('copy');fs.writeFileSync(a[2],'// synthetic runtime file\n');return response();}
  if(a[0]==='start'){hit('start');const x=snapshots.get(a[1]);hit('start-'+n.owned.find(e=>e.id===a[1]).role);Object.assign(x.State,{Status:'running',Running:true,Pid:123,StartedAt:'2026-10-10T00:00:00Z'});return response(x.Id);}
  if(a[0]==='stop'){const x=snapshots.get(a[3]);Object.assign(x.State,{Status:'exited',Running:false,Pid:0,FinishedAt:'2026-10-10T00:00:01Z'});return response(x.Id);}
  if(a[0]==='exec'&&a.includes('pg_isready'))return response();
  if(a[0]==='exec'&&a.includes('redis-cli'))return response(fault?.at==='redis-ping'?'BAD':'PONG');
  if(a[0]==='exec'&&a.includes('redis-server'))return response('Redis server v=7.4.8');
  if(a[0]==='exec'&&a.includes('pg_dump'))return response('SYNTHETIC_DUMP');
  if(a[0]==='exec'&&a.includes('pg_dumpall'))return response('CREATE ROLE postgres;\nCREATE ROLE synthetic_runtime;\n');
  if(a[0]==='exec'&&a.includes('psql')){assert.equal(o.input,'CREATE ROLE synthetic_runtime;\n');return response();}
  if(a[0]==='exec'&&a.includes('pg_restore')){assert.equal(o.input.toString(),'SYNTHETIC_DUMP');return response();}
  if(a[0]==='exec'&&a.includes('/proof/probe.cjs')){const input=JSON.parse(o.input);assert.ok(['initialize','database','restore-logins'].includes(input.action));hit('probe');await new Promise(r=>setImmediate(r));return response(fault?.at==='probe-json'?'SSB_PROOF_JSON {':'SSB_PROOF_JSON '+JSON.stringify({verified:true,counts:input.action==='initialize'?[34,4,1]:input.action==='restore-logins'?[2,2]:[1],hashes:['c'.repeat(64)]}));}
  assert.fail('unapproved offline command');
 };
 const actual=n.execute.bind(n),pm=sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json')));
 n.execute=async phase=>phase==='preflight'?{verified:true,counts:[901,4],hashes:[pm]}:phase==='bases'?{verified:true,counts:[4],ids:require('./registry-bindings.json').images.map(x=>x.imageId)}:phase==='builds'?{verified:true,counts:[4,2],ids:[100,101,102,103,100].map(i=>'sha256:'+id(i))}:actual(phase);
 return{n,root,calls,pm,snapshots};
}
function receiver(log,{badManifest=false,writeFailure=null}={}){
 const destination=path.join(tmp(),'received'),output=[],fakeFS={...fs,readFileSync(p,...a){if(badManifest&&p.endsWith('publication-manifest.json'))return Buffer.from('wrong manifest');return fs.readFileSync(p,...a);},writeFileSync(p,b,o){if(path.basename(p)===writeFailure)throw Object.assign(Error(marker),{code:'ENOSPC'});return fs.writeFileSync(p,b,o);}};
 const api=(bin,args)=>{assert.equal(bin,'gh');const route=args[1];if(route.endsWith('/actions/runs/'+opts.run))return JSON.stringify({id:Number(opts.run),event:'workflow_dispatch',run_attempt:1,head_sha:opts.workflowHead,display_title:dispatchTitle(opts.workflowHead,opts.dispatchNonce),status:'completed',conclusion:'failure',path:'.github/workflows/ssb-native-forward-recovery.yml'});if(route.endsWith('/actions/jobs/'+job))return JSON.stringify({id:Number(job),run_id:Number(opts.run),conclusion:'failure',name:'Native forward recovery',labels:['ubuntu-24.04']});if(route.endsWith('/logs'))return log;assert.fail('unapproved offline API');};
 const r=load(path.join(__dirname,'receive.cjs'),{'node:fs':fakeFS,'node:child_process':{execFileSync:api}},{console:{log:x=>output.push(x)}});
 return{destination,output,invoke:()=>r.main([opts.run,job,opts.workflowHead,opts.dispatchNonce,destination])};
}
async function runFailure(config,output){const h=harness(config),lines=[];let error;try{await main({...opts,output:output||((x)=>lines.push(x))},h.n);}catch(e){error=e;}assert.ok(error);return{...h,lines,error};}
const decode=lines=>lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
const cases=[
 ['JSON',{at:'network-json'},'network-inspect','network-create','invalid_json','GateError','unknown'],
 ['TypeError',{at:'network-empty'},'network-inspect','network-create','unknown','TypeError','unknown'],
 ['SyntaxError',{at:'load',error:new SyntaxError(marker)},'runtime-load','maintenance-permissions','unknown','SyntaxError','unknown'],
 ['forged error class',{at:'copy',error:{name:'TypeError',message:marker,code:'UNRECOGNIZED'}},'maintenance-copy','maintenance-directory','unknown','unknown','unknown'],
 ['EACCES',{at:'mkdir',error:Object.assign(Error(marker),{code:'EACCES',path:'/synthetic-private'})},'maintenance-directory','probe-writer-connect','unknown','Error','EACCES'],
 ['EPERM',{at:'chmod',error:Object.assign(Error(marker),{code:'EPERM'})},'maintenance-permissions','maintenance-copy','unknown','Error','EPERM'],
 ['known gate',{at:'redis-ping'},'redis-ping','postgres-ready','redis_not_ready','GateError','unknown'],
 ['unknown',{at:'copy',error:Object.assign(Error(marker),{code:'UNRECOGNIZED',path:'/synthetic-private'})},'maintenance-copy','maintenance-directory','unknown','Error','unknown'],
 ['primitive',{at:'copy',error:'SYNTHETIC_PRIVATE_MARKER'},'maintenance-copy','maintenance-directory','unknown','unknown','unknown'],
 ['async probe',{at:'probe',error:new TypeError(marker)},'database-initialize','redis-version','unknown','TypeError','unknown'],
 ['probe JSON',{at:'probe-json'},'database-initialize','redis-version','invalid_json','GateError','unknown'],
];
for(const [name,fault,step,lastConfirmed,gate,errorClass,fsCode]of cases)test('actual initialize -> controller -> receipt -> unchanged receiver: '+name,async()=>{
 const h=await runFailure({fault}),rows=decode(h.lines),failed=rows.find(x=>!x.ok),d=failed.detail.failure;
 assert.equal(failed.phase,'initialize');assert.deepEqual(d.init,{version:1,step,lastConfirmed,gate,errorClass,fsCode});validateFailure(d);
 assert.equal(h.error.code,h.error.cause instanceof GateError?h.error.cause.code:'init_failed');if(fault.error)assert.equal(h.error.cause,fault.error);assert.equal(rows[0].hashes[0],h.pm);assert.equal(rows.at(-1).phase,'closure');assert.ok(rows.at(-1).ok);
 assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|synthetic-private|stack|password|postgres\.env/);
 assert.throws(()=>parseReceipts(h.lines.join('\n'),opts.run,SOURCE,opts));const r=receiver('unexported synthetic raw\n'+h.lines.join('\n'));r.invoke();const proof=JSON.parse(fs.readFileSync(path.join(r.destination,'Empfang.json')));assert.equal(proof.status,'PARTIAL_FAILURE_RECEIVED');assert.equal(proof.publicationManifest,h.pm);assert.equal(proof.phases,5);assert.equal(r.output.length,1);assert.equal(fs.statSync(r.destination).mode&511,0o700);assert.equal(fs.statSync(path.join(r.destination,'receipts.txt')).mode&511,0o600);
});
test('old actual initialize loses TypeError progress; new diagnostic does not claim historical cause',async()=>{const old=await runFailure({old:true,fault:{at:'network-empty'}});assert.equal(old.error instanceof TypeError,true);assert.equal(decode(old.lines)[3].detail.failure.code,'unclassified');assert.equal(decode(old.lines)[3].detail.failure.init,undefined);const next=await runFailure({fault:{at:'network-empty'}});assert.equal(decode(next.lines)[3].detail.failure.init.errorClass,'TypeError');});
test('historical start collision is reproduced without workaround; corrected constructor reaches all three actual starts',async()=>{
 const before=await runFailure({old:true}),after=harness();assert.equal(typeof before.n.start,'number');assert.equal(typeof Object.getPrototypeOf(before.n).start,'function');assert.ok(before.error instanceof TypeError);assert.match(before.error.message,/this.start is not a function/);
 assert.equal(decode(before.lines)[3].detail.failure.code,'unclassified');assert.ok(!before.calls.some(c=>c.args[2]==='start'));
 const result=await after.n.initialize();assert.equal(result.verified,true);assert.equal(after.n.start,Object.getPrototypeOf(after.n).start);assert.equal(Object.hasOwn(after.n,'start'),false);
 assert.deepEqual(after.calls.filter(c=>c.args[2]==='start').map(c=>c.args[3]),[after.n.pg.id,after.n.redis.id,after.n.probeContainer.id]);assert.ok(after.n.owned.every(e=>e.startRequested&&after.snapshots.get(e.id).State.Running));
});
test('actual initialize awaits success, preserves 90-second window and invokes State exactly once without a start override',async()=>{
 const b=harness(),t=performance.now(),rb=await b.n.initialize();assert.ok(rb.verified);assert.ok(b.n.probeDeadline>=t+90000);assert.ok(b.n.probeDeadline<=performance.now()+90000);
 const states=b.calls.filter(c=>c.bin===process.execPath);assert.equal(states.length,2);assert.deepEqual(states.map(c=>c.args.at(-1)),['load-runtime','run']);for(const c of states){assert.equal(c.o.ms,1000);assert.equal(c.o.uid,1000);assert.equal(c.o.gid,1000);}assert.equal(JSON.parse(states[1].o.input).action,'initialize');
});
for(const rawWriteFailure of [false,true])test('actual Processes state error and raw-write failure preserve primary and structured init context: '+rawWriteFailure,async()=>{
 let processProof;
 const h=await runFailure({processFailure:async(n,args,o)=>{
  const child=new EventEmitter();for(const k of ['stdout','stderr','stdin'])child[k]=new EventEmitter();child.stdin.end=()=>queueMicrotask(()=>{child.stderr.emit('data',Buffer.from('SSB_STATE_DIAGNOSTIC_V1 {"version":1,"stage":"initialize-state","code":"EACCES"}\n'));child.emit('close',1,null);});
  const fsProxy={...fs,writeFileSync(...a){if(rawWriteFailure)throw Object.assign(Error(marker),{code:'ENOSPC'});return fs.writeFileSync(...a);}};
  const C=load(path.join(__dirname,'common.cjs'),{'node:fs':fsProxy,'node:child_process':{spawn:(bin,a,options)=>{assert.equal(bin,process.execPath);assert.deepEqual(Array.from(a),Array.from(args));assert.equal(options.uid,1000);assert.equal(options.gid,1000);return child;}}});
  const p=new C.Processes({deadline:performance.now()+40000,privateRoot:path.join(n.privateRoot,'raw')});try{return await p.run(process.execPath,args,o);}finally{p.assertClosed();processProof=p.calls;}
 }});
 const primary=rawWriteFailure?h.error.cause.errors[0]:h.error.cause;assert.equal(primary.code,'command_failed');assert.equal(primary.stateDiagnostic.code,'EACCES');assert.ok(primary.stack);assert.equal(processProof.length,1);assert.ok(processProof[0].closed);
 const d=decode(h.lines)[3].detail.failure;assert.equal(d.init.step,'state-initialize');assert.equal(d.init.lastConfirmed,'runtime-load');assert.doesNotMatch(JSON.stringify(d),/SYNTHETIC_PRIVATE|stack|argv/);assert.match(JSON.stringify(d),/EACCES/);if(rawWriteFailure)assert.match(JSON.stringify(d),/ENOSPC/);receiver(h.lines.join('\n')).invoke();
});
test('additional public receipt-write and closure-write failures retain original exception and prevent receipt acceptance',async()=>{
 const original=new TypeError(marker),lines=[];let calls=0;
 const h=await runFailure({fault:{at:'copy',error:original}},line=>{if(++calls>=4)throw Object.assign(Error(marker),{code:'ENOSPC'});lines.push(line);});
 const contains=e=>e===original||(e?.cause&&contains(e.cause))||(Array.isArray(e?.errors)&&e.errors.some(contains));assert.ok(contains(h.error));assert.ok(original.stack);assert.equal(lines.length,3);const r=receiver(lines.join('\n'));assert.throws(r.invoke);assert.equal(r.output.length,0);
 const messages=[];await reportFailure({recordFailure:async e=>{assert.equal(e,h.error);throw Error(marker);}},h.error,x=>messages.push(x));assert.deepEqual(messages,['SSB_PRIVATE_DIAGNOSTIC_NOT_PERSISTED','SSB_NATIVE_FORWARD_RECOVERY_FAILED: inspect bounded receipt phase; raw diagnostics remain private']);
});
for(const file of ['receipts.txt','Empfang.json'])test('receiver write failure cannot turn bounded Init error into accepted result: '+file,async()=>{const h=await runFailure({fault:{at:'network-json'}}),r=receiver(h.lines.join('\n'),{writeFailure:file});assert.throws(r.invoke);assert.equal(r.output.length,0);assert.ok(!fs.existsSync(path.join(r.destination,'Empfang.json')));});
function rechain(rows){let prev='0'.repeat(64);return rows.map((r,seq)=>{const b=JSON.stringify({...r,seq,previous:prev});prev=sha(b);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(b).toString('base64')+' '+prev;}).join('\n');}
for(const kind of ['manifest','missing','truncated','private-step','private-code','private-class','extra-field','wrong-phase'])test('receiver strictly rejects damaged or unsafe Init evidence: '+kind,async()=>{
 const h=await runFailure({fault:{at:'network-json'}}),rows=decode(h.lines);
 if(kind==='manifest')rows[0].hashes=['f'.repeat(64)];if(kind==='missing')rows.pop();if(kind==='private-step')rows[3].detail.failure.init.step=marker;if(kind==='private-code')rows[3].detail.failure.init.fsCode=marker;if(kind==='private-class')rows[3].detail.failure.init.errorClass=marker;if(kind==='extra-field')rows[3].detail.failure.init.path=marker;if(kind==='wrong-phase'){rows[4].ok=false;rows[4].detail.failure=rows[3].detail.failure;}
 let log=rechain(rows);if(kind==='truncated')log=log.slice(0,-10);const r=receiver(log);assert.throws(r.invoke);assert.equal(r.output.length,0);assert.ok(!fs.existsSync(r.destination));
});
test('fixed vocabulary rejects counterfeit gate classes and never reads free messages for classification',()=>{const t=new InitProgress();for(const step of initSteps){t.enter(step);t.confirm();}const e=Object.assign(Error('invalid_json '+marker),{code:'invalid_json'});const d=publicFailure(t.failure(e));assert.equal(d.init.gate,'unknown');assert.equal(d.init.errorClass,'Error');assert.doesNotMatch(JSON.stringify(d),/PRIVATE/);assert.throws(()=>validateInit({...d.init,gate:'invalid_json'}));assert.throws(()=>t.enter(marker));});

test('HV5QFt actual constructor fails at postgres-start; current constructor succeeds with untouched prototype method',async()=>{
 const before=await runFailure({old:'diagnostic'}),d=decode(before.lines)[3].detail.failure;
 assert.equal(d.init.step,'postgres-start');assert.equal(d.init.lastConfirmed,'state-initialize');assert.equal(d.init.errorClass,'TypeError');assert.ok(before.error.cause instanceof TypeError);
 const after=harness();assert.ok((await after.n.initialize()).verified);assert.equal(after.n.start,Object.getPrototypeOf(after.n).start);assert.equal(Object.hasOwn(after.n,'start'),false);
});
test('actual restore creates its own PostgreSQL resource and starts it with the unchanged method',async()=>{
 const h=harness();await h.n.initialize();const deadline=h.n.deadline,probeDeadline=h.n.probeDeadline,result=await h.n.restore();assert.ok(result.verified);
 assert.equal(h.n.deadline,deadline);assert.equal(h.n.probeDeadline,probeDeadline);assert.equal(h.n.owned.length,4);assert.equal(h.n.restorePg.role,'restore-postgres');assert.notEqual(h.n.restorePg.id,h.n.pg.id);
 assert.deepEqual(h.calls.filter(c=>c.args[2]==='start').map(c=>c.args[3]),[h.n.pg.id,h.n.redis.id,h.n.probeContainer.id,h.n.restorePg.id]);
 const a=h.calls.findIndex(c=>c.args[2]==='start'&&c.args[3]===h.n.restorePg.id);
 assert.deepEqual(h.calls[a+1].args.slice(2),['container','inspect',h.n.restorePg.id]);assert.equal(h.calls[a+2].args[3],'ls');assert.ok(h.calls.slice(a+3).some(c=>c.args.includes('pg_restore')));
 assert.equal(result.hashes[0],sha(Buffer.from('SYNTHETIC_DUMP')));assert.equal(h.n.start,Object.getPrototypeOf(h.n).start);
});
for(const [role,index,last]of [['postgres',0,'state-initialize'],['redis',1,'postgres-start'],['probe',2,'redis-start']])test('failed actual Init start stops subsequent work and preserves bounded diagnostics: '+role,async()=>{
 const error=new GateError('command_failed'),h=await runFailure({fault:{at:'start-'+role,error}}),rows=decode(h.lines),d=rows.find(r=>!r.ok).detail.failure;
 assert.equal(d.init.step,role+'-start');assert.equal(d.init.lastConfirmed,last);assert.equal(d.init.gate,'command_failed');assert.ok(h.error instanceof AggregateError);assert.equal(h.error.errors[0].cause,error);assert.equal(rows.at(-1).ok,false);assert.equal(rows.at(-1).detail.outcomes[index].state,'unverified');
 assert.equal(h.calls.filter(c=>c.args[2]==='start').length,index+1);assert.ok(!h.calls.some(c=>c.args.includes('pg_isready')));assert.ok(rows.at(-1).detail.outcomes.every(x=>x.state!=='graceful'));
 assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|stack|password/);receiver(h.lines.join('\n')).invoke();
});
test('failed restore start cannot reach readiness, role import or restore and preserves original error',async()=>{
 const error=new GateError('command_failed'),h=harness({fault:{at:'start-restore-postgres',error}});await h.n.initialize();const n=h.calls.length;
 await assert.rejects(h.n.restore(),e=>e===error);const calls=h.calls.slice(n);assert.equal(calls.filter(c=>c.args[2]==='start').length,1);assert.ok(!calls.some(c=>c.args.includes('pg_isready')||c.args.includes('pg_restore')||c.args.includes('psql')));assert.equal(h.n.restorePg.startRequested,true);
});
for(const scenario of ['command','inspect','created','not-running','oom','ninth-running','malformed'])test('unmodified start rejects invalid transport/runtime evidence: '+scenario,async()=>{
 const {Native}=require('./native.cjs'),n=new Native(opts),entry={id:'d'.repeat(64),startRequested:false},calls=[],original=new GateError('command_failed');
 n.docker='/usr/bin/docker';n.command=async(bin,args)=>{assert.equal(bin,n.docker);const a=args.slice(2);calls.push(a);
  if(a[0]==='start'){if(scenario==='command')throw original;return{stdout:Buffer.alloc(0)};}
  if(a[0]==='container'&&a[1]==='inspect'){if(scenario==='inspect')throw original;return{stdout:Buffer.from(scenario==='malformed'?'[]':JSON.stringify([{State:{Status:scenario==='created'?'created':'running',Running:scenario!=='not-running',OOMKilled:scenario==='oom'}}]))};}
  assert.deepEqual(a,['container','ls','-q','--filter','label=com.ssb.native-run='+opts.run]);return{stdout:Buffer.from(Array.from({length:9},(_,i)=>String(i)).join('\n'))};
 };
 assert.equal(n.start,Native.prototype.start);assert.equal(Object.hasOwn(n,'start'),false);
 await assert.rejects(n.start(entry),e=>['command','inspect'].includes(scenario)?e===original:scenario==='malformed'?e instanceof TypeError:e.code===(scenario==='ninth-running'?'running_resource_limit':'service_not_running'));
 assert.equal(entry.startRequested,true);assert.deepEqual(calls[0],['start',entry.id]);assert.equal(calls.length,scenario==='command'?1:scenario==='ninth-running'?3:2);
});
test('start awaits command and inspect before completing; no overridden or deleted start method',async()=>{
 const {Native}=require('./native.cjs'),n=new Native(opts),entry={id:'e'.repeat(64)},calls=[];let releaseStart,releaseInspect,done=false;
 n.docker='/usr/bin/docker';n.command=async(bin,args)=>{assert.equal(bin,n.docker);const a=args.slice(2);calls.push(a);
  if(a[0]==='start'){await new Promise(r=>{releaseStart=r;});return{stdout:Buffer.alloc(0)};}
  if(a[1]==='inspect'){await new Promise(r=>{releaseInspect=r;});return{stdout:Buffer.from(JSON.stringify([{State:{Status:'running',Running:true,OOMKilled:false}}]))};}
  return{stdout:Buffer.alloc(0)};
 };
 const promise=n.start(entry).then(x=>{done=true;return x;});assert.equal(done,false);assert.equal(calls.length,1);releaseStart();await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(calls.length,2);releaseInspect();assert.equal((await promise).State.Running,true);assert.equal(calls.length,3);assert.equal(n.start,Native.prototype.start);
});
for(const remaining of [undefined,45000,1200000])test('actual constructor keeps original monotone deadline calculation: '+remaining,()=>{
 let ticks=0;const proc={...process,env:{...process.env}};delete proc.env.SSB_JOB_DEADLINE_MS;if(remaining!==undefined)proc.env.SSB_JOB_DEADLINE_MS=String(1700000000000+remaining);
 const C=load(path.join(__dirname,'native.cjs'),{'./common.cjs':{...common,clock:()=>{ticks++;return 1234.5;}}},{process:proc,Date:{now:()=>1700000000000}}).Native;
 const n=new C(opts);assert.equal(ticks,1);assert.equal(n.startedAt,1234.5);assert.equal(n.jobRemaining,remaining??990000);assert.equal(n.deadline,1234.5+Math.min(990000,remaining??990000));assert.equal(n.start,C.prototype.start);assert.equal(Object.hasOwn(n,'start'),false);
});
test('actual d/command keeps probe work cutoff and 30-second closure reserve after rename',async()=>{
 let now=1000;const root=tmp(),fakeFS={...fs,statfsSync:()=>({bavail:10,bsize:1024**3,ffree:300000}),readFileSync:(p,...args)=>p==='/proc/meminfo'?'MemAvailable: 9000000 kB\n':fs.readFileSync(p,...args)};
 const C=load(path.join(__dirname,'native.cjs'),{'node:fs':fakeFS,'./common.cjs':{...common,clock:()=>now}},{process:{...process,env:{}}}).Native,n=new C(opts),calls=[];
 n.docker='/usr/bin/docker';n.privateRoot=root;n.probeDeadline=91000;n.proc={run:async(bin,args,o)=>{calls.push({bin,args,o});return{stdout:Buffer.alloc(0)};}};
 now=60000;await n.d(['container','inspect','f'.repeat(64)]);assert.equal(calls[0].o.ms,1000);
 now=60750;await assert.rejects(n.d(['start','f'.repeat(64)]),e=>e.code==='probe_work_deadline');assert.equal(calls.length,1);
 n.closureDeadline=85000;await n.d(['container','inspect','f'.repeat(64)],{closure:true,ms:1500});assert.equal(calls[1].o.deadline,85000);assert.equal(calls[1].o.ms,1500);assert.equal(n.deadline,991000);assert.equal(n.probeDeadline,91000);
});
