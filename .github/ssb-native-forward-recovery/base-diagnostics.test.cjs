'use strict';
// Synthetic output only. The historical Docker stderr was not exported.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {EventEmitter}=require('node:events');
const {createRequire}=require('node:module');
const {classifyBase,validateBase,references}=require('./base-diagnostics.cjs');
const {Native}=require('./native.cjs'),{main,reportFailure,SOURCE}=require('./controller.cjs');
const {publicFailure,validateFailure}=require('./diagnostics.cjs'),{parseReceipts,Receipts}=require('./evidence.cjs');
const {sha}=require('./common.cjs');
const reference=references[0],url='https://registry-1.docker.io/v2/library/node/manifests/'+reference.split('@')[1];
const options={authorization:'ONE_NATIVE_FORWARD_RECOVERY',run:'12345678',attempt:'1',workflowHead:'a'.repeat(40),dispatchNonce:'b'.repeat(64)};
const cases=[
 ['unauthorized: authentication required','reported_authentication',null],
 ['denied: requested access to the resource is denied','reported_denial',null],
 ['toomanyrequests: Too Many Requests','reported_rate_limit',null],
 ['toomanyrequests: You have reached your unauthenticated pull rate limit. https://www.docker.com/increase-rate-limit','reported_rate_limit',null],
 [`manifest for ${reference} not found: manifest unknown: manifest unknown`,'reported_manifest_missing',null],
 ['no matching manifest for linux/amd64 in the manifest list entries','reported_platform_mismatch',null],
 [`failed to do request: Head "${url}": tls: failed to verify certificate: x509: certificate signed by unknown authority`,'reported_tls_error',null],
 [`Head "${url}": dial tcp: lookup registry-1.docker.io on 192.0.2.1:53: no such host`,'reported_dns_error',null],
 [`Head "${url}": dial tcp 192.0.2.2:443: connect: connection refused`,'reported_connection_error',null],
 ...[[401,'Unauthorized'],[403,'Forbidden'],[429,'Too Many Requests'],[500,'Internal Server Error'],[503,'Service Unavailable']].map(([code,name])=>[`unexpected status from HEAD request to ${url}: ${code} ${name}`,'reported_http_error',code]),
];
function processes({before=false,stderr='',stdout='',exit=1,signal=null,writeFailure=false,timeout=false,spawnError=false,realChild=false}={}){
 const file=before?path.resolve(__dirname,'../../../../ssb-native-init-closure-followup-20261009.tAr8EB/publication/.github/ssb-native-forward-recovery/common.cjs'):path.join(__dirname,'common.cjs');
 const writes=[],calls=[],kills=[],timers=[],module={exports:{}},realRequire=createRequire(file);
 const fakeFS={...fs,writeFileSync(p,bytes,opts){writes.push({path:p,bytes:Buffer.from(bytes),opts});if(writeFailure===true||writeFailure==='stderr'&&p.endsWith('.stderr'))throw Object.assign(Error('SYNTHETIC_PRIVATE_PATH'),{code:'ENOSPC'});}};
 const spawn=(bin,args,o)=>{calls.push({bin,args,o});const c=new EventEmitter();c.pid=123456789;c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();c.stdin.end=()=>queueMicrotask(()=>{c.stdout.emit('data',Buffer.from(stdout));c.stderr.emit('data',Buffer.from(stderr));if(timeout)timers[0]();if(spawnError)c.emit('error',Error('SYNTHETIC_PRIVATE_SPAWN'));c.emit('close',exit,signal);});return c;};
 const actualSpawn=(bin,args,o)=>{calls.push({bin,args,o});assert.equal(bin,'/usr/bin/docker');return require('node:child_process').spawn(process.execPath,['-e',`process.stdout.write(${JSON.stringify(stdout)});process.stderr.write(${JSON.stringify(stderr)},()=>{process.exitCode=${exit};});`],o);};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:id=>id==='node:fs'?fakeFS:id==='node:child_process'?{spawn:realChild?actualSpawn:spawn}:realRequire(id),process:{env:process.env,kill:(...a)=>{kills.push(a);if(realChild)process.kill(...a);}},performance,Buffer,AggregateError,setTimeout:realChild?setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:realChild?clearTimeout:()=>{}},{filename:file});
 return{proc:new module.exports.Processes({deadline:performance.now()+90000,privateRoot:'/synthetic-private-evidence'}),writes,calls,kills,failureRecord:module.exports.failureRecord};
}
async function throughController(config={}){
 const p=processes(config),n=new Native(options),lines=[];n.proc=p.proc;n.resources=()=>{};n.docker='/usr/bin/docker';
 n.preflight=async()=>({verified:true,counts:[901,4],hashes:[sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json')))]});
 let error;try{await main({...options,output:line=>{if(config.receiptWriteFailure&&lines.length===1)throw Error('SYNTHETIC_PRIVATE_OUTPUT');lines.push(line);}},n);}catch(e){error=e;}
 assert.ok(error,'failure must reject');assert.equal(p.calls.length,1,'no inspect, retry, later bases, build or init after failure');
 assert.deepEqual(p.calls[0].args,['--host','unix:///var/run/docker.sock','pull','--platform=linux/amd64',reference]);
 p.proc.assertClosed();return{...p,n,error,lines};
}
for(const [message,category,httpStatus]of cases)test('complete actual process/controller/receipt path: '+category+' '+httpStatus+' '+cases.findIndex(c=>c[0]===message),async()=>{
 const h=await throughController({stderr:'Error response from daemon: '+message+'\n'});
 assert.equal(h.error.code,'command_failed');assert.deepEqual(h.error.baseDiagnostic,{reference,category,httpStatus});
 assert.equal(h.error.process.code,1);assert.equal(h.error.process.closed,true);
 assert.equal(h.writes.length,2);assert.match(h.writes[1].bytes.toString(),/Error response/);
 const result=parseReceipts(h.lines.join('\n'),options.run,SOURCE,options,{partial:true});assert.equal(result.proof.status,'PARTIAL_FAILURE_RECEIVED');
 const records=h.lines.map(x=>JSON.parse(Buffer.from(x.split(' ')[1],'base64')));assert.deepEqual(records[1].detail.failure.base,{reference,category,httpStatus});assert.equal(records.at(-1).ok,true);
 assert.throws(()=>parseReceipts(h.lines.join('\n'),options.run,SOURCE,options));
 assert.doesNotMatch(JSON.stringify(records),/https:|192\.0\.2|SYNTHETIC_PRIVATE|stderr|synthetic-private/);
});
test('historical process path loses classifier data; no claim about historical raw error',async()=>{
 const simulated='Error response from daemon: unauthorized: authentication required\n';
 const old=await throughController({before:true,stderr:simulated}),next=await throughController({stderr:simulated});
 assert.equal(old.error.baseDiagnostic,undefined);assert.equal(next.error.baseDiagnostic.category,'reported_authentication');
 assert.equal(old.error.process.code,next.error.process.code);
});
for(const input of ['', 'Digest not confirmed','PRIVATE_ACCESS_TOKEN=synthetic\nunauthorized: authentication required','unauthorized: authentication required\nno matching manifest for linux/amd64 in the manifest list entries',`unexpected status from HEAD request to ${url}: 401 Forbidden`,`unexpected status from HEAD request to ${url}: 418 Teapot`, `failed to resolve reference "other@sha256:${'0'.repeat(64)}": unauthorized: authentication required`,`Head "https://private.invalid/path": dial tcp 192.0.2.2:443: connect: connection refused`,`Head "https://user:synthetic@registry-1.docker.io/path": dial tcp 192.0.2.2:443: connect: connection refused`,'unauthorized: authentication require','unauthorized: authentication required\u001b[0m','x'.repeat(65537)])test('unknown/ambiguous input is explicit unknown, no inference: '+input.slice(0,35),async()=>{
 const h=await throughController({stderr:input}),b=h.error.baseDiagnostic;assert.deepEqual(b,{reference,category:'unknown',httpStatus:null});assert.doesNotMatch(JSON.stringify(publicFailure(h.error)),/PRIVATE_ACCESS|private\.invalid|user:|synthetic@/);
 assert.equal(parseReceipts(h.lines.join('\n'),options.run,SOURCE,options,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
});
test('both captured streams participate; conflicting stdout cannot be discarded',()=>{
 const a=Buffer.from(cases[0][0]),b=Buffer.from(cases[1][0]);assert.equal(classifyBase(a,Buffer.alloc(0),reference).category,'reported_authentication');assert.equal(classifyBase(a,b,reference).category,'unknown');
 assert.equal(classifyBase(Buffer.from('012345abcdef: Waiting\n'),a,reference).category,'reported_authentication');
 assert.equal(classifyBase(Buffer.alloc(0),Buffer.from([255]),reference).category,'unknown');
});
test('bounded wrapper and exact reference; no arbitrary stdout or suffix accepted',()=>{
 assert.equal(classifyBase(Buffer.alloc(0),Buffer.from(`Error response from daemon: failed to resolve reference "docker.io/${reference}": unauthorized: authentication required\n`),reference).category,'reported_authentication');
 assert.equal(classifyBase(Buffer.alloc(0),Buffer.from(cases[0][0]+' SECRET'),reference).category,'unknown');
 assert.throws(()=>classifyBase(Buffer.alloc(0),Buffer.alloc(0),'private@sha256:'+'a'.repeat(64)));
});
for(const fault of [{writeFailure:true},{writeFailure:'stderr'},{receiptWriteFailure:true},{writeFailure:true,receiptWriteFailure:true}])test('primary cause survives secondary output failure '+JSON.stringify(fault),async()=>{
 const h=await throughController({...fault,stderr:'Error response from daemon: '+cases[0][0]});
 const tree=publicFailure(h.error);validateFailure(tree);assert.match(JSON.stringify(tree),/reported_authentication/);assert.match(JSON.stringify(tree),/command_failed/);assert.doesNotMatch(JSON.stringify(tree),/SYNTHETIC_PRIVATE/);
 if(fault.writeFailure)assert.match(JSON.stringify(tree),/evidence_write_failed/);
 if(fault.receiptWriteFailure)assert.throws(()=>parseReceipts(h.lines.join('\n'),options.run,SOURCE,options,{partial:true}));
 else assert.equal(parseReceipts(h.lines.join('\n'),options.run,SOURCE,options,{partial:true}).proof.status,'PARTIAL_FAILURE_RECEIVED');
 assert.match(JSON.stringify(h.failureRecord(h.error)),/reported_authentication/);
 const out=[];await reportFailure({recordFailure:async()=>{throw Error('SYNTHETIC_PRIVATE');}},h.error,x=>out.push(x));assert.equal(out[0],'SSB_PRIVATE_DIAGNOSTIC_NOT_PERSISTED');assert.doesNotMatch(out.join('\n'),/SYNTHETIC_PRIVATE/);
});
for(const config of [{timeout:true,signal:'SIGTERM'},{signal:'SIGKILL',exit:137},{spawnError:true}])test('timeout, forced exit and spawn errors are never reinterpreted as Docker denial '+JSON.stringify(config),async()=>{
 const h=await throughController({...config,stderr:cases[0][0]});assert.equal(h.error.baseDiagnostic,undefined);assert.ok(!JSON.stringify(publicFailure(h.error)).includes('reported_authentication'));
});
test('wrong command/context/platform/ref cannot opt into classification or spawn',async()=>{
 for(const args of [['--host','tcp://private.invalid','pull','--platform=linux/amd64',reference],['--host','unix:///var/run/docker.sock','pull','--platform=linux/arm64',reference],['image','inspect',reference]]){const h=processes();await assert.rejects(h.proc.run('/usr/bin/docker',args,{baseReference:reference}));assert.equal(h.calls.length,0);}
});
test('strict public validation rejects extra fields, false status codes and cross-phase claims',()=>{
 const base={reference,category:'reported_authentication',httpStatus:null};
 for(const bad of [{...base,raw:'SECRET'},{...base,category:'SECRET'},{...base,httpStatus:401},{...base,category:'unknown',httpStatus:500},{...base,category:'reported_http_error',httpStatus:418},{...base,reference:'private'}])assert.throws(()=>validateBase(bad));
 const e=Object.assign(Error('PRIVATE'),{code:'command_failed',process:{index:7,code:1,closed:true,timeout:false,signal:null},baseDiagnostic:base});
 const valid=publicFailure(e);validateFailure(valid);for(const p of [{...valid.process,closed:false},{...valid.process,exit:0},{...valid.process,timeout:true}])assert.throws(()=>validateFailure({...valid,process:p}));
 const r=new Receipts(options.run,SOURCE,options,()=>{});assert.throws(()=>r.emit('preflight',false,{detail:{failure:valid,outcomes:[]}}),/base_phase_invalid/);
});
test('actual private record preserves bounded classification and original stack before recordFailure I/O error',async()=>{
 const h=await throughController({stderr:cases[0][0],writeFailure:true});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ssb-base-diagnostic-offline-'));fs.mkdirSync(path.join(dir,'raw'));h.n.privateRoot=dir;
 await h.n.recordFailure(h.error);const record=JSON.parse(fs.readFileSync(path.join(dir,'raw/failure.json')));assert.match(JSON.stringify(record),/reported_authentication/);assert.ok(record.failure.causes[0].frames.length>0);assert.doesNotMatch(JSON.stringify(record),/SYNTHETIC_PRIVATE/);
 await assert.rejects(h.n.recordFailure(h.error),e=>e.code==='EEXIST');assert.match(JSON.stringify(publicFailure(h.error)),/reported_authentication/);
});
for(const writeFailure of [false,'stderr'])test('real Node child pipes and close event through unchanged process runner; Docker never spawned; writeFailure='+writeFailure,async()=>{
 const h=await throughController({realChild:true,writeFailure,stderr:'Error response from daemon: '+cases[0][0]+'\n'});
 const result=parseReceipts(h.lines.join('\n'),options.run,SOURCE,options,{partial:true});assert.equal(result.proof.status,'PARTIAL_FAILURE_RECEIVED');
 assert.match(JSON.stringify(publicFailure(h.error)),/reported_authentication/);assert.equal(h.kills.length,0);assert.equal(h.proc.children.size,0);assert.equal(h.proc.calls[0].code,1);
});
test('overflow remains output_limit, never an accepted parsed Docker error',async()=>{
 const h=await throughController({stderr:'Error response from daemon: '+cases[0][0],stdout:'x'.repeat(8*1024*1024+1)});assert.equal(h.error.code,'output_limit');assert.equal(h.error.baseDiagnostic,undefined);
});
for(const failure of [null,'receipts.txt','Empfang.json','truncated'])test('actual receiver keeps only classified canonical receipts and never confirms failed storage: '+failure,async()=>{
 const h=await throughController({stderr:cases[0][0]}),received=new Map(),output=[],module={exports:{}},file=path.join(__dirname,'receive.cjs'),realRequire=createRequire(file),job='23456789';
 const log='SYNTHETIC_PRIVATE_UNSTRUCTURED_LOG\n'+(failure==='truncated'?h.lines.slice(0,-1):h.lines).join('\n');
 const fakeFS={...fs,mkdirSync(p,o){assert.equal(p,'/synthetic-received');assert.equal(o.mode,0o700);},writeFileSync(p,b,o){assert.equal(o.mode,0o600);assert.equal(o.flag,'wx');if(path.basename(p)===failure)throw Object.assign(Error('SYNTHETIC_PRIVATE_DISK'),{code:'ENOSPC'});received.set(path.basename(p),b);}};
 const execFileSync=(bin,args)=>{assert.equal(bin,'gh');const route=args[1];if(route.endsWith('/runs/'+options.run))return JSON.stringify({id:Number(options.run),event:'workflow_dispatch',run_attempt:1,head_sha:options.workflowHead,display_title:require('./evidence.cjs').dispatchTitle(options.workflowHead,options.dispatchNonce),status:'completed',conclusion:'failure',path:'.github/workflows/ssb-native-forward-recovery.yml'});if(route.endsWith('/jobs/'+job))return JSON.stringify({id:Number(job),run_id:Number(options.run),conclusion:'failure',name:'Native forward recovery',labels:['ubuntu-24.04']});if(route.endsWith('/logs'))return log;throw Error('unexpected mock route');};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname,process,console:{log:x=>output.push(x)},require:id=>id==='node:fs'?fakeFS:id==='node:child_process'?{execFileSync}:realRequire(id)});
 const invoke=()=>module.exports.main([options.run,job,options.workflowHead,options.dispatchNonce,'/synthetic-received']);
 if(failure){assert.throws(invoke);assert.equal(output.length,0);assert.ok(!received.has('Empfang.json'));}else{invoke();const proof=JSON.parse(received.get('Empfang.json'));assert.equal(proof.status,'PARTIAL_FAILURE_RECEIVED');assert.equal(sha(received.get('receipts.txt')),proof.publicReceiptSha256);assert.match(Buffer.from(received.get('receipts.txt').split('\n')[1].split(' ')[1],'base64').toString(),/reported_authentication/);}
 assert.doesNotMatch([...received.values()].join('\n')+output.join('\n'),/SYNTHETIC_PRIVATE/);
});
test('new receiver still reads unchanged historical partial receipt without inventing a base diagnosis',()=>{
 const prior=path.resolve(__dirname,'../../../../ssb-native-tAr8EB-execution-20261009.QpIci2');
 const metadata=JSON.parse(fs.readFileSync(path.join(prior,'remote-result.json'))),p=metadata.publicReceiptProof;
 const text=fs.readFileSync(path.join(prior,'public-receipts.txt'),'utf8'),parsed=parseReceipts(text,p.run,p.source,p,{partial:true});
 assert.equal(parsed.proof.finalSha256,p.finalSha256);const failure=JSON.parse(Buffer.from(parsed.lines[1].split(' ')[1],'base64')).detail.failure;assert.ok(!Object.hasOwn(failure,'base'));assert.equal(failure.code,'command_failed');
});
