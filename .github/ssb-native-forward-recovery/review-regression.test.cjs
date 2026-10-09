'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {Processes}=require('./common.cjs'),{Native}=require('./native.cjs');
test('process failure retains classification, exit and stack if evidence writing also fails',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-review-process-'));
  const p=new Processes({deadline:performance.now()+40000,privateRoot:path.join(dir,'missing')});
  await assert.rejects(p.run(process.execPath,['-e','process.exit(7)'],{ms:2000}),e=>{
    assert.ok(e instanceof AggregateError);assert.equal(e.errors[0].code,'command_failed');
    assert.equal(e.errors[0].process.code,7);assert.equal(e.errors[0].process.closed,true);
    assert.match(e.errors[0].stack,/command_failed/);assert.equal(e.errors[1].code,'evidence_write_failed');return true;
  });p.assertClosed();
});
test('missing child close has a bounded uncertain outcome, never completion',async()=>{
  const child=new EventEmitter();child.unref=()=>{};
  for(const k of ['stdin','stdout','stderr']){child[k]=new EventEmitter();child[k].unref=()=>{};}
  child.stdin.end=()=>{};
  const mod={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'common.cjs'),'utf8'),{
    module:mod,exports:mod.exports,require:id=>id==='node:child_process'?{spawn:()=>child}:require(id),
    process,performance,Buffer,setTimeout,clearTimeout,AggregateError,
  });
  const p=new mod.exports.Processes({deadline:performance.now()+40000,privateRoot:'/unused'}),start=performance.now();
  await assert.rejects(p.run('synthetic',[],{ms:350}),e=>e.code==='process_completion_unverified');
  assert.ok(performance.now()-start<1000);assert.equal(p.calls[0].closed,false);assert.throws(()=>p.assertClosed());
  child.emit('close',null,'SIGKILL');assert.throws(()=>p.assertClosed());
});
test('native cleanup commands are bounded by probe and closure deadlines',async()=>{
  const n=new Native({run:'1'}),now=performance.now();n.deadline=now+100000;n.probeDeadline=now+1000;n.closureDeadline=now+800;
  let actual;n.proc={run:async(...args)=>{actual=args[2];return {};}};
  await n.command('synthetic',[],{closure:true,ms:9500});assert.equal(actual.deadline,n.closureDeadline);assert.equal(actual.ms,9500);
  n.probeDeadline=now+400;await n.command('synthetic',[],{closure:true,ms:9500});assert.equal(actual.deadline,n.probeDeadline);
});
test('cleanup keeps specific identity error rather than replacing it',async()=>{
  const n=new Native({run:'1'});n.proc={assertClosed(){},calls:[]};
  n.owned=[{id:'a'.repeat(64),name:'own',image:'sha256:'+'1'.repeat(64)}];
  n.d=async()=>({stdout:Buffer.from(JSON.stringify([{Id:'a'.repeat(64),Name:'/wrong',Image:'sha256:'+'1'.repeat(64)}]))});
  await assert.rejects(n.close(true),e=>e instanceof AggregateError&&e.errors.some(x=>x.code==='cleanup_identity_unverified'));
});
test('pre-existing named volumes fail before network or mount creation',async()=>{
  const n=new Native({run:'1'});n.prefix='ssb-native-1';n.initial={volumes:['ssb-native-1-postgres-data']};let called=0;
  n.d=async()=>{called++;throw Error('must not run');};
  await assert.rejects(n.initialize(),e=>e.code==='preexisting_volume_forbidden');assert.equal(called,0);
});
for(const preexisting of [true,false])test('unresolved unowned container is never stopped; preexisting='+preexisting,async()=>{
  const n=new Native({run:'1'}),id='a'.repeat(64),image='sha256:'+'b'.repeat(64);n.initial={containers:preexisting?[id]:[]};
  n.proc={assertClosed(){},calls:[]};n.owned=[{id:null,name:'conflict',image,role:'redis'}];const calls=[];
  n.d=async args=>{calls.push(args);return{stdout:Buffer.from(JSON.stringify([{Id:id,Name:'/conflict',Image:image,Config:{Labels:{}},State:{Running:true}}]))};};
  await assert.rejects(n.close(true));assert.equal(calls.length,1);assert.equal(calls[0][1],'inspect');
});
test('work-output exhaustion leaves an independent bounded closure allowance',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-review-output-')),p=new Processes({deadline:performance.now()+40000,privateRoot:dir});
  p.workBytes=28*1024*1024;p.bytes=p.workBytes;
  await assert.rejects(p.run(process.execPath,['-e','process.stdout.write("bounded")'],{ms:2000}),e=>e.code==='output_limit');
  const result=await p.run(process.execPath,['-e','process.stdout.write("inspect")'],{ms:2000,closure:true});assert.equal(result.stdout.toString(),'inspect');p.assertClosed();
  p.closureBytes=4*1024*1024;await assert.rejects(p.run(process.execPath,['-e','process.stdout.write("over")'],{ms:2000,closure:true}),e=>e.code==='output_limit');
});
test('lost raw storage does not block identity-verified stop but keeps closure failed',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-review-cleanup-')),n=new Native({run:'1'}),id='a'.repeat(64),image='sha256:'+'b'.repeat(64);
  n.initial={containers:[]};n.proc=new Processes({deadline:n.deadline,privateRoot:path.join(dir,'missing')});n.owned=[{id,name:'own',image,role:'redis'}];let running=true,stops=0;
  n.d=async(args,options)=>{if(args[0]==='stop'){running=false;stops++;}const output=args[0]==='stop'?id:JSON.stringify([{Id:id,Name:'/own',Image:image,Config:{Labels:{'com.ssb.native-run':'1'}},State:{Running:running,Status:running?'running':'exited',OOMKilled:false,ExitCode:0}}]);return n.command(process.execPath,['-e',`process.stdout.write(${JSON.stringify(output)})`],options);};
  await assert.rejects(n.close(true),e=>e instanceof AggregateError&&e.errors.every(x=>x.code==='evidence_write_failed'));
  assert.equal(stops,1);assert.equal(running,false);assert.equal(n.closed,false);n.proc.assertClosed();
});
test('private diagnostic retains cause codes and safe process fields, not messages or argv',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-review-private-')),n=new Native({run:'1'});n.privateRoot=dir;fs.mkdirSync(path.join(dir,'raw'),{mode:0o700});
  const e=Error('SYNTHETIC_SECRET_MARKER');e.code='command_failed';e.process={code:7,closed:true,argv:['SYNTHETIC_SECRET_MARKER']};
  await n.recordFailure(new AggregateError([e,Error('SYNTHETIC_SECRET_MARKER')],'SYNTHETIC_SECRET_MARKER'));
  const file=path.join(dir,'raw/failure.json'),bytes=fs.readFileSync(file,'utf8'),r=JSON.parse(bytes);
  assert.doesNotMatch(bytes,/SYNTHETIC_SECRET_MARKER|argv/);assert.equal(r.failure.causes[0].code,'command_failed');assert.equal(r.failure.causes[0].process.code,7);assert.equal(fs.statSync(file).mode&511,384);
  await assert.rejects(n.recordFailure(e),e=>e.code==='EEXIST');
});
