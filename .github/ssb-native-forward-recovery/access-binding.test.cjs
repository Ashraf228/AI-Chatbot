'use strict';
// Real files and pinned Node pipes; Linux root/UID1000 ownership is modeled, not claimed as a native pass.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const {sha,Processes,bound}=require('./common.cjs'),{stateArgs}=require('./state-launch.cjs');
const {main,SOURCE}=require('./controller.cjs'),{parseReceipts,dispatchTitle}=require('./evidence.cjs');
const {names}=require('./state-code.cjs');
const context={workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)},run='12345678',job='87654321';
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ssb-access-binding-'));
function load(name,replacements={},globals={}){
 const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file);
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,__dirname,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),Buffer,process,performance,AggregateError,setTimeout,clearTimeout,setInterval,clearInterval,console,...globals},{filename:file});return m.exports;
}
function copyHarness({parentMode=0o711,parentOwner=0,codeOwner=0,corrupt=false,badChmod=false}={}){
 const root=tmp(),source=path.join(root,'checkout'),privateRoot=path.join(root,'run');fs.mkdirSync(source,{mode:0o700});fs.mkdirSync(privateRoot,{mode:parentMode});fs.chmodSync(privateRoot,parentMode);
 for(const name of ['raw','state'])fs.mkdirSync(path.join(privateRoot,name),{mode:0o700});
 const manifest={files:names.map(name=>{const b=fs.readFileSync(path.join(__dirname,name));fs.writeFileSync(path.join(source,name),b,{mode:0o644});return{path:'.github/ssb-native-forward-recovery/'+name,sha256:sha(b),bytes:b.length,mode:0o644,gitMode:'100644'};})};
 const fakeFS={...fs,lstatSync(p){const s=fs.lstatSync(p);Object.defineProperty(s,'uid',{value:p===privateRoot?parentOwner:codeOwner});return s;},writeFileSync(p,b,o){return fs.writeFileSync(p,corrupt&&p.endsWith('probe.cjs')?'corrupt':b,o);},chmodSync(p,m){if(!badChmod)fs.chmodSync(p,m);}};
 const actual=load('state-code.cjs',{'node:fs':fakeFS});
 return{root,source,privateRoot,manifest,invoke:()=>actual.prepareStateCode(source,privateRoot,manifest)};
}
test('allowlisted public copies are byte-identical, read-only and do not expose checkout/raw/state',()=>{
 const h=copyHarness(),before=names.map(n=>fs.readFileSync(path.join(h.source,n))),entry=h.invoke(),code=path.dirname(entry);
 assert.equal(entry,path.join(h.privateRoot,'state-code/state-agent.cjs'));assert.deepEqual(fs.readdirSync(code).sort(),[...names].sort());assert.equal(fs.statSync(code).mode&511,0o555);
 for(const [i,n] of names.entries()){assert.ok(fs.readFileSync(path.join(code,n)).equals(before[i]));assert.ok(fs.readFileSync(path.join(h.source,n)).equals(before[i]));assert.equal(fs.statSync(path.join(code,n)).mode&511,0o444);}
 for(const p of [h.source,path.join(h.privateRoot,'raw'),path.join(h.privateRoot,'state')])assert.equal(fs.statSync(p).mode&511,0o700);
 assert.equal(fs.statSync(h.privateRoot).mode&511,0o711);
 const p=spawnSync(process.execPath,stateArgs(entry,'load'),{input:'{}',encoding:'utf8',timeout:1500});assert.equal(p.status,1);assert.match(p.stderr,/state_owner_required/);assert.doesNotMatch(p.stderr,/EACCES|MODULE_NOT_FOUND/);assert.equal(p.stdout,'');
 assert.deepEqual(fs.readdirSync(path.join(h.privateRoot,'state')),[]);
});
for(const [label,args] of [['parent write',{parentMode:0o777}],['parent unreadable',{parentMode:0o700}],['parent UID1000',{parentOwner:1000}],['code UID1000',{codeOwner:1000}],['wrong copy',{corrupt:true}],['mode not enforced',{badChmod:true}]])test('public copy rejects '+label,()=>{assert.throws(()=>copyHarness(args).invoke());});
for(const kind of ['missing','duplicate','hash','size','mode','git-mode','symlink-source','hardlink-source','directory-source'])test('copy refuses invalid manifest/type: '+kind,()=>{
 const h=copyHarness(),f=h.manifest.files[0],p=path.join(h.source,names[0]);
 if(kind==='missing')h.manifest.files.shift();else if(kind==='duplicate')h.manifest.files.push({...f});else if(kind==='hash')f.sha256='f'.repeat(64);else if(kind==='size')f.bytes++;else if(kind==='mode')f.mode=0o600;else if(kind==='git-mode')f.gitMode='100755';
 else if(kind==='hardlink-source')fs.linkSync(p,path.join(h.root,'hardlink'));
 else{fs.renameSync(p,p+'.kept');if(kind==='symlink-source')fs.symlinkSync(p+'.kept',p);else fs.mkdirSync(p);}
 assert.throws(h.invoke);assert.ok(!fs.existsSync(path.join(h.privateRoot,'state-code')));
});
for(const type of ['directory','symlink'])test('never overwrites a preexisting code directory: '+type,()=>{const h=copyHarness(),p=path.join(h.privateRoot,'state-code');if(type==='directory')fs.mkdirSync(p);else fs.symlinkSync(h.source,p);assert.throws(h.invoke);assert.equal(fs.statSync(h.source).mode&511,0o700);});
test('unrelated manifest entries and private files are never copied',()=>{const h=copyHarness();fs.writeFileSync(path.join(h.source,'private.txt'),'SYNTHETIC_PRIVATE');h.manifest.files.push({path:'private.txt',sha256:sha('SYNTHETIC_PRIVATE'),bytes:17});const entry=h.invoke();assert.deepEqual(fs.readdirSync(path.dirname(entry)).sort(),[...names].sort());});
test('missing immutable State entry never falls back to checkout or spawns',async()=>{const {Native}=require('./native.cjs'),n=new Native({run});n.command=async()=>assert.fail('unexpected process');await assert.rejects(n.stateLoadCheck(false),/state_entry_unbound/);await assert.rejects(n.state('snapshot',{}),/state_entry_unbound/);});

function runner(failure='load'){
 const root=tmp(),local=path.join(root,'run'),prefix='/var/tmp/ssb-native-'+run,map=p=>typeof p==='string'&&p.startsWith(prefix)?path.join(local,p.slice(prefix.length)):p;
 const fakeFS={...fs};for(const op of ['mkdirSync','cpSync','chmodSync','writeFileSync','readdirSync','accessSync'])fakeFS[op]=(...args)=>fs[op](...args.map(map));
 fakeFS.lstatSync=p=>{const s=fs.lstatSync(map(p));if(typeof p==='string'&&p.startsWith(prefix))Object.defineProperty(s,'uid',{value:failure==='copy'&&p===prefix?1000:0});return s;};
 fakeFS.statSync=p=>p==='/usr/bin/docker'?{isFile:()=>true}:fs.statSync(map(p));fakeFS.statfsSync=()=>({bavail:32*1024**3,bsize:1,ffree:1000000});
 fakeFS.chownSync=(p,u,g)=>{assert.equal(p,prefix+'/state');assert.equal(u,1000);assert.equal(g,1000);};
 let manifestRead=false,boundCalls=0;
 fakeFS.readFileSync=(p,...a)=>{if(p==='/proc/meminfo')return'MemAvailable: 12582912 kB\n';return fs.readFileSync(map(p),...a);};
 const hash=sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),common=require('./common.cjs');
 const proxyCommon={...common,bound(p,f){boundCalls++;if(failure==='manifest-file-last'&&boundCalls===JSON.parse(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))).files.length)throw Object.assign(Error('synthetic'),{code:'content_binding_changed'});if(failure==='manifest-file'&&!manifestRead){manifestRead=true;throw Object.assign(Error('synthetic'),{code:'content_binding_changed'});}return bound(map(p),f);}};
 const copier=load('state-code.cjs',{'node:fs':fakeFS,'./common.cjs':proxyCommon});
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Ashraf228/AI-Chatbot',RUNNER_ARCH:'X64',RUNNER_OS:'Linux',SSB_REPOSITORY_VISIBILITY:'public',SSB_JOB_DEADLINE_MS:String(Date.now()+990000),SSB_PUBLICATION_MANIFEST:failure==='manifest-digest'?'f'.repeat(64):hash,SSB_RELEASE_ROOT:path.resolve(__dirname,'../../../../AI-Chatbot-worktrees/ssb-state-entry-followup-20261009')};
 const modeled={...process,platform:'linux',arch:'x64',getuid:()=>failure==='host'?501:0,env};
 const C=load('native.cjs',{'node:fs':fakeFS,'./common.cjs':proxyCommon,'./state-code.cjs':copier},{process:modeled,setInterval:()=>0,clearInterval:()=>{}}).Native;
 const opts={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run,attempt:'1',...context},n=new C(opts),calls=[];
 n.command=async(bin,args,o={})=>{
  calls.push({bin,args,o});
  if(bin===process.execPath){
   assert.equal(args.at(-2),prefix+'/state-code/state-agent.cjs');assert.equal(args.at(-1),'load');assert.equal(o.uid,1000);assert.equal(o.gid,1000);assert.equal(o.ms,1000);
   if(failure==='load'||failure==='write'){
    // Actual pinned Node fails before importing, preserving the real process/diagnostic path.
    fs.chmodSync(map(n.stateEntry),0);
    const proc=new Processes({deadline:performance.now()+40000,privateRoot:failure==='write'?path.join(root,'missing-raw'):path.join(local,'raw')});n.actualProc=proc;
    try{return await proc.run(process.execPath,stateArgs(map(n.stateEntry)),{input:'{}',ms:1000,stateDiagnostic:true});}finally{fs.chmodSync(map(n.stateEntry),0o444);}
   }
   return{stdout:Buffer.from(JSON.stringify({loaded:true,uid:1000,gid:1000,node:'v24.17.0',modules:7,runtime:false})),stderr:Buffer.alloc(0)};
  }
  if(bin==='/usr/bin/git')return{stdout:Buffer.from(args.includes('rev-parse')?(failure==='release'?'f'.repeat(40):SOURCE):'')};
  assert.equal(bin,'/usr/bin/docker');if(args[2]==='pull')throw Object.assign(Error('offline stop'),{code:'command_failed'});
  if(args[2]==='info')return{stdout:Buffer.from(JSON.stringify({OSType:'linux',Architecture:'amd64',ID:'synthetic-daemon-binding'}))};
  assert.ok(['container','network','volume','image'].includes(args[2]));return{stdout:Buffer.alloc(0)};
 };
 n.close=async()=>{n.actualProc?.assertClosed();return{verified:true,counts:[0,0,calls.length],ids:[],detail:{failure:null,outcomes:[]}};};
 return{n,opts,calls,map,hash,root};
}
function receiver(log,{writeFailure=null}={}){
 const root=tmp(),destination=path.join(root,'received'),stdout=[],calls=[];
 const fakeFS={...fs,writeFileSync(p,b,o){if(writeFailure&&path.basename(p)===writeFailure)throw Object.assign(Error('SYNTHETIC_PRIVATE'),{code:'ENOSPC'});return fs.writeFileSync(p,b,o);}};
 const api=(bin,args)=>{assert.equal(bin,'gh');calls.push(args);const route=args[1];
  if(route.endsWith('/actions/runs/'+run))return JSON.stringify({id:Number(run),event:'workflow_dispatch',run_attempt:1,head_sha:context.workflowHead,display_title:dispatchTitle(context.workflowHead,context.dispatchNonce),status:'completed',conclusion:'failure',path:'.github/workflows/ssb-native-forward-recovery.yml'});
  if(route.endsWith('/actions/jobs/'+job))return JSON.stringify({id:Number(job),run_id:Number(run),conclusion:'failure',name:'Native forward recovery',labels:['ubuntu-24.04']});
  if(route.endsWith('/actions/jobs/'+job+'/logs'))return log;throw Error('unapproved route');};
 const r=load('receive.cjs',{'node:fs':fakeFS,'node:child_process':{execFileSync:api}},{console:{log:x=>stdout.push(x)}});
 return{destination,stdout,calls,invoke:()=>r.main([run,job,context.workflowHead,context.dispatchNonce,destination])};
}
for(const kind of ['host','manifest-digest','manifest-file','manifest-file-last','release','copy','load','write','success-to-pull'])test('actual preflight/controller/receiver binding: '+kind,async()=>{
 const h=runner(kind),lines=[];let primary;
 await assert.rejects(main({...h.opts,output:l=>lines.push(l)},h.n),e=>{primary=e;return true;});
 const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),verified=!['host','manifest-digest','manifest-file','manifest-file-last'].includes(kind);
 assert.equal(rows[0].ok,kind==='success-to-pull');assert.deepEqual(rows[0].hashes,verified?[h.hash]:[]);
 assert.equal(h.n.verifiedPublicationManifest,verified?h.hash:undefined);if(verified){assert.equal(Object.getOwnPropertyDescriptor(h.n,'verifiedPublicationManifest').writable,false);assert.throws(()=>{h.n.verifiedPublicationManifest='f'.repeat(64);});}assert.equal(rows.at(-1).phase,'closure');assert.ok(!rows.some(r=>r.phase==='complete'));
 const receive=receiver('SYNTHETIC_PRIVATE_RAW\n'+lines.join('\n'));
 if(verified){receive.invoke();const proof=JSON.parse(fs.readFileSync(path.join(receive.destination,'Empfang.json')));assert.equal(proof.status,'PARTIAL_FAILURE_RECEIVED');assert.equal(proof.publicationManifest,h.hash);assert.equal(fs.statSync(receive.destination).mode&511,0o700);assert.equal(fs.statSync(path.join(receive.destination,'receipts.txt')).mode&511,0o600);assert.doesNotMatch(fs.readFileSync(path.join(receive.destination,'receipts.txt'),'utf8'),/SYNTHETIC_PRIVATE_RAW/);assert.equal(receive.stdout.length,1);}else{assert.throws(receive.invoke,/received_publication_binding/);assert.ok(!fs.existsSync(receive.destination));assert.equal(receive.stdout.length,0);}
 if(kind==='load'||kind==='write'){const p=kind==='write'?primary.errors[0]:primary;assert.equal(p.code,'command_failed');assert.equal(p.stateDiagnostic.stage,'entry-access');assert.equal(p.stateDiagnostic.code,'EACCES');assert.equal(p.process.closed,true);assert.equal(p.process.timeout,false);if(kind==='write')assert.equal(primary.errors[1].code,'evidence_write_failed');}
 const load=h.calls.findIndex(c=>c.bin===process.execPath),pull=h.calls.findIndex(c=>c.args[2]==='pull');
 if(kind==='success-to-pull'){assert.ok(load>=0&&pull>load);assert.equal(h.n.stateEntry,path.dirname(h.n.stateEntry)+'/state-agent.cjs');assert.equal(Object.getOwnPropertyDescriptor(h.n,'stateEntry').writable,false);const calls=[];h.n.command=async(bin,args,o)=>{calls.push({args,o});return{stdout:Buffer.from(JSON.stringify(args.at(-1)==='load-runtime'?{loaded:true,uid:1000,gid:1000,node:'v24.17.0',modules:8,runtime:true}:{phase:'closed'})),stderr:Buffer.alloc(0)};};await h.n.stateLoadCheck(true);await h.n.state('snapshot',{});assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.args.at(-1)),['load-runtime','run']);for(const c of calls){assert.equal(c.args.at(-2),h.n.stateEntry);assert.equal(c.o.uid,1000);assert.equal(c.o.gid,1000);assert.equal(c.o.ms,1000);}}else assert.equal(pull,-1);
 assert.ok(!h.calls.some(c=>c.args[2]==='build'));
});
function rechain(rows){let previous='0'.repeat(64);return rows.map((r,seq)=>{const b=JSON.stringify({...r,seq,previous}),hash=sha(b);previous=hash;return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(b).toString('base64')+' '+hash;}).join('\n');}
for(const change of ['wrong-hash','missing-hash','missing-closure','truncated','extra-hash','counts'])test('full receiver rejects damaged/false early evidence: '+change,async()=>{
 const h=runner('load'),lines=[];await assert.rejects(main({...h.opts,output:l=>lines.push(l)},h.n));const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
 if(change==='wrong-hash')rows[0].hashes=['f'.repeat(64)];if(change==='missing-hash')rows[0].hashes=[];if(change==='extra-hash')rows[0].hashes.push('f'.repeat(64));if(change==='counts')rows[0].counts=[901,4];if(change==='missing-closure')rows.pop();let log=rechain(rows);if(change==='truncated')log=log.slice(0,-5);
 const r=receiver(log);assert.throws(r.invoke);assert.ok(!fs.existsSync(r.destination));assert.equal(r.stdout.length,0);
});
for(const file of ['receipts.txt','Empfang.json'])test('receiver write error never emits confirmed acceptance: '+file,async()=>{const h=runner('load'),lines=[];await assert.rejects(main({...h.opts,output:l=>lines.push(l)},h.n));const r=receiver(lines.join('\n'),{writeFailure:file});assert.throws(r.invoke,/SYNTHETIC_PRIVATE/);assert.equal(r.stdout.length,0);assert.ok(!fs.existsSync(path.join(r.destination,'Empfang.json')));});
test('early bound error remains primary if public error receipt also cannot be written',async()=>{const h=runner('load');let calls=0;await assert.rejects(main({...h.opts,output:()=>{calls++;throw Error('synthetic write failure');}},h.n),e=>{const visit=x=>x.errors?x.errors.some(visit):x.stateDiagnostic?.code==='EACCES';assert.ok(visit(e));assert.ok(e instanceof AggregateError);return true;});h.n.actualProc.assertClosed();assert.ok(calls>=1);});
