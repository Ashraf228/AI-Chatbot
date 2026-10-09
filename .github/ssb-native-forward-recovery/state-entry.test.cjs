'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const {stateArgs}=require('./state-launch.cjs'),{decodeState,publicFailure}=require('./diagnostics.cjs');
const {Native}=require('./native.cjs'),{Processes}=require('./common.cjs'),{main,SOURCE}=require('./controller.cjs'),{parseReceipts}=require('./evidence.cjs');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ssb-entry-offline-'));
const put=(d,n,b)=>{const p=path.join(d,n);fs.writeFileSync(p,b,{flag:'wx',mode:0o600});return p;};
function launch(entry,input={},mode='run'){assert.equal(process.version,'v24.17.0');return spawnSync(process.execPath,stateArgs(entry,mode),{input:JSON.stringify(input),encoding:'utf8',timeout:1500,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});}
function failed(r,stage,code){assert.equal(r.status,1);assert.equal(r.signal,null);assert.equal(r.stdout,'');assert.deepEqual(decodeState(r.stderr),{version:1,stage,code});assert.doesNotMatch(r.stderr,/SSB_PRIVATE_MARKER|ssb-entry-offline|node:internal|stack|cookie|token/);}
test('old direct Node entry loses missing-entry diagnosis; inline entry emits exact bounded ENOENT',()=>{const p=path.join(tmp(),'SSB_PRIVATE_MARKER.cjs'),old=spawnSync(process.execPath,[p],{input:'{}',encoding:'utf8',timeout:1500});assert.equal(old.status,1);assert.throws(()=>decodeState(old.stderr));failed(launch(p),'entry-access','ENOENT');});
test('early diagnosis has no dependency on inaccessible diagnostics/common modules',()=>{const d=tmp(),entry=put(d,'agent.cjs',"require('./SSB_PRIVATE_MARKER.cjs');");failed(launch(entry),'entry-load','MODULE_NOT_FOUND');});
for(const target of ['entry','dependency','ancestor'])test('actual OS denied read/traversal, no simulated UID: '+target,()=>{
 assert.notEqual(process.getuid(),0);const d=tmp(),sub=path.join(d,'private');fs.mkdirSync(sub,{mode:0o700});const dependency=put(sub,'dependency.cjs','module.exports={};'),entry=put(sub,'agent.cjs',"require('./dependency.cjs');module.exports.run=async()=>({ok:true});");
 const blocked=target==='entry'?entry:target==='dependency'?dependency:sub;const old=fs.statSync(blocked).mode&511;fs.chmodSync(blocked,0);
 try{failed(launch(entry),target==='dependency'?'entry-load':'entry-access','EACCES');}finally{fs.chmodSync(blocked,old);}
});
test('invalid module syntax remains unknown and never exports source or stack',()=>{failed(launch(put(tmp(),'agent.cjs','SSB_PRIVATE_MARKER {{{')),'entry-load','other');});
test('symlink entry and directory entry are not regular entrypoints',()=>{const d=tmp(),p=put(d,'entry.cjs','module.exports.run=async()=>({});');const link=path.join(d,'link.cjs');fs.symlinkSync(p,link);for(const x of [link,d])failed(launch(x),'entry-access','entry_file_invalid');});
test('missing export rejects instead of exit-zero acceptance',()=>{failed(launch(put(tmp(),'entry.cjs','module.exports={};')),'entry-contract','entry_contract_invalid');});
test('real pinned Node stdin path runs once, awaits asynchronous completion, import does not initialize',()=>{
 const d=tmp(),entry=put(d,'entry.cjs',"const fs=require('node:fs');if(require.main===module)throw Error('SSB_PRIVATE_MARKER');exports.run=async p=>{fs.writeFileSync(p.counter,'once',{flag:'wx'});await new Promise(r=>setTimeout(r,25));return{done:true};};"),counter=path.join(d,'counter');
 const r=launch(entry,{counter});assert.equal(r.status,0);assert.equal(r.stderr,'');assert.equal(r.stdout,'{"done":true}\n');assert.equal(fs.readFileSync(counter,'utf8'),'once');failed(launch(entry,{counter}),'action','EEXIST');
});
test('asynchronous operation failure remains a bounded failure',()=>{const entry=put(tmp(),'entry.cjs',"exports.run=async()=>{await new Promise(r=>setTimeout(r,5));throw Object.assign(Error('SSB_PRIVATE_MARKER'),{code:'EIO'});};");failed(launch(entry),'action','EIO');});
test('unwritable earliest diagnostic stays exit 1 without an uncaught raw stack',()=>{
 const entry=put(tmp(),'entry.cjs',"require('node:fs').closeSync(2);throw Object.assign(Error('SSB_PRIVATE_MARKER'),{code:'EACCES'});");const r=launch(entry);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr,'');
});
test('failed output write cannot be accepted as successful awaited state execution',()=>{
 const entry=put(tmp(),'entry.cjs',"exports.run=async()=>{require('node:fs').closeSync(1);return{ok:true};};");failed(launch(entry),'output','other');
});
test('existing valid state stage retained, malformed claimed diagnosis ignored',()=>{
 const d=tmp();for(const [name,diag,stage,code]of [['valid',{version:1,stage:'initialize-state',code:'EACCES'},'initialize-state','EACCES'],['invalid',{version:1,stage:'/SSB_PRIVATE_MARKER',code:'EACCES'},'action','other']]){const entry=put(d,name+'.cjs','exports.run=async()=>{throw Object.assign(Error("SSB_PRIVATE_MARKER"),{stateDiagnostic:'+JSON.stringify(diag)+'});};');failed(launch(entry),stage,code);}
});
test('actual state entry refuses local UID as native UID1000 proof; load check does not mutate state',()=>{
 assert.notEqual(process.getuid(),1000);const d=tmp(),entry=path.join(__dirname,'state-agent.cjs');for(const mode of ['load','load-runtime','run'])failed(launch(entry,{toolsRoot:d,action:'initialize',binding:{root:d}},mode),'uid','state_owner_required');assert.deepEqual(fs.readdirSync(d),[]);
});
test('load and load-runtime entry await only loadCheck, never run',()=>{
 const p=put(tmp(),'entry.cjs','exports.run=()=>{throw Error("SSB_PRIVATE_MARKER");};exports.loadCheck=async(p,runtime)=>{await new Promise(r=>setTimeout(r,10));return{loaded:true,runtime};};');for(const mode of ['load','load-runtime']){const r=launch(p,{},mode);assert.equal(r.status,0);assert.deepEqual(JSON.parse(r.stdout),{loaded:true,runtime:mode==='load-runtime'});}
});
test('actual Native load gate binds real child uid/gid, timeout and exact result (offline transport model)',async()=>{
 for(const runtime of [false,true]){const n=new Native({run:'1'});n.toolsRoot='/synthetic';let calls=0;n.command=async(bin,args,o)=>{calls++;assert.equal(bin,process.execPath);assert.deepEqual(args,stateArgs(path.join(__dirname,'state-agent.cjs'),runtime?'load-runtime':'load'));assert.equal(o.uid,1000);assert.equal(o.gid,1000);assert.equal(o.ms,1000);assert.equal(o.stateDiagnostic,true);assert.deepEqual(JSON.parse(o.input),{toolsRoot:'/synthetic'});return{stdout:Buffer.from(JSON.stringify({loaded:true,uid:1000,gid:1000,node:'v24.17.0',modules:runtime?8:7,runtime})),stderr:Buffer.alloc(0)};};await n.stateLoadCheck(runtime);assert.equal(calls,1);}
});
for(const mutation of ['uid','gid','node','modules','runtime','extra','empty','stderr'])test('actual Native gate rejects misleading successful load proof: '+mutation,async()=>{
 const n=new Native({run:'1'}),v={loaded:true,uid:1000,gid:1000,node:'v24.17.0',modules:7,runtime:false};if(mutation==='extra')v.extra=true;else if(mutation in v)v[mutation]='wrong';n.command=async()=>({stdout:Buffer.from(mutation==='empty'?'':JSON.stringify(v)),stderr:Buffer.from(mutation==='stderr'?'SSB_PRIVATE_MARKER':'')});await assert.rejects(n.stateLoadCheck(false));
});
for(const writeFails of [false,true])test('actual process/controller/receipt path retains early cause and primary on private-write failure='+writeFails,async()=>{
 const d=tmp(),missing=path.join(d,'SSB_PRIVATE_MARKER.cjs'),proc=new Processes({deadline:performance.now()+40000,privateRoot:writeFails?path.join(d,'missing-dir'):d}),n=new Native({run:'12345678'}),lines=[];
 // Native UID options are asserted above. This real-process test runs unprivileged, not as UID1000.
 n.execute=async()=>{await proc.run(process.execPath,stateArgs(missing),{input:'{}',ms:1000,stateDiagnostic:true});return{verified:true};};n.close=async()=>{proc.assertClosed();return{verified:true,counts:[0,0,proc.calls.length],ids:[],detail:{failure:null,outcomes:[]}};};
 const opts={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64),output:l=>lines.push(l)};
 await assert.rejects(main(opts,n),e=>{const primary=writeFails?e.errors[0]:e;assert.equal(primary.code,'command_failed');assert.equal(primary.stateDiagnostic.stage,'entry-access');assert.equal(primary.stateDiagnostic.code,'ENOENT');assert.equal(primary.process.closed,true);assert.match(primary.stack,/command_failed/);if(writeFails)assert.equal(e.errors[1].code,'evidence_write_failed');return true;});
 const proof=parseReceipts(lines.join('\n'),opts.run,SOURCE,opts,{partial:true}).proof;assert.equal(proof.status,'PARTIAL_FAILURE_RECEIVED');const rows=lines.map(x=>JSON.parse(Buffer.from(x.split(' ')[1],'base64')));assert.doesNotMatch(JSON.stringify(rows),/SSB_PRIVATE_MARKER|ssb-entry-offline/);assert.equal(proc.children.size,0);assert.equal(proc.calls.length,1);
});
test('regular Native.state retains exactly one awaited invocation, no hidden load retry',async()=>{
 const n=new Native({run:'1'});n.synthetic={owner:'synthetic'};n.toolsRoot='/synthetic';let calls=0,completed=false;n.command=async(bin,args,o)=>{calls++;assert.deepEqual(args,stateArgs(path.join(__dirname,'state-agent.cjs')));assert.equal(o.uid,1000);assert.equal(o.gid,1000);assert.equal(o.ms,1000);assert.equal(JSON.parse(o.input).action,'snapshot');await new Promise(r=>setTimeout(r,10));completed=true;return{stdout:Buffer.from('{"phase":"closed"}'),stderr:Buffer.alloc(0)};};assert.deepEqual(await n.state('snapshot',{}),{phase:'closed'});assert.equal(completed,true);assert.equal(calls,1);
});
for(const missing of ['diagnostics.cjs','common.cjs','base-diagnostics.cjs','state-launch.cjs','registry-bindings.json'])test('real state-agent dependency failure before old handler is captured: '+missing,()=>{
 const d=tmp();for(const name of ['state-agent.cjs','diagnostics.cjs','common.cjs','base-diagnostics.cjs','state-launch.cjs','registry-bindings.json'])if(name!==missing)fs.copyFileSync(path.join(__dirname,name),path.join(d,name),fs.constants.COPYFILE_EXCL);
 failed(launch(path.join(d,'state-agent.cjs')),'entry-load','MODULE_NOT_FOUND');
});
test('real state-agent inaccessible diagnostics does not disable the early diagnostic',()=>{
 const d=tmp();for(const name of ['state-agent.cjs','diagnostics.cjs'])fs.copyFileSync(path.join(__dirname,name),path.join(d,name),fs.constants.COPYFILE_EXCL);
 const p=path.join(d,'diagnostics.cjs');fs.chmodSync(p,0);try{failed(launch(path.join(d,'state-agent.cjs')),'entry-load','EACCES');}finally{fs.chmodSync(p,0o600);}
});
for(const failLoad of [true,false])test('actual controller/preflight calls UID1000 gate before first pull/build; simulated runner fail='+failLoad,async()=>{
 const d=path.join(tmp(),'runner'),prefix='/var/tmp/ssb-native-12345678',map=p=>typeof p==='string'&&p.startsWith(prefix)?path.join(d,p.slice(prefix.length)):p;
 const fakeFS={...fs};for(const method of ['mkdirSync','cpSync','statSync','lstatSync'])fakeFS[method]=(...args)=>fs[method](...args.map(map));
 fakeFS.statSync=p=>p==='/usr/bin/docker'?{isFile:()=>true}:fs.statSync(map(p));
 fakeFS.chownSync=(p,u,g)=>{assert.equal(p,prefix+'/state');assert.equal(u,1000);assert.equal(g,1000);};
 fakeFS.statfsSync=()=>({bavail:32*1024**3,bsize:1,ffree:1000000});fakeFS.readFileSync=(p,...a)=>p==='/proc/meminfo'?'MemAvailable: 12582912 kB\n':fs.readFileSync(map(p),...a);
 const file=path.join(__dirname,'native.cjs'),m={exports:{}},req=createRequire(file),manifest=fs.readFileSync(path.join(__dirname,'publication-manifest.json'));
 const fakeProcess={...process,platform:'linux',arch:'x64',getuid:()=>0,env:{GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Ashraf228/AI-Chatbot',RUNNER_ARCH:'X64',RUNNER_OS:'Linux',SSB_REPOSITORY_VISIBILITY:'public',SSB_JOB_DEADLINE_MS:String(Date.now()+990000),SSB_PUBLICATION_MANIFEST:require('./common.cjs').sha(manifest),SSB_RELEASE_ROOT:path.resolve(__dirname,'../../../../AI-Chatbot-worktrees/ssb-base-pull-diagnostic-followup-20261009')}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,__dirname,require:id=>id==='node:fs'?fakeFS:req(id),process:fakeProcess,Buffer,performance,AggregateError,setInterval:()=>0,clearInterval:()=>{}});
 const lines=[],opts={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64),output:l=>lines.push(l)},n=new m.exports.Native(opts),calls=[];
 n.command=async(bin,args,o={})=>{
  calls.push({bin,args,o});
  if(bin===process.execPath){assert.equal(o.uid,1000);assert.equal(o.gid,1000);assert.equal(o.ms,1000);assert.equal(args.at(-1),'load');if(failLoad)throw Object.assign(Error('PRIVATE'),{code:'command_failed',stateDiagnostic:{version:1,stage:'entry-load',code:'EACCES'}});return{stdout:Buffer.from(JSON.stringify({loaded:true,uid:1000,gid:1000,node:'v24.17.0',modules:7,runtime:false})),stderr:Buffer.alloc(0)};}
  if(bin==='/usr/bin/git')return{stdout:Buffer.from(args.includes('rev-parse')?SOURCE:'')};
  assert.equal(bin,'/usr/bin/docker');if(args[2]==='pull')throw Object.assign(Error('offline stop at first pull'),{code:'command_failed'});
  if(args[2]==='info')return{stdout:Buffer.from(JSON.stringify({OSType:'linux',Architecture:'amd64',ID:'synthetic-daemon-123'}))};
  assert.ok(['container','network','volume','image'].includes(args[2]));return{stdout:Buffer.alloc(0)};
 };
 n.close=async()=>({verified:true,counts:[0,0,calls.length],ids:[],detail:{failure:null,outcomes:[]}});
 let primary;await assert.rejects(main(opts,n),error=>{primary=error;return true;});const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
 const load=calls.findIndex(x=>x.bin===process.execPath),pull=calls.findIndex(x=>x.args[2]==='pull');assert.ok(load>=0,primary.code+': '+primary.message);assert.equal(calls.filter(x=>x.bin===process.execPath).length,1);
 if(failLoad){assert.equal(pull,-1);assert.equal(rows[0].phase,'preflight');assert.equal(rows[0].ok,false);assert.equal(rows[0].detail.failure.state.code,'EACCES');}else{assert.ok(pull>load);assert.equal(rows[0].phase,'preflight');assert.equal(rows[0].ok,true);assert.equal(rows[1].phase,'bases');assert.equal(rows[1].ok,false);}
 assert.ok(!calls.some(x=>x.args[2]==='build'));assert.equal(parseReceipts(lines.join('\n'),opts.run,SOURCE,opts,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
});
