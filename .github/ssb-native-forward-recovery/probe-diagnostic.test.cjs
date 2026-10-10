'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{createRequire}=require('node:module'),cp=require('node:child_process');
const common=require('./common.cjs'),{sha,GateError}=common;
const {main,SOURCE}=require('./controller.cjs'),{publicFailure,decodeProbe,probeMarker,validateProbe,probeCallsInFailure}=require('./diagnostics.cjs');
const {parseReceipts,dispatchTitle,Receipts}=require('./evidence.cjs');
const options={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'23456789',attempt:'1',workflowHead:'c'.repeat(40),dispatchNonce:'d'.repeat(64)},job='87654322';
const pm=()=>sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json')));
const id='a'.repeat(64),image='sha256:'+'b'.repeat(64),marker='SYNTHETIC_PRIVATE_SQL_PASSWORD_PATH';
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ssb-probe-diag-'));
assert.ok(process.env.SSB_PROBE_TEST_SOURCE&&path.isAbsolute(process.env.SSB_PROBE_TEST_SOURCE),'run through the bound finalizer with a verified source root');
function load(file,replacements={},globals={}){const m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname:path.dirname(file),__filename:file,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,performance,setTimeout,clearTimeout,setInterval,clearInterval,console,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError,...globals};vm.compileFunction(fs.readFileSync(file,'utf8'),Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;}
function binding(){return{version:1,action:'initialize',run:options.run,source:SOURCE,publication:pm(),call:'e'.repeat(64)};}
function input(diagnostic=binding()){return{action:'initialize',service:'ssb-native-'+options.run,source:SOURCE,diagnostic,passwords:Object.fromEntries(['postgres','ssb_runtime','ssb_admin_writer','ssb_reporter','ssb_migrator'].map(k=>[k,'1'.repeat(64)]))};}
function transport(config,root,record){
 return(bin,args,spawnOptions)=>{
  assert.equal(bin,'/usr/bin/docker');assert.deepEqual(args,['--host','unix:///var/run/docker.sock','exec','-i',id,'node','/proof/probe.cjs']);
  record.push({args,spawnOptions});
  return cp.spawn(process.execPath,['--require',path.join(__dirname,'probe-offline-preload.cjs'),path.join(__dirname,'probe.cjs')],{...spawnOptions,env:{PATH:process.env.PATH,SSB_PROBE_TEST_SOURCE:process.env.SSB_PROBE_TEST_SOURCE,SSB_PROBE_TEST:JSON.stringify({...config,countsFile:path.join(root,'counts.json')})}});
 };
}
function harness(config={},extra={}){
 assert.equal(process.version,'v24.17.0');
 const root=tmp(),record=[],fakeFS={...fs,statfsSync:()=>({bavail:1e9,bsize:4096,ffree:1e9}),readFileSync:(p,...args)=>p==='/proc/meminfo'?'MemAvailable: 16000000 kB\n':fs.readFileSync(p,...args)};
 const processFS={...fs,writeFileSync(p,...args){if(extra.rawWriteFailure&&/process-\d+\.(stdout|stderr)$/.test(p))throw Object.assign(Error(marker),{code:'ENOSPC'});return fs.writeFileSync(p,...args);}};
 const C=load(path.join(__dirname,'common.cjs'),{'node:fs':processFS,'node:child_process':{spawn:transport(config,root,record)}});
 const N=load(path.join(__dirname,'native.cjs'),{'node:fs':fakeFS}).Native,n=new N(options);
 Object.defineProperty(n,'verifiedPublicationManifest',{value:pm()});
 Object.assign(n,{privateRoot:root,docker:'/usr/bin/docker',prefix:'ssb-native-'+options.run,synthetic:input(),images:{api:image},probeContainer:{id},proc:new C.Processes({deadline:n.deadline,privateRoot:root})});
 return{n,root,record};
}
async function failure(config,extra={}){
 const h=harness(config,extra),lines=[],primaryErrors=[];
 // Execute the production probe/d/command/Processes chain; only earlier Docker phases are simulated.
 const execute=h.n.execute.bind(h.n);
 h.n.execute=async phase=>{
  if(phase==='preflight')return{verified:true,counts:[901,4],hashes:[pm()]};
  if(phase==='bases')return{verified:true,counts:[4],ids:require('./registry-bindings.json').images.map(x=>x.imageId)};
  if(phase==='builds')return{verified:true,counts:[4,2],ids:[1,2,3,4,1].map(x=>'sha256:'+String(x).repeat(64))};
  if(phase==='initialize'){const progress=new(require('./diagnostics.cjs').InitProgress)();progress.enter('redis-version');progress.confirm();progress.enter('database-initialize');try{return await h.n.probe('initialize');}catch(e){primaryErrors.push(e);throw progress.failure(e);}}
  return execute(phase);
 };
 h.n.close=async()=>{h.n.proc.assertClosed();if(extra.closureFailure)throw Object.assign(Error(marker),{code:'closure_incomplete'});return{verified:true,counts:[0,0,1],ids:[],detail:{failure:null,outcomes:[]}};};
 let error;try{await main({...options,output:line=>{if(extra.receiptWriteFailure&&lines.length===3)throw Object.assign(Error(marker),{code:'ENOSPC'});lines.push(line);}},h.n);}catch(e){error=e;}
 assert.ok(error);assert.equal(h.record.length,1);h.n.proc.assertClosed();assert.equal(h.n.proc.calls[0].closed,true);assert.equal(h.n.proc.calls[0].signal,null);
 const rows=lines.map(l=>JSON.parse(Buffer.from(l.split(' ')[1],'base64')));
 assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_PRIVATE|synthetic-private|ALTER ROLE|PASSWORD|stack|SELECT |INSERT INTO/);
 return{...h,error,lines,rows,primaryErrors};
}
function receive(lines,overrides={}){
 const destination=path.join(tmp(),'received'),logs=[],fakeFS={...fs,writeFileSync(p,...args){if(path.basename(p)===overrides.writeFailure)throw Object.assign(Error(marker),{code:'ENOSPC'});return fs.writeFileSync(p,...args);}};
 const api=(bin,args)=>{assert.equal(bin,'gh');const url=args[1];if(url.endsWith('/runs/'+options.run))return JSON.stringify({id:Number(options.run),event:'workflow_dispatch',run_attempt:1,head_sha:options.workflowHead,display_title:dispatchTitle(options.workflowHead,options.dispatchNonce),status:'completed',conclusion:'failure',path:'.github/workflows/ssb-native-forward-recovery.yml'});if(url.endsWith('/jobs/'+job))return JSON.stringify({id:Number(job),run_id:Number(options.run),conclusion:'failure',name:'Native forward recovery',labels:['ubuntu-24.04']});assert.ok(url.endsWith('/logs'));return lines.join('\n');};
 const r=load(path.join(__dirname,'receive.cjs'),{'node:fs':fakeFS,'node:child_process':{execFileSync:api}},{console:{log:x=>logs.push(x)}});
 r.main([options.run,job,options.workflowHead,options.dispatchNonce,destination]);
 const proof=JSON.parse(fs.readFileSync(path.join(destination,'Empfang.json')));assert.equal(proof.status,'PARTIAL_FAILURE_RECEIVED');assert.equal(proof.publicationManifest,pm());assert.equal(logs.length,1);return proof;
}
const cases=[
 ['SQLSTATE',{step:'migration-execute',migration:2,code:'42501'},'migration-execute','migration-read','Error','42501','unknown','unknown',2],
 ['JSON',{step:'migration-read',migration:3,kind:'json'},'migration-read','migration-begin','SyntaxError','unknown','unknown','unknown',3],
 ['TypeError',{step:'schema-ledger',kind:'type'},'schema-ledger','migration-list','TypeError','unknown','unknown','unknown',null],
 ['EACCES',{step:'migration-read',migration:1,code:'EACCES'},'migration-read','migration-begin','Error','unknown','EACCES','unknown',1],
 ['Assertion',{step:'migration-execute',migration:4,kind:'assertion'},'migration-execute','migration-read','AssertionError','unknown','unknown','ERR_ASSERTION',4],
 ['unknown',{step:'migration-connect',code:'SECRET_CODE'},'migration-connect','schema-ledger','Error','unknown','unknown','unknown',1],
 ['Node connection',{step:'schema-ledger',code:'ECONNREFUSED'},'schema-ledger','migration-list','Error','unknown','ECONNREFUSED','unknown',null],
 ['pool close',{step:'pool-close',code:'EIO'},'pool-close','database-assertions','Error','unknown','EIO','unknown',null],
 ['late assertion',{step:'database-assertions'},'database-assertions','database-readback','AssertionError','unknown','unknown','ERR_ASSERTION',null]
];
for(const [name,config,step,lastConfirmed,errorClass,sqlstate,nodeCode,assertionCode,migration]of cases)test('real Node entry -> subprocess -> driver -> receipt -> receiver: '+name,async()=>{
 const h=await failure(config),d=probeCallsInFailure(h.rows[3].detail.failure);assert.equal(d.length,1);
 assert.deepEqual({...d[0].primary,lastMigration:undefined},{step,lastConfirmed,migration,errorClass,sqlstate,nodeCode,assertionCode,gate:'unknown',lastMigration:undefined});
 assert.equal(d[0].binding.publication,pm());assert.equal(d[0].binding.run,options.run);assert.equal(h.n.proc.calls[0].code,1);
 assert.throws(()=>parseReceipts(h.lines.join('\n'),options.run,SOURCE,options));
 receive(h.lines);assert.equal(JSON.parse(fs.readFileSync(path.join(h.root,'counts.json'))).endCalls,1);
});
test('successful actual entry runs once and completely awaits all 34 migrations and pool close',async()=>{const h=harness(),result=await h.n.probe('initialize');assert.deepEqual(result.counts,[34,4,1]);assert.equal(h.record.length,1);h.n.proc.assertClosed();assert.equal(h.n.proc.calls[0].code,0);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(h.root,'counts.json'))),{poolQueries:10,migration:34,releaseCalls:34,endCalls:1});assert.equal(h.n.start,Object.getPrototypeOf(h.n).start);assert.ok(h.n.deadline-h.n.startedAt<=990000);});
for(const output of ['empty','truncated','json','call','run','publication','action','private','extra','stdout'])test('malformed/missing/misbound process diagnostic stays blocking: '+output,async()=>{const h=await failure({step:'schema-ledger',code:'42501',output});assert.equal(probeCallsInFailure(h.rows[3].detail.failure).length,0);assert.match(JSON.stringify(h.rows[3].detail.failure),/probe_diagnostic_(?:missing|invalid|misbound)|probe_binding_invalid/);assert.equal(h.rows[3].ok,false);receive(h.lines);});
test('diagnostic emitted with Exit 0 still rejects success',async()=>{const h=await failure({step:'schema-ledger',code:'42501',exitZero:true});assert.equal(h.n.proc.calls[0].code,0);assert.equal(h.primaryErrors[0].code,'probe_diagnostic_invalid');assert.equal(h.rows[3].ok,false);});
test('child diagnostic write failure preserves failing exit and is explicitly missing',async()=>{const h=await failure({step:'migration-execute',code:'42501',writeFailure:true});assert.equal(h.n.proc.calls[0].code,1);assert.match(JSON.stringify(h.rows[3].detail.failure),/probe_diagnostic_missing/);receive(h.lines);});
test('primary SQLSTATE survives client-release and pool-close failures, then raw-write and closure failures',async()=>{const h=await failure({step:'migration-execute',migration:2,code:'42501',releaseFailure:true,endFailure:true},{rawWriteFailure:true,closureFailure:true});const d=probeCallsInFailure(h.rows[3].detail.failure)[0];assert.equal(d.primary.sqlstate,'42501');assert.deepEqual(d.cleanup.map(x=>[x.step,x.nodeCode]),[['client-release','EIO'],['pool-close','ECONNRESET']]);assert.match(JSON.stringify(h.rows[3].detail.failure),/evidence_write_failed/);assert.equal(h.rows.at(-1).ok,false);assert.ok(h.error.errors);receive(h.lines);});
test('public receipt write failure retains original process error and cannot be accepted',async()=>{const h=await failure({step:'schema-ledger',code:'42501'},{receiptWriteFailure:true});const has=e=>e===h.primaryErrors[0]||e?.cause&&has(e.cause)||e?.errors?.some(has);assert.ok(has(h.error));assert.throws(()=>receive(h.lines));});
for(const file of ['receipts.txt','Empfang.json'])test('receiver '+file+' write failure never reports acceptance',async()=>{const h=await failure({step:'schema-ledger',code:'42501'});assert.throws(()=>receive(h.lines,{writeFailure:file}));});
function rechain(rows){let previous='0'.repeat(64);return rows.map((r,seq)=>{const bytes=JSON.stringify({...r,seq,previous});previous=sha(bytes);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(bytes).toString('base64')+' '+previous;});}
for(const kind of ['manifest','run','action','migration','private-field','unknown-code','wrong-phase','exit','omitted-closure'])test('actual receiver rejects forged probe evidence: '+kind,async()=>{
 const h=await failure({step:'migration-execute',migration:1,code:'42501'}),v=probeCallsInFailure(h.rows[3].detail.failure)[0];
 if(kind==='manifest')v.binding.publication='f'.repeat(64);if(kind==='run')v.binding.run='999';if(kind==='action')v.binding.action='roles';if(kind==='migration')v.primary.migration=35;if(kind==='private-field')v.primary.path=marker;if(kind==='unknown-code')v.primary.sqlstate='SECRET';if(kind==='wrong-phase'){h.rows[4].ok=false;h.rows[4].detail.failure=h.rows[3].detail.failure;}if(kind==='exit'){const walk=x=>{if(x.probe)x.process.exit=0;for(const c of x.causes)walk(c);};walk(h.rows[3].detail.failure);}if(kind==='omitted-closure')h.rows.pop();
 assert.throws(()=>receive(rechain(h.rows)));
});
test('wrong transport binding blocks before spawn, no fallback',async()=>{const h=harness();const b=binding(),request=input(b);await assert.rejects(h.n.proc.run('/usr/bin/docker',['exec','-i',id,'node','/other.cjs'],{input:JSON.stringify(request),probeDiagnostic:{binding:b,container:id}}),/probe_binding_invalid/);assert.equal(h.record.length,0);assert.equal(h.n.proc.calls.length,0);});
test('old actual process collector loses already sanitized child details; no historical SQL cause inferred',async()=>{
 const old=path.resolve(__dirname,'../../../../ssb-start-field-followup-20261010.L6MXNJ/publication/.github/ssb-native-forward-recovery/common.cjs'),root=tmp(),record=[];
 const C=load(old,{'node:child_process':{spawn:transport({step:'schema-ledger',code:'42501'},root,record)}}),p=new C.Processes({deadline:performance.now()+40000,privateRoot:root});let err;try{await p.run('/usr/bin/docker',['--host','unix:///var/run/docker.sock','exec','-i',id,'node','/proof/probe.cjs'],{input:JSON.stringify(input()),ms:15000});}catch(e){err=e;}assert.equal(err.code,'command_failed');assert.equal(err.probeDiagnostic,undefined);assert.match(fs.readFileSync(path.join(root,'process-0.stderr'),'utf8'),/42501/);assert.doesNotMatch(JSON.stringify(publicFailure(err)),/42501/);p.assertClosed();
});
test('unexpected Exit 2 is not decoded as the declared Exit 1 contract',async()=>{const h=await failure({step:'schema-ledger',code:'42501',exitTwo:true});assert.equal(h.n.proc.calls[0].code,2);assert.equal(probeCallsInFailure(h.rows[3].detail.failure).length,0);assert.equal(h.rows[3].ok,false);receive(h.lines);});
for(const step of ['pool-create','migration-list','migration-connect','migration-begin','migration-read','migration-record','migration-commit','client-release','roles-read','roles-apply','role-password-apply','tenant-site-fixture','user-fixture','site-config-fixture','database-readback'])test('fixed database substep reached through actual entry: '+step,async()=>{const h=await failure({step,code:'EIO'}),d=probeCallsInFailure(h.rows[3].detail.failure)[0];assert.equal(d.primary.step,step);assert.equal(d.primary.nodeCode,'EIO');receive(h.lines);});
test('private bounded failureRecord preserves primary probe diagnostic after public write failure',async()=>{const h=await failure({step:'migration-execute',migration:2,code:'42501'},{rawWriteFailure:true,receiptWriteFailure:true,closureFailure:true}),record=common.failureRecord(h.error);assert.match(JSON.stringify(record),/42501/);assert.match(JSON.stringify(record),/evidence_write_failed/);assert.doesNotMatch(JSON.stringify(record),/SYNTHETIC_PRIVATE|synthetic-private|SELECT |ALTER ROLE|PASSWORD/);});
test('strict binding rejects array coercions, extra fields and unbound migrations',()=>{
 for(const change of [{call:['e'.repeat(64)]},{publication:['e'.repeat(64)]},{run:23456789},{path:'/synthetic-private'}])assert.throws(()=>require('./diagnostics.cjs').validateProbeBinding({...binding(),...change}));
 const {ProbeProgress}=require('./diagnostics.cjs'),t=new ProbeProgress(binding());t.enter('schema-ledger');t.capture(Object.assign(Error(marker),{code:'unrecognized'}));const good=t.diagnostic();
 for(const change of [{migration:1},{nodeCode:'TOKEN'},{gate:'query_failed'},{errorClass:'DatabaseError'},{sqlstate:'99999'},{assertionCode:'ERR_SECRET'}])assert.throws(()=>validateProbe({...good,primary:{...good.primary,...change}}));
 assert.throws(()=>decodeProbe(Buffer.from(probeMarker+JSON.stringify(good)+'\n'+probeMarker+JSON.stringify(good)+'\n'),binding()));
});
