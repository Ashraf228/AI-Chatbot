'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
const proto=require('./reporter-contract.cjs'),{Native}=require('./native.cjs'),{sha,GateError}=require('./common.cjs'),{main,SOURCE}=require('./controller.cjs'),{publicFailure}=require('./diagnostics.cjs'),{parseReceipts}=require('./evidence.cjs');
assert.equal(process.version,'v24.17.0');
function load(name,replacements={},tail=''){
 const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname,__filename:file,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};
 vm.compileFunction(fs.readFileSync(file,'utf8')+tail,Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;
}
const h=load('reporter-diagnostic.test.cjs',{'node:test':()=>{}}),options=h.globalOptions();
const publication=sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json')));
const {nativeEvidence}=load('offline.test.cjs',{'node:test':()=>{}},'\nmodule.exports={nativeEvidence};');
const binding=g=>proto.binding(options.run,g,publication);
const record=g=>({version:1,binding:binding(g),status:'completed',steps:[...proto.completionSteps]});
const line=r=>proto.COMPLETION_MARKER+JSON.stringify(r)+'\n';
const actual=new Map();
for(const generation of ['release','forward','normal'])test('actual Reporter entry awaits successful admitted work: '+generation,t=>{
 const f=h.fixture(t),b=binding(generation);f.env.MAINTENANCE_GENERATION=generation;f.env.SSB_REPORTER_DIAGNOSTIC_BINDING=JSON.stringify(b);
 const stateFile=path.join(f.state,'runtime-state.json'),state=JSON.parse(fs.readFileSync(stateFile));state.phase='open';state.generations=[generation];fs.writeFileSync(stateFile,JSON.stringify(state));
 fs.writeFileSync(path.join(f.dist,'main.js'),'import {reporterEntry} from "./maintenance.js";export async function startReporter(p){await reporterEntry(async()=>{await new Promise(r=>setTimeout(r,15));},p);}');
 const out=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(out.error,undefined);assert.equal(out.signal,null);assert.equal(out.status,0,out.stderr);
 assert.deepEqual(proto.decodeCompletion(out.stdout,out.stderr,b),record(generation));
 const done=JSON.parse(fs.readFileSync(stateFile));assert.equal(Object.values(done.work).filter(w=>w.kind==='worker'&&w.state==='completed').length,1);
 assert.doesNotMatch(out.stdout+out.stderr,/PRIVATE|\/Users\/|password|cookie|stack/);assert.doesNotMatch(fs.readFileSync(f.events,'utf8'),/external-denied/);
 actual.set(generation,out);
});
test('Exit 0 without reporterEntry does not fabricate a completion',t=>{
 const f=h.fixture(t);fs.writeFileSync(path.join(f.dist,'main.js'),'export async function startReporter(){}');
 const r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,0);assert.equal(r.stdout,'');assert.throws(()=>proto.decodeCompletion(r.stdout,r.stderr,binding('release')),/reporter_completion_missing/);
});
for(const fault of ['work-close','action-and-close','entry-missing','state-json'])test('actual '+fault+' never emits completed work',t=>{
 const f=h.fixture(t,fault),r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1);assert.equal(r.error,undefined);assert.doesNotMatch(r.stdout, /SSB_REPORTER_COMPLETED/);proto.decode(r.stdout,r.stderr,binding('release'));
});
test('actual completion write failure fails; no successful proof or secret output',async t=>{
 const f=h.fixture(t),file=path.join(f.root,'synthetic-main.mjs');fs.writeFileSync(file,'export async function startReporter(p){for(const s of ["admission","action","work-close","completion"]){p.enter(s);p.confirm();}}');
 const err=Object.assign(new Error('SYNTHETIC_PRIVATE'),{code:'EPIPE'}),parts=[];
 await assert.rejects(proto.run({env:f.env,entry:file,write:(fd,buf,at,len)=>{if(fd===1)throw err;parts.push(buf.subarray(at,at+len));return len;}}),e=>e===err);
 const d=proto.decode('',Buffer.concat(parts),binding('release'));assert.equal(d.primary.nodeCode,'EPIPE');assert.equal(d.primary.step,'diagnostic-write');assert.doesNotMatch(Buffer.concat(parts).toString(),/SYNTHETIC_PRIVATE/);
});
for(const name of ['empty','truncated','invalid-json','duplicate','raw-extra','stderr','oversize','wrong-run','wrong-generation','wrong-manifest','wrong-call','missing-step','reordered','extra-field','false-status'])test('completion contract rejects '+name,()=>{
 let r=record('forward'),out=line(r),err='';
 if(name==='empty')out='';if(name==='truncated')out=out.slice(0,-5);if(name==='invalid-json')out=proto.COMPLETION_MARKER+'{\n';if(name==='duplicate')out+=out;if(name==='raw-extra')out+='PRIVATE\n';if(name==='stderr')err='PRIVATE';if(name==='oversize')out+='x'.repeat(2048);
 if(name==='wrong-run')r.binding=binding('release'),r.binding=proto.binding('98765432','forward',publication);
 if(name==='wrong-generation')r.binding=binding('release');if(name==='wrong-manifest')r.binding=proto.binding(options.run,'forward','a'.repeat(64));if(name==='wrong-call')r.binding.call='a'.repeat(64);
 if(name==='missing-step')r.steps.splice(2,1);if(name==='reordered')r.steps.reverse();if(name==='extra-field')r.path='/PRIVATE';if(name==='false-status')r.status=false;
 if(name.startsWith('wrong-')||['missing-step','reordered','extra-field','false-status'].includes(name))out=line(r);
 assert.throws(()=>proto.decodeCompletion(out,err,binding('forward')));
});
function nativeHarness(t,{generation='forward',mutate,logs,logsExit=0,writeFailure=false,probeFailure=false}={}){
 const values=nativeEvidence(options.run),n=new Native(options),b=binding(generation),index=['release','forward','normal'].indexOf(generation),ids=values[generation+'-start'].ids,calls=[];
 n.verifiedPublicationManifest=publication;n.current={generation,reporterBinding:b};n.synthetic={};n.prefix='ssb-native-'+options.run;n.images={api:values.builds.ids[0],reporter:values.builds.ids[2]};n.probeContainer={id:'e'.repeat(64)};
 n.owned=[{generation,role:'reporter',id:ids[3],image:values.builds.ids[2],name:n.prefix+'-'+generation+'-reporter',project:n.prefix+'-'+generation},{generation,role:'widget',id:ids[4]}];
 n.resources=()=>{};n.docker='/usr/bin/docker';n.probeDeadline=performance.now()+90000;
 const r=n.owned[0],raw=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ssb-e1-proof-'));
 const inspect={Id:r.id,Name:'/'+r.name,Image:r.image,RestartCount:0,Config:{Labels:{'com.ssb.native-run':options.run,'com.docker.compose.service':'reporter','com.docker.compose.project':r.project},Env:['SSB_REPORTER_DIAGNOSTIC_BINDING='+JSON.stringify(b)]},State:{Status:'exited',Running:false,ExitCode:0,OOMKilled:false,Error:''}};
 mutate?.(inspect);
 const transport={spawn(bin,args){assert.equal(bin,'/usr/bin/docker');assert.deepEqual(args.slice(0,2),['--host','unix:///var/run/docker.sock']);const a=args.slice(2);calls.push(a);let out='',err='',code=0;
  if(a[0]==='exec'&&a[1]==='-i'){assert.deepEqual(a,['exec','-i',n.probeContainer.id,'node','/proof/probe.cjs']);out='SSB_PROOF_JSON '+JSON.stringify({verified:true,...values[generation+'-e1']})+'\n';if(probeFailure){code=1;out='';err='{"status":"FAIL","phase":"sites-read","kind":"assertion","code":"ERR_ASSERTION"}\n';}}
  else if(a[0]==='container'){assert.deepEqual(a,['container','inspect',r.id]);out=JSON.stringify([inspect]);}
  else if(a[0]==='logs'){assert.deepEqual(a,['logs','--tail','4',r.id]);out=logs===undefined?actual.get(generation)?.stdout||line(record(generation)):logs;code=logsExit;}
  else{assert.deepEqual(a,['exec',ids[4],'sha256sum','/usr/share/nginx/html/widget.js','/usr/share/nginx/html/loader.js']);out=values[generation+'-e1'].hashes.map((h,i)=>h+'  '+['widget.js','loader.js'][i]).join('\n');}
  const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();c.stdin.end=input=>{if(a[1]==='-i'){const request=JSON.parse(input);assert.equal(request.action,'e1');assert.equal(request.generation,generation);}queueMicrotask(()=>{if(out)c.stdout.emit('data',Buffer.from(out));if(err)c.stderr.emit('data',Buffer.from(err));c.emit('close',code,null);});};return c;
 }};
 const P=load('common.cjs',{'node:child_process':transport,'node:fs':{...fs,writeFileSync(file,...args){if(writeFailure&&calls.at(-1)?.[0]==='logs'&&(writeFailure!=='stderr'||file.endsWith('.stderr')))throw Object.assign(Error('PRIVATE'),{code:'ENOSPC'});return fs.writeFileSync(file,...args);}}}).Processes;
 n.proc=new P({deadline:n.deadline,privateRoot:raw});
 n.state=async()=>assert.fail('A compactable work list is not a durable completion ledger');
 const execute=n.execute.bind(n);n.execute=phase=>phase===generation+'-e1'?execute(phase):Promise.resolve({verified:true,...values[phase]});
 n.close=async()=>{
  n.proc.assertClosed();const v=structuredClone(values.closure);v.detail.outcomes=v.detail.outcomes.slice(0,3+(index+1)*5).map(o=>({...o,state:o.generation===generation?'exited':o.state}));v.counts=[v.detail.outcomes.length,v.detail.outcomes.length,n.proc.calls.length];v.ids=[...v.detail.outcomes.map(o=>o.id),...values.inventory.ids.slice(19)];return{verified:true,...require('./dashboard-shutdown-fixture.cjs').observeClosure(v)};
 };
 return{n,calls,values};
}
for(const generation of ['release','forward','normal'])test('real Native.e1 and Processes accept exact completion without compactable history: '+generation,async t=>{
 const h=nativeHarness(t,{generation});assert.equal((await h.n.e1()).verified,true);h.n.proc.assertClosed();assert.equal(h.calls.filter(c=>c[0]==='logs').length,1);
});
test('actual journal compaction: historical E1 rejects completed work; corrected E1 retains exact Reporter proof',async t=>{
 const f=h.fixture(t),stateFile=path.join(f.state,'runtime-state.json'),s=JSON.parse(fs.readFileSync(stateFile));s.phase='open';s.generations=['forward'];fs.writeFileSync(stateFile,JSON.stringify(s));
 f.env.MAINTENANCE_GENERATION='forward';f.env.SSB_REPORTER_DIAGNOSTIC_BINDING=JSON.stringify(binding('forward'));
 fs.writeFileSync(path.join(f.dist,'main.js'),'import {reporterEntry} from "./maintenance.js";export async function startReporter(p){await reporterEntry(async()=>{},p);}');
 const child=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(child.status,0);assert.equal(child.error,undefined);proto.decodeCompletion(child.stdout,child.stderr,binding('forward'));
 const {MaintenanceState}=require(path.join(f.dist,'maintenance-state.cjs')),state=new MaintenanceState({root:f.state,service:f.env.MAINTENANCE_SERVICE,generation:'forward'});
 const worker=Object.entries(state.snapshot().work).find(([,w])=>w.kind==='worker'&&w.state==='completed');assert(worker);
 const n=nativeHarness(t,{logs:child.stdout}).n;
 // Frozen historical method from 660b2c803b409cafb85f597ea13cb4d8f325c03a;
 // keep this regression runnable without an unpublished local baseline directory.
 const {need}=require('./common.cjs');
 const historical=({
  async e1(){const result=await this.probe('e1');const r=this.owned.find(x=>x.generation===this.current.generation&&x.role==='reporter');const x=(await this.inspect(r.id))[0];need(x.State.Status==='exited'&&x.State.ExitCode===0&&!x.State.OOMKilled,'reporter_completion_failed');const state=await this.state('snapshot',this.current.binding);need(Object.values(state.work).some(w=>w.generation===this.current.generation&&w.kind==='worker'&&w.state==='completed'),'reporter_work_missing');
    const widget=this.owned.find(x=>x.generation===this.current.generation&&x.role==='widget');
    const bytes=(await this.d(['exec',widget.id,'sha256sum','/usr/share/nginx/html/widget.js','/usr/share/nginx/html/loader.js'])).stdout.toString().trim().split('\n').map(x=>x.split(/\s+/)[0]);need(JSON.stringify(bytes)===JSON.stringify(result.hashes),'widget_bytes_changed');return result;}
 }).e1;
 n.state=async()=>state.snapshot();assert.equal((await historical.call(n)).verified,true);
 for(let i=0;i<129;i++){const id=state.begin('http');state.end(id);}
 assert.equal(state.snapshot().work[worker[0]],undefined);
 await assert.rejects(historical.call(n),e=>e.code==='reporter_work_missing');
 assert.equal((await n.e1()).verified,true);n.proc.assertClosed();
});
const identityFaults={id:x=>x.Id='f'.repeat(64),image:x=>x.Image='sha256:'+'f'.repeat(64),name:x=>x.Name='/foreign',project:x=>x.Config.Labels['com.docker.compose.project']='foreign',run:x=>x.Config.Labels['com.ssb.native-run']='123',role:x=>x.Config.Labels['com.docker.compose.service']='api',binding:x=>x.Config.Env=[],duplicateBinding:x=>x.Config.Env.push(x.Config.Env[0]),running:x=>x.State.Running=true,exit137:x=>x.State.ExitCode=137,oom:x=>x.State.OOMKilled=true,restart:x=>x.RestartCount=1};
for(const [name,mutate]of Object.entries(identityFaults))test('real E1 rejects '+name+' before reading logs',async t=>{const h=nativeHarness(t,{mutate});await assert.rejects(h.n.e1());assert.equal(h.calls.some(a=>a[0]==='logs'),false);h.n.proc.assertClosed();});
for(const variant of [{logs:''},{logs:line(record('release'))},{logs:line(record('forward')).slice(0,-4)},{logsExit:1},{writeFailure:true},{probeFailure:true}])test('real E1 error -> controller -> regular receiver '+JSON.stringify(variant),async t=>{
 const h=nativeHarness(t,variant),lines=[];let primary;await assert.rejects(main({...options,output:s=>lines.push(s)},h.n),e=>{primary=e;return true;});h.n.proc.assertClosed();
 const receipt=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))).find(r=>r.phase==='forward-e1');assert.equal(receipt.ok,false);assert.notEqual(receipt.detail.failure.code,'unclassified');
 assert.equal(parseReceipts(lines.join('\n'),options.run,SOURCE,options,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');assert.doesNotMatch(JSON.stringify(receipt.detail),/PRIVATE|password|cookie|\/Users\//);assert(primary);
});
test('additional closure/write failure preserves the original E1 error',async t=>{
 const h=nativeHarness(t,{logs:''});h.n.close=async()=>{throw new GateError('closure_unverified');};const lines=[];let first;const e1=h.n.e1.bind(h.n);h.n.e1=async()=>{try{return await e1();}catch(e){first=e;throw e;}};
 await assert.rejects(main({...options,output:l=>{if(JSON.parse(Buffer.from(l.split(' ')[1],'base64')).phase==='forward-e1')throw Object.assign(Error('PRIVATE'),{code:'ENOSPC'});lines.push(l);}},h.n),e=>{const contains=x=>x===first||x instanceof AggregateError&&x.errors.some(contains);return contains(e);});h.n.proc.assertClosed();assert.throws(()=>parseReceipts(lines.join('\n'),options.run,SOURCE,options,{partial:true}));
});
test('arbitrary error codes still cannot enter public receipts',()=>{assert.equal(publicFailure(Object.assign(Error('PRIVATE'),{code:'SECRET_VALUE'})).code,'unclassified');});
const failureCodes=e=>[e?.code,...(e?.errors||[]).flatMap(failureCodes),...(e?.cause?failureCodes(e.cause):[])].filter(Boolean);
const publicCodes=e=>[e.code,...e.causes.flatMap(publicCodes)];
for(const writeFailure of [true,'stderr'])for(const [name,logs,logsExit,expected]of [
 ['missing','',0,'reporter_completion_missing'],
 ['foreign',line(record('release')),0,'reporter_completion_misbound'],
 ['invalid',proto.COMPLETION_MARKER+'{PRIVATE\n',0,'reporter_completion_invalid'],
 ['truncated',line(record('forward')).slice(0,-7),0,'reporter_completion_invalid'],
 ['transport',line(record('forward')),1,'command_failed'],
 ['valid',line(record('forward')),0,null]
])test('receipt validation survives '+name+' plus '+(writeFailure===true?'stdout':'stderr')+' persistence failure',async t=>{
 const h=nativeHarness(t,{logs,logsExit,writeFailure}),lines=[];let caught;
 await assert.rejects(main({...options,output:l=>lines.push(l)},h.n),e=>{caught=e;return true;});h.n.proc.assertClosed();
 const receipt=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))).find(r=>r.phase==='forward-e1');
 assert.equal(receipt.ok,false);const codes=failureCodes(caught),safe=publicCodes(receipt.detail.failure);
 assert(codes.includes('evidence_write_failed'));assert(safe.includes('evidence_write_failed'));
 if(expected){assert(codes.includes(expected),JSON.stringify({codes,safe}));assert.equal(receipt.detail.failure.causes[0].code,expected);assert.equal(receipt.detail.failure.causes[1].code,'evidence_write_failed');}
 else{assert.equal(receipt.detail.failure.code,'evidence_write_failed');assert.equal(safe.some(c=>c.startsWith('reporter_completion_')),false);}
 assert.equal(parseReceipts(lines.join('\n'),options.run,SOURCE,options,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
 assert.equal(h.calls.filter(c=>c[0]==='logs').length,1);assert.equal(h.calls.some(c=>c.includes('sha256sum')),false);
 assert.doesNotMatch(JSON.stringify(receipt.detail),/PRIVATE|ENOSPC|password|cookie|\/Users\//);
});
for(const fault of ['bin','host','container','container-type','args','input','deadline','infinite','negative','allowFailure','closure','state','probe','base','start','operation','reporterLogs','null','extra','binding'])test('completion prevalidation rejects wrong transport binding: '+fault,async()=>{
 let spawned=0;const P=load('common.cjs',{'node:child_process':{spawn(){spawned++;throw Error('must-not-spawn');}}}).Processes;
 const p=new P({deadline:performance.now()+60000,privateRoot:'/unused'}),id='a'.repeat(64);
 let bin='/usr/bin/docker',args=['--host','unix:///var/run/docker.sock','logs','--tail','4',id];
 const opts={ms:1000,reporterCompletion:{container:id,binding:binding('forward')}};
 if(fault==='bin')bin='/other/docker';if(fault==='host')args[1]='unix:///other.sock';if(fault==='container')opts.reporterCompletion.container='b'.repeat(64);
 if(fault==='container-type')opts.reporterCompletion.container={toString:()=>id,toJSON:()=>id};if(fault==='infinite')opts.ms=Infinity;if(fault==='negative')opts.ms=-1;
 if(fault==='args')args[4]='5';if(fault==='input')opts.input='';if(fault==='deadline')opts.ms=1001;
 if(fault==='allowFailure')opts.allowFailure=true;if(fault==='closure')opts.closure=true;if(fault==='state')opts.stateDiagnostic=true;
 if(fault==='probe')opts.probeDiagnostic={};if(fault==='base')opts.baseReference='other';if(fault==='start')opts.startDiagnostic={};if(fault==='operation')opts.startOperation={};if(fault==='reporterLogs')opts.reporterLogs={};
 if(fault==='null')opts.reporterCompletion=null;if(fault==='extra')opts.reporterCompletion.extra=true;if(fault==='binding')opts.reporterCompletion.binding.call='0'.repeat(64);
 await assert.rejects(p.run(bin,args,opts),e=>e.code==='reporter_binding_invalid');assert.equal(spawned,0);assert.equal(p.calls.length,0);
});
test('actual E1 preserves existing shorter probe budget and rejects exhausted reserve',async t=>{
 const h=nativeHarness(t),run=h.n.proc.run.bind(h.n.proc);let observed;
 h.n.proc.run=async(bin,args,opts)=>{if(opts.reporterCompletion)observed=opts.ms;return run(bin,args,opts);};
 h.n.probeDeadline=performance.now()+30750;assert.equal((await h.n.e1()).verified,true);
 assert(Number.isFinite(observed)&&observed>100&&observed<1000);h.n.proc.assertClosed();
 h.n.probeDeadline=performance.now()+30000;const count=h.calls.length;
 await assert.rejects(h.n.e1(),e=>e.code==='probe_work_deadline');assert.equal(h.calls.length,count);h.n.proc.assertClosed();
});
test('completion and private-write primary survive subsequent closure and receipt-write errors',async t=>{
 const h=nativeHarness(t,{logs:'',writeFailure:'stderr'}),lines=[];
 h.n.close=async()=>{throw new GateError('closure_unverified');};let caught;
 await assert.rejects(main({...options,output:l=>{if(JSON.parse(Buffer.from(l.split(' ')[1],'base64')).phase==='forward-e1')throw Object.assign(Error('PRIVATE'),{code:'EPIPE'});lines.push(l);}},h.n),e=>{caught=e;return true;});
 h.n.proc.assertClosed();const codes=failureCodes(caught);
 for(const code of ['reporter_completion_missing','evidence_write_failed','closure_unverified','EPIPE'])assert(codes.includes(code));
 assert.throws(()=>parseReceipts(lines.join('\n'),options.run,SOURCE,options,{partial:true}));
 assert.doesNotMatch(lines.join('\n'),/PRIVATE|password|cookie|\/Users\//);
});
