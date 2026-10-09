'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),{createHash}=require('node:crypto');
const {main,reportFailure,SOURCE}=require('./controller.cjs');
const {Receipts,receive,parseReceipts,phases,dispatchTitle,generationCounts}=require('./evidence.cjs');
const {sha}=require('./common.cjs');
const run='12345678',job='87654321',context={workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};
const root=path.resolve(__dirname,'../../..'),pub=path.join(root,'publication'),manifestPath=path.join(__dirname,'publication-manifest.json');
const options=output=>({authorization:'ONE_NATIVE_FORWARD_RECOVERY',run,attempt:'1',...context,output});
function fixture(){
  const id=n=>n.toString(16).padStart(64,'0'),ids=Array.from({length:24},(_,i)=>id(i+1));
  const data={preflight:{counts:[901,4],hashes:[sha(fs.readFileSync(manifestPath))]},bases:{counts:[4],ids:require('./registry-bindings.json').images.map(x=>x.imageId)},
    builds:{counts:[4,2],ids:[100,101,102,103,100].map(n=>'sha256:'+id(n))},initialize:{counts:[34,4,1],hashes:[id(200)]},roles:{counts:[32]},
    restore:{counts:[34,4,7],hashes:[id(201),id(202)]},inventory:{counts:[19,5,2],ids},closure:{counts:[19,19,1000],ids},complete:{}};
  for(const [i,g]of ['release','forward','normal'].entries()){
    const cohort=ids.slice(3+i*5,8+i*5);
    data[g+'-start']={counts:[...generationCounts.start[g]],ids:cohort};data[g+'-e1']={counts:[...generationCounts.e1],hashes:[id(210),id(211)]};
    data[g+'-drain']={counts:[...generationCounts.drain]};data[g+'-shutdown']={counts:[...generationCounts.shutdown],ids:cohort,hashes:[id(220+2*i),id(221+2*i)]};
  }
  return Object.fromEntries(Object.entries(data).map(([p,r])=>[p,structuredClone(r)]));
}
function sample(data=fixture()){
  const lines=[],writer=new Receipts(run,SOURCE,context,x=>lines.push(x));for(const p of phases)writer.emit(p,true,data[p]);
  return{lines,rows:lines.map(x=>JSON.parse(Buffer.from(x.split(' ')[1],'base64')))};
}
function rechain(rows){
  let previous='0'.repeat(64);return rows.map((row,seq)=>{const bytes=JSON.stringify({...row,seq,previous}),digest=sha(bytes);previous=digest;return 'SSB_PUBLIC_RECEIPT_V1 '+Buffer.from(bytes).toString('base64')+' '+digest;}).join('\n');
}
function backend(data){return{async execute(p){return{verified:true,...data[p]};},async close(){return{verified:true,...data.closure};}};}
function loadActual(file,replacements={},globals={},cli=false){
  const module={exports:{}},realRequire=createRequire(file),requireMock=id=>Object.hasOwn(replacements,id)?replacements[id]:realRequire(id);
  if(cli)requireMock.main=module;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:requireMock,__dirname:path.dirname(file),Buffer,console,performance,setTimeout,...globals},{filename:file});
  return module.exports;
}
function receiverHarness(log,runFields={},jobFields={}){
  const files=new Map(),stdout=[],calls=[];let mkdirs=0;
  const fakeFs={...fs,mkdirSync(_p,o){assert.equal(o.mode,0o700);mkdirs++;},writeFileSync(p,b,o){assert.equal(o.flag,'wx');assert.equal(o.mode,0o600);files.set(path.basename(p),b);}};
  const execFileSync=(bin,args)=>{
    assert.equal(bin,'gh');calls.push(args);
    const route=args[1];
    if(route.endsWith('/actions/runs/'+run))return JSON.stringify({id:Number(run),event:'workflow_dispatch',run_attempt:1,head_sha:context.workflowHead,display_title:dispatchTitle(context.workflowHead,context.dispatchNonce),status:'completed',conclusion:'success',path:'.github/workflows/ssb-native-forward-recovery.yml',...runFields});
    if(route.endsWith('/actions/jobs/'+job))return JSON.stringify({id:Number(job),run_id:Number(run),conclusion:'success',name:'Native forward recovery',labels:['ubuntu-24.04'],...jobFields});
    if(route.endsWith('/actions/jobs/'+job+'/logs'))return log;
    throw Error('unapproved_mock_route');
  };
  const receiver=loadActual(path.join(__dirname,'receive.cjs'),{'node:fs':fakeFs,'node:child_process':{execFileSync}},{console:{log:x=>stdout.push(x)}});
  return{files,stdout,calls,get mkdirs(){return mkdirs;},invoke(args=[run,job,context.workflowHead,context.dispatchNonce,path.join(root,'mock-received')]){return receiver.main(args);}};
}

test('receiver exports exactly canonical validated lines, replayable with the same proof',()=>{
  const {lines}=sample(),raw=['SYNTHETIC_PRIVATE_LOG',...lines.map(x=>'2026-10-09T20:00:00.1234567Z '+x),'unrelated log'].join('\r\n');
  const h=receiverHarness(raw);h.invoke();assert.equal(h.calls.length,3);assert.equal(h.mkdirs,1);
  const saved=h.files.get('receipts.txt'),proof=JSON.parse(h.files.get('Empfang.json'));
  assert.equal(saved,lines.join('\n')+'\n');assert.equal(proof.publicReceiptSha256,sha(saved));assert.equal(proof.bytes,Buffer.byteLength(saved));
  const replay=receive(saved,run,SOURCE,context);for(const [k,v]of Object.entries(replay))assert.equal(proof[k],v);
  assert.equal(proof.source,SOURCE);assert.equal(proof.workflowHead,context.workflowHead);assert.equal(proof.dispatchNonce,context.dispatchNonce);
  assert.deepEqual(Object.keys(proof).sort(),['status','run','source','workflowHead','dispatchNonce','phases','publicationManifest','finalSha256','bytes','job','receivedUTC','publicReceiptSha256'].sort());
  assert.doesNotMatch([...h.files.values(),...h.stdout].join('\n'),/SYNTHETIC_PRIVATE_LOG|unrelated log/);
});
for(const kind of ['invalid-marker','bare-marker','hidden-duplicate','spaced-prefix','duplicate','trailing-text','leading-space','ansi-prefix'])test('receiver rejects marker smuggling: '+kind,()=>{
  const {lines}=sample(),first=lines[0],bad={'invalid-marker':'SSB_PUBLIC_RECEIPT_V1 SYNTHETIC_PRIVATE_MARKER','bare-marker':'SSB_PUBLIC_RECEIPT_V1','hidden-duplicate':'debug:'+first,'spaced-prefix':'debug: '+first,duplicate:first,'trailing-text':first+' private','leading-space':' '+first,'ansi-prefix':'\x1b[0m'+first}[kind];
  const h=receiverHarness([...lines,bad].join('\n'));assert.throws(()=>h.invoke());assert.equal(h.mkdirs,0);assert.equal(h.files.size,0);assert.equal(h.stdout.length,0);
});
test('noncanonical JSON cannot smuggle duplicate keys or ignored whitespace into an export',()=>{
  const {rows}=sample();for(const prefix of ['{"run":"SYNTHETIC_PRIVATE_MARKER",','{ ']){
    const bytes=prefix+JSON.stringify(rows[0]).slice(1),line='SSB_PUBLIC_RECEIPT_V1 '+Buffer.from(bytes).toString('base64')+' '+sha(bytes);
    assert.throws(()=>parseReceipts(line,run,SOURCE,context),/receipt_noncanonical/);
  }
});
test('name-only successful phases fail at both producer and receiver',async()=>{
  const h=backend({});h.execute=async p=>({verified:true,...(p==='preflight'?{hashes:[sha(fs.readFileSync(manifestPath))]}:{})});
  await assert.rejects(main(options(()=>{}),h));
  const rows=sample().rows;for(const r of rows){r.counts=[];r.ids=[];r.hashes=r.phase==='preflight'?r.hashes:[];}
  assert.throws(()=>receive(rechain(rows),run,SOURCE,context));
});
for(const p of phases.filter(p=>p!=='complete'))for(const field of ['counts','ids','hashes'].filter(k=>fixture()[p][k]?.length))test(p+' requires native '+field+' in producer and receiver',async()=>{
  const data=fixture();data[p][field]=[];await assert.rejects(main(options(()=>{}),backend(data)));
  const rows=sample().rows;rows.find(r=>r.phase===p)[field]=[];assert.throws(()=>receive(rechain(rows),run,SOURCE,context));
});
for(const p of phases.filter(p=>p!=='complete'))test(p+' rejects incorrect native counts even with a recomputed chain',async()=>{
  const data=fixture();data[p].counts[0]++;await assert.rejects(main(options(()=>{}),backend(data)));
  const rows=sample().rows;rows.find(r=>r.phase===p).counts[0]++;assert.throws(()=>receive(rechain(rows),run,SOURCE,context));
});
const cohortMutations={
  'wrong registry image':d=>{d.bases.ids[0]='sha256:'+'f'.repeat(64);},
  'missing writer image alias':d=>{d.builds.ids[4]=d.builds.ids[1];},
  'reused build image':d=>{d.builds.ids[1]=d.builds.ids[2];},
  'duplicate cohort member':d=>{d['release-start'].ids[1]=d['release-start'].ids[0];},
  'image ID used as container':d=>{d['release-start'].ids[0]=d.builds.ids[0];},
  'forward reuses release cohort':d=>{d['forward-start'].ids=[...d['release-start'].ids];},
  'normal reuses forward cohort':d=>{d['normal-start'].ids=[...d['forward-start'].ids];},
  'shutdown swaps cohort':d=>{d['release-shutdown'].ids=[...d['forward-start'].ids];},
  'shutdown reorders members':d=>{d['normal-shutdown'].ids.reverse();},
  'shutdown missing receipt':d=>{d['normal-shutdown'].hashes.pop();},
  'shutdown duplicate receipt':d=>{d['release-shutdown'].hashes[1]=d['release-shutdown'].hashes[0];},
  'shutdown reuses generation receipts':d=>{d['forward-shutdown'].hashes=[...d['release-shutdown'].hashes];},
  'forward widget changed':d=>{d['forward-e1'].hashes[0]='f'.repeat(64);},
  'normal widget changed':d=>{d['normal-e1'].hashes.reverse();},
  'restore missing receipt count':d=>{d.restore.counts[2]=3;},
  'restore missing database hash':d=>{d.restore.hashes.pop();},
  'inventory missing cohort':d=>{d.inventory.ids[3]='f'.repeat(64);},
  'inventory duplicate network':d=>{d.inventory.ids[23]=d.inventory.ids[22];},
  'inventory substitutes network for participant':d=>{[d.inventory.ids[3],d.inventory.ids[19]]=[d.inventory.ids[19],d.inventory.ids[3]];},
  'closure swaps identity':d=>{d.closure.ids[0]='f'.repeat(64);},
  'closure lacks process completion count':d=>{d.closure.counts[2]=0;},
  'complete contains extra evidence':d=>{d.complete={counts:[1]};},
};
for(const [name,mutate]of Object.entries(cohortMutations))test('shared evidence validation: '+name,async()=>{
  const data=fixture();mutate(data);
  if(!name.startsWith('complete'))await assert.rejects(main(options(()=>{}),backend(data)));
  else assert.throws(()=>sample(data));
  const rows=sample().rows;for(const r of rows)Object.assign(r,data[r.phase]);assert.throws(()=>receive(rechain(rows),run,SOURCE,context));
});
test('complete cannot be emitted before all native phases and closure',()=>{
  assert.throws(()=>new Receipts(run,SOURCE,context,()=>{}).emit('complete',true));
});
test('sparse native arrays fail validation rather than serializing unvalidated nulls',()=>{
  const data=fixture();data.preflight.hashes=Array(1);assert.throws(()=>sample(data),/receipt_hashes/);
  const writer=new Receipts(run,SOURCE,context,()=>{});writer.emit('preflight',false);
  const counts=[0,0];counts.length=3;assert.throws(()=>writer.emit('closure',true,{counts}),/receipt_counts/);
});
test('producer retains a snapshot, not mutable aliases of native evidence',()=>{
  const data=fixture(),lines=[],writer=new Receipts(run,SOURCE,context,x=>lines.push(x));
  for(const p of phases.slice(0,6))writer.emit(p,true,data[p]);
  const original=[...data['release-start'].ids];data['release-start'].ids[0]='f'.repeat(64);
  assert.deepEqual(writer.records.at(-1).ids,original);assert.equal(lines.length,6);
});
test('retired-cohort obligations and E1 counts match the reviewed native generation contract',async()=>{
  assert.deepEqual(generationCounts.start,{release:[5,5,0],forward:[5,5,8],normal:[5,5,16]});assert.deepEqual(generationCounts.e1,[11,7]);
  const {Native}=require('./native.cjs'),n=new Native(options(()=>{}));n.synthetic={};n.current={generation:'normal'};n.probeContainer={id:'a'.repeat(64)};n.images={api:'sha256:'+'b'.repeat(64)};
  let result; n.d=async()=>({stdout:Buffer.from('SSB_PROOF_JSON '+JSON.stringify(result)+'\n')});
  result={verified:true,counts:[11,7],hashes:fixture()['release-e1'].hashes};await n.probe('e1');
  result.counts=[10,6];await assert.rejects(n.probe('e1'),/mandatory_proof_missing/);
  result={verified:true,counts:[3,2]};await n.probe('closed-ready');
  result={verified:true,counts:[8,1],generation:'normal',retiredGeneration:'release',code:'generation_retired'};await n.probe('retired-admission',{retiredGeneration:'release'});
  result.retiredGeneration='forward';await assert.rejects(n.probe('retired-admission',{retiredGeneration:'release'}),/retired_proof_binding/);
});
for(const early of [true,false])test('successful partial cleanup stays true after failed work; early='+early,async()=>{
  const lines=[],data=fixture(),primary=Error('controlled_failure'),b=backend(data);
  const stop=early?'preflight':'forward-start',execute=b.execute;
  b.execute=async p=>{if(p===stop)throw primary;return execute(p);};
  const owned=data.inventory.ids.slice(0,8),networks=data.inventory.ids.slice(19);
  b.close=async failed=>{assert.equal(failed,true);return{verified:true,...(early?{counts:[0]}:{counts:[8,8,100],ids:[...owned,...networks]})};};
  await assert.rejects(main(options(x=>lines.push(x)),b),e=>e===primary);
  const rows=lines.map(x=>JSON.parse(Buffer.from(x.split(' ')[1],'base64')));
  assert.equal(rows.at(-2).phase,stop);assert.equal(rows.at(-2).ok,false);assert.equal(rows.at(-1).phase,'closure');assert.equal(rows.at(-1).ok,true);
  assert.ok(!rows.some(r=>r.phase==='complete'));assert.throws(()=>receive(lines.join('\n'),run,SOURCE,context));
  const forged=[...rows,{...sample().rows.at(-1),elapsedMs:rows.at(-1).elapsedMs}];assert.throws(()=>receive(rechain(forged),run,SOURCE,context));
});
for(const data of [{counts:[20,20,1],ids:[]},{counts:[1,0,1],ids:[]},{counts:[0,0,1],ids:Array(6).fill('a'.repeat(64))},{counts:[0],hashes:['a'.repeat(64)]}])test('partial cleanup refuses impossible counts or IDs '+JSON.stringify(data.counts),()=>{
  const writer=new Receipts(run,SOURCE,context,()=>{});writer.emit('preflight',false);assert.throws(()=>writer.emit('closure',true,data));
});
for(const [field,value]of [['workflowHead','c'.repeat(40)],['dispatchNonce','d'.repeat(64)],['source','e'.repeat(40)],['run','12345679']])test('every receipt is bound to '+field,()=>{
  for(const index of [0,10,20]){const rows=sample().rows;rows[index][field]=value;assert.throws(()=>receive(rechain(rows),run,SOURCE,context));}
});
for(const b of [{workflowHead:undefined},{dispatchNonce:undefined},{workflowHead:['a'.repeat(40)]},{dispatchNonce:'../unsafe'},{run:'9007199254740993'}])test('unsafe binding is rejected before backend work '+Object.keys(b)[0],async()=>{
  let calls=0;await assert.rejects(main({...options(()=>{}),...b},{async execute(){calls++;},async close(){calls++;}}));assert.equal(calls,0);
});
for(const [field,value]of [['display_title','unrelated'],['head_sha','c'.repeat(40)],['id',9],['run_attempt',2],['event','push'],['status','in_progress'],['conclusion','failure'],['path','unrelated.yml']])test('receiver rejects run provenance '+field,()=>{
  const h=receiverHarness(sample().lines.join('\n'),{[field]:value});assert.throws(()=>h.invoke());assert.equal(h.files.size,0);assert.equal(h.calls.length,2);
});
for(const [field,value]of [['id',9],['run_id',9],['name','unrelated'],['labels',['self-hosted','ubuntu-24.04']],['labels',null],['conclusion','failure']])test('receiver rejects job provenance '+field,()=>{
  const h=receiverHarness(sample().lines.join('\n'),{},{[field]:value});assert.throws(()=>h.invoke());assert.equal(h.files.size,0);
});
test('receiver rejects old argument shape and wrong manifest without any acceptance',()=>{
  const h=receiverHarness(sample().lines.join('\n'));assert.throws(()=>h.invoke([run,job,context.workflowHead,path.join(root,'mock')]));assert.equal(h.calls.length,0);
  const rows=sample().rows;rows[0].hashes=['f'.repeat(64)];const bad=receiverHarness(rechain(rows));assert.throws(()=>bad.invoke(),/received_publication_binding/);assert.equal(bad.files.size,0);
});
test('private failure persistence is awaited and receives the original error tree',async()=>{
  const error=new AggregateError([Error('SYNTHETIC_PRIVATE_FAILURE'),Error('cleanup')],'both'),events=[];
  await reportFailure({async recordFailure(e){assert.equal(e,error);await Promise.resolve();events.push('persisted');}},error,x=>events.push(x));
  assert.equal(events[0],'persisted');assert.equal(events.length,2);assert.match(events[1],/^SSB_NATIVE_FORWARD_RECOVERY_FAILED:/);assert.doesNotMatch(events.join('\n'),/SYNTHETIC_PRIVATE_FAILURE/);
});
for(const writeFails of [false,true])test('actual CLI hands preserved errors to Native.recordFailure; writeFails='+writeFails,async()=>{
  const output=[],primary=Error('SYNTHETIC_PRIVATE_PRIMARY'),cleanup=Error('SYNTHETIC_PRIVATE_CLEANUP');let saved;
  class FakeNative{async execute(){throw primary;}async close(){throw cleanup;}async recordFailure(e){saved=e;if(writeFails)throw Error('private write failure');}}
  const proc={env:{SSB_EXECUTION_APPROVAL:'ONE_NATIVE_FORWARD_RECOVERY',GITHUB_RUN_ID:run,GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:context.workflowHead,SSB_DISPATCH_NONCE:context.dispatchNonce}};
  const consoleMock={log:x=>output.push(x),error:x=>output.push(x)},evidence=loadActual(path.join(__dirname,'evidence.cjs'),{},{console:consoleMock});
  loadActual(path.join(__dirname,'controller.cjs'),{'./native.cjs':{Native:FakeNative},'./evidence.cjs':evidence},{process:proc,console:consoleMock},true);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.errors[0],primary);assert.equal(saved.errors[1],cleanup);assert.equal(proc.exitCode,1);
  const markers=output.filter(x=>!x.startsWith('SSB_PUBLIC_RECEIPT_V1 '));assert.equal(markers.length,writeFails?2:1);
  if(writeFails)assert.equal(markers[0],'SSB_PRIVATE_DIAGNOSTIC_NOT_PERSISTED');assert.match(markers.at(-1),/^SSB_NATIVE_FORWARD_RECOVERY_FAILED:/);
  assert.doesNotMatch(output.join('\n'),/SYNTHETIC_PRIVATE_|private write failure/);
});

function dispatchHarness(mode='matching'){
  // Refresh hashes in memory only. Package manifests on disk remain deliberately unfinalized.
  const artifactPath=path.join(root,'artifact-manifest.json'),manifest=JSON.parse(fs.readFileSync(artifactPath));
  manifest.files=manifest.files.map(f=>{const p=path.join(root,f.path),s=fs.statSync(p);return{...f,bytes:s.size,mode:s.mode&0o777,sha256:sha(fs.readFileSync(p))};});
  const manifestBytes=Buffer.from(JSON.stringify(manifest)),publication=JSON.parse(fs.readFileSync(manifestPath));
  const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
  const tree=[...publication.files,{path:'.github/ssb-native-forward-recovery/publication-manifest.json'}].map(f=>({path:f.path,sha:blob(fs.readFileSync(path.join(pub,f.path))),mode:'100644',type:'blob'}));
  const state={posts:[],locks:[],receiver:[],stdout:[],lists:0,headReads:0};let stored,clock=0;
  const fakeFs={...fs,readFileSync(p,...args){return p===artifactPath?manifestBytes:fs.readFileSync(p,...args);},writeFileSync(p,b,o){assert.equal(p,path.join(root,'../ssb-native-forward-recovery-9wgIuS.spent.json'));assert.equal(o.flag,'wx');assert.equal(o.mode,0o600);if(stored)throw Error('EEXIST');stored=JSON.parse(b);state.locks.push(stored);}};
  const execFileSync=(bin,args)=>{
    if(bin==='/offline/node'){state.receiver.push(args);return Buffer.from('{"status":"MOCK_RECEIVER"}\n');}
    assert.equal(bin,'gh');const route=args[1];
    if(route==='repos/Ashraf228/AI-Chatbot')return JSON.stringify({private:false,default_branch:'main'});
    if(route.endsWith('/git/ref/heads/main')){state.headReads++;return JSON.stringify({object:{sha:mode==='head-advanced'&&state.headReads>1?'e'.repeat(40):context.workflowHead}});}
    if(route.includes('/git/commits/'))return JSON.stringify({tree:{sha:'c'.repeat(40)}});
    if(route.includes('/git/trees/bc81'))return JSON.stringify({tree:[],truncated:false});
    if(route.includes('/git/trees/'))return JSON.stringify({tree,truncated:false});
    if(route.endsWith('/dispatches')){assert.ok(stored);state.posts.push(args);if(mode==='post-fails')throw Error('SYNTHETIC_PRIVATE_API_ERROR');return '';}
    if(route.includes('/runs?')){
      state.lists++;assert.ok(state.lists<=3);const nonce=stored.dispatchNonce;
      const matched={id:Number(run),event:'workflow_dispatch',path:'.github/workflows/ssb-native-forward-recovery.yml',created_at:new Date().toISOString(),head_sha:context.workflowHead,run_attempt:1,status:'completed',conclusion:'success',display_title:dispatchTitle(context.workflowHead,nonce)};
      const unrelated={...matched,id:Number(run)+1,display_title:dispatchTitle(context.workflowHead,'e'.repeat(64))};
      if(mode==='unrelated')return JSON.stringify({workflow_runs:[unrelated]});
      if(mode==='duplicate')return JSON.stringify({workflow_runs:[matched,{...matched,id:Number(run)+2}]});
      if(mode==='wrong-head')matched.head_sha='e'.repeat(40);
      if(mode==='rerun')matched.run_attempt=2;
      if(mode==='failed')matched.conclusion='failure';
      if(mode==='changed-run'){matched.status=state.lists===1?'in_progress':'completed';if(state.lists>1)matched.id++;}
      return JSON.stringify({workflow_runs:[unrelated,matched]});
    }
    if(route.endsWith('/runs/'+run+'/jobs'))return JSON.stringify({jobs:[{id:Number(job),conclusion:'success'}]});
    throw Error('unapproved_mock_route');
  };
  const proc={argv:['node','dispatch-once.cjs','--execute'],execPath:'/offline/node',env:{SSB_APPROVED_PACKAGE_SHA256:sha(manifestBytes)},stdout:{write:x=>state.stdout.push(x.toString())}};
  const dispatch=loadActual(path.join(root,'dispatch-once.cjs'),{'node:fs':fakeFs,'node:child_process':{execFileSync}},{process:proc,performance:{now:()=>{const n=clock;clock+=400000;return n;}},setTimeout:fn=>{queueMicrotask(fn);return 0;}});
  return{state,main:dispatch.main};
}
test('dispatch persists a random nonce before POST and selects only its exact title',async()=>{
  const h=dispatchHarness();await h.main();const {state}=h,lock=state.locks[0];assert.equal(state.posts.length,1);assert.match(lock.dispatchNonce,/^[a-f0-9]{64}$/);assert.equal(lock.head,context.workflowHead);assert.equal(lock.dispatches,1);
  assert.ok(state.posts[0].includes('inputs[dispatch_nonce]='+lock.dispatchNonce));assert.ok(state.posts[0].includes('ref=main'));assert.ok(state.posts[0].includes('inputs[expected_head]='+lock.head));assert.equal(state.headReads,2);
  assert.equal(state.receiver.length,1);assert.deepEqual(Array.from(state.receiver[0].slice(1,5)),[run,job,lock.head,lock.dispatchNonce]);
  await assert.rejects(h.main(),/EEXIST/);assert.equal(state.posts.length,1);
  const other=dispatchHarness();await other.main();assert.notEqual(other.state.locks[0].dispatchNonce,lock.dispatchNonce);
});
test('head changes after tree verification: no spent lock, POST or receipt subprocess',async()=>{
  const h=dispatchHarness('head-advanced');await assert.rejects(h.main(),/head changed before dispatch/);
  assert.equal(h.state.headReads,2);assert.equal(h.state.posts.length,0);assert.equal(h.state.locks.length,0);assert.equal(h.state.receiver.length,0);
});
for(const mode of ['unrelated','duplicate','wrong-head','rerun','failed','changed-run','post-fails'])test('dispatch fails closed without redispatch: '+mode,async()=>{
  const h=dispatchHarness(mode);await assert.rejects(h.main());assert.equal(h.state.posts.length,1);assert.equal(h.state.locks.length,1);assert.equal(h.state.receiver.length,0);assert.equal(h.state.stdout.length,0);
  await assert.rejects(h.main(),/EEXIST/);assert.equal(h.state.posts.length,1);
});
test('workflow input, run title, checkout and sudo environment bind the same head and nonce',()=>{
  const w=fs.readFileSync(path.join(pub,'.github/workflows/ssb-native-forward-recovery.yml'),'utf8');
  assert.match(w,/run-name: SSB native forward recovery \/ \$\{\{ github\.sha \}\} \/ \$\{\{ inputs\.dispatch_nonce \}\}/);
  assert.match(w,/dispatch_nonce:\n\s+description:[^\n]+\n\s+required: true\n\s+type: string/);
  assert.match(w,/expected_head:\n\s+description:[^\n]+\n\s+required: true\n\s+type: string/);assert.match(w,/if:[^\n]+github\.sha == inputs\.expected_head/);
  assert.match(w,/SSB_EXPECTED_HEAD: \$\{\{ inputs\.expected_head \}\}/);assert.match(w,/test "\$GITHUB_SHA" = "\$SSB_EXPECTED_HEAD"/);
  assert.match(w,/SSB_DISPATCH_NONCE: \$\{\{ inputs\.dispatch_nonce \}\}/);assert.match(w,/--preserve-env=[^\n]*GITHUB_SHA[^\n]*SSB_DISPATCH_NONCE/);
  assert.match(w,/ref: 94a25578e883a6d7bbd03f26c56735739f75e45e/);assert.match(w,/test "\$\(git -C bundle rev-parse HEAD\)" = "\$GITHUB_SHA"/);
});
