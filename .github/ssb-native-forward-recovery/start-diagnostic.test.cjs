'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm'),{createRequire}=require('node:module');
const metadata=service=>({User:service==='widget'?'':'node',Cmd:service==='dashboard'?['node','app/server.js']:service==='reporter'?['node','dist/main.js','weekly']:service==='widget'?['nginx','-g','daemon off;']:['node','dist/main.js'],Entrypoint:service==='dashboard'?['docker-entrypoint.sh']:service==='widget'?['/docker-entrypoint.sh']:[],Env:[],Labels:{'com.ssb.maintenance-protocol':'2','com.ssb.shutdown-protocol':'1','com.ssb.reporter-lifecycle':'1'}});

// This branch is a test-only preload. Every Docker/network transport is denied or simulated.
if(process.env.SSB_START_OFFLINE_CHILD){
 const cfg=JSON.parse(process.env.SSB_START_OFFLINE_CHILD),Module=require('node:module'),EventEmitter=require('node:events');
 const stateOwner=process.argv[2]==='state-owner',fault=cfg.fault||'';
 const error=(code,name='Error')=>Object.assign(new Error('SYNTHETIC_PRIVATE_DO_NOT_EXPORT'),{code,name});
 const event=(kind,value)=>fs.appendFileSync(cfg.events,JSON.stringify({kind,value,stateOwner})+'\n');
 process.getuid=()=>stateOwner?1000:0;process.getgid=()=>1000;process.getgroups=()=>[1000];
 const open=fs.openSync,fstat=fs.fstatSync,lstat=fs.lstatSync,access=fs.accessSync,write=fs.writeSync;const descriptors=new Map();
 fs.openSync=(p,...a)=>{if(fault==='plan-access'&&p===cfg.plan)throw error('EACCES');const fd=open(p,...a);descriptors.set(fd,p);return fd;};
 fs.fstatSync=(fd,...a)=>{const s=fstat(fd,...a),p=descriptors.get(fd);s.uid=stateOwner||cfg.userFiles.includes(p)?1000:0;return s;};
 fs.lstatSync=(p,...a)=>{if(fault==='entry-access'&&p===cfg.entry)throw error('EACCES');const s=lstat(p,...a);s.uid=p===cfg.stateRoot?1000:0;return s;};
 fs.accessSync=(p,...a)=>access(p,...a);
 fs.writeSync=(fd,data,...a)=>{
  if(fault==='diagnostic-write'&&fd===2)throw error('ENOSPC');
  if(fault==='success-write'&&fd===1)throw error('ENOSPC');
  if(fault==='truncated'&&typeof data==='string'&&data.startsWith('SSB_START_'))data=data.slice(0,-4);
  if(fault==='misbound'&&typeof data==='string'&&data.startsWith('SSB_START_'))data=data.replace(/"call":"[a-f0-9]{64}"/,'"call":"'+'f'.repeat(64)+'"');
  return write(fd,data,...a);
 };
 class MaintenanceDenied extends Error{constructor(code){super(code);this.name='MaintenanceDenied';this.code=code;}}
 class MaintenanceState{
  drained(){event('state','drained');if(fault==='state-begin')throw new MaintenanceDenied('admission_closed');}
  activateGeneration(_o,_e,g){return g;}
  assertDeployment(_owner,_epoch,previous,bootstrap){
   event('state','check');
   if(previous!==cfg.previousGeneration||bootstrap!==cfg.bootstrap)throw error('ERR_ASSERTION');
   event('deployment-binding',{previous,bootstrap});
   if(fault==='state-check')throw new MaintenanceDenied('generation_retired');
   if(this.begun){
    event('state','ipc-check-after-begin');
    const started=fs.readFileSync(cfg.events,'utf8').trim().split('\n').map(JSON.parse).some(e=>e.kind==='start-complete');
    if(['state-check-late','state-check-accounting'].includes(fault)||fault==='state-check-after-id'&&started){
     event('state','ipc-check-denied');throw new MaintenanceDenied('generation_retired');
    }
   }
  }
  begin(){event('state','begin');this.begun=true;return 'synthetic-work';}
  end(_w,uncertain){event('state',uncertain?'uncertain':'complete');if(['accounting','start-and-accounting','state-check-accounting'].includes(fault))throw error('EIO');}
 }
 const originalLoad=Module._load;
 Module._load=function(id,parent,...rest){
  if(/maintenance-state$/.test(id))return{MaintenanceState,MaintenanceDenied};
  if(id==='./maintenance-executor.cjs'&&fault==='module-missing')throw error('MODULE_NOT_FOUND');
  if(id==='./maintenance-executor.cjs'&&fault==='module-type')throw new TypeError('SYNTHETIC_PRIVATE_DO_NOT_EXPORT');
  return originalLoad.call(this,id,parent,...rest);
 };
 const fork=cp.fork;
 cp.fork=(file,args,options)=>{
  if(file!==cfg.entry||JSON.stringify(args)!=='["state-owner"]')throw error('UNAUTHORIZED_PROCESS');
  return fork(file,args,{...options,uid:undefined,gid:undefined,execArgv:['--require',__filename],env:{...options.env,SSB_START_OFFLINE_CHILD:process.env.SSB_START_OFFLINE_CHILD}});
 };
 for(const id of ['node:net','node:tls','node:http','node:https','node:dgram']){const m=require(id);for(const method of ['connect','createConnection','request','get','createSocket'])if(typeof m[method]==='function')m[method]=()=>{throw error('NETWORK_NOT_AUTHORIZED');};}
 cp.spawn=()=>{throw error('UNAUTHORIZED_PROCESS');};cp.exec=()=>{throw error('UNAUTHORIZED_PROCESS');};cp.execSync=()=>{throw error('UNAUTHORIZED_PROCESS');};
 let container;
 const fake=async(bin,args,options)=>{
  if(bin!=='/usr/bin/docker'||args[0]!=='--host'||args[1]!=='unix:///var/run/docker.sock')throw error('DOCKER_NOT_AUTHORIZED');
  const a=args.slice(2),p=JSON.parse(fs.readFileSync(cfg.plan)),c=p.contract;event('docker',a[0]==='compose'?a.includes('config')?'compose-config':'create':a.slice(0,2).join(':'));
  if(options.timeout>10000||options.timeout<=0)throw error('TIMEOUT_INVALID');
  const config=JSON.parse(fs.readFileSync(c.files[0].path).toString().replace(/\$\$/g,'$')),service=c.service,s=config.services[service],image=metadata(service);
  const base={Id:cfg.containerId||'d'.repeat(64),Name:'/'+c.containerNames[service],Image:c.imageId,Config:{User:s.user,Cmd:s.command||image.Cmd,Entrypoint:image.Entrypoint,Labels:{...s.labels,'com.docker.compose.project':c.project,'com.docker.compose.service':service},Env:Object.entries(s.environment||{}).map(([k,v])=>`${k}=${v}`)},State:{Status:'created',Running:false,Paused:false,Restarting:false,OOMKilled:false,Dead:false,Error:'',Pid:0,ExitCode:0,StartedAt:'0001-01-01T00:00:00Z',FinishedAt:'0001-01-01T00:00:00Z'},RestartCount:0,HostConfig:{Privileged:false,ReadonlyRootfs:!!s.read_only,RestartPolicy:{Name:'no'},SecurityOpt:s.security_opt,CapDrop:s.cap_drop||[],NetworkMode:c.networks[c.serviceNetworks[service][0]].name,Tmpfs:Object.fromEntries((s.tmpfs||[]).map(x=>[x.slice(0,x.indexOf(':')),x.slice(x.indexOf(':')+1)]))},Mounts:(s.volumes||[]).map(v=>({Type:'bind',Source:v.source,Destination:v.target,RW:!v.read_only,Propagation:'rprivate'})),NetworkSettings:{Networks:Object.fromEntries(c.serviceNetworks[service].map(k=>[c.networks[k].name,{NetworkID:''}]))}};
  let result;
  if(a[0]==='info'){if(fault==='daemon-json')return{stdout:'{'};result={ID:fault==='daemon'?'wrong':c.daemonId,OSType:'linux',Architecture:'amd64'};}
  else if(a[0]==='image'){if(fault==='image')image.User='0';result=[{Id:c.imageId,Os:'linux',Architecture:'amd64',Config:image}];}
  else if(a[0]==='network'){const n=Object.values(c.networks).find(n=>n.id===a[2]);result=[{Id:n.id,Name:n.name,Internal:fault!=='network',Driver:'bridge',Scope:'local'}];}
  else if(a.includes('config')){if(fault==='compose')config.services.api.ports=['5000:5000'];result=config;}
  else if(a[0]==='container'&&a[1]==='ls'){if(fault==='inventory')throw error('EACCES');return{stdout:fault==='inventory-json'?'{':fault==='collision'?'[{}]':''};}
  else if(a.includes('create')){if(fault==='create')throw error('EACCES');container=base;return{stdout:''};}
  else if(a[0]==='container'&&a[1]==='inspect'){
   const predecessor=c.predecessors.find(p=>p.id===a[2]);
   if(predecessor){
    event('predecessor-inspect',predecessor.id);
    const prior=structuredClone(cfg.predecessorStates[predecessor.id]);
    if(fault==='predecessor'&&predecessor.service==='api'){prior.State.Status='running';prior.State.Running=true;}
    return{stdout:JSON.stringify([prior])};
   }
   if(!container||fault==='created-inspect'&&!container.State.Running)throw error('EIO');
   result=[structuredClone(container)];if(fault==='created-identity'&&!container.State.Running)result[0].Image='sha256:'+'f'.repeat(64);
   if(fault==='running-identity'&&container.State.Running)result[0].Id='e'.repeat(64);
  }else if(a[0]==='container'&&a[1]==='start'){
   if(['start','start-and-accounting','diagnostic-write'].includes(fault))throw error('EACCES');
   container.State.Status='running';container.State.Running=true;for(const k of c.serviceNetworks[service])container.NetworkSettings.Networks[c.networks[k].name].NetworkID=c.networks[k].id;
   if(fault==='delayed')await new Promise(r=>setTimeout(r,40));event('start-complete',container.Id);return{stdout:''};
  }else throw error('DOCKER_NOT_AUTHORIZED');
  return{stdout:JSON.stringify(result)};
 };
 const exec=(bin,args,options,callback)=>{const promise=fake(bin,args,options);if(callback)promise.then(r=>callback(null,r.stdout,''),e=>callback(e));return new EventEmitter();};
 exec[require('node:util').promisify.custom]=fake;cp.execFile=exec;
}else{
 const test=require('node:test'),assert=require('node:assert/strict'),{Native}=require('./native.cjs'),{sha,Processes}=require('./common.cjs'),{startProtocol,startArgs,publicFailure}=require('./diagnostics.cjs'),{main,SOURCE}=require('./controller.cjs'),{parseReceipts}=require('./evidence.cjs');
 assert.equal(process.version,'v24.17.0');const proto=startProtocol(),id='d'.repeat(64),publication=sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),opts={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};
 function load(name,replacements={},tail=''){
  const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname:path.dirname(file),__filename:file,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};
  vm.compileFunction(fs.readFileSync(file,'utf8')+tail,Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;
 }
 const {nativeEvidence}=load('offline.test.cjs',{'node:test':()=>{}},'\nmodule.exports={nativeEvidence};');
 const {receiver}=load('init-diagnostic.test.cjs',{'node:test':()=>{}},'\nmodule.exports={receiver};');
 const error=(code='EIO')=>Object.assign(new Error('SYNTHETIC_PRIVATE_DO_NOT_EXPORT'),{code});
 function setup(t,fault='',key='release'){
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ssb-start-offline-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const toolsRoot=path.join(root,'host-tools');fs.cpSync(path.join(__dirname,'adapters'),toolsRoot,{recursive:true});fs.mkdirSync(path.join(root,'raw'));fs.mkdirSync(path.join(root,'state'),{mode:0o700});fs.mkdirSync(path.join(root,'state/maintenance-window'),{mode:0o700});
  fs.writeFileSync(path.join(root,'state/maintenance-window/owner.json'),JSON.stringify({owner:'s'.repeat(64)}),{mode:0o600});
  const fakeFS={...fs,chownSync(){}};const f=load('fixtures.cjs',{'node:fs':fakeFS});
  const C=load('native.cjs',{'./fixtures.cjs':f}).Native,n=new C(opts);
  Object.assign(n,{privateRoot:root,stateRoot:path.join(root,'state'),toolsRoot,prefix:'ssb-native-'+opts.run,docker:'/usr/bin/docker',daemonId:'synthetic-bound-daemon',synthetic:f.secrets(),images:{api:'sha256:'+'1'.repeat(64),'admin-writer':'sha256:'+'1'.repeat(64),dashboard:'sha256:'+'2'.repeat(64),reporter:'sha256:'+'3'.repeat(64),widget:'sha256:'+'4'.repeat(64)},networks:Object.fromEntries(f.networks.map((k,i)=>[k,{name:'ssb-native-'+k,id:String(i+5).repeat(64),internal:true}])),initial:{containers:[]},verifiedPublicationManifest:publication});n.synthetic.owner='s'.repeat(64);n.resources=()=>{};
  class MaintenanceDenied extends Error{constructor(code){super(code);this.code=code;}}
  const policy=load('adapters/scripts/ops/maintenance-start-contract.cjs',{'../../apps/api/dist/maintenance/maintenance-state':{MaintenanceDenied}});
  const predecessorStates={};
  if(key==='forward'){
   const previous=f.generation(n,'release','seed',[],policy);
   n.previousGeneration='release';
   n.previous=f.services.map(service=>{
    const p={service,id:sha('release-predecessor-'+service),imageId:n.images[service],name:previous.names[service],project:previous.project};
    const startedAt='2026-10-10T00:00:00Z',recordedAt='2026-10-10T00:00:01Z',finishedAt='2026-10-10T00:00:02Z';
    if(['api','admin-writer'].includes(service)){
     const bytes=JSON.stringify({version:1,status:'graceful',component:service,service:n.prefix,generation:'release',participant:p.name,imageId:p.imageId,remainingWork:0,poolsClosed:true,elapsedMs:1000,recordedAt});
     p.receipt={path:path.join(n.stateRoot,'shutdown-'+p.name+'.json'),sha256:sha(bytes)};fs.writeFileSync(p.receipt.path,bytes,{mode:0o600});
    }
    predecessorStates[p.id]={Id:p.id,Name:'/'+p.name,Image:p.imageId,Config:{Labels:{'com.docker.compose.project':p.project,'com.docker.compose.service':service}},HostConfig:{RestartPolicy:{Name:'no'}},State:{Status:'exited',Running:false,Paused:false,Restarting:false,OOMKilled:false,ExitCode:0,StartedAt:startedAt,FinishedAt:finishedAt}};
    return p;
   });
  }
  n.current=f.generation(n,key,n.previousGeneration,n.previous,policy);const c={...n.current.common,service:'api',imageId:n.images.api};
  const plan=path.join(root,'plan.json'),b=n.startBinding('participant-helper','api',key);fs.writeFileSync(plan,fault==='plan-json'?'{':JSON.stringify({version:1,action:b.action,uid:1000,gid:1000,epoch:0,ownerSha256:sha(n.synthetic.owner),timeoutMs:10000,binding:n.current.binding,contract:c}),{mode:0o600});
  const entry=path.join(toolsRoot,'scripts/ops/maintenance-privileged-executor.cjs'),events=path.join(root,'events.jsonl');fs.writeFileSync(events,'');
  const cfg={fault,entry,plan,stateRoot:n.stateRoot,events,previousGeneration:c.previousGeneration,bootstrap:c.bootstrap,predecessorStates,userFiles:[...Object.values(c.mountFiles).map(x=>x.path),...c.predecessors.filter(p=>p.receipt).map(p=>p.receipt.path)]};
  const fakeChild={...cp,spawn(bin,args,o){assert.equal(bin,process.execPath);assert.deepEqual(args,startArgs(entry,plan,b));return cp.spawn(bin,args,{...o,env:{...o.env,NODE_OPTIONS:'--require '+JSON.stringify(__filename),SSB_START_OFFLINE_CHILD:JSON.stringify(cfg)}});}};
  const P=load('common.cjs',{'node:child_process':fakeChild,'node:fs':{...fs,writeFileSync(p,...a){if(fault==='raw-write'&&String(p).includes('/raw/'))throw error('ENOSPC');return fs.writeFileSync(p,...a);}}}).Processes;
  n.proc=new P({deadline:n.deadline,privateRoot:path.join(root,'raw')});const e={name:n.current.names.api,image:n.images.api,id:null,role:'api',generation:key,project:n.current.project,startRequested:true};
  return{root,n,e,c,entry,plan,b,cfg,events,f,C};
 }
 async function invoke(t,fault=''){
  const h=setup(t,fault);if(fault==='entry-missing')fs.renameSync(h.entry,h.entry+'.retained');
  let result,failure;try{result=await h.n.privilegedStart(h.plan,h.b,h.e);}catch(e){failure=e;}
  h.n.proc.assertClosed();const publicError=failure?publicFailure(failure):null;
  assert.doesNotMatch(JSON.stringify(publicError),/SYNTHETIC_PRIVATE|ssb-start-offline|postgresql:|ownerSha256/);
  return{...h,result,failure,publicError,eventsRead:fs.readFileSync(h.events,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)};
 }
 function diagnosis(e){if(e?.startDiagnostic)return e.startDiagnostic;for(const c of Array.isArray(e?.errors)?e.errors:e?.cause?[e.cause]:[]){const found=diagnosis(c);if(found)return found;}}
 for(const fault of ['', 'delayed'])test('actual Node launcher -> helper -> IPC owner -> compose adapter -> process: '+(fault||'success'),async t=>{
  const h=await invoke(t,fault);assert.equal(h.failure,undefined,JSON.stringify(h.publicError));assert.equal(h.result.startDiagnostic.ok,true);assert.equal(h.e.id,id);assert.equal(h.result.startDiagnostic.resource.state,'running_verified');
  assert.equal(h.eventsRead.filter(e=>e.kind==='docker'&&e.value==='create').length,1);assert.equal(h.eventsRead.filter(e=>e.kind==='docker'&&e.value==='container:start').length,1);assert.equal(h.eventsRead.filter(e=>e.kind==='start-complete').length,1);assert.ok(h.eventsRead.some(e=>e.kind==='state'&&e.value==='complete'));
 });
 const cases=[['entry-missing','entry-access','ENOENT',false],['entry-access','entry-access','EACCES',false],['module-missing','module-load','MODULE_NOT_FOUND',false],['module-type','module-load','unknown',false],['plan-json','plan-read','unknown',false],['plan-access','plan-read','EACCES',false],['state-begin','state-begin','admission_closed',false],['state-check','state-begin','generation_retired',false],['daemon-json','daemon','unknown',false],['daemon','daemon','daemon_binding_invalid',false],['image','image','image_user_invalid',false],['network','network','network_identity_invalid',false],['compose','compose-config','start_ports_invalid',false],['inventory','name-inventory','EACCES',false],['inventory-json','name-inventory','unknown',false],['collision','name-inventory','container_name_not_fresh',false],['create','create','EACCES',false],['created-inspect','created-inspect','EIO',false],['created-identity','created-inspect','container_identity_invalid',false],['start','start','EACCES',true],['running-identity','running-inspect','container_identity_invalid',true],['accounting','accounting','EIO',true],['success-write','output','ENOSPC',true],['raw-write',null,null,true]];
 for(const [fault,step,code,retained]of cases)test('actual process preserves fail-closed diagnosis: '+fault,async t=>{
  const h=await invoke(t,fault);assert.ok(h.failure);const d=diagnosis(h.failure);assert.ok(d);assert.equal(h.e.id,retained?id:null);
  if(step){assert.equal(d.primary.step,step);assert.equal(d.primary.code,code);assert.equal(d.ok,false);}else assert.equal(h.publicError.code,'evidence_write_failed');
  assert.ok(h.n.proc.calls.every(x=>x.closed));assert.equal(h.n.proc.calls.length,1);
 });
 test('primary start failure survives additional accounting failure',async t=>{const h=await invoke(t,'start-and-accounting'),d=diagnosis(h.failure);assert.equal(d.primary.step,'start');assert.equal(d.primary.code,'EACCES');assert.ok(d.cleanup.some(x=>x.step==='accounting'&&x.code==='EIO'));assert.equal(h.e.id,id);});
 for(const fault of ['diagnostic-write','truncated','misbound'])test('missing/damaged/misbound actual child output remains failure: '+fault,async t=>{const h=await invoke(t,fault);assert.ok(h.failure);assert.equal(h.e.id,null);assert.match(JSON.stringify(h.publicError),/start_diagnostic_(missing|invalid|misbound)/);});
 test('valid helper error travels through actual controller, receipts and regular receiver',async t=>{
  const h=await invoke(t,'start'),lines=[],values=nativeEvidence();h.n.execute=async phase=>{if(phase==='release-start')throw h.failure;return{verified:true,...values[phase]};};h.n.close=async()=>({verified:true,counts:[0]});
  // Use a failed closure rather than claim no resources after a started participant.
  h.n.close=async()=>{const e=new Error('SYNTHETIC_PRIVATE');e.publicReceipt={counts:[],ids:[],detail:{outcomes:[]}};throw e;};
  await assert.rejects(main({...opts,output:l=>lines.push(l)},h.n));assert.equal(parseReceipts(lines.join('\n'),opts.run,SOURCE,opts,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
  const r=receiver(lines.join('\n'));r.invoke();assert.equal(JSON.parse(r.output[0]).status,'PARTIAL_FAILURE_RECEIVED');assert.throws(()=>receiver(lines.join('\n'),{badManifest:true}).invoke());assert.throws(()=>receiver(lines.join('\n'),{writeFailure:'receipts.txt'}).invoke());
 });
 test('wire schema rejects extra fields, truncation, duplicates and unrelated bindings',()=>{
  const n=new Native(opts);n.verifiedPublicationManifest=publication;const b=n.startBinding('participant-helper','api','release'),p=new proto.Progress(b);p.capture(error('EACCES'));const d=p.result(false),good=Buffer.from(proto.marker+JSON.stringify(d)+'\n');assert.deepEqual(proto.decode(good,b,false),d);
  for(const bytes of [Buffer.alloc(0),good.subarray(0,20),Buffer.concat([good,good]),Buffer.from('x'.repeat(4097)),Buffer.from(proto.marker+JSON.stringify({...d,private:'secret'})+'\n')])assert.throws(()=>proto.decode(bytes,b,false));
  for(const key of ['run','call','publication','source','service','generation','action','phase']){const v=structuredClone(d);v.binding[key]=key==='call'||key==='publication'?'f'.repeat(64):'different';assert.throws(()=>proto.validate(v,b));}
  for(const extra of [{operation:null},{start:null},{operation:b,start:null}])assert.throws(()=>require('./diagnostics.cjs').validateFailure({code:'unclassified',process:null,state:null,causes:[],...extra}));
 });
 test('historical actual CLI loses start detail; corrected launcher retains it without reproducing a native cause',async t=>{
  const h=setup(t,'start'),old=path.resolve(__dirname,'../../../../ssb-postgres-readiness-followup-20261010.TDO7TA/publication/.github/ssb-native-forward-recovery/adapters/scripts/ops');
  for(const name of ['maintenance-executor.cjs','maintenance-privileged-executor.cjs'])fs.copyFileSync(path.join(old,name),path.join(path.dirname(h.entry),name));
  const r=cp.spawnSync(process.execPath,[h.entry,h.plan],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH,NODE_OPTIONS:'--require '+JSON.stringify(__filename),SSB_START_OFFLINE_CHILD:JSON.stringify(h.cfg)}});
  assert.equal(r.status,1);assert.equal(r.signal,null);assert.equal(r.stdout,'');assert.equal(r.stderr,'privileged_operation_failed\n');
  const after=await invoke(t,'start');assert.equal(diagnosis(after.failure).primary.code,'EACCES');assert.equal(diagnosis(after.failure).primary.step,'start');assert.equal(after.e.id,id);
 });
 test('deadline and signalled process never accept an otherwise valid helper envelope',async t=>{
  const h=setup(t),p=new proto.Progress(h.b);p.observe('running_verified',id);const wire=proto.successMarker+JSON.stringify(p.result(true))+'\n';
  const E=require('node:events').EventEmitter,child=new E();child.stdout=new E();child.stderr=new E();child.stdin=new E();child.stdin.end=()=>queueMicrotask(()=>{child.stdout.emit('data',Buffer.from(wire));child.emit('close',137,'SIGKILL');});
  const P=load('common.cjs',{'node:child_process':{spawn(){return child;}}}).Processes,proc=new P({deadline:performance.now()+40000,privateRoot:path.join(h.root,'raw')});
  await assert.rejects(proc.run(process.execPath,startArgs(h.entry,h.plan,h.b),{startDiagnostic:{entry:h.entry,plan:h.plan,binding:h.b}}),e=>{assert.equal(e.code,'command_failed');assert.equal(e.startDiagnostic,undefined);assert.equal(e.process.signal,'SIGKILL');assert.equal(e.startOperation.call,h.b.call);return true;});proc.assertClosed();
  const expired=new P({deadline:performance.now()+30000,privateRoot:h.root});await assert.rejects(expired.run(process.execPath,startArgs(h.entry,h.plan,h.b),{startDiagnostic:{entry:h.entry,plan:h.plan,binding:h.b}}),e=>e.code==='deadline');assert.equal(expired.calls.length,0);
 });
 function generationHarness(t,{fault='',key='release',readiness=3,closureFault='',writeFailure=false}={}){
  const h=setup(t,'',key),calls=[],operations=[],stopped=new Set(),stateCalls=[];
  const fds=new Map(),model={...fs,openSync(p,...a){const fd=fs.openSync(p,...a);fds.set(fd,p);return fd;},fstatSync(fd){const s=fs.fstatSync(fd);s.uid=h.cfg.userFiles.includes(fds.get(fd))?1000:0;return s;},lstatSync(p){const s=fs.lstatSync(p);s.uid=p===h.n.stateRoot?1000:0;return s;}};
  class MaintenanceDenied extends Error{constructor(code){super(code);this.code=code;}}
  const policy=load('adapters/scripts/ops/maintenance-start-contract.cjs',{'node:fs':model,'../../apps/api/dist/maintenance/maintenance-state':{MaintenanceDenied}});
  const C=load('native.cjs',{'./fixtures.cjs':{...h.f,generation(n,g,previous,predecessors){assert.equal(g,key);assert.equal(previous,h.c.previousGeneration);assert.deepEqual(predecessors,h.c.predecessors);return n.current;}},[path.join(h.n.toolsRoot,'scripts/ops/maintenance-start-contract.cjs')]:policy}).Native;
  Object.setPrototypeOf(h.n,C.prototype);
  h.n.imageMetadata=Object.fromEntries(['api','dashboard','reporter','widget'].map(s=>[s,{Id:h.n.images[s],Os:'linux',Architecture:'amd64',Config:metadata(s)}]));
  const syntheticChild=(stdout='',code=0)=>{const E=require('node:events').EventEmitter,c=new E();c.stdout=new E();c.stderr=new E();c.stdin=new E();c.stdin.end=()=>queueMicrotask(()=>{if(stdout)c.stdout.emit('data',Buffer.from(stdout));c.emit('close',code,null);});return c;};
  const transport={spawn(bin,args,o){
   calls.push({bin,args});
   if(bin===process.execPath){
    const b=JSON.parse(args.at(-1)),plan=args.at(-2);assert.deepEqual(args,startArgs(h.entry,plan,b));operations.push({binding:b,index:h.n.proc.calls.length-1});
    const cfg={...h.cfg,plan,containerId:sha(b.service),fault:b.service==='api'?fault==='helper'?'start':fault==='accounting'?'accounting':['state-check-late','state-check-accounting','state-check-after-id','predecessor'].includes(fault)?fault:'':''};
    return cp.spawn(bin,args,{...o,env:{...o.env,NODE_OPTIONS:'--require '+JSON.stringify(__filename),SSB_START_OFFLINE_CHILD:JSON.stringify(cfg)}});
   }
   assert.equal(bin,'/usr/bin/docker');assert.deepEqual(args.slice(0,2),['--host','unix:///var/run/docker.sock']);const a=args.slice(2);
   if(a[0]==='exec')return syntheticChild();
   if(a[0]==='container'&&a[1]==='ls')return syntheticChild(h.n.owned.map(e=>e.id).join('\n'));
   if(a[0]==='stop'){assert.equal(a[1],'--time');assert.equal(a[2],'8');assert.ok(h.n.owned.some(e=>e.id===a[3]));stopped.add(a[3]);return syntheticChild();}
   assert.deepEqual(a.slice(0,2),['container','inspect']);const entry=h.n.owned.find(e=>e.name===a[2]||e.id===a[2]);assert.ok(entry);
   const closing=!!h.n.closureDeadline;
   if(closing&&entry.id===null&&['state-check-late','state-check-accounting','predecessor'].includes(fault))return syntheticChild('',1);
   if(closing&&closureFault==='inspect'||!closing&&entry.role==='api'&&fault==='postinspect')return syntheticChild('',1);
   const x={Id:sha(entry.role),Name:'/'+entry.name,Image:entry.image,RestartCount:0,Config:{Labels:{'com.ssb.native-run':opts.run,'com.docker.compose.project':entry.project,'com.docker.compose.service':entry.role}},State:{Status:stopped.has(entry.id)?'exited':'running',Running:!stopped.has(entry.id),Paused:false,Restarting:false,Dead:false,OOMKilled:false,Error:'',Pid:stopped.has(entry.id)?0:123,ExitCode:stopped.has(entry.id)&&closureFault==='137'?137:0,StartedAt:'2026-10-10T00:00:00Z',FinishedAt:stopped.has(entry.id)?'2026-10-10T00:00:01Z':'0001-01-01T00:00:00Z'}};
   if(!closing&&entry.role==='api'&&fault==='postidentity')x.Id='f'.repeat(64);
   if(closing){if(closureFault==='id')x.Id='f'.repeat(64);if(closureFault==='name')x.Name='/foreign';if(closureFault==='image')x.Image='sha256:'+'f'.repeat(64);if(closureFault==='run')x.Config.Labels['com.ssb.native-run']='87654321';if(closureFault==='project')x.Config.Labels['com.docker.compose.project']='foreign';if(closureFault==='service')x.Config.Labels['com.docker.compose.service']='foreign';}
   return syntheticChild(JSON.stringify([x]));
  }};
  const P=load('common.cjs',{'node:child_process':transport,'node:fs':{...fs,writeFileSync(p,...a){if(writeFailure&&h.n.closureDeadline)throw error('ENOSPC');return fs.writeFileSync(p,...a);}}}).Processes;
  h.n.proc=new P({deadline:h.n.deadline,privateRoot:path.join(h.root,'raw')});
  // Prior successful readiness process records only affect indices, never the bound operation.
  h.n.proc.calls=Array.from({length:readiness},(_,index)=>({index,closed:true,code:0,timeout:false}));
  h.n.probe=async action=>{assert.ok(['closed-ready','retired-admission'].includes(action));return{verified:true};};
  h.n.state=async action=>{stateCalls.push(action);assert.ok(['snapshot','open'].includes(action));return{phase:'closed',work:{}};};
  return{...h,calls,operations,stopped,stateCalls};
 }
 for(const readiness of [3,4])test('unchanged full startGeneration with '+readiness+' readiness records awaits all five real helper processes',async t=>{
  const h=generationHarness(t,{readiness}),result=await h.n.startGeneration('release');assert.deepEqual(result.counts,[5,5,0]);assert.equal(h.operations.length,6);assert.equal(h.operations[0].binding.operation,'activation-helper');assert.equal(h.operations[1].index,readiness+1);assert.deepEqual(h.stateCalls,['snapshot','open']);assert.equal(h.n.owned.length,5);assert.ok(h.n.owned.every(e=>e.id===sha(e.role)));h.n.proc.assertClosed();
 });
 test('forward entry verifies five retained release predecessors through every actual participant helper',async t=>{
  const h=generationHarness(t,{key:'forward'}),r=await h.n.startGeneration('forward');
  assert.equal(h.c.bootstrap,false);assert.equal(h.c.previousGeneration,'release');assert.equal(h.c.predecessors.length,5);
  assert.deepEqual(h.c.predecessors.map(p=>p.service),h.f.services);assert.equal(h.c.predecessors.filter(p=>p.receipt).length,2);
  assert.deepEqual(r.counts,[5,5,8]);assert.ok(h.operations.every(x=>x.binding.generation==='forward'));
  const events=fs.readFileSync(h.events,'utf8').trim().split('\n').map(JSON.parse);
  for(const p of h.c.predecessors)assert.equal(events.filter(e=>e.kind==='predecessor-inspect'&&e.value===p.id).length,15);
  assert.ok(events.filter(e=>e.kind==='deployment-binding').every(e=>e.value.previous==='release'&&e.value.bootstrap===false));
  assert.deepEqual(h.stateCalls,['snapshot','open']);assert.equal(h.stopped.size,0);h.n.proc.assertClosed();
 });
 const wireDiagnosis=v=>v?.start||v?.causes?.map(wireDiagnosis).find(Boolean);
 async function actualFailureToReceiver(t,options){
  const h=generationHarness(t,options),phase=(options.key||'release')+'-start',lines=[],values=nativeEvidence(),execute=h.n.execute.bind(h.n);let primary;
  h.n.execute=async p=>p===phase?execute(p):{verified:true,...values[p]};
  await assert.rejects(main({...opts,output:l=>lines.push(l)},h.n),e=>{primary=e;return true;});
  assert.deepEqual(h.stateCalls,[]);h.n.proc.assertClosed();
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),failed=rows.find(r=>r.phase===phase);
  assert.equal(failed.ok,false);assert.equal(rows.at(-1).phase,'closure');assert.ok(!rows.some(r=>r.phase==='complete'));
  assert.throws(()=>parseReceipts(lines.join('\n'),opts.run,SOURCE,opts));
  const r=receiver(lines.join('\n'));r.invoke();
  const proof=JSON.parse(fs.readFileSync(path.join(r.destination,'Empfang.json'))),saved=fs.readFileSync(path.join(r.destination,'receipts.txt'),'utf8');
  assert.equal(proof.status,'PARTIAL_FAILURE_RECEIVED');assert.equal(proof.publicationManifest,publication);
  assert.equal(parseReceipts(saved,opts.run,SOURCE,opts,{partial:true}).proof.finalSha256,proof.finalSha256);
  const received=saved.trim().split('\n').map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))).find(r=>r.phase===phase);
  assert.deepEqual(received.detail.failure,failed.detail.failure);
  assert.doesNotMatch(saved+JSON.stringify(rows),/SYNTHETIC_PRIVATE|ssb-start-offline|ownerSha256|postgresql:/);
  const d=wireDiagnosis(received.detail.failure);assert.ok(d);assert.equal(d.ok,false);assert.equal(d.binding.phase,phase);assert.equal(d.binding.publication,publication);
  assert.equal(d.binding.call,h.operations.find(x=>x.binding.service==='api').binding.call);
  return{...h,rows,primary,d,eventsRead:fs.readFileSync(h.events,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)};
 }
 for(const fault of ['state-check-late','state-check-accounting'])test('later IPC check after successful begin remains primary through regular receipt: '+fault,async t=>{
  const h=await actualFailureToReceiver(t,{fault});
  assert.deepEqual(h.d.primary,{step:'state-check',lastConfirmed:'plan-validate',errorClass:'MaintenanceDenied',code:'generation_retired'});
  const begin=h.eventsRead.findIndex(e=>e.kind==='state'&&e.value==='begin'),denied=h.eventsRead.findIndex(e=>e.kind==='state'&&e.value==='ipc-check-denied');
  assert.ok(begin>=0&&denied>begin);assert.equal(h.eventsRead.filter(e=>e.kind==='state'&&e.value==='begin').length,1);
  assert.ok(h.eventsRead.some(e=>e.kind==='state'&&e.value==='ipc-check-after-begin'));assert.ok(h.eventsRead.some(e=>e.kind==='state'&&e.value==='uncertain'));
  assert.equal(h.eventsRead.filter(e=>e.kind==='docker').length,0);assert.equal(h.operations.length,2);assert.equal(h.n.owned[0].id,null);assert.equal(h.stopped.size,0);
  assert.equal(h.rows.at(-1).detail.outcomes[0].state,'unverified');assert.deepEqual(diagnosis(h.primary).primary,h.d.primary);
  if(fault==='state-check-accounting')assert.ok(h.d.cleanup.some(p=>p.step==='accounting'&&p.code==='EIO'));else assert.deepEqual(h.d.cleanup,[]);
 });
 for(const closureFault of ['', 'id'])test('later IPC check retains strictly verified ID without bypassing closure ownership: '+(closureFault||'owned'),async t=>{
  const h=await actualFailureToReceiver(t,{fault:'state-check-after-id',closureFault}),retained=sha('api');
  assert.deepEqual(h.d.primary,{step:'state-check',lastConfirmed:'start',errorClass:'MaintenanceDenied',code:'generation_retired'});
  assert.deepEqual(h.d.resource,{state:'start_requested',id:retained});assert.equal(h.n.owned[0].id,retained);
  const start=h.eventsRead.findIndex(e=>e.kind==='start-complete'),denied=h.eventsRead.findIndex(e=>e.kind==='state'&&e.value==='ipc-check-denied');
  assert.ok(start>=0&&denied>start);assert.equal(h.eventsRead.filter(e=>e.kind==='docker'&&e.value==='container:inspect').length,1);
  assert.equal(h.eventsRead.filter(e=>e.kind==='docker'&&e.value==='container:start').length,1);assert.equal(h.operations.length,2);
  assert.equal(h.rows.at(-1).detail.outcomes[0].id,retained);assert.equal(h.stopped.size,closureFault?0:1);
  assert.equal(h.rows.at(-1).detail.outcomes[0].state,closureFault?'unverified':'exited');
  assert.equal(h.calls.filter(c=>c.bin==='/usr/bin/docker'&&c.args[2]==='stop').length,closureFault?0:1);
 });
 test('nonempty release predecessor refusal travels through actual helper and regular receiver before create',async t=>{
  const h=await actualFailureToReceiver(t,{fault:'predecessor',key:'forward'});
  assert.equal(h.c.bootstrap,false);assert.equal(h.c.previousGeneration,'release');assert.equal(h.c.predecessors.length,5);
  assert.deepEqual(h.d.primary,{step:'predecessor-check',lastConfirmed:'state-check',errorClass:'MaintenanceDenied',code:'predecessor_not_stopped'});
  assert.equal(h.d.resource.state,'planned');assert.equal(h.d.resource.id,null);
  assert.deepEqual(h.eventsRead.filter(e=>e.kind==='predecessor-inspect').map(e=>e.value),[h.c.predecessors[0].id]);
  assert.ok(!h.eventsRead.some(e=>e.kind==='docker'&&['create','container:start','container:ls'].includes(e.value)));
  assert.equal(h.operations.length,2);assert.equal(h.stopped.size,0);assert.equal(h.rows.at(-1).detail.outcomes[0].state,'unverified');
 });
 for(const fault of ['helper','accounting','postinspect','postidentity'])test('actual controller start -> helper/process -> closure -> receipt -> receiver: '+fault,async t=>{
  const h=generationHarness(t,{fault}),lines=[],values=nativeEvidence(),execute=h.n.execute.bind(h.n);
  h.n.execute=async phase=>phase==='release-start'?execute(phase):{verified:true,...values[phase]};
  await assert.rejects(main({...opts,output:x=>lines.push(x)},h.n));assert.equal(h.n.owned[0].id,sha('api'));assert.deepEqual(h.stateCalls,[]);assert.equal(h.stopped.size,1);h.n.proc.assertClosed();
  const parsed=parseReceipts(lines.join('\n'),opts.run,SOURCE,opts,{partial:true});assert.equal(parsed.proof.status,'PARTIAL_FAILURE_RECEIVED');const r=receiver(lines.join('\n'));r.invoke();assert.equal(JSON.parse(r.output[0]).status,'PARTIAL_FAILURE_RECEIVED');
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),failure=rows.find(r=>r.phase==='release-start').detail.failure;
  assert.equal(failure.operation.operation,fault.startsWith('post')?'participant-postinspect':'participant-helper');assert.equal(rows.at(-1).detail.outcomes[0].state,'exited');assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|ssb-start-offline|ownerSha256/);
 });
 for(const closureFault of ['inspect','id','name','image','run','project','service','preexisting'])test('retained ID never bypasses actual closure ownership: '+closureFault,async t=>{
  const h=generationHarness(t,{fault:'postinspect',closureFault});await assert.rejects(h.n.startGeneration('release'));if(closureFault==='preexisting')h.n.initial.containers=[h.n.owned[0].id];
  await assert.rejects(h.n.close(true),e=>{const d=publicFailure(e);assert.equal(d.causes[0].operation.operation,'closure-inspect');assert.equal(e.publicReceipt.detail.outcomes[0].state,'unverified');return true;});assert.equal(h.stopped.size,0);h.n.proc.assertClosed();
 });
 test('real start failure plus closure evidence-write failure preserves primary and unclean 137',async t=>{
  const h=generationHarness(t,{fault:'helper',closureFault:'137',writeFailure:true}),lines=[],values=nativeEvidence(),execute=h.n.execute.bind(h.n);h.n.execute=async p=>p==='release-start'?execute(p):{verified:true,...values[p]};
  await assert.rejects(main({...opts,output:l=>lines.push(l)},h.n),e=>{assert.equal(e.errors[0].code,'command_failed');assert.equal(diagnosis(e.errors[0]).primary.step,'start');return true;});
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));assert.equal(rows.at(-1).detail.outcomes[0].state,'exited_unclean');assert.equal(rows.at(-1).detail.outcomes[0].exit,137);assert.equal(parseReceipts(lines.join('\n'),opts.run,SOURCE,opts,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');h.n.proc.assertClosed();
 });
 module.exports={load,setup,invoke};
}
