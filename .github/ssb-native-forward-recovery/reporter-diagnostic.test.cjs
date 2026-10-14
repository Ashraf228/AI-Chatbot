'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm'),{createRequire}=require('node:module');
if(process.env.SSB_REPORTER_CHILD){
 const cfg=JSON.parse(process.env.SSB_REPORTER_CHILD),Module=require('node:module');
 const fault=code=>Object.assign(Error('SYNTHETIC_PRIVATE_NOT_EXPORT'),{code});
 const record=kind=>fs.appendFileSync(cfg.events,JSON.stringify({kind})+'\n');
 for(const id of ['node:net','node:tls','node:http','node:https','node:dgram']){const m=require(id);for(const method of ['connect','createConnection','request','get','createSocket','createServer'])if(typeof m[method]==='function')m[method]=()=>{record('external-denied');throw fault('NETWORK_NOT_AUTHORIZED');};}
 global.fetch=async()=>{record('external-denied');throw fault('NETWORK_NOT_AUTHORIZED');};
 for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[k]=()=>{throw fault('PROCESS_NOT_AUTHORIZED');};
 const map=p=>typeof p==='string'&&p.startsWith('/run/ssb-maintenance')?cfg.state+p.slice(20):p;
 for(const name of ['lstatSync','openSync','mkdirSync','rmdirSync','renameSync','unlinkSync']){const original=fs[name];fs[name]=function(p,...args){
  if(name==='openSync'&&String(p).endsWith('/runtime-state.json')){record('state-read');if(cfg.fault==='state-access')throw fault('EACCES');}
  if(name==='renameSync')args[0]=map(args[0]);return original.call(fs,map(p),...args);
 };}
 const load=Module._load;Module._load=function(id,...args){if(id.endsWith('maintenance-state.cjs')&&cfg.fault==='maintenance-missing')throw fault('MODULE_NOT_FOUND');const result=load.call(this,id,...args);if(id.endsWith('maintenance-state.cjs')&&['work-close','action-and-close'].includes(cfg.fault))result.MaintenanceState.prototype.end=()=>{throw fault('EIO');};return result;};
 if(['stderr-write','partial-stderr'].includes(cfg.fault)){const write=fs.writeSync;let first=true;fs.writeSync=(fd,...args)=>{if(fd===2){if(cfg.fault==='partial-stderr'&&first){first=false;return write(fd,args[0],args[1],7);}throw fault('EPIPE');}return write(fd,...args);};}
}else{
 const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
 const proto=require('./reporter-contract.cjs'),{sha,GateError}=require('./common.cjs'),{Native}=require('./native.cjs'),{main,SOURCE}=require('./controller.cjs'),{parseReceipts}=require('./evidence.cjs');
 assert.equal(process.version,'v24.17.0');
 const deps=process.env.SSB_REPORTER_TEST_DEPS,ts=require(path.join(deps,'typescript')),source=process.env.SSB_PROBE_TEST_SOURCE,overlay=path.join(__dirname,'reporter-overlay');
 const publication=sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),options={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)},binding=proto.binding(options.run,'release',publication);
 const tmp=t=>{const p=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-reporter-offline-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;};
 const write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b,{mode:0o600});};
 function load(name,replacements={},tail=''){
  const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname:path.dirname(file),__filename:file,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};
  vm.compileFunction(fs.readFileSync(file,'utf8')+tail,Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;
 }
 const {nativeEvidence}=load('offline.test.cjs',{'node:test':()=>{}},'\nmodule.exports={nativeEvidence};');
 const {receiver}=load('init-diagnostic.test.cjs',{'node:test':()=>{}},'\nmodule.exports={receiver};');
 function fixture(t,fault=''){
  const root=tmp(t),dist=path.join(root,'dist'),state=path.join(root,'state'),events=path.join(root,'events');fs.mkdirSync(state,{mode:0o700});write(events,'');write(path.join(root,'package.json'),'{"type":"module"}');
  const reporter=path.join(source,'apps/reporter/src');
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  for(const file of walk(reporter).filter(p=>p.endsWith('.ts'))){const rel=path.relative(reporter,file),patch=path.join(overlay,'apps/reporter/src',rel);const text=fs.readFileSync(fs.existsSync(patch)?patch:file,'utf8');write(path.join(dist,rel.replace(/\.ts$/,'.js')),ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText);}
  const maintenance=fs.readFileSync(path.join(source,'apps/api/src/maintenance/maintenance-state.ts'),'utf8');write(path.join(dist,'maintenance-state.cjs'),ts.transpileModule(maintenance,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText);
  write(path.join(dist,'reporter-entry.cjs'),fs.readFileSync(path.join(overlay,'apps/reporter/scripts/reporter-entry.cjs')));
  fs.symlinkSync(deps,path.join(root,'node_modules'),'dir');
  write(path.join(state,'runtime-state.json'),JSON.stringify({version:1,service:'ssb-native-'+options.run,generations:['release'],epoch:0,phase:'closed',legacy:'new-empty-service',work:{}}));
  if(fault==='entry-missing')fs.renameSync(path.join(dist,'main.js'),path.join(dist,'main-unavailable.js'));
  if(fault==='import-missing')fs.renameSync(path.join(dist,'jobs/generateWeeklyReports.js'),path.join(dist,'jobs/unavailable.js'));
  if(fault==='syntax')write(path.join(dist,'main.js'),'throw ??? SYNTHETIC_PRIVATE_NOT_EXPORT');
  if(fault==='type')write(path.join(dist,'main.js'),'throw new TypeError("SYNTHETIC_PRIVATE_NOT_EXPORT");');
  if(fault==='entry-access')fs.chmodSync(path.join(dist,'main.js'),0o000);
  if(fault==='unknown')write(path.join(dist,'main.js'),'throw Object.assign(new Error("SYNTHETIC_PRIVATE_NOT_EXPORT"),{code:"PRIVATE_CODE"});');
  if(fault==='state-mode')fs.chmodSync(state,0o755);
  if(['state-json','stderr-write','partial-stderr'].includes(fault))write(path.join(state,'runtime-state.json'),'{');
  if(['work-close','action-and-close'].includes(fault)){
   const s=JSON.parse(fs.readFileSync(path.join(state,'runtime-state.json')));s.phase='open';write(path.join(state,'runtime-state.json'),JSON.stringify(s));
   write(path.join(dist,'main.js'),'import {reporterEntry} from "./maintenance.js";export async function startReporter(p){await reporterEntry(async()=>{'+(fault==='action-and-close'?'throw new TypeError("SYNTHETIC_PRIVATE_NOT_EXPORT");':'')+'},p);}');
  }
  const env={PATH:path.dirname(process.execPath)+':/usr/bin:/bin',LANG:'C.UTF-8',NODE_ENV:'production',APP_ENV:'production',MAINTENANCE_STATE_ROOT:'/run/ssb-maintenance',MAINTENANCE_SERVICE:'ssb-native-'+options.run,MAINTENANCE_GENERATION:'release',SSB_REPORTER_DIAGNOSTIC_BINDING:JSON.stringify(binding),SSB_REPORTER_CHILD:JSON.stringify({fault,state,events})};
  return{root,dist,state,events,env,args:['--require',__filename,path.join(dist,'reporter-entry.cjs'),'weekly']};
 }
 const faults=[['entry-missing','entry-import','entry','Error','ERR_MODULE_NOT_FOUND'],['import-missing','entry-import','entry','Error','ERR_MODULE_NOT_FOUND'],['syntax','entry-import','entry','SyntaxError','unknown'],['type','entry-import','entry','TypeError','unknown'],['maintenance-missing','maintenance-load','maintenance-binding','Error','MODULE_NOT_FOUND'],['state-access','admission','maintenance-construct','Error','EACCES'],['state-json','admission','maintenance-construct','SyntaxError','unknown'],['stderr-write','admission','maintenance-construct','SyntaxError','unknown']];
 const results=new Map();
 for(const [fault,step,lastConfirmed,errorClass,nodeCode]of faults)test('actual Node24 bootstrap and Reporter source: '+fault,t=>{
  const f=fixture(t,fault),r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1);assert.equal(r.signal,null);assert.equal(r.error,undefined);
  const d=proto.decode(r.stdout,r.stderr,binding);assert.deepEqual(d.primary,{step,lastConfirmed,errorClass,nodeCode,gate:'unknown'});assert.equal(d.truncated,false);
  if(fault==='stderr-write')assert.equal(d.delivery.writeError.nodeCode,'EPIPE');assert.deepEqual(d.cleanup,[]);
  assert.doesNotMatch(JSON.stringify(d)+r.stdout+r.stderr,/SYNTHETIC_PRIVATE|stack|\/Users\/|ssb-reporter-offline|password|cookie/i);assert.doesNotMatch(fs.readFileSync(f.events,'utf8'),/external-denied/);results.set(fault,{stdout:r.stdout,stderr:r.stderr,d});
 });
 test('actual closed Reporter waits without external or report work and follows unchanged SIGTERM completion',async t=>{
  const f=fixture(t),c=cp.spawn(process.execPath,f.args,{env:f.env,stdio:['ignore','pipe','pipe']});let out='',err='';c.stdout.on('data',b=>out+=b);c.stderr.on('data',b=>err+=b);
  const ended=new Promise(resolve=>c.once('close',(code,signal)=>resolve({code,signal}))),timer=setTimeout(()=>c.kill('SIGKILL'),2500);t.after(()=>clearTimeout(timer));
  const until=performance.now()+1500;while(fs.readFileSync(f.events,'utf8').split('state-read').length<3&&performance.now()<until)await new Promise(r=>setTimeout(r,20));
  assert.equal(c.exitCode,null);assert.ok(fs.readFileSync(f.events,'utf8').split('state-read').length>=3);assert.doesNotMatch(fs.readFileSync(f.events,'utf8'),/external-denied/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.state,'runtime-state.json'))).work,{});c.kill('SIGTERM');assert.deepEqual(await ended,{code:0,signal:null});clearTimeout(timer);assert.equal(err,'');assert.equal(out,'{"event":"reporter_shutdown_complete","graceful":true}\n');
 });
 for(const field of ['run','generation','service','publication','call','source'])test('wrong '+field+' binding blocks decoding',()=>{
  const p=new proto.Progress(binding);p.capture(new TypeError('private'));const r=p.result();r.binding={...r.binding,[field]:'foreign'};assert.throws(()=>proto.decode('',proto.MARKER+JSON.stringify(r)+'\n',binding));
 });
 for(const kind of ['missing','truncated','extra','raw','two','wrong-class','wrong-code'])test('strict fixed output refuses '+kind,()=>{
  const p=new proto.Progress(binding);p.capture(new TypeError('private'));const r=p.result();let s=proto.MARKER+JSON.stringify(r)+'\n';
  if(kind==='missing')s='';if(kind==='truncated')s=s.slice(0,-4);if(kind==='raw')s+='private\n';if(kind==='two')s+=s;if(kind==='extra'){r.primary.stack='private';s=proto.MARKER+JSON.stringify(r)+'\n';}if(kind==='wrong-class'||kind==='wrong-code'){r.primary[kind==='wrong-class'?'errorClass':'nodeCode']='PRIVATE';s=proto.MARKER+JSON.stringify(r)+'\n';}assert.throws(()=>proto.decode('',s,binding));
 });
 test('two diagnostic write failures retain the exact primary and never report success',()=>{
  const p=new proto.Progress(binding),original=new TypeError('private');assert.throws(()=>proto.emit(p,original,()=>{throw Object.assign(Error('private'),{code:'ENOSPC'});}),e=>e instanceof AggregateError&&e.errors[0]===original&&e.errors.length===3);assert.equal(p.result().primary.errorClass,'TypeError');assert.equal(p.result().cleanup.length,1);assert.equal(p.result().delivery.writeError.nodeCode,'ENOSPC');
 });
 for(const [fault,step,errorClass,nodeCode,gate]of [['entry-access','entry-import','Error','EACCES','unknown'],['unknown','entry-import','Error','unknown','unknown'],['state-mode','maintenance-construct','MaintenanceDenied','unknown','private_directory_required']])test('real filesystem / unknown classification: '+fault,t=>{
  const f=fixture(t,fault),r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1);assert.equal(r.error,undefined);
  const d=proto.decode(r.stdout,r.stderr,binding);assert.equal(d.primary.step,step);assert.equal(d.primary.errorClass,errorClass);assert.equal(d.primary.nodeCode,nodeCode);assert.equal(d.primary.gate,gate);assert.doesNotMatch(JSON.stringify(d),/PRIVATE|stack|\/Users\//);
 });
 test('baseline actual reporter loses the synthetic JSON cause; overlay preserves it',t=>{
  const f=fixture(t,'state-json');for(const name of ['main','maintenance'])write(path.join(f.dist,name+'.js'),ts.transpileModule(fs.readFileSync(path.join(source,'apps/reporter/src',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2021}}).outputText);
  const r=cp.spawnSync(process.execPath,['--require',__filename,path.join(f.dist,'main.js'),'weekly'],{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1);assert.equal(r.stderr,'{"event":"reporter_failed","graceful":false}\n');assert.equal(r.stdout,'');assert.equal(results.get('state-json').d.primary.errorClass,'SyntaxError');
 });
 for(const kind of ['missing','wrong-run','wrong-generation'])test('actual bootstrap rejects '+kind+' binding before import',t=>{
  const f=fixture(t);if(kind==='missing')delete f.env.SSB_REPORTER_DIAGNOSTIC_BINDING;else f.env[kind==='wrong-run'?'MAINTENANCE_SERVICE':'MAINTENANCE_GENERATION']='foreign';
  const r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr,'SSB_REPORTER_DIAGNOSTIC_UNBOUND\n');assert.equal(fs.readFileSync(f.events,'utf8'),'');
 });
 test('partial stderr writes retain exact primary via validated bounded stdout fallback',t=>{
  const f=fixture(t,'partial-stderr'),r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1);assert.equal(r.stderr.length,7);const d=proto.decode(r.stdout,r.stderr,binding);assert.equal(d.primary.errorClass,'SyntaxError');assert.equal(d.delivery.stderrBytes,7);assert.equal(d.delivery.writeError.nodeCode,'EPIPE');results.set('partial-stderr',{stdout:r.stdout,stderr:r.stderr,d});
  assert.throws(()=>proto.decode(r.stdout,'PRIVATE',binding));assert.throws(()=>proto.decode(r.stdout,r.stderr+'x',binding));
 });
 for(const fault of ['work-close','action-and-close'])test('actual admitted synthetic action distinguishes work-close and retains primary: '+fault,t=>{
  const f=fixture(t,fault),r=cp.spawnSync(process.execPath,f.args,{env:f.env,encoding:'utf8',timeout:2500,maxBuffer:8192});assert.equal(r.status,1);const d=proto.decode(r.stdout,r.stderr,binding);
  assert.equal(d.primary.step,fault==='work-close'?'work-close':'action');assert.equal(d.primary.lastConfirmed,fault==='work-close'?'action':'admission');assert.equal(d.primary.nodeCode,fault==='work-close'?'EIO':'unknown');if(fault==='action-and-close'){assert.equal(d.primary.errorClass,'TypeError');assert.equal(d.cleanup.length,1);assert.equal(d.cleanup[0].step,'work-close');assert.equal(d.cleanup[0].nodeCode,'EIO');}assert.doesNotMatch(fs.readFileSync(f.events,'utf8'),/external-denied/);
 });
 function harness(t,child,{writeFailure=false,identity=false,closureFailure=false,mountFailure=false}={}){
  const root=tmp(t),raw=path.join(root,'raw');fs.mkdirSync(raw);const values=nativeEvidence(),n=new Native(options),stopped=new Set(),calls=[];
  n.verifiedPublicationManifest=publication;Object.assign(n,{privateRoot:root,prefix:'ssb-native-'+options.run,stateRoot:path.join(root,'state'),toolsRoot:path.join(root,'tools'),docker:'/usr/bin/docker',initial:{containers:[]},probeDeadline:performance.now()+90000,images:Object.fromEntries(['api','dashboard','reporter','widget'].map((s,i)=>[s,values.builds.ids[i]])),imageMetadata:{},synthetic:{owner:'a'.repeat(64)}});n.images['admin-writer']=n.images.api;n.resources=()=>{};
  const current={generation:'release',root:tmp(t),binding:{root:n.stateRoot,service:n.prefix,generation:'release'},common:{},names:Object.fromEntries(['api','admin-writer','dashboard','reporter','widget'].map(s=>[s,n.prefix+'-release-'+s])),project:n.prefix+'-release',reporterBinding:binding};
  const fakeFixtures={...require('./fixtures.cjs'),generation(){return current;},write(p,b){write(p,b);return{path:p,sha256:sha(b)};}};
  const C=load('native.cjs',{'./fixtures.cjs':fakeFixtures,[path.join(n.toolsRoot,'scripts/ops/maintenance-start-contract.cjs')]:{assertPlan(){},verifyFiles(){},assertImage(){}}}).Native;Object.setPrototypeOf(n,C.prototype);
  n.privilegedStart=async(_p,_b,e)=>{if(e)e.id=sha(e.role);return{};};
  let reporterEnded=!mountFailure;
  const transport={spawn(bin,args){assert.equal(bin,'/usr/bin/docker');assert.deepEqual(args.slice(0,2),['--host','unix:///var/run/docker.sock']);const a=args.slice(2);calls.push(a);let stdout='',stderr='',status=0;
   if(a[0]==='logs'){assert.deepEqual(a,['logs','--tail','4',sha('reporter')]);stdout=child.stdout;stderr=child.stderr;}
   else if(a[0]==='exec'){if(mountFailure&&a[1]===sha('reporter')){reporterEnded=true;status=1;}}
   else if(a[0]==='stop'){assert.equal(a[2],'8');assert.notEqual(a[3],sha('reporter'));if(closureFailure)status=1;else stopped.add(a[3]);}
   else if(a[1]==='ls')stdout=n.owned.filter(e=>e.role!=='reporter'&&!stopped.has(e.id)).map(e=>e.id).join('\n');
   else if(a[1]==='inspect'){
    const e=n.owned.find(e=>e.name===a[2]||e.id===a[2]);assert.ok(e);const exited=e.role==='reporter'&&reporterEnded||stopped.has(e.id);
    stdout=JSON.stringify([{Id:identity&&e.role==='reporter'?'f'.repeat(64):e.id,Name:'/'+e.name,Image:e.image,Config:{Labels:{'com.ssb.native-run':options.run,'com.docker.compose.service':e.role,'com.docker.compose.project':e.project},Env:['SSB_REPORTER_DIAGNOSTIC_BINDING='+JSON.stringify(binding)]},RestartCount:0,State:{Status:exited?'exited':'running',Running:!exited,Paused:false,Restarting:false,Dead:false,OOMKilled:false,Error:'',Pid:exited?0:123,ExitCode:e.role==='reporter'?1:0,StartedAt:'2026-10-13T11:00:00Z',FinishedAt:exited?'2026-10-13T11:00:01Z':'0001-01-01T00:00:00Z'}}]);
   }else assert.fail('unapproved synthetic transport');
   const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();c.stdin.end=()=>queueMicrotask(()=>{if(stdout)c.stdout.emit('data',Buffer.from(stdout));if(stderr)c.stderr.emit('data',Buffer.from(stderr));c.emit('close',status,null);});return c;
  }};
  const P=load('common.cjs',{'node:child_process':transport,'node:fs':{...fs,writeFileSync(p,...args){if(writeFailure&&calls.at(-1)?.[0]==='logs')throw Object.assign(Error('PRIVATE'),{code:'ENOSPC'});return fs.writeFileSync(p,...args);}}}).Processes;n.proc=new P({deadline:n.deadline,privateRoot:raw});
  const execute=n.execute.bind(n);n.execute=phase=>phase==='release-start'?execute(phase):Promise.resolve({verified:true,...values[phase]});
  return{n,calls};
 }
 for(const options of [{},{writeFailure:true},{closureFailure:true},{identity:true},{mountFailure:true},{partialWrite:true}])test('bootstrap -> real process decoder -> native start -> controller -> regular receiver '+JSON.stringify(options),async t=>{
  const child=results.get(options.partialWrite?'partial-stderr':'state-access');assert.ok(child);const h=harness(t,child,options),lines=[];let primary;
  await assert.rejects(main({...globalOptions(),output:l=>lines.push(l)},h.n),e=>{primary=e;return true;});h.n.proc.assertClosed();
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),f=rows.find(r=>r.phase==='release-start').detail.failure;
  assert.equal(f.code,options.mountFailure?'command_failed':'started_identity');assert.equal(f.operation.service,'reporter');assert.equal(f.operation.operation,options.mountFailure?'mount-readability':'participant-postinspect');
  if(options.identity){assert.equal(f.reporterError,'identity');assert.equal(f.reporter,undefined);assert.equal(h.calls.filter(c=>c[0]==='logs').length,0);}
  else{assert.deepEqual(f.reporter.record,child.d);assert.equal(f.reporterError,options.writeFailure?'evidence_write_failed':undefined);assert.equal(h.calls.filter(c=>c[0]==='logs').length,1);}
  assert.equal(rows.at(-1).detail.outcomes.at(-1).observation.stop.requested,false);
  assert.equal(rows.at(-1).ok,!options.closureFailure&&!options.identity);assert.equal(parseReceipts(lines.join('\n'),globalOptions().run,SOURCE,globalOptions(),{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
  const received=receiver(lines.join('\n'));received.invoke();assert.equal(JSON.parse(received.output[0]).status,'PARTIAL_FAILURE_RECEIVED');assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|\/Users\/|stack|password|cookie/i);assert.ok(primary);
 });
 function globalOptions(){return{authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};}
 test('private and public receipt write failures keep original start failure; incomplete reception rejects',async t=>{
  const h=harness(t,results.get('type')),lines=[];let original;
  const old=h.n.startGeneration.bind(h.n);h.n.startGeneration=async g=>{try{return await old(g);}catch(e){original=e;throw e;}};
  await assert.rejects(main({...options,output:l=>{if(JSON.parse(Buffer.from(l.split(' ')[1],'base64')).phase==='release-start')throw Object.assign(Error('private'),{code:'ENOSPC'});lines.push(l);}},h.n),e=>{const contains=e=>e===original||e instanceof AggregateError&&e.errors.some(contains);return contains(e);});
  assert.equal(original.reporterDiagnostic.record.primary.errorClass,'TypeError');assert.throws(()=>receiver(lines.join('\n')).invoke());
 });
 test('reporter overlay only replaces exact allowed source bytes, dependencies and shared state remain unchanged',t=>{
  const root=tmp(t),release=path.resolve(source,'../../..'),prepared=require('./reporter-source.cjs').prepare(release,root);
  assert.equal(prepared.hash,require('./reporter-source.cjs').manifest().hash);
  for(const p of ['apps/reporter/package.json','apps/reporter/package-lock.json','apps/api/src/maintenance/maintenance-state.ts'])assert.deepEqual(fs.readFileSync(path.join(prepared.root,p)),fs.readFileSync(path.join(source,p)));
  assert.deepEqual(fs.readFileSync(path.join(prepared.root,'apps/reporter/scripts/reporter-entry.cjs')),fs.readFileSync(path.join(__dirname,'reporter-contract.cjs')));
  write(path.join(prepared.root,'unexpected.txt'),'synthetic');assert.throws(()=>require('./reporter-source.cjs').verify(prepared));fs.unlinkSync(path.join(prepared.root,'unexpected.txt'));
  fs.appendFileSync(path.join(prepared.root,'apps/reporter/package-lock.json'),' ');assert.throws(()=>require('./reporter-source.cjs').verify(prepared));
 });
 test('actual build driver binds only Reporter overlay while keeping four build limits and origin labels',async t=>{
  const n=new Native(options),root=tmp(t),release=path.resolve(source,'../../..');n.release=release;n.privateRoot=root;n.reporterSource=require('./reporter-source.cjs').prepare(release,root);n.dashboardSource=require('./dashboard-source.cjs').prepare(release,root);const calls=[];let app;
  n.d=async(args,o={})=>{calls.push({args,o});if(args[0]==='build'){app=['api','dashboard','reporter','widget'][calls.filter(c=>c.args[0]==='build').length-1];assert.equal(args[1],'--platform=linux/amd64');assert.ok(o.ms>0&&o.ms<=270000);assert.ok(args.includes('--pull=false'));assert.ok(args.includes('org.opencontainers.image.revision='+SOURCE));
   if(app==='reporter'){assert.equal(o.cwd,n.reporterSource.root);assert.deepEqual(args.slice(-5),['--label','com.ssb.reporter-source='+n.reporterSource.hash,'-f','reporter.Dockerfile','.']);}else if(app==='dashboard')assert.equal(o.cwd,n.dashboardSource.root);else assert.equal(o.cwd,path.join(release,'.github/ssb-capacity-diagnostic'));
   write(args[args.indexOf('--iidfile')+1],'sha256:'+sha(app));return{stdout:Buffer.alloc(0)};
  }assert.deepEqual(args.slice(0,2),['image','inspect']);return{stdout:Buffer.from(JSON.stringify([{Id:'sha256:'+sha(app),Os:'linux',Architecture:'amd64',Config:{Labels:{'org.opencontainers.image.revision':SOURCE,'com.ssb.dashboard-source':n.dashboardSource.hash,'com.ssb.reporter-source':n.reporterSource.hash}}}]))};};
  const r=await n.builds();assert.deepEqual(r.counts,[4,2]);assert.deepEqual(r.hashes,[n.reporterSource.hash,n.dashboardSource.hash]);assert.equal(calls.filter(c=>c.args[0]==='build').length,4);assert.equal(n.images['admin-writer'],n.images.api);
 });
 for(const kind of ['wrong-image','wrong-publication','wrong-container','private-field','truncated'])test('regular receiver rejects tampered Reporter binding: '+kind,async t=>{
  const h=harness(t,results.get('type')),lines=[];await assert.rejects(main({...options,output:l=>lines.push(l)},h.n));const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),failure=rows.find(r=>r.phase==='release-start').detail.failure;
  if(kind==='wrong-image')failure.reporter.image='sha256:'+'f'.repeat(64);if(kind==='wrong-publication')failure.reporter.binding.publication='f'.repeat(64);if(kind==='wrong-container')failure.reporter.container='f'.repeat(64);if(kind==='private-field')failure.reporter.record.primary.message='PRIVATE';
  let previous='0'.repeat(64);const logs=rows.map(r=>{r.previous=previous;const bytes=JSON.stringify(r);previous=sha(bytes);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(bytes).toString('base64')+' '+previous;}).join('\n');
  assert.throws(()=>receiver(kind==='truncated'?logs.slice(0,-8):logs).invoke());
 });
}
