'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),{createRequire}=require('node:module');
const privateMarker='SYNTHETIC_PRIVATE_LISTENER_DO_NOT_EXPORT';
if(process.env.SSB_LISTENER_OFFLINE){
 const cfg=JSON.parse(process.env.SSB_LISTENER_OFFLINE),read=fs.readFileSync,write=process.stdout.write.bind(process.stdout);
 const id=cfg.id||'d'.repeat(64),fail=code=>{throw Object.assign(Error(privateMarker),{code});};
 fs.readFileSync=function(p,...args){
  if(p===0)return read.call(this,p,...args);
  if(String(p).startsWith('/proc/1/')){
   if(cfg.error)fail(cfg.error);
   const values={
    '/proc/1/cmdline':cfg.cmdline||(cfg.other?'other\0private/path\0':'node\0app/server.js\0'),
    '/proc/1/environ':'PRIVATE_SECRET='+privateMarker+'\0'+(cfg.unset?'':'HOSTNAME='+(cfg.hostname||id.slice(0,12))+'\0')+(cfg.port===undefined?'':'PORT='+cfg.port+'\0'),
    '/proc/1/net/tcp':'  sl  local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n'+(cfg.noListener?'':cfg.badTcp?'truncated\n':'0: '+(cfg.addressHex||'00000000')+':'+(cfg.listenerPort||'0BB8')+' 00000000:0000 0A 0:0 00:0 0 1000 0 '+(cfg.foreign?'555':'123')+'\n'),
    '/proc/1/net/tcp6':'  sl  local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n'+(cfg.ipv6?'0: 00000000000000000000000000000000:0BB8 00000000000000000000000000000000:0000 0A 0:0 00:0 0 1000 0 123\n':'')
   };
   if(!Object.hasOwn(values,p))fail('EACCES');return Buffer.from(values[p]);
  }
  return read.call(this,p,...args);
 };
 fs.readdirSync=p=>{if(p!=='/proc/1/fd')fail('EACCES');return ['1','2','3'];};
 fs.readlinkSync=p=>p.endsWith('/3')?'socket:[123]':'pipe:[444]';
 require('node:dns').promises.lookup=async(host,options)=>{if(host!=='dashboard'||options.all!==true)fail('EACCES');if(cfg.dnsError)fail(cfg.dnsError);return(cfg.dns||['172.20.0.3']).map(address=>({address,family:4}));};
 for(const name of ['node:net','node:tls','node:http','node:https','node:dgram']){const m=require(name);for(const k of ['connect','createConnection','request','get','createSocket'])if(typeof m[k]==='function')m[k]=()=>fail('NETWORK_NOT_AUTHORIZED');}
 for(const k of ['spawn','exec','execSync','execFile','execFileSync','fork'])cp[k]=()=>fail('PROCESS_NOT_AUTHORIZED');
 process.stdout.write=function(text,...args){if(cfg.output==='json')text='{';if(cfg.output==='private')text=String(text).replace('"ok":','"private":"'+privateMarker+'","ok":');if(cfg.output==='missing')text='';return write(text,...args);};
}else{
 const test=require('node:test'),assert=require('node:assert/strict'),E=require('node:events').EventEmitter;
 const D=require('./dashboard-diagnostic.cjs'),{sha}=require('./common.cjs'),{publicFailure}=require('./diagnostics.cjs');
 assert.equal(process.version,'v24.17.0');
 function load(name,overrides={},rewrite=s=>s){const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname,__filename:file,require:k=>Object.hasOwn(overrides,k)?overrides[k]:req(k),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};vm.compileFunction(rewrite(fs.readFileSync(file,'utf8')),Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;}
 const {harness,receiver,opts,nativeEvidence}=load('closed-start-diagnostic.test.cjs',{'node:test':()=>{}},s=>s.replace(/\n}\s*$/,'\nmodule.exports={harness,receiver,opts,nativeEvidence};\n}'));
 const {main}=require('./controller.cjs');
 function fake(body){const c=new E();c.stdout=new E();c.stderr=new E();c.stdin=new E();c.stdin.end=()=>queueMicrotask(()=>{c.stdout.emit('data',Buffer.from(body));c.emit('close',0,null);});return c;}
 function sample(mode,cfg={}){
  const input={call:'c'.repeat(64),container:'d'.repeat(64),mode},r=cp.spawnSync(process.execPath,['--require',__filename,'-e',D.workerSource],{input:JSON.stringify(input),encoding:'utf8',timeout:2000,env:{PATH:process.env.PATH,SSB_LISTENER_OFFLINE:JSON.stringify(cfg)}});
  assert.equal(r.status,0);assert.equal(r.stderr,'');assert.doesNotMatch(r.stdout,/SYNTHETIC_PRIVATE|"message"|"stack"|private\/path/);const v=JSON.parse(r.stdout);D.validateSample(v,mode,input,input.container);return v;
 }
 for(const [cfg,want]of [[{},'listener-on-configured-port'],[{noListener:true},'no-pid1-listener'],[{foreign:true},'no-pid1-listener'],[{listenerPort:'0BB9'},'listener-on-other-port'],[{other:true},'process-unverified']])test('actual stdin worker: '+want+JSON.stringify(cfg),()=>assert.equal(sample('process',cfg).data.startStatus,want));
 test('PID1 only, wildcard/IPv6 and selected environment fields',()=>{const s=sample('process',{ipv6:true,hostname:'127.0.0.1',port:'3001'});assert.equal(s.data.hostname.value,'127.0.0.1');assert.equal(s.data.port.value,3001);assert.deepEqual(s.data.listeners,[{address:'::',port:3000},{address:'0.0.0.0',port:3000}]);});
 for(const noListener of [false,true])test('review F2: exact bound Next process title retains listener evidence '+noListener,()=>{const s=sample('process',{cmdline:'next-server (v16.3.8)\0\0\0',noListener});assert.equal(s.data.process,'next-server');assert.equal(s.data.startStatus,noListener?'no-pid1-listener':'listener-on-configured-port');});
 for(const noListener of [false,true])test('review F2: exact observed truncated title remains a separate category '+noListener,()=>{const s=sample('process',{cmdline:'next-server (v16.3\0',noListener});assert.equal(s.data.process,'next-title-truncated');assert.equal(s.data.startStatus,noListener?'no-pid1-listener':'listener-on-configured-port');});
 for(const cmdline of ['next-server (v16.\0','next-server (v16.4\0','next-server (v16.3\0extra\0'])test('review F2: no arbitrary partial title or extra argv accepted '+cmdline.replaceAll('\0','/'),()=>{const s=sample('process',{cmdline});assert.equal(s.data.process,'other');assert.equal(s.data.startStatus,'process-unverified');});
 for(const cmdline of ['next-server (v16.3.9)\0','next-server (v16.3.8)\0extra\0'])test('review F2: other process titles never imply the bound Next server '+cmdline.replaceAll('\0','/'),()=>{const s=sample('process',{cmdline});assert.equal(s.data.process,'other');assert.equal(s.data.startStatus,'process-unverified');});
 for(const cfg of [{unset:true},{hostname:privateMarker},{port:privateMarker}])test('no free hostname/port or environment export '+JSON.stringify(cfg),()=>{const s=sample('process',cfg);assert.doesNotMatch(JSON.stringify(s),new RegExp(privateMarker));});
 for(const error of ['EACCES','EPERM','ENOENT','EIO','PRIVATE'])test('bounded proc failure '+error,()=>{const s=sample('process',{error});assert.equal(s.ok,false);assert.equal(s.code,error==='PRIVATE'?'unknown':error);});
 for(const cfg of [{badTcp:true},{addressHex:'08080808'}])test('unusable/public socket data is not absence '+JSON.stringify(cfg),()=>{const s=sample('process',cfg);assert.equal(s.ok,false);assert.equal(s.data,null);});
 test('DNS fixed alias only and bounded private addresses',()=>assert.deepEqual(sample('dns',{dns:['172.20.0.3','172.21.0.3']}).data.addresses,['172.20.0.3','172.21.0.3']));
 for(const cfg of [{dns:['8.8.8.8']},{dnsError:'ENOTFOUND'},{dnsError:'PRIVATE'}])test('bad DNS remains unknown or known failure '+JSON.stringify(cfg),()=>assert.equal(sample('dns',cfg).ok,false));
 async function pipeline(t,cfg={}){
  const h=harness(t,{fault:'closed-dashboard',kind:'type',endFailure:cfg.endFailure,rawWriteFailure:cfg.rawWriteFailure,closureFault:cfg.closureFault||''});
  h.n.probeDeadline=performance.now()+90000;
  const original=h.n.proc.run.bind(h.n.proc),order=[],capture={count:0,ms:[]};
  const transport={spawn(bin,args,options){
   capture.count++;capture.ms.push(args[2]);
   if(args[2]==='container')return fake(JSON.stringify([{Id:sha('dashboard'),Image:h.n.images.dashboard,Name:'/ssb-native-'+opts.run+'-release-dashboard',Config:{Labels:{'com.ssb.native-run':opts.run}},State:{Running:true},NetworkSettings:{Networks:Object.fromEntries(['internal','admin_writer','ingress'].map((k,i)=>[h.n.networks[k].name,{NetworkID:cfg.wrongNetwork?'f'.repeat(64):h.n.networks[k].id,IPAddress:'172.'+(20+i)+'.0.3',GlobalIPv6Address:''}]))}}]));
   assert.equal(args[2],'exec');assert.equal(args[7],D.workerSource);
   return cp.spawn(process.execPath,['--require',__filename,'-e',D.workerSource],{...options,env:{PATH:process.env.PATH,SSB_LISTENER_OFFLINE:JSON.stringify({...cfg,id:sha('dashboard')})}});
  }};
  const P=load('common.cjs',{'node:child_process':transport}).Processes,proc=new P({deadline:h.n.deadline,privateRoot:path.join(h.root,'raw')});proc.calls=h.n.proc.calls;
  h.n.proc.run=async(bin,args,options={})=>{
   const diagnostic=!options.closure&&options.ms<=1500&&(args[2]==='container'&&args[3]==='inspect'&&args[4]===sha('dashboard')||args[2]==='exec'&&args[6]==='-e');
   if(diagnostic){order.push('diagnostic');assert.ok(options.ms>100&&options.ms<=1500);if(cfg.inspectFailure&&args[2]==='container')throw Object.assign(Error(privateMarker),{code:cfg.inspectFailure});return proc.run(bin,args,options);}
   if(options.closure)order.push('closure');return original(bin,args,options);
  };
  if(cfg.noBudget){const probe=h.n.probe.bind(h.n);h.n.probe=async(...args)=>{try{return await probe(...args);}finally{h.n.probeDeadline=performance.now()+30000;}};}
  const execute=h.n.execute.bind(h.n),values=nativeEvidence(),lines=[];let primary;
  values.builds.ids=['api','dashboard','reporter','widget','admin-writer'].map(k=>h.n.images[k]);
  h.n.execute=async p=>p==='release-start'?execute(p):{verified:true,...values[p]};
  await assert.rejects(main({...opts,output:l=>{if(cfg.receiptFailure&&lines.length===5)throw Object.assign(Error(privateMarker),{code:'ENOSPC'});lines.push(l);}},h.n),e=>{primary=e;return true;});
  h.n.proc.assertClosed();proc.assertClosed();
  const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64'))),failed=rows.find(r=>r.phase==='release-start');
  assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|"stack"|"message"|PRIVATE_SECRET/);
  if(!cfg.receiptFailure){const r=receiver(lines.join('\n'));r.invoke();assert.equal(JSON.parse(r.output[0]).status,'PARTIAL_FAILURE_RECEIVED');}
  return{...h,rows,lines,failed,primary,order,capture};
 }
 const find=v=>v?.dashboard||v?.causes?.map(find).find(Boolean);
 function rechain(rows){let prev='0'.repeat(64);return rows.map((r,seq)=>{const b=JSON.stringify({...r,seq,previous:prev});prev=sha(b);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(b).toString('base64')+' '+prev;}).join('\n');}
 test('actual controller -> process -> pre-stop diagnosis -> regular receiver',async t=>{
  const h=await pipeline(t),d=find(h.failed.detail.failure);assert.ok(d);assert.equal(d.process.data.startStatus,'listener-on-configured-port');assert.equal(d.process.data.hostname.kind,'container-id');assert.equal(d.networks.length,3);assert.deepEqual(d.dns.data.addresses,['172.20.0.3']);assert.equal(h.capture.count,3);assert.ok(h.order.lastIndexOf('diagnostic')<h.order.indexOf('closure'));
  const p=h.failed.detail.failure.probe;assert.ok(p.readiness.firstFailure.timing.startedAt);assert.ok(p.readiness.lastFailure.timing.failedAt);assert.equal(p.primary.step,'closed-dashboard');assert.equal(h.failed.ok,false);
 });
 for(const cfg of [{noListener:true},{listenerPort:'0BB9'},{dns:['172.29.0.3']},{error:'EACCES'},{dnsError:'EAI_AGAIN'},{wrongNetwork:true},{inspectFailure:'command_timeout'},{inspectFailure:'evidence_write_failed'},{output:'json'},{output:'private'},{output:'missing'},{noBudget:true},{endFailure:true,closureFault:'137'}])test('real path bounded diagnostics keep primary '+JSON.stringify(cfg),async t=>{
  const h=await pipeline(t,cfg),d=find(h.failed.detail.failure);assert.ok(d);assert.equal(h.failed.detail.failure.probe.primary.step,'closed-dashboard');if(cfg.noBudget){assert.equal(h.capture.count,0);assert.equal(d.errors[0].code,'deadline');}if(cfg.wrongNetwork)assert.equal(h.capture.count,1);
 });
 test('review F1: additional private-write failure retains diagnosis and original in aggregate',async t=>{const h=await pipeline(t,{rawWriteFailure:true});assert.match(JSON.stringify(h.failed.detail.failure),/closed-dashboard/);assert.doesNotMatch(JSON.stringify(h.failed.detail.failure),new RegExp(privateMarker));assert.equal(h.capture.count,3);assert.ok(find(h.failed.detail.failure));assert.ok(h.order.lastIndexOf('diagnostic')<h.order.indexOf('closure'));assert.equal(h.failed.ok,false);});
 test('review F1: inherited operation must match exact probe call; traversal is bounded',()=>{
  const {Native}=require('./native.cjs'),n=new Native({run:'12345678'});n.verifiedPublicationManifest='a'.repeat(64);const binding=n.startBinding('closed-ready','probe','release');
  const probe={primary:{step:'closed-dashboard'},binding:{...binding}},inner=Object.assign(Error('synthetic'),{probeDiagnostic:probe}),outer=Object.assign(new AggregateError([inner]),{startOperation:binding});
  assert.equal(D.target(outer).primary,inner);assert.equal(D.target(outer).binding,binding);assert.equal(inner.startOperation,undefined);
  probe.binding.call='f'.repeat(64);assert.equal(D.target(outer),null);const cycle=Error('synthetic');cycle.cause=cycle;assert.equal(D.target(cycle),null);
 });
 test('receipt write failure never becomes a successful reception',async t=>{const h=await pipeline(t,{receiptFailure:true});assert.match(JSON.stringify(publicFailure(h.primary)),/closed-dashboard/);assert.throws(()=>receiver(h.lines.join('\n')).invoke());});
 test('strict receiver rejects identity, private fields and false sample assertions',async t=>{
  const h=await pipeline(t);
  for(const mutate of [d=>d.binding.call='a'.repeat(64),d=>d.container='f'.repeat(64),d=>d.image='sha256:'+'f'.repeat(64),d=>d.networks[0].id='f'.repeat(64),d=>d.process.data.private=privateMarker,d=>d.process.data.listeners[0].address='8.8.8.8',d=>d.process.data.startStatus='no-pid1-listener',d=>d.process.ok='true',d=>d.process.call='f'.repeat(64),d=>d.dns.data.addresses=[privateMarker],d=>d.errors.push({step:'process',code:'EIO'}),d=>d.process=null]){
   const rows=structuredClone(h.rows);mutate(find(rows.find(r=>r.phase==='release-start').detail.failure));assert.throws(()=>receiver(rechain(rows)).invoke());
  }
 });
 test('receiver rejects impossible attempt timing',async t=>{const h=await pipeline(t);for(const mutate of [p=>p.readiness.firstFailure.timing.elapsedMs=-1,p=>p.readiness.lastFailure.timing.startedAt='private',p=>p.readiness.lastFailure.timing.extra=privateMarker]){const rows=structuredClone(h.rows);mutate(rows.find(r=>r.phase==='release-start').detail.failure.probe);assert.throws(()=>receiver(rechain(rows)).invoke());}});
 test('review F3: receiver rejects overlapping sequential attempts and inconsistent single-attempt times',async t=>{
  const h=await pipeline(t);
  for(const single of [false,true]){
   const rows=structuredClone(h.rows),p=rows.find(r=>r.phase==='release-start').detail.failure.probe;
   p.readiness.firstFailure.timing={startedAt:'2026-10-13T00:00:10.000Z',failedAt:'2026-10-13T00:00:11.000Z',elapsedMs:1000};
   p.readiness.lastFailure.timing={startedAt:'2026-10-13T00:00:00.000Z',failedAt:'2026-10-13T00:00:12.000Z',elapsedMs:12000};
   if(single){p.readiness.attempts=1;p.readiness.lastFailure.attempt=1;}
   assert.throws(()=>require('./diagnostics.cjs').validateProbe(p));assert.throws(()=>receiver(rechain(rows)).invoke());
  }
 });
}
