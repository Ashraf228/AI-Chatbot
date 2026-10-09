'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {main,SOURCE}=require('./controller.cjs'),{Native,verifyBase,proofResult}=require('./native.cjs');
const {phases,Receipts,receive,generationCounts}=require('./evidence.cjs'),{expand}=require('./fixtures.cjs');
const {sha}=require('./common.cjs');
const context={workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};
const options=output=>({authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',...context,output});
function nativeEvidence(){
  const id=n=>n.toString(16).padStart(64,'0'),all=Array.from({length:24},(_,i)=>id(i+1));
  const image=n=>'sha256:'+id(n),result={
    preflight:{counts:[901,4],hashes:[sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json')))]},
    bases:{counts:[4],ids:require('./registry-bindings.json').images.map(x=>x.imageId)},
    builds:{counts:[4,2],ids:[100,101,102,103,100].map(image)},initialize:{counts:[34,4,1],hashes:[id(200)]},roles:{counts:[32]},
    restore:{counts:[34,4,7],hashes:[id(210),id(211)]},inventory:{counts:[19,5,2],ids:all},closure:{counts:[19,19,1000],ids:all},complete:{},
  };
  for(const [i,g]of ['release','forward','normal'].entries()){
    const ids=all.slice(3+i*5,8+i*5);
    result[g+'-start']={counts:[...generationCounts.start[g]],ids};result[g+'-e1']={counts:[...generationCounts.e1],hashes:[id(220),id(221)]};
    result[g+'-drain']={counts:[...generationCounts.drain]};result[g+'-shutdown']={counts:[...generationCounts.shutdown],ids,hashes:[id(230+i*2),id(231+i*2)]};
  }
  return result;
}
function backend(fault){
  const native=new Native(options(()=>{})),calls=[],evidence=nativeEvidence();
  const methods=['preflight','bases','builds','initialize','startGeneration','e1','drain','shutdown','restore','finalInventory','probe'];
  for(const name of methods)native[name]=async function(arg){calls.push([name,arg]);if(name==='startGeneration')this.current={generation:arg};if(fault?.(name,arg))throw Error('controlled_failure');const phase=name==='startGeneration'?arg+'-start':['e1','drain','shutdown'].includes(name)?this.current.generation+'-'+name:name==='finalInventory'?'inventory':name==='probe'?arg:name;return{verified:true,...evidence[phase]};};
  let closed=0;native.close=async failed=>{calls.push(['close',failed]);closed++;return{verified:true,...evidence.closure};};return{native,calls,get closed(){return closed;}};
}
test('actual controller entry and Native dispatch: complete ordered release-forward-normal',async()=>{const b=backend(),lines=[];const rows=await main(options(x=>lines.push(x)),b.native);assert.deepEqual(rows.map(r=>r.phase),phases);assert.deepEqual(b.calls.filter(x=>x[0]==='startGeneration').map(x=>x[1]),['release','forward','normal']);assert.equal(b.closed,1);assert.equal(receive(lines.join('\n'),'12345678',SOURCE,context).status,'RECEIVED_AND_VERIFIED');});
for(const stage of phases.filter(x=>!['closure','complete'].includes(x)))test('entry fails closed at '+stage,async()=>{
  const b=backend(),original=b.native.execute.bind(b.native),lines=[];b.native.execute=async p=>{if(p===stage)throw Error('controlled_failure');return original(p);};
  await assert.rejects(main(options(x=>lines.push(x)),b.native));assert.equal(b.closed,1);assert.throws(()=>receive(lines.join('\n'),'12345678',SOURCE,context));const prefix=phases.slice(0,phases.indexOf(stage));assert.equal(lines.length,prefix.length+2);
});
test('missing execution authorization has zero backend calls',async()=>{const b=backend();await assert.rejects(main({...options(()=>{}),authorization:''},b.native));assert.equal(b.calls.length,0);});
test('second job attempt has zero backend calls',async()=>{const b=backend();await assert.rejects(main({...options(()=>{}),attempt:'2'},b.native));assert.equal(b.calls.length,0);});
test('malformed phase result is never PASS',async()=>{const b=backend();b.native.preflight=async()=>({});await assert.rejects(main(options(()=>{}),b.native));assert.equal(b.closed,1);});
test('primary and closure failures both preserved',async()=>{const b=backend(()=>true);b.native.close=async()=>{throw Error('closure');};await assert.rejects(main(options(()=>{}),b.native),e=>e instanceof AggregateError&&e.errors.length===2);});
test('receipt write failure still closes and retains primary',async()=>{const b=backend(()=>true);await assert.rejects(main(options(()=>{throw Error('disk');}),b.native),e=>e instanceof AggregateError);assert.equal(b.closed,1);});
for(const base of require('./registry-bindings.json').images){
  const good=()=>[{Id:base.imageId,Os:'linux',Architecture:'amd64',RepoDigests:[base.reference],Config:{Env:Object.entries(base.envVersionFields).map(([k,v])=>`${k}=${v}`)}}];
  test(base.key+' exact metadata binding passes',()=>verifyBase(good(),base));
  for(const field of ['Id','Architecture','RepoDigests','Config'])test(base.key+' rejects wrong '+field,()=>{const x=good();x[0][field]=field==='RepoDigests'?[]:field==='Config'?null:'invalid';assert.throws(()=>verifyBase(x,base));});
}
for(const data of ['', '{}','SSB_PROOF_JSON {','SSB_PROOF_JSON {"verified":false}','SSB_PROOF_JSON {"verified":true}\nSSB_PROOF_JSON {"verified":true}'])test('strict stdout rejects '+JSON.stringify(data),()=>assert.throws(()=>proofResult(Buffer.from(data))));
test('valid complete stdout receipt',()=>assert.equal(proofResult(Buffer.from('private app log\nSSB_PROOF_JSON {"verified":true,"counts":[32]}\n')).verified,true));
test('actual probe method preserves stdin and rejects missing mandatory checks',async()=>{const n=new Native(options(()=>{}));n.synthetic={passwords:{}};n.probeContainer={id:'a'.repeat(64)};n.images={api:'sha256:'+'b'.repeat(64)};let seen;n.d=async(args,o)=>{seen={args,o};return{stdout:Buffer.from('SSB_PROOF_JSON {"verified":true,"counts":[]}\n')};};await assert.rejects(n.probe('roles'));assert.equal(JSON.parse(seen.o.input).action,'roles');assert.deepEqual(seen.args.slice(0,2),['exec','-i']);});
test('receipt refuses private fields and arbitrary text',()=>{const r=new Receipts('123',SOURCE,context,()=>{});assert.throws(()=>r.emit('roles',true,{token:'private'}));assert.throws(()=>r.emit('roles',true,{ids:['private-credential']}));});
test('receipt detects truncation, corruption, wrong run and phase omission',()=>{const logs=[],r=new Receipts('123',SOURCE,context,x=>logs.push(x)),evidence=nativeEvidence();for(const p of phases)r.emit(p,true,evidence[p]);assert.throws(()=>receive(logs.slice(0,-1).join('\n'),'123',SOURCE,context));assert.throws(()=>receive(logs.join('\n'),'124',SOURCE,context));assert.throws(()=>receive(logs.join('\n').replace(/SSB_PUBLIC_RECEIPT_V1 ./,'SSB_PUBLIC_RECEIPT_V1 z'),'123',SOURCE,context));assert.throws(()=>receive(logs.filter((_,i)=>i!==5).join('\n'),'123',SOURCE,context));});
test('strict fixture substitution rejects missing references',()=>{assert.equal(expand('${BOUND:?required}',{BOUND:'exact'}),'exact');assert.throws(()=>expand('${BOUND:?required}',{}));assert.deepEqual(expand({a:['${BOUND:?required}']},{BOUND:'value'}),{a:['value']});});
test('native platform and missing approval reject before any process',async()=>{const n=new Native(options(()=>{}));if(process.platform!=='linux'||process.arch!=='x64'||process.getuid()!==0){await assert.rejects(n.preflight());assert.equal(n.proc,undefined);}});
test('reviewed adapter hashes unchanged',()=>{const m=require('./adapter-bindings.json');for(const f of m.files)assert.equal(sha(fs.readFileSync(path.join(__dirname,'adapters',f.path))),f.sha256);});
test('published controller has no deletion, compose up, artifact or cache uploader',()=>{const native=fs.readFileSync(path.join(__dirname,'native.cjs'),'utf8');assert.doesNotMatch(native, /\['(?:rm|rmi|prune|down)'|force-recreate|docker compose up/);const w=fs.readFileSync(path.join(__dirname,'../workflows/ssb-native-forward-recovery.yml'),'utf8');assert.doesNotMatch(w,/upload-artifact|actions\/cache|push:|pull_request:|schedule:|workflow_run:|secrets\./);assert.match(w,/runs-on: ubuntu-24\.04/);});
test('generated Compose and five start plans obey actual reviewed adapter',t=>{
  const vm=require('node:vm'),file=path.join(__dirname,'adapters/scripts/ops/maintenance-start-contract.cjs'),module={exports:{}};
  class MaintenanceDenied extends Error{constructor(code){super(code);this.code=code;}}
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,Buffer,URL,require:id=>id.includes('maintenance-state')?{MaintenanceDenied}:require(id)}, {filename:file});
  const policy=module.exports,{generation,secrets,services,networks}=require('./fixtures.cjs');
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ssb-forward-fixture-'));
  t.mock.method(fs,'chownSync',()=>{});
  const n={privateRoot:dir,stateRoot:path.join(dir,'state'),toolsRoot:dir,prefix:'ssb-native-123',options:{run:'123'},synthetic:secrets(),images:{api:'sha256:'+'1'.repeat(64),'admin-writer':'sha256:'+'1'.repeat(64),dashboard:'sha256:'+'2'.repeat(64),reporter:'sha256:'+'3'.repeat(64),widget:'sha256:'+'4'.repeat(64)},docker:'/usr/bin/docker',daemonId:'bounded-native-daemon',networks:Object.fromEntries(networks.map((k,i)=>[k,{name:'ssb-native-'+k,id:String(i+5).repeat(64),internal:true}]))};
  const g=generation(n,'release','seed',[],policy);
  for(const service of services){const c={...g.common,service,imageId:n.images[service]};policy.assertPlan(g.binding,c);
    const image={User:service==='widget'?'':'node',Cmd:policy.commands[service==='admin-writer'?'api':service],Entrypoint:service==='widget'?['/docker-entrypoint.sh']:service==='dashboard'?['docker-entrypoint.sh']:[],Env:[],Labels:{'com.ssb.maintenance-protocol':'2','com.ssb.reporter-lifecycle':'1','com.ssb.shutdown-protocol':'1'}};
    policy.assertImage([{Id:c.imageId,Os:'linux',Architecture:'amd64',Config:image}],c);policy.assertCompose(g.binding,c,g.config,image);
    const wrong=structuredClone(c);wrong.roles.runtime='postgres';assert.throws(()=>policy.assertPlan(g.binding,wrong));
    const bad=structuredClone(g.config);bad.services[service].ports=['5000:5000'];assert.throws(()=>policy.assertCompose(g.binding,c,bad,image));
    if(service==='api'){const bad=structuredClone(g.config);bad.services.api.environment.DATABASE_URL=bad.services.api.environment.DATABASE_URL.replace('ssb_runtime','postgres');assert.throws(()=>policy.assertCompose(g.binding,c,bad,image));}
    if(service==='widget')assert.throws(()=>policy.assertImage([{Id:c.imageId,Os:'linux',Architecture:'amd64',Config:{...image,User:null}}],c));
  }
  const p={id:'a'.repeat(64),name:'previous-api',imageId:n.images.api,project:'previous',service:'api'};
  const exited=[{Id:p.id,Name:'/'+p.name,Image:p.imageId,Config:{Labels:{'com.docker.compose.project':p.project,'com.docker.compose.service':'api'}},State:{Status:'exited',Running:false,Paused:false,Restarting:false,OOMKilled:false,ExitCode:137},HostConfig:{RestartPolicy:{Name:'no'}}}];
  assert.throws(()=>policy.assertPredecessor(g.binding,g.common,p,exited),e=>e.code==='predecessor_not_stopped');
});
test('native cleanup will not stop wrong identity',async()=>{
  const n=new Native(options(()=>{}));n.proc={assertClosed(){},calls:[]};n.owned=[{id:'a'.repeat(64),name:'own',image:'sha256:'+'1'.repeat(64)}];const calls=[];
  n.d=async args=>{calls.push(args);return{stdout:Buffer.from(JSON.stringify([{Id:'a'.repeat(64),Name:'/foreign',Image:'sha256:'+'2'.repeat(64),State:{Running:true}}]))};};
  await assert.rejects(n.close(true));assert.equal(calls.length,1);assert.equal(calls[0][1],'inspect');
});
test('actual process wrapper records nonzero and waits for close',async()=>{
  const {Processes}=require('./common.cjs'),dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ssb-process-proof-'));
  const p=new Processes({deadline:performance.now()+40000,privateRoot:dir});
  await assert.rejects(p.run(process.execPath,['-e','process.stderr.write("synthetic-private-marker");process.exitCode=7'],{ms:2000}));p.assertClosed();assert.equal(p.calls[0].code,7);assert.equal(p.calls[0].closed,true);assert.equal(fs.readFileSync(path.join(dir,'process-0.stderr'),'utf8'),'synthetic-private-marker');
});
test('actual process wrapper times out; timeout never becomes success',async()=>{
  const {Processes}=require('./common.cjs'),dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ssb-timeout-proof-'));
  const p=new Processes({deadline:performance.now()+40000,privateRoot:dir});
  await assert.rejects(p.run(process.execPath,['-e','setInterval(()=>{},1000)'],{ms:500}),e=>e.code==='command_timeout');p.assertClosed();assert.equal(p.calls[0].timeout,true);
});
test('resource deadline refuses child creation before reserve',async()=>{const {Processes}=require('./common.cjs');const p=new Processes({deadline:performance.now()+20000,privateRoot:'/unused'});await assert.rejects(p.run(process.execPath,['-e','process.exit(0)']));assert.equal(p.calls.length,0);});
