'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=process.env.SSB_LISTENER_TEST_ROOT||__dirname;
const template=JSON.parse(fs.readFileSync(path.join(root,'compose-template.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
class MaintenanceDenied extends Error{constructor(code){super(code);this.code=code;}}
function load(file,deps){
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,URL,Buffer,require:id=>{
    assert.ok(Object.hasOwn(deps,id),'unbound test dependency');return deps[id];
  }},{filename:file,timeout:1000});return module.exports;
}
test('listener denial survives structured public receipt and partial receiver without raw fields',()=>{
  const diagnostics=require('./diagnostics.cjs'),protocol=diagnostics.startProtocol();
  const {Receipts,parseReceipts}=require('./evidence.cjs'),SOURCE=require('./controller.cjs').SOURCE;
  const{g,c}=context('release');delete g.config.services.dashboard.environment.HOSTNAME;
  let cause;try{policy.assertCompose(g.binding,c,g.config,image);}catch(e){cause=e;}
  assert.equal(cause.code,'dashboard_listener_binding_invalid');
  const binding={version:1,operation:'participant-helper',action:'start-retained-participant',phase:'release-start',service:'dashboard',generation:'release',run:'123',source:SOURCE,publication:native.verifiedPublicationManifest,call:'c'.repeat(64)};
  const progress=new protocol.Progress(binding);progress.enter('network');progress.confirm();progress.enter('compose-config');progress.capture(cause);
  const d=progress.result(false);assert.equal(d.primary.code,'dashboard_listener_binding_invalid');assert.ok(protocol.preCreateFailure(d));
  const decoded=protocol.decode(Buffer.from(protocol.marker+JSON.stringify(d)+'\n'),binding,false);
  const primary=Object.assign(new Error('PRIVATE_RAW_NOT_EXPORTABLE'),{code:'command_failed',process:{index:7,code:1,signal:null,closed:true,timeout:false},startOperation:binding,startDiagnostic:decoded});
  const output=[],ctx={workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)},r=new Receipts('123',SOURCE,ctx,line=>output.push(line));
  r.emit('preflight',true,{counts:[901,4],hashes:[binding.publication]});
  r.emit('bases',true,{counts:[4],ids:require('./registry-bindings.json').images.map(x=>x.imageId)});
  r.emit('builds',true,{counts:[4,2],ids:[native.images.api,native.images.dashboard,native.images.reporter,native.images.widget,native.images.api],hashes:[require('./reporter-source.cjs').manifest().hash,require('./dashboard-source.cjs').manifest().hash]});
  r.emit('initialize',true,{counts:[34,4,1],hashes:['d'.repeat(64)]});r.emit('roles',true,{counts:[32]});
  r.emit('release-start',false,{detail:{failure:diagnostics.publicFailure(primary),outcomes:[]}});
  // Additional closure failure must not convert or hide the original denial.
  r.emit('closure',false,{detail:{failure:diagnostics.publicFailure(Object.assign(new Error('PRIVATE_WRITE_ERROR'),{code:'evidence_write_failed'})),outcomes:[]}});
  const received=parseReceipts(output.join('\n'),'123',SOURCE,ctx,{partial:true});assert.equal(received.proof.status,'PARTIAL_FAILURE_RECEIVED');
  const rows=received.lines.map(line=>JSON.parse(Buffer.from(line.split(' ')[1],'base64')));
  assert.equal(rows[5].detail.failure.start.primary.code,'dashboard_listener_binding_invalid');
  assert.equal(rows[6].detail.failure.code,'evidence_write_failed');assert.equal(received.proof.publicationManifest,binding.publication);
  assert.throws(()=>parseReceipts(output.join('\n'),'123',SOURCE,ctx));
  assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_RAW|PRIVATE_WRITE|stack|password|cookie/);
  for(const bad of ['secret-value','dashboard_listener_binding_invalid_suffix','/private/raw'])assert.equal(protocol.classify({code:bad}).code,'unknown');
  const extra=structuredClone(d);extra.primary.message='PRIVATE_RAW';assert.throws(()=>protocol.validate(extra,binding));
  assert.throws(()=>protocol.decode(Buffer.from(protocol.marker+JSON.stringify(d)+'\n'),{...binding,publication:'e'.repeat(64)},false));
  progress.enter('output');progress.capture(Object.assign(new Error('PRIVATE_WRITE'),{code:'ENOSPC'}));
  assert.equal(progress.result(false).primary.code,'dashboard_listener_binding_invalid');assert.equal(progress.result(false).cleanup[0].code,'ENOSPC');
});
const policy=load(path.join(root,'adapters/scripts/ops/maintenance-start-contract.cjs'),{
  './dashboard-shutdown-contract.cjs':require('./dashboard-shutdown-contract.cjs'),'node:fs':{},'node:path':path,'node:crypto':crypto,'../../apps/api/dist/maintenance/maintenance-state':{MaintenanceDenied}
});
const writes=new Map();
const fixtures=load(path.join(__dirname,'fixtures.cjs'),{
  'node:fs':{mkdirSync(){},chownSync(){},writeFileSync(p,b,o){assert.equal(o.flag,'wx');writes.set(p,String(b));}},
  'node:path':path,'node:crypto':crypto,'./common.cjs':require('./common.cjs'),
  './dashboard-shutdown-contract.cjs':require('./dashboard-shutdown-contract.cjs'),'./compose-template.json':template,'./reporter-contract.cjs':require('./reporter-contract.cjs')
});
const native={privateRoot:'/synthetic-only/private',stateRoot:'/synthetic-only/state',prefix:'ssb-native-123',options:{run:'123'},
  docker:'/usr/bin/docker',daemonId:'synthetic-bound-daemon',verifiedPublicationManifest:sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),
  images:{api:'sha256:'+'1'.repeat(64),'admin-writer':'sha256:'+'1'.repeat(64),dashboard:'sha256:'+'2'.repeat(64),reporter:'sha256:'+'3'.repeat(64),widget:'sha256:'+'4'.repeat(64)},
  networks:Object.fromEntries(fixtures.networks.map((k,i)=>[k,{name:'ssb-native-'+k,id:String(i+5).repeat(64),internal:true}])),synthetic:fixtures.secrets()};
const image={User:'node',Cmd:['node','app/scripts/dashboard-entry.cjs'],Entrypoint:[],Env:[]};
function context(generation){
  const previous={release:'seed',forward:'release',normal:'forward'}[generation];
  const predecessors=previous==='seed'?[]:fixtures.services.map((service,i)=>({service,id:String(i+1).repeat(64),imageId:native.images[service],
    project:native.prefix+'-'+previous,name:native.prefix+'-'+previous+'-'+service,
    receipt:{path:path.join(native.stateRoot,'shutdown-'+native.prefix+'-'+previous+'-'+service+'.json')}}));
  const g=fixtures.generation(native,generation,previous,predecessors,policy);
  return{g,c:{...g.common,service:'dashboard',imageId:native.images.dashboard}};
}
const plain=x=>JSON.parse(JSON.stringify(x));
for(const generation of ['release','forward','normal']){
  test(generation+': real fixture explicitly binds both listener fields',()=>{
    const{g,c}=context(generation),e=g.config.services.dashboard.environment;
    assert.equal(e.HOSTNAME,'0.0.0.0');assert.equal(e.PORT,'3000');
    policy.assertPlan(g.binding,c);policy.assertCompose(g.binding,c,g.config,image);
    const rendered=JSON.parse(writes.get(g.common.files[0].path).replace(/\$\$/g,'$'));
    assert.equal(rendered.services.dashboard.environment.HOSTNAME,'0.0.0.0');assert.equal(rendered.services.dashboard.environment.PORT,'3000');
    policy.assertCompose(g.binding,c,rendered,image);
    assert.equal(g.common.timeoutMs,10000);assert.deepEqual(plain(c.ports.dashboard),[]);
    assert.deepEqual(Object.keys(g.config.services.dashboard.networks),['internal','admin_writer','ingress']);
    assert.ok(Object.values(native.networks).every(n=>n.internal));
    assert.equal(g.config.services.dashboard.ports,undefined);
    assert.equal(g.config.services.api.environment.OPENAI_API_KEY,'synthetic-no-provider');
    assert.equal(g.config.services.reporter.environment.SMTP_HOST,'smtp-blocked.invalid');
  });
  test(generation+': rejects implicit Docker hostname before create',()=>{
    const{g,c}=context(generation);delete g.config.services.dashboard.environment.HOSTNAME;delete g.config.services.dashboard.environment.PORT;
    assert.throws(()=>policy.assertCompose(g.binding,c,g.config,{...image,Env:['HOSTNAME=abcdef123456']}),e=>e.code==='dashboard_listener_binding_invalid');
  });
  test(generation+': explicit listener overrides image environment',()=>{
    const{g,c}=context(generation);policy.assertCompose(g.binding,c,g.config,{...image,Env:['HOSTNAME=abcdef123456','PORT=3001']});
  });
  const mutations=[
    ['host absent',e=>delete e.HOSTNAME],['host empty',e=>e.HOSTNAME=''],['host loopback',e=>e.HOSTNAME='127.0.0.1'],
    ['host container',e=>e.HOSTNAME='abcdef123456'],['host IP',e=>e.HOSTNAME='172.18.0.7'],['host wildcard IPv6',e=>e.HOSTNAME='::'],
    ['host null',e=>e.HOSTNAME=null],['host bool',e=>e.HOSTNAME=false],['host array',e=>e.HOSTNAME=['0.0.0.0']],
    ['port absent',e=>delete e.PORT],['port empty',e=>e.PORT=''],['port wrong',e=>e.PORT='3001'],['port number',e=>e.PORT=3000],
    ['port padded',e=>e.PORT='03000'],['port suffixed',e=>e.PORT='3000x'],['port null',e=>e.PORT=null],['port array',e=>e.PORT=['3000']]
  ];
  for(const[label,change]of mutations)test(generation+': rejects '+label,()=>{
    const{g,c}=context(generation);change(g.config.services.dashboard.environment);
    assert.throws(()=>policy.assertCompose(g.binding,c,g.config,image),e=>e.code==='dashboard_listener_binding_invalid');
  });
  for(const[label,change,code]of [
    ['public port',s=>s.ports=['3000:3000'],'start_ports_invalid'],
    ['extra network',s=>s.networks.unbound={},'start_network_invalid'],
    ['host networking',s=>s.network_mode='host','start_security_invalid'],
    ['root user',s=>s.user='0:0','start_security_invalid'],
    ['writable key',s=>s.volumes[0].read_only=false,'start_mount_invalid'],
    ['unknown mount field',s=>s.volumes[0].unknown=true,'start_mount_invalid'],
    ['textual mount boolean',s=>s.volumes[0].read_only='true','start_mount_invalid'],
    ['unbound writer',s=>s.environment.ADMIN_WRITER_BASE_URL='http://api:5000','dashboard_writer_binding_missing'],
    ['alternate entry',s=>s.command=['node','other.js'],'start_security_invalid'],
    ['NODE_OPTIONS injection',s=>s.environment.NODE_OPTIONS='--inspect','alternate_start_environment_forbidden']
  ])test(generation+': unchanged boundary '+label,()=>{
    const{g,c}=context(generation);change(g.config.services.dashboard);
    assert.throws(()=>policy.assertCompose(g.binding,c,g.config,image),e=>e.code===code);
  });
  for(const status of ['created','running'])test(generation+': actual container '+status+' must retain exact listener env',()=>{
    const{g,c}=context(generation),s=g.config.services.dashboard,id='a'.repeat(64);
    const x={Id:id,Name:'/'+c.containerNames.dashboard,Image:c.imageId,State:{Status:status,Running:status==='running',Paused:false,Restarting:false,OOMKilled:false},
      Config:{User:s.user,Cmd:image.Cmd,Entrypoint:image.Entrypoint,Labels:{'com.docker.compose.project':c.project,'com.docker.compose.service':'dashboard'},Env:Object.entries(s.environment).map(([k,v])=>`${k}=${v}`)},
      HostConfig:{Privileged:false,ReadonlyRootfs:false,RestartPolicy:{Name:'no'},SecurityOpt:s.security_opt,NetworkMode:c.networks.internal.name,
        Tmpfs:{'/tmp':'rw,nosuid,size=16m'}},
      Mounts:[{Type:'bind',Source:c.mountFiles.writerKey.path,Destination:'/run/ssb-writer-signing-key',RW:false,Propagation:'rprivate'},{Type:'bind',Source:g.binding.root,Destination:'/run/ssb-maintenance',RW:true,Propagation:'rprivate'}],
      NetworkSettings:{Networks:Object.fromEntries(c.serviceNetworks.dashboard.map(k=>[c.networks[k].name,{NetworkID:status==='created'?'':c.networks[k].id}]))}};
    assert.equal(policy.assertContainer(g.binding,c,g.config,image,[x],status,id),id);
    for(const env of [x.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')),x.Config.Env.map(v=>v.startsWith('HOSTNAME=')?'HOSTNAME=abcdef123456':v),x.Config.Env.map(v=>v.startsWith('PORT=')?'PORT=3001':v)]){
      const bad=structuredClone(x);bad.Config.Env=env;assert.throws(()=>policy.assertContainer(g.binding,c,g.config,image,[bad],status,id),e=>e.code==='container_environment_invalid');
    }
  });
}
