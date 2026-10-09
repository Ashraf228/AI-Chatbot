const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const {MaintenanceState}=require('../dist/maintenance/maintenance-state');
const {MaintenanceExecutor,composeParticipant}=require('../../../scripts/ops/maintenance-executor.cjs');
const {fixture}=require('./helpers/start-binding-fixture.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
function setup(t) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retained-recovery-')));fs.chmodSync(root,0o700);
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const binding={root,service:'synthetic',generation:'seed'},owner='a'.repeat(64);
  fs.writeFileSync(path.join(root,'runtime-state.json'),JSON.stringify({version:1,service:binding.service,generations:['seed'],epoch:0,phase:'closed',legacy:'new-empty-service',work:{}}),{mode:0o600});
  fs.mkdirSync(path.join(root,'maintenance-window'),{mode:0o700});
  fs.writeFileSync(path.join(root,'maintenance-window/owner.json'),JSON.stringify({version:1,owner}),{mode:0o600});
  return {binding,owner,state:new MaintenanceState(binding)};
}
function activate(f,generation) {
  f.state.activateGeneration(f.owner,0,generation);
  f.binding={...f.binding,generation};f.state=new MaintenanceState(f.binding);
}
function predecessors(t,f) {
  f.c.bootstrap=false;
  const records=[],inodes=new Set(),before=new Date(Date.now()-2000).toISOString(),at=new Date(Date.now()-1000).toISOString(),after=new Date().toISOString();
  f.c.predecessors=Object.entries(f.c.images).map(([service,imageId],i)=>{
    const project=`${f.binding.service}-${f.c.previousGeneration}`,name=`${project}-${service}`,id=String(i+1).repeat(64);
    const p={service,imageId,project,name,id};
    records.push({Id:id,Name:'/'+name,Image:imageId,Config:{Labels:{'com.docker.compose.project':project,'com.docker.compose.service':service}},
      State:{Status:'exited',ExitCode:0,Running:false,Paused:false,Restarting:false,OOMKilled:false,StartedAt:before,FinishedAt:after},HostConfig:{RestartPolicy:{Name:'no'}}});
    if(['api','admin-writer'].includes(service)) {
      const file=path.join(f.binding.root,`shutdown-${name}.json`);
      const bytes=Buffer.from(JSON.stringify({version:1,status:'graceful',component:service,service:f.binding.service,
        generation:f.c.previousGeneration,participant:name,imageId,remainingWork:0,poolsClosed:true,recordedAt:at,elapsedMs:100}));
      fs.writeFileSync(file,bytes,{mode:0o600});p.receipt={path:file,sha256:sha(bytes)};inodes.add(fs.statSync(file).ino);
    }
    return p;
  });
  const stat=fs.fstatSync;
  t.mock.method(fs,'fstatSync',(fd,...args)=>{const s=stat(fd,...args);if(inodes.has(s.ino))s.uid=1000;return s;});
  const execute=f.execute;
  f.execute=async(bin,args,opts)=>{
    const old=records.find(r=>r.Id===args[4]);
    if(args[2]==='container'&&args[3]==='inspect'&&old){f.calls.push({args,options:opts});return {stdout:JSON.stringify([old])};}
    return execute(bin,args,opts);
  };
  return records;
}
test('connected release -> recovery -> normal: new names, old containers retained, journal identity follows explicit activation',async t=>{
  const f=setup(t),saved=[];
  for(const generation of ['release','recovery','normal']) {
    await t.test(generation,async st=>{
    const previous=f.state;activate(f,generation);
    assert.throws(()=>previous.begin('http'),{code:'generation_retired'});
    const bound={binding:f.binding,...fixture(st,f.binding)};
    if(generation!=='release')predecessors(st,bound);
    const result=await new MaintenanceExecutor(f.binding).composeApi(f.owner,0,bound.c,bound.execute);
    assert.equal(result.predecessorsRetained,true);assert.equal(result.runtimeVerified,false);
    assert.equal(f.state.snapshot().phase,'closed');
    assert.equal(f.state.drained(f.owner,0).completed,true);
    assert.throws(()=>f.state.begin('http'),{code:'admission_closed'});
    saved.push(bound.c.containerNames.api);
    assert.equal(bound.calls.some(c=>c.args.some(a=>['--force-recreate','rm','down','restart'].includes(a))),false);
    });
  }
  assert.equal(new Set(saved).size,3);
  f.state.open(f.owner,0);
  assert.throws(()=>f.state.begin('http')); // Held owner window must still be retired explicitly.
  fs.renameSync(path.join(f.binding.root,'maintenance-window'),path.join(f.binding.root,'synthetic-released-window'));
  const work=f.state.begin('handler');f.state.end(work);
  assert.equal(f.state.snapshot().work[work].state,'completed');
});
for(const kind of ['running','uncertain','legacy','stale-owner','reused-generation'])test(`activation denied: ${kind}`,t=>{
  const f=setup(t);
  if(kind==='running'||kind==='uncertain') {
    const id=f.state.begin('configuration',undefined,f.owner,0);
    if(kind==='uncertain')f.state.end(id,true);
  }
  if(kind==='legacy') {const p=path.join(f.binding.root,'runtime-state.json'),v=JSON.parse(fs.readFileSync(p));v.legacy='unverified';fs.writeFileSync(p,JSON.stringify(v));}
  assert.throws(()=>f.state.activateGeneration(kind==='stale-owner'?'b'.repeat(64):f.owner,0,kind==='reused-generation'?'seed':'release'));
  assert.deepEqual(f.state.snapshot().generations,['seed']);
});
for(const fault of ['running','137','143','oom','receipt-missing','receipt-drift','receipt-false','wrong-image','wrong-name'])test(`predecessor denies create: ${fault}`,async t=>{
  const base=setup(t);activate(base,'release');activate(base,'recovery');
  const f={binding:base.binding,...fixture(t,base.binding)},old=predecessors(t,f),api=old[0];
  if(fault==='running'){api.State.Status='running';api.State.Running=true;}
  if(fault==='137')api.State.ExitCode=137;
  if(fault==='143')api.State.ExitCode=143;
  if(fault==='oom')api.State.OOMKilled=true;
  if(fault==='wrong-image')api.Image='sha256:'+'f'.repeat(64);
  if(fault==='wrong-name')api.Name='/unrelated';
  const p=f.c.predecessors[0];
  if(fault==='receipt-missing')fs.renameSync(p.receipt.path,p.receipt.path+'.saved');
  if(fault==='receipt-drift')fs.appendFileSync(p.receipt.path,' ');
  if(fault==='receipt-false'){const r=JSON.parse(fs.readFileSync(p.receipt.path));r.poolsClosed=false;const b=Buffer.from(JSON.stringify(r));fs.writeFileSync(p.receipt.path,b);p.receipt.sha256=sha(b);}
  const codes={running:'predecessor_not_stopped','137':'predecessor_not_stopped','143':'predecessor_shutdown_unverified',oom:'predecessor_not_stopped',
    'receipt-missing':'ENOENT','receipt-drift':'private_file_binding_changed','receipt-false':'predecessor_shutdown_unverified','wrong-image':'predecessor_not_stopped','wrong-name':'predecessor_not_stopped'};
  await assert.rejects(new MaintenanceExecutor(base.binding).composeApi(base.owner,0,f.c,f.execute),{code:codes[fault]});
  assert.equal(f.calls.some(c=>c.args.includes('create')||c.args.includes('start')),false);
});
for(const fault of ['created-empty-id','created-wrong-id','extra-network','public-port','wrong-user','missing-mount','inspect-error','start-error','running-empty-id','running-wrong-id','exited'])test(`actual retained command path: ${fault}`,async t=>{
  const base=setup(t);activate(base,'release');const f={binding:base.binding,...fixture(t,base.binding)};
  if(fault==='created-wrong-id')Object.values(f.container.NetworkSettings.Networks)[0].NetworkID='f'.repeat(64);
  if(fault==='extra-network')f.container.NetworkSettings.Networks.external={NetworkID:'f'.repeat(64)};
  if(fault==='public-port')f.container.HostConfig.PortBindings={'5000/tcp':[{HostIp:'0.0.0.0',HostPort:'5000'}]};
  if(fault==='wrong-user')f.container.Config.User='0:0';
  if(fault==='missing-mount')f.container.Mounts=[];
  const run=new MaintenanceExecutor(base.binding).composeApi(base.owner,0,f.c,async(bin,args,opts)=>{
    if(fault==='inspect-error'&&args[2]==='container'&&args[3]==='inspect')throw Error('synthetic inspect denied');
    if(fault==='start-error'&&args[2]==='container'&&args[3]==='start')throw Error('synthetic start denied');
    const result=await f.execute(bin,args,opts);
    if(args[2]==='container'&&args[3]==='inspect'&&f.container.State.Running){
      const c=JSON.parse(result.stdout);
      if(fault==='running-empty-id')Object.values(c[0].NetworkSettings.Networks)[0].NetworkID='';
      if(fault==='running-wrong-id')Object.values(c[0].NetworkSettings.Networks)[0].NetworkID='f'.repeat(64);
      if(fault==='exited'){c[0].State.Status='exited';c[0].State.Running=false;}
      result.stdout=JSON.stringify(c);
    }
    return result;
  });
  if(fault==='created-empty-id'){assert.equal((await run).commandCompleted,true);return;}
  const codes={'created-wrong-id':'container_network_invalid','extra-network':'container_network_invalid','public-port':'container_security_invalid',
    'wrong-user':'container_identity_invalid','missing-mount':'container_mount_invalid','running-empty-id':'container_network_invalid',
    'running-wrong-id':'container_network_invalid',exited:'container_identity_invalid'};
  await assert.rejects(run,codes[fault]?{code:codes[fault]}:/synthetic (inspect|start) denied/);assert.equal(base.state.snapshot().phase,'closed');
});
for(const fault of ['collision','inventory-failure','inventory-corrupt','missing-activation','fake-bootstrap'])test(`fail closed before resources: ${fault}`,async t=>{
  const base=setup(t);if(fault!=='missing-activation')activate(base,'release');
  const f={binding:base.binding,...fixture(t,base.binding)};
  if(fault==='fake-bootstrap')f.c.previousGeneration='unrelated';
  await assert.rejects(new MaintenanceExecutor(base.binding).composeApi(base.owner,0,f.c,async(bin,args,opts)=>{
    if(args[2]==='container'&&args[3]==='ls') {
      if(fault==='inventory-failure')throw Error('synthetic inventory denied');
      return {stdout:fault==='collision'?'[{"ID":"existing"}]':'not-json'};
    }
    return f.execute(bin,args,opts);
  }));assert.equal(f.calls.some(c=>c.args.includes('create')||c.args.includes('start')),false);
});

test('state-owner cleanup bounds its own subprocess and confirms exit, without claiming graceful API shutdown',async()=>{
  const {spawn}=require('node:child_process'),{once}=require('node:events');
  const {finishStateOwner}=require('../../../scripts/ops/maintenance-privileged-executor.cjs');
  const p=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.on('disconnect',()=>{});setInterval(()=>{},1000);process.send('ready')"],{stdio:['ignore','ignore','ignore','ipc']});
  const exited=once(p,'exit');await once(p,'message');
  await finishStateOwner(p,exited,performance.now()+1000);
  assert.deepEqual(await exited,[null,'SIGKILL']);
});
test('unconfirmed state-owner termination rejects inside the unchanged deadline',async()=>{
  const {finishStateOwner}=require('../../../scripts/ops/maintenance-privileged-executor.cjs');
  const signals=[],p={connected:false,exitCode:null,signalCode:null,kill:s=>signals.push(s)};
  const start=performance.now();await assert.rejects(finishStateOwner(p,new Promise(()=>{}),start+50),/state_owner_exit_unverified/);
  assert.deepEqual(signals,['SIGTERM','SIGKILL']);assert.ok(performance.now()-start<250);
});
