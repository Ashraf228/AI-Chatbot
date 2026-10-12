'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),{createRequire}=require('node:module');
const marker='SYNTHETIC_PRIVATE_HTTP_DO_NOT_EXPORT';
if(process.env.SSB_HTTP_OFFLINE){
 const cfg=JSON.parse(process.env.SSB_HTTP_OFFLINE),Module=require('node:module'),assert=require('node:assert/strict');
 let ticks=0,attempts=0,queries=0,ends=0,requests=0,bodies=0,delays=0;
 const error=s=>Object.assign(new TypeError(marker),{code:s.code||'UNKNOWN_PRIVATE_CODE',cause:Object.assign(Error(marker),{code:s.cause||'UNKNOWN_PRIVATE_CAUSE'})});
 Object.defineProperty(globalThis,'performance',{value:{now:()=>ticks}});
 const timeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...a)=>{if(ms===50){ticks+=2000;delays++;return timeout(fn,0,...a);}return timeout(fn,ms,...a);};
 const signalTimeout=AbortSignal.timeout;AbortSignal.timeout=ms=>{assert.equal(ms,3500);return signalTimeout(ms);};
 const load=Module._load;Module._load=function(id,parent,...rest){
  if(id==='/app/node_modules/pg')return{Pool:class{
   async query(){queries++;return{rows:[]};}
   async end(){ends++;fs.writeFileSync(cfg.counts,JSON.stringify({attempts,queries,ends,requests,bodies,delays}));if(cfg.endFailure)throw Object.assign(Error(marker),{code:'EACCES'});}
  }};
  return load.call(this,id,parent,...rest);
 };
 for(const name of ['node:net','node:tls','node:http','node:https','node:dgram']){const m=require(name);for(const k of ['connect','createConnection','request','get','createSocket'])if(typeof m[k]==='function')m[k]=()=>{throw Error('NETWORK_NOT_AUTHORIZED');};}
 for(const k of ['spawn','exec','execSync','execFile','execFileSync','fork'])cp[k]=()=>{throw Error('PROCESS_NOT_AUTHORIZED');};
 globalThis.fetch=async(url,options)=>{
  const u=new URL(url),host=u.hostname;assert.equal(u.protocol,'http:');assert.ok(['api','admin-writer','dashboard'].includes(host));assert.equal(options.redirect,'manual');requests++;if(host==='api')attempts++;
  const scenarios=cfg.scenarios||[{stage:'body'}],s=scenarios[Math.min(attempts-1,scenarios.length-1)],target=s.host||'dashboard',active=host===target;
  if(active&&s.stage==='request')throw error(s);
  return{status:active&&s.stage==='status'?418:host==='dashboard'?200:503,headers:new Headers({'set-cookie':marker}),text:async()=>{
   await new Promise(resolve=>setImmediate(resolve));bodies++;
   if(active&&s.stage==='body')throw error(s);
   return marker;
  }};
 };
 const write=fs.writeSync;fs.writeSync=(fd,bytes,...args)=>{
  if(fd===2&&String(bytes).startsWith('SSB_INIT_PROBE_')){
   if(cfg.output==='missing')return Buffer.byteLength(bytes);
   if(cfg.output==='write-failure')throw Object.assign(Error(marker),{code:'ENOSPC'});
   if(cfg.output==='truncated')bytes=bytes.slice(0,-7);
   if(cfg.output==='json')bytes='SSB_INIT_PROBE_DIAGNOSTIC_V1 {\n';
   if(cfg.output==='call')bytes=bytes.replace(/"call":"[a-f0-9]{64}"/,'"call":"'+'0'.repeat(64)+'"');
   if(cfg.output==='private')bytes=bytes.replace('"version":1','"private":"'+marker+'","version":1');
  }
  return write(fd,bytes,...args);
 };
}else{
 const test=require('node:test'),assert=require('node:assert/strict');
 const {sha}=require('./common.cjs'),{probeCallsInFailure,publicFailure,decodeProbe,probeMarker}=require('./diagnostics.cjs');
 assert.equal(process.version,'v24.17.0');
 function load(name,rewrite=s=>s){const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname,__filename:file,require:k=>k==='node:test'?()=>{}:req(k),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};vm.compileFunction(rewrite(fs.readFileSync(file,'utf8')),Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;}
 const {harness,receiptFailure}=load('closed-start-diagnostic.test.cjs',s=>s.replaceAll('SSB_CLOSED_OFFLINE','SSB_HTTP_OFFLINE').replace("['--require',__filename,path.join(__dirname,'probe.cjs')]",`['--require',${JSON.stringify(__filename)},path.join(__dirname,'probe.cjs')]`).replace('readiness:config.readiness||3','key:config.generation||\'release\',readiness:config.readiness||3').replaceAll("p==='release-start'","p===(config.generation||'release')+'-start'").replaceAll("r.phase==='release-start'","r.phase===(config.generation||'release')+'-start'").replace(/\n}\s*$/,'\nmodule.exports={harness,receiptFailure};\n}'));
 const {receiver}=load('init-diagnostic.test.cjs',s=>s+'\nmodule.exports={receiver};');
 const diag=h=>probeCallsInFailure(h.failed.detail.failure)[0];
 const counts=h=>JSON.parse(fs.readFileSync(h.counts));
 function rechain(rows){let prev='0'.repeat(64);return rows.map((r,seq)=>{const s=JSON.stringify({...r,seq,previous:prev});prev=sha(s);return'SSB_PUBLIC_RECEIPT_V2 '+Buffer.from(s).toString('base64')+' '+prev;}).join('\n');}
 for(const generation of ['release','forward','normal'])for(const stage of ['request','body','status'])test(`real child/controller/receipt/receiver ${generation}/${stage}`,async t=>{
  const h=await receiptFailure(t,{generation,scenarios:[{stage,cause:'UND_ERR_SOCKET'}]}),d=diag(h);
  assert.equal(d.binding.generation,generation);assert.equal(d.primary.step,'closed-dashboard');assert.equal(d.primary.lastConfirmed,'closed-writer');
  assert.equal(d.primary.httpStatus,stage==='request'?null:stage==='status'?418:200);
  assert.equal(d.primary.httpStage,stage==='status'?'complete':stage);assert.equal(d.primary.httpConfirmed,stage==='request'?'none':stage==='status'?'body':'headers');
  assert.equal(d.primary.causeNodeCode,stage==='status'?'unknown':'UND_ERR_SOCKET');assert.equal(d.readiness.attempts,3);assert.equal(d.readiness.firstFailure.attempt,1);assert.equal(d.readiness.lastFailure.attempt,3);
  assert.deepEqual(d.readiness.lastFailure.point,d.primary);assert.equal(counts(h).ends,1);assert.equal(counts(h).delays,3);assert.equal(counts(h).bodies,stage==='request'?6:9);
  assert.doesNotMatch(JSON.stringify(h.rows),/SYNTHETIC_PRIVATE|UNKNOWN_PRIVATE|set-cookie|"stack"|"message"/);
 });
 for(const host of ['api','admin-writer','dashboard'])test('status stored before asynchronous body rejection: '+host,async t=>{
  const h=await receiptFailure(t,{scenarios:[{host,stage:'body',code:'EPIPE',cause:'ECONNRESET'}]}),d=diag(h);assert.equal(d.primary.httpStatus,host==='dashboard'?200:503);assert.equal(d.primary.nodeCode,'EPIPE');assert.equal(d.primary.causeNodeCode,'ECONNRESET');assert.equal(d.primary.httpStage,'body');
 });
 test('first request error and last body error retain separate metadata, bounded to two snapshots',async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'request',cause:'ECONNREFUSED'},{stage:'body',cause:'UND_ERR_SOCKET'}]}),d=diag(h);
  assert.equal(d.readiness.firstFailure.point.httpStatus,null);assert.equal(d.readiness.firstFailure.point.httpStage,'request');assert.equal(d.readiness.firstFailure.point.causeNodeCode,'ECONNREFUSED');assert.equal(d.readiness.lastFailure.point.httpStatus,200);assert.equal(d.readiness.lastFailure.point.causeNodeCode,'UND_ERR_SOCKET');
  assert.deepEqual(Object.keys(d.readiness),['attempts','firstFailure','lastFailure']);assert.ok(Buffer.byteLength(probeMarker+JSON.stringify(d)+'\n')<4096);
 });
 for(const [code,cause,wantCode,wantCause]of [['EACCES','ETIMEDOUT','EACCES','ETIMEDOUT'],['UND_ERR_HEADERS_TIMEOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_CONNECT_TIMEOUT'],['PRIVATE','PRIVATE','unknown','unknown'],[400,500,'unknown','unknown'],[null,null,'unknown','unknown']])test('strict root/direct cause allowlist '+String(code),async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'request',code,cause}]}),d=diag(h);assert.equal(d.primary.nodeCode,wantCode);assert.equal(d.primary.causeNodeCode,wantCause);
 });
 test('success after failed attempt still awaits bodies, database readback and pool close',async t=>{
  const h=harness(t,{scenarios:[{stage:'body'},{stage:'success'}]}),r=await h.n.startGeneration('release');assert.deepEqual(r.counts,[5,5,0]);assert.deepEqual(counts(h),{attempts:2,queries:4,ends:1,requests:6,bodies:6,delays:1});h.n.proc.assertClosed();
 });
 test('pool-close failure after recovery retains earlier failed attempt without inventing an HTTP primary',async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'body'},{stage:'success'}],endFailure:true}),d=diag(h);assert.equal(d.primary.step,'pool-close');assert.equal(d.primary.httpStatus,null);assert.equal(d.primary.httpStage,'none');assert.equal(d.readiness.attempts,2);assert.equal(d.readiness.lastFailure.attempt,1);
 });
 test('primary HTTP failure survives pool, raw-write and closure failure',async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'body',cause:'UND_ERR_SOCKET'}],endFailure:true,rawWriteFailure:true,closureFault:'137'}),d=diag(h);assert.equal(d.primary.httpStatus,200);assert.equal(d.primary.httpStage,'body');assert.equal(d.cleanup[0].nodeCode,'EACCES');assert.equal(h.rows.at(-1).ok,false);assert.ok(h.rows.at(-1).detail.outcomes.some(x=>x.exit===137&&x.state==='exited_unclean'));
 });
 test('receipt-write failure does not overwrite the primary; incomplete receipt is rejected',async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'body'}],receiptFailure:true}),d=probeCallsInFailure(publicFailure(h.primary))[0];assert.equal(d.primary.httpStatus,200);assert.equal(d.primary.httpStage,'body');assert.throws(()=>receiver(h.lines.join('\n')).invoke());
 });
 for(const output of ['missing','truncated','json','call','private','write-failure'])test('corrupt or missing child diagnosis remains blocking: '+output,async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'body'}],output});assert.equal(probeCallsInFailure(h.failed.detail.failure).length,0);assert.match(JSON.stringify(h.failed.detail.failure),/probe_diagnostic_(missing|invalid|misbound)/);
 });
 test('receiver and decoder reject contradictory HTTP/attempt/private fields and misbinding',async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'body'}]});
  const mutations=[d=>d.primary.httpStatus=null,d=>d.primary.httpStage='request',d=>d.primary.httpConfirmed='body',d=>d.primary.causeNodeCode=marker,d=>d.primary.cause={code:'EPIPE'},d=>delete d.readiness,d=>d.readiness.attempts=10001,d=>d.readiness.attempts='3',d=>d.readiness.firstFailure.attempt=0,d=>d.readiness.firstFailure.attempt=4,d=>d.readiness.lastFailure.attempt=2,d=>d.readiness.firstFailure.point.message=marker,d=>d.readiness.lastFailure.point.httpStatus=503,d=>d.readiness.firstFailure=null,d=>d.binding.generation='forward',d=>d.binding.publication='f'.repeat(64)];
  for(const mutate of mutations){const rows=structuredClone(h.rows),d=probeCallsInFailure(rows.find(r=>r.phase==='release-start').detail.failure)[0];mutate(d);assert.throws(()=>receiver(rechain(rows)).invoke());assert.throws(()=>decodeProbe(Buffer.from(probeMarker+JSON.stringify(d)+'\n'),diag(h).binding));}
 });
 test('local receipt persistence error cannot report complete evidence',async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'body'}]}),r=receiver(h.lines.join('\n'),{writeFailure:'receipts.txt'});assert.throws(()=>r.invoke());assert.equal(r.output.length,0);
 });
 test('review R1: impossible first/final failure chronology rejected by decoder and receiver',async t=>{
  for(const scenarios of [[{stage:'body'}],[{stage:'body'},{stage:'success'}],[{stage:'success'}]]){
   const h=await receiptFailure(t,{scenarios,endFailure:true}),original=diag(h);
   const mutations=original.primary.step==='pool-close'?[d=>d.primary.lastConfirmed='closed-writer',d=>d.readiness.attempts=0,...(original.readiness.firstFailure?[d=>d.readiness.lastFailure.attempt=d.readiness.attempts,d=>d.readiness.attempts++]:[d=>d.readiness.attempts=2])]:[d=>d.readiness.firstFailure.attempt=2];
   for(const mutate of mutations){const rows=structuredClone(h.rows),d=probeCallsInFailure(rows.find(r=>r.phase==='release-start').detail.failure)[0];mutate(d);assert.throws(()=>decodeProbe(Buffer.from(probeMarker+JSON.stringify(d)+'\n'),original.binding));assert.throws(()=>receiver(rechain(rows)).invoke());}
  }
 });
 test('review R2: HTTP stage must be a primitive string at every diagnosis point',async t=>{
  const h=await receiptFailure(t,{scenarios:[{stage:'body'}],endFailure:true}),original=diag(h);
  for(const point of ['primary','cleanup','first','last'])for(const value of [['body'],[[['body']]],{},null,0,true]){
   const rows=structuredClone(h.rows),d=probeCallsInFailure(rows.find(r=>r.phase==='release-start').detail.failure)[0],p=point==='primary'?d.primary:point==='cleanup'?d.cleanup[0]:d.readiness[point==='first'?'firstFailure':'lastFailure'].point;p.httpStage=value;
   assert.throws(()=>decodeProbe(Buffer.from(probeMarker+JSON.stringify(d)+'\n'),original.binding));assert.throws(()=>receiver(rechain(rows)).invoke());
  }
 });
}
