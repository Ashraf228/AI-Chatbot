'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
const {sha,GateError}=require('./common.cjs'),{main,SOURCE}=require('./controller.cjs'),{phases,parseReceipts,dispatchTitle,generationCounts}=require('./evidence.cjs');
const {probeCallsInFailure,validateFailure,publicFailure}=require('./diagnostics.cjs');
const opts={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'34567891',attempt:'1',workflowHead:'c'.repeat(40),dispatchNonce:'d'.repeat(64)},job='87654323';
const id=n=>n.toString(16).padStart(64,'0'),pm=()=>sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),marker='SYNTHETIC_PRIVATE_RESTORE_SQL_PASSWORD_PATH';
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ssb-restore-offline-'));
function load(file,replacements={},globals={}){const m={exports:{}},req=createRequire(file),g={module:m,exports:m.exports,__dirname:path.dirname(file),__filename:file,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,performance,setTimeout,clearTimeout,setInterval,clearInterval,console,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError,...globals};vm.compileFunction(fs.readFileSync(file,'utf8'),Object.keys(g),{filename:file})(...Object.values(g));return m.exports;}
function evidence(){
 const all=Array.from({length:24},(_,i)=>id(i+1)),r={preflight:{counts:[901,4],hashes:[pm()]},bases:{counts:[4],ids:require('./registry-bindings.json').images.map(x=>x.imageId)},builds:{counts:[4,2],ids:[100,101,102,103,100].map(n=>'sha256:'+id(n)),hashes:[require('./reporter-source.cjs').manifest().hash]},initialize:{counts:[34,4,1],hashes:[id(200)]},roles:{counts:[32]},inventory:{counts:[19,5,2],ids:all}};
 for(const [i,g]of ['release','forward','normal'].entries()){
  const ids=all.slice(3+i*5,8+i*5);r[g+'-start']={counts:generationCounts.start[g],ids};r[g+'-e1']={counts:generationCounts.e1,hashes:[id(220),id(221)]};r[g+'-drain']={counts:generationCounts.drain};r[g+'-shutdown']={counts:generationCounts.shutdown,ids,hashes:[id(230+i*2),id(231+i*2)]};
 }
 const observation=()=>({before:{status:'exited',running:false,exit:0,observedAt:'2026-10-13T00:00:02.000Z',startedAt:'2026-10-13T00:00:00.000Z',finishedAt:'2026-10-13T00:00:01.000Z'},stop:{requested:false,completed:false},after:{status:'exited',running:false,exit:0,observedAt:'2026-10-13T00:00:02.000Z',startedAt:'2026-10-13T00:00:00.000Z',finishedAt:'2026-10-13T00:00:01.000Z'}});
 r.closure={counts:[19,19,500],ids:all,detail:{failure:null,outcomes:all.slice(0,19).map((x,i)=>({id:x,role:i<3?['postgres','redis','probe'][i]:i===18?'restore-postgres':['api','admin-writer','dashboard','reporter','widget'][(i-3)%5],generation:i<3||i===18?'seed':['release','forward','normal'][Math.floor((i-3)/5)],state:i>=3&&i<18&&(i-3)%5<2?'graceful':'exited',exit:0,code:'none',observation:observation()}))}};return r;
}
function fakeChild(answer,record){
 const child=new EventEmitter();for(const k of ['stdin','stdout','stderr'])child[k]=new EventEmitter();
 child.stdin.end=input=>queueMicrotask(()=>{record.input=input;child.stdout.emit('data',Buffer.from(answer.stdout||''));child.stderr.emit('data',Buffer.from(answer.stderr||''));child.emit('close',answer.exit||0,answer.signal||null);});return child;
}
function harness(cfg={},extra={}){
 assert.equal(process.version,'v24.17.0');const root=tmp(),calls=[],states=new Map(),children=[],counts=[];
 const transport=(bin,args,options)=>{
  assert.equal(bin,'/usr/bin/docker');assert.deepEqual(args.slice(0,2),['--host','unix:///var/run/docker.sock']);const a=args.slice(2),record={a,options};calls.push(record);
  if(a[0]==='exec'&&a.at(-1)==='/proof/probe.cjs'){
   const countsFile=path.join(root,'counts-'+counts.length+'.json');counts.push(countsFile);
   const child=cp.spawn(process.execPath,['--require',path.join(__dirname,'restore-offline-preload.cjs'),path.join(__dirname,'probe.cjs')],{...options,env:{PATH:path.dirname(process.execPath),SSB_RESTORE_TEST:JSON.stringify({...cfg,countsFile})}});
   children.push(child);const end=child.stdin.end.bind(child.stdin);child.stdin.end=input=>{record.input=input;return end(input);};return child;
  }
  let step,stdout='';
  if(a.includes('pg_dump')){step='dump';stdout=Buffer.from([80,71,68,77,80,0,255,254,1]);}
  else if(a.includes('pg_dumpall')){step='role-dump';stdout='CREATE ROLE postgres;\nALTER ROLE postgres LOGIN;\nCREATE ROLE ssb_runtime;\n';}
  else if(a.includes('psql'))step='role-import';
  else if(a.includes('pg_restore'))step='database-import';
  else if(a[0]==='create'){
   step='postgres-create';const name=a[a.indexOf('--name')+1],image=a.at(-1);states.set(id(19),{Id:id(19),Name:'/'+name,Image:image,State:{Status:'created',Running:false,OOMKilled:false},HostConfig:{Privileged:false,PortBindings:{},PublishAllPorts:false}});stdout=id(19);
  }else if(a[0]==='start'){step='postgres-start';Object.assign(states.get(a[1]).State,{Status:'running',Running:true});}
  else if(a[0]==='container'&&a[1]==='inspect')stdout=JSON.stringify([states.get(a[2])]);
  else if(a[0]==='container'&&a[1]==='ls')stdout=id(19);
  else assert.fail('unapproved offline command '+a[0]);
  const fail=cfg.driverStep!==undefined&&cfg.driverStep===step;record.step=step;
  return fakeChild({stdout:fail?'':stdout,stderr:fail?marker:'',exit:fail?1:0,signal:fail&&cfg.signal?cfg.signal:null},record);
 };
 const processFS={...fs,writeFileSync(p,...args){if(extra.rawWriteFailure&&p.endsWith('.stderr'))throw Object.assign(Error(marker),{code:'ENOSPC'});return fs.writeFileSync(p,...args);}};
 const C=load(path.join(__dirname,'common.cjs'),{'node:fs':processFS,'node:child_process':{spawn:transport}});
 const fakeFS={...fs,statfsSync:()=>({bavail:1e9,bsize:4096,ffree:1e9}),readFileSync:(p,...args)=>p==='/proc/meminfo'?'MemAvailable: 16000000 kB\n':fs.readFileSync(p,...args)};
 const restoreModule=load(path.join(__dirname,'restore-diagnostic.cjs'),{'./common.cjs':C});
 const file=path.join(__dirname,'native.cjs'),N=load(file,{'node:fs':fakeFS,'./restore-diagnostic.cjs':restoreModule}).Native,n=new N(opts);
 Object.assign(n,{privateRoot:root,docker:'/usr/bin/docker',prefix:'ssb-native-'+opts.run,pg:{id:id(1)},probeContainer:{id:id(3)},networks:{internal:{name:'synthetic-internal',id:id(20)}},images:{api:'sha256:'+id(100)},initial:{containers:[]},synthetic:{passwords:Object.fromEntries(['postgres','ssb_runtime','ssb_admin_writer'].map(k=>[k,'1'.repeat(64)]))},proc:new C.Processes({deadline:n.deadline,privateRoot:root}),probeDeadline:performance.now()+90000});
 Object.defineProperty(n,'verifiedPublicationManifest',{value:pm()});
 if(extra.old){const old=load(path.resolve(__dirname,'../../../baseline/.github/ssb-native-forward-recovery/native.cjs'),{'node:fs':fakeFS}).Native;n.restore=old.prototype.restore;n.probe=old.prototype.probe;}
 // Only the already completed phases/closure are modelled. Restore/probe/d/command/Processes stay real.
 const original=n.execute.bind(n),data=evidence();n.execute=async phase=>phase==='restore'?original(phase):{verified:true,...data[phase]};
 n.close=async()=>{n.proc.assertClosed();if(extra.closureFailure)throw new GateError('closure_incomplete');return{verified:true,...data.closure};};
 return{n,root,calls,children,counts};
}
async function run(cfg={},extra={}){
 const h=harness(cfg,extra),lines=[];let error;const deadline=h.n.deadline,probeDeadline=h.n.probeDeadline;
 try{await main({...opts,output:line=>{if(extra.receiptWriteFailure&&lines.length===17)throw Object.assign(Error(marker),{code:'ENOSPC'});lines.push(line);}},h.n);}catch(e){error=e;}
 h.n.proc.assertClosed();assert.equal(h.n.deadline,deadline);assert.equal(h.n.probeDeadline,probeDeadline);assert.ok(h.children.every(c=>c.exitCode!==null));
 const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|synthetic-private|SELECT |ALTER ROLE|PASSWORD|stack|\.env/);
 return{...h,lines,rows,error};
}
function receive(lines,writeFailure){
 const dest=path.join(tmp(),'received'),logs=[],api=(bin,args)=>{assert.equal(bin,'gh');const u=args[1];if(u.endsWith('/runs/'+opts.run))return JSON.stringify({id:+opts.run,event:'workflow_dispatch',run_attempt:1,head_sha:opts.workflowHead,display_title:dispatchTitle(opts.workflowHead,opts.dispatchNonce),status:'completed',conclusion:'failure',path:'.github/workflows/ssb-native-forward-recovery.yml'});if(u.endsWith('/jobs/'+job))return JSON.stringify({id:+job,run_id:+opts.run,conclusion:'failure',name:'Native forward recovery',labels:['ubuntu-24.04']});assert.ok(u.endsWith('/logs'));return lines.join('\n');};
 const f={...fs,writeFileSync(p,...a){if(path.basename(p)===writeFailure)throw Object.assign(Error(marker),{code:'ENOSPC'});return fs.writeFileSync(p,...a);}};
 load(path.join(__dirname,'receive.cjs'),{'node:fs':f,'node:child_process':{execFileSync:api}},{console:{log:x=>logs.push(x)}}).main([opts.run,job,opts.workflowHead,opts.dispatchNonce,dest]);
 assert.equal(logs.length,1);const proof=JSON.parse(fs.readFileSync(path.join(dest,'Empfang.json')));assert.equal(proof.status,'PARTIAL_FAILURE_RECEIVED');assert.equal(proof.publicationManifest,pm());return proof;
}
const fail=h=>h.rows.find(r=>r.phase==='restore').detail.failure;
function find(e,fn){return e&&(fn(e)||find(e.cause,fn)||Array.isArray(e.errors)&&e.errors.some(x=>find(x,fn)));}
test('actual restore preserves binary dump, command contract, authenticated readiness order and byte comparison',async()=>{
 const h=await run();assert.ifError(h.error);assert.equal(h.rows.at(-1).phase,'complete');parseReceipts(h.lines.join('\n'),opts.run,SOURCE,opts);
 const calls=h.calls,roles=calls.find(x=>x.step==='role-import'),restore=calls.find(x=>x.step==='database-import');
 assert.equal(roles.input,'ALTER ROLE postgres LOGIN;\nCREATE ROLE ssb_runtime;\n');assert.deepEqual(restore.input,Buffer.from([80,71,68,77,80,0,255,254,1]));
 assert.ok(roles.a.includes('ON_ERROR_STOP=1'));assert.ok(restore.a.includes('--exit-on-error'));
 const actions=calls.filter(x=>x.a.at(-1)==='/proof/probe.cjs').map(x=>JSON.parse(x.input));assert.deepEqual(actions.map(x=>x.action),['database','postgres-ready-restore','restore-logins','database']);
 assert.equal(actions[0].restoreStage,'before');assert.equal(actions.at(-1).restoreStage,'after');assert.equal(actions.at(-1).host,'restore-db');assert.equal(actions.at(-1).noPools,true);
 assert.ok(calls.indexOf(calls.find(x=>x.input&&String(x.input).includes('postgres-ready-restore')))<calls.indexOf(roles));
 for(const p of h.counts){const c=JSON.parse(fs.readFileSync(p));assert.equal(c.pools,c.ends);}
});
for(const driverStep of ['dump','postgres-create','postgres-start','role-dump','role-import','database-import'])test('actual driver failure stays rejecting with stable operation: '+driverStep,async()=>{
 const h=await run({driverStep});assert.ok(h.error);const d=fail(h);assert.equal(d.restore.step,driverStep);assert.equal(d.restore.gate,'command_failed');assert.equal(d.process.exit,1);assert.equal(d.process.closed,true);validateFailure(d);receive(h.lines);assert.ok(!h.rows.some(r=>r.phase==='inventory'));assert.equal(h.calls.filter(c=>c.step===driverStep).length,1);
});
const cases=[
 ['database before SQL',{action:'database',restoreStage:'before',step:'snapshot-migrations',code:'42P01'},'database-before','snapshot-migrations','Error','42P01','unknown'],
 ['after permission',{action:'database',restoreStage:'after',step:'snapshot-tables',code:'42501'},'database-after','snapshot-tables','Error','42501','unknown'],
 ['after JSON',{action:'database',restoreStage:'after',step:'snapshot-constraints',kind:'json'},'database-after','snapshot-constraints','SyntaxError','unknown','unknown'],
 ['after TypeError',{action:'database',restoreStage:'after',step:'snapshot-markers',kind:'type'},'database-after','snapshot-markers','TypeError','unknown','unknown'],
 ['after mismatch',{action:'database',restoreStage:'after',step:'snapshot-compare'},'database-after','snapshot-compare','AssertionError','unknown','unknown'],
 ['role password',{action:'restore-logins',step:'restore-password',code:'42501'},'role-logins','restore-password','Error','42501','unknown'],
 ['role login',{action:'restore-logins',step:'restore-session',code:'28P01'},'role-logins','restore-session','Error','28P01','unknown'],
 ['role access',{action:'restore-logins',step:'restore-session',code:'EACCES'},'role-logins','restore-session','Error','unknown','EACCES'],
 ['unknown',{action:'restore-logins',step:'restore-session',code:'SECRET_CODE'},'role-logins','restore-session','Error','unknown','unknown'],
 ['primitive',{action:'restore-logins',step:'restore-session',kind:'primitive'},'role-logins','restore-session','unknown','unknown','unknown'],
 ['role close',{action:'restore-logins',step:'restore-pool-close',code:'EIO'},'role-logins','restore-pool-close','Error','unknown','EIO']
];
for(const [name,cfg,step,substep,kind,sqlstate,nodeCode]of cases)test('real Node stdin entry -> process -> driver -> receipt -> receiver: '+name,async()=>{
 const h=await run(cfg);assert.ok(h.error);const d=fail(h),p=probeCallsInFailure(d)[0];assert.equal(d.restore.step,step);assert.equal(p.primary.step,substep);assert.equal(p.primary.errorClass,kind);assert.equal(p.primary.sqlstate,sqlstate);assert.equal(p.primary.nodeCode,nodeCode);assert.equal(p.binding.publication,pm());receive(h.lines);
});
test('historical driver drops role import operation; corrected driver retains it without asserting historical SQL cause',async()=>{
 const old=await run({driverStep:'role-import'},{old:true});assert.ok(old.error);assert.equal(fail(old).restore,undefined);assert.equal(fail(old).code,'command_failed');
 const next=await run({driverStep:'role-import'});assert.equal(fail(next).restore.step,'role-import');
});
for(const output of ['missing','truncated','json','call','run','publication','action','private','write-failed','exit-zero'])test('unusable or misbound probe diagnosis never accepts restore: '+output,async()=>{
 const h=await run({action:'restore-logins',step:'restore-session',code:'28P01',output});assert.ok(h.error);assert.ok(!probeCallsInFailure(fail(h)).length);assert.match(JSON.stringify(fail(h)),/probe_diagnostic/);receive(h.lines);
});
for(const cfg of [{superuserAllowed:true},{wrongUser:true},{grants:true},{activePools:true}])test('unchanged security assertions reject '+JSON.stringify(cfg),async()=>{const h=await run(cfg);assert.ok(h.error);receive(h.lines);});
test('SQL primary survives both nested pool closure failures',async()=>{
 const h=await run({action:'restore-logins',step:'restore-session',code:'28P01',closeFailure:true}),p=probeCallsInFailure(fail(h))[0];assert.ok(h.error);assert.equal(p.primary.sqlstate,'28P01');assert.deepEqual(p.cleanup.map(x=>x.step),['restore-pool-close','pool-close']);assert.ok(p.cleanup.every(x=>x.nodeCode==='EIO'));receive(h.lines);
});
test('additional process evidence write failure retains original CLI error and restore step',async()=>{
 const h=await run({action:'database',restoreStage:'before',step:'snapshot-roles',code:'42501'},{rawWriteFailure:true});assert.ok(find(h.error,e=>e.code==='command_failed'));assert.ok(find(h.error,e=>e.code==='evidence_write_failed'));assert.equal(probeCallsInFailure(fail(h))[0].primary.sqlstate,'42501');receive(h.lines);
});
test('additional closure and receipt write failures do not replace primary',async()=>{
 for(const extra of [{closureFailure:true},{receiptWriteFailure:true}]){const h=await run({driverStep:'database-import'},extra);assert.ok(find(h.error,e=>e.restoreDiagnostic?.step==='database-import'));assert.ok(find(h.error,e=>e.code==='command_failed'));if(extra.receiptWriteFailure)assert.throws(()=>receive(h.lines));else receive(h.lines);}
});
function rechain(rows){let prev='0'.repeat(64);return rows.map((r,seq)=>{const b=JSON.stringify({...r,seq,previous:prev});prev=sha(b);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(b).toString('base64')+' '+prev;});}
test('receiver rejects wrong restore binding, extra fields, absent/truncated receipts and write failures',async()=>{
 const h=await run({driverStep:'role-import'});
 for(const mutate of [d=>d.binding.run='999',d=>d.binding.source='f'.repeat(40),d=>d.binding.publication='f'.repeat(64),d=>d.step='private-path',d=>d.message=marker,d=>d.lastConfirmed='result']){const rows=structuredClone(h.rows);mutate(rows[17].detail.failure.restore);assert.throws(()=>receive(rechain(rows)));}
 assert.throws(()=>receive(h.lines.slice(0,-1)));assert.throws(()=>receive([...h.lines.slice(0,-1),h.lines.at(-1).slice(0,-5)]));
 for(const file of ['receipts.txt','Empfang.json'])assert.throws(()=>receive(h.lines,file));
});
test('forced process termination remains error, never clean restore',async()=>{const h=await run({driverStep:'database-import',signal:'SIGKILL'});assert.ok(h.error);assert.equal(fail(h).process.signal,'SIGKILL');receive(h.lines);});
test('confirmed old probe finally masks SQL primary with pool close error; corrected path preserves both',async()=>{
 for(const old of [true,false]){
  const primary=Object.assign(Error(marker),{code:'42P01'}),cleanup=Object.assign(Error(marker),{code:'EIO'});let ends=0;
  const file=path.join(old?path.resolve(__dirname,'../../../baseline/.github/ssb-native-forward-recovery'):__dirname,'probe.cjs');
  const m=load(file,{'/app/node_modules/pg':{Pool:class{async query(){throw primary;}async end(){ends++;throw cleanup;}}}});
  let error;try{await m.main({action:'database',passwords:{postgres:'1'.repeat(64)}});}catch(e){error=e;}assert.equal(ends,1);
  if(old)assert.equal(error,cleanup);else{assert.ok(error instanceof AggregateError);assert.equal(error.errors[0],primary);assert.equal(error.errors[1],cleanup);assert.ok(primary.stack);}
 }
});
test('query literals and security assertions remain byte-identical despite step wrappers',()=>{
 const before=fs.readFileSync(path.resolve(__dirname,'../../../baseline/.github/ssb-native-forward-recovery/probe.cjs'),'utf8'),after=fs.readFileSync(path.join(__dirname,'probe.cjs'),'utf8');
 const sql=s=>[...s.slice(s.indexOf('async function database(input)')).matchAll(/(?:p|admin)\.query\((['"`])([\s\S]*?)\1\)/g)].map(m=>m[2]);
 assert.deepEqual(sql(after),sql(before));assert.equal(sql(after).length,11);
 for(const text of ['assert.equal(snapshot.migrations.length,34)','assert.equal(snapshot.roles.length,4)','assert.equal(snapshot.markers.length,2)','assert.ok(snapshot.receipts.length>=4)',"assert.rejects(p.query('SET ROLE postgres'),e=>e.code==='42501')"])assert.ok(before.includes(text)&&after.includes(text));
});
test('receiver rejects swapped before/after context and misplaced restore subdiagnosis',async()=>{
 const h=await run({action:'database',restoreStage:'after',step:'snapshot-tables',code:'42501'});
 for(const mutate of [v=>v.probe.binding.restoreStage='before',v=>delete v.restore,v=>{v.restore.step='role-import';v.restore.lastConfirmed='role-filter';}]){const rows=structuredClone(h.rows);mutate(rows[17].detail.failure);assert.throws(()=>receive(rechain(rows)));}
});
for(const primitiveValue of ['null','undefined','false','zero','empty'])test('falsy thrown primary remains rejecting and closes both pools: '+primitiveValue,async()=>{
 const h=await run({action:'restore-logins',step:'restore-session',kind:'primitive',primitiveValue});assert.ok(h.error);const p=probeCallsInFailure(fail(h))[0];assert.equal(p.primary.errorClass,'unknown');assert.equal(p.primary.step,'restore-session');receive(h.lines);
 const c=JSON.parse(fs.readFileSync(h.counts.at(-1)));assert.equal(c.pools,2);assert.equal(c.ends,2);
});
test('present falsy restore diagnostic fields are rejected, not silently treated as absent',async()=>{
 const h=await run({driverStep:'role-import'});
 for(const bad of [null,false,0,'']){const rows=structuredClone(h.rows);rows[17].detail.failure.restore=bad;assert.throws(()=>receive(rechain(rows)),e=>e.code==='restore_diagnostic_invalid');}
});
test('readiness subdiagnosis agrees with enclosing restore step; legacy absence remains readable',async()=>{
 const h=await run({action:'postgres-ready-restore',step:'readiness-query',code:'42501'});assert.ok(h.error);assert.equal(fail(h).restore.step,'postgres-ready');assert.equal(probeCallsInFailure(fail(h))[0].primary.sqlstate,'42501');receive(h.lines);
 for(const mutate of [v=>{v.restore.step='role-import';v.restore.lastConfirmed='role-filter';},v=>v.restore.binding.publication='f'.repeat(64),v=>v.restore.binding.run='999']){const rows=structuredClone(h.rows);mutate(rows[17].detail.failure);assert.throws(()=>receive(rechain(rows)));}
 const legacy=structuredClone(h.rows);delete legacy[17].detail.failure.restore;receive(rechain(legacy));
 const nested=structuredClone(h.rows),v=nested[17].detail.failure,restore=v.restore;delete v.restore;nested[17].detail.failure={code:'aggregate',process:null,state:null,causes:[v],restore};receive(rechain(nested));
 restore.step='role-import';restore.lastConfirmed='role-filter';assert.throws(()=>receive(rechain(nested)));
});
