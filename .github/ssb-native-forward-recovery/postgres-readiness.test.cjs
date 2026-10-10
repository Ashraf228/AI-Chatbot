'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),{createRequire}=require('node:module');
const common=require('./common.cjs'),{main,SOURCE}=require('./controller.cjs'),{parseReceipts}=require('./evidence.cjs'),{probeCallsInFailure,publicFailure}=require('./diagnostics.cjs');
assert.equal(process.version,'v24.17.0');
function load(name,replacements={},tail=''){
 const file=path.join(__dirname,name),m={exports:{}},req=createRequire(file),scope={module:m,exports:m.exports,__dirname,__filename:file,require:id=>Object.hasOwn(replacements,id)?replacements[id]:req(id),process,Buffer,console,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,Error,TypeError,SyntaxError,RangeError,ReferenceError,AggregateError};
 vm.compileFunction(fs.readFileSync(file,'utf8')+tail,Object.keys(scope),{filename:file})(...Object.values(scope));return m.exports;
}
const {harness,receiver,opts}=load('init-diagnostic.test.cjs',{'node:test':()=>{}},'\nmodule.exports={harness,receiver,opts};');
const {fixture}=load('evidence-review.test.cjs',{'node:test':()=>{}},'\nmodule.exports={fixture};');
async function driver(stage,config={},options={}){
 let now=10000;const h=harness({now:()=>now}),events=[],records=[],children=[];
 h.n.synthetic.passwords.postgres='1'.repeat(64);
 if(stage==='restore')await h.n.initialize();
 const original=h.n.command.bind(h.n),raw=path.join(h.root,'readiness-raw');fs.mkdirSync(raw);let attempts=0;
 const C=load('common.cjs',{'node:fs':{...fs,writeFileSync(p,...a){if(options.rawWriteFailure)throw Object.assign(Error('SYNTHETIC_PRIVATE'),{code:'ENOSPC'});return fs.writeFileSync(p,...a);}},'node:child_process':{spawn:(bin,args,o)=>{
  assert.equal(bin,'/usr/bin/docker');assert.deepEqual(args,['--host','unix:///var/run/docker.sock','exec','-i',h.n.probeContainer.id,'node','/proof/probe.cjs']);
  const record=path.join(h.root,'ready-'+attempts+'.json');records.push(record);
  const child=cp.spawn(process.execPath,['--require',path.join(__dirname,'postgres-readiness-preload.cjs'),path.join(__dirname,'probe.cjs')],{...o,env:{PATH:process.env.PATH,SSB_READY_PG:process.env.SSB_READY_PG,SSB_READY_TEST:JSON.stringify({...config,attempt:attempts,record})}});children.push(child);return child;
 }}});
 const p=new C.Processes({deadline:h.n.deadline,privateRoot:raw,now:()=>now});
 h.n.command=async(bin,args,o={})=>{
  if(args.includes('/proof/probe.cjs')){
   const input=JSON.parse(o.input);events.push(input.action);
   if(input.action==='postgres-ready-'+stage){
    attempts++;assert.equal(o.allowFailure,undefined);assert.ok(o.ms>800&&o.ms<=1500);assert.equal(o.probeDiagnostic.binding.action,input.action);
    assert.equal(input.readiness.host,stage==='init'?'db':'restore-db');assert.equal(input.readiness.port,5432);
    if(options.input)options.input(input);
    try{return await p.run(bin,args,{...o,input:JSON.stringify(input)});}finally{now+=(config.advanceMs||1);}
   }
  }
  if(args.includes('pg_isready'))assert.fail('local socket readiness must not run');
  if(args.includes('pg_restore')||args.includes('psql'))events.push(args.includes('pg_restore')?'restore-write':'role-write');
  return original(bin,args,o);
 };
 h.n.proc=p;
 const beforeDeadline=h.n.deadline;let result,error;
 try{result=stage==='init'?await h.n.initialize():await h.n.restore();}catch(e){error=e;}
 p.assertClosed();assert.equal(h.n.deadline,beforeDeadline);assert.equal(h.n.probeDeadline,100000);
 const rows=records.map(p=>JSON.parse(fs.readFileSync(p)));
 assert.equal(children.length,attempts);assert.ok(p.calls.every(x=>x.closed));
 if(error){assert.ok(!events.includes(stage==='init'?'initialize':'role-write'));assert.ok(!events.includes('restore-write'));}
 return{...h,result,error,attempts,events,rows,p,now};
}
for(const stage of ['init','restore']){
 test(stage+': actual driver -> actual process stdin -> authenticated readonly SQL -> fully awaited end -> DB work',async()=>{
  const r=await driver(stage,{endDelay:25});assert.ifError(r.error);assert.ok(r.result.verified);assert.equal(r.attempts,1);
  assert.deepEqual(r.rows.map(x=>[x.connects,x.queries,x.endCalls,x.endEvent]),[[1,1,1,true]]);
  assert.deepEqual(r.rows[0].options,{host:stage==='init'?'db':'restore-db',port:5432,database:'synthetic',user:'postgres',ssl:false,credentialMatchesExpected:true,connectionTimeoutMillis:500,statement_timeout:500,query_timeout:500});
  assert.ok(r.events.indexOf('postgres-ready-'+stage)<r.events.indexOf(stage==='init'?'initialize':'role-write'));
 });
 for(const startupCode of ['ECONNREFUSED','57P03'])test(stage+': delayed startup retries only closed pre-authentication '+startupCode,async()=>{
  const r=await driver(stage,{delayed:2,startupCode});assert.ifError(r.error);assert.equal(r.attempts,3);assert.deepEqual(r.rows.map(x=>x.queries),[0,0,1]);assert.ok(r.rows.every(x=>x.endCalls===1&&x.endEvent));
 });
 test(stage+': local socket would be ready but TCP refused; deadline blocks subsequent DB work',async()=>{
  const r=await driver(stage,{connectCode:'ECONNREFUSED',advanceMs:2000});assert.ok(r.error);assert.match(JSON.stringify(publicFailure(r.error)),/readiness_deadline/);assert.equal(r.attempts,stage==='init'?3:3);assert.ok(r.rows.every(x=>x.queries===0&&x.endEvent));
 });
 for(const [name,config,code] of [
  ['wrong credentials',{connectCode:'28P01'},'28P01'],['authorization',{connectCode:'28000'},'28000'],['unknown connect error',{connectCode:'PRIVATE_UNKNOWN'},'unknown'],
  ['connect timeout',{connectHang:true},'readiness_deadline'],['SQL syntax',{queryCode:'42601'},'42601'],['SQL startup code is not retryable',{queryCode:'57P03'},'57P03'],
  ['SQL connection refusal is not startup',{queryCode:'ECONNREFUSED'},'ECONNREFUSED'],['query timeout',{queryHang:true},'readiness_deadline'],
  ['wrong database',{rows:[{database:'wrong',username:'postgres',port:5432}]},'readiness_identity_invalid'],
  ['wrong session user',{rows:[{database:'synthetic',username:'other',port:5432}]},'readiness_identity_invalid'],
  ['wrong server port',{rows:[{database:'synthetic',username:'postgres',port:5433}]},'readiness_identity_invalid'],
  ['end rejects',{endCode:'EIO'},'EIO'],['end resolves without close event',{noEndEvent:true},'readiness_deadline'],['end hangs',{endHang:true},'readiness_deadline'],
  ['late connection error',{lateError:'ECONNRESET'},'ECONNRESET'],['resolved target mismatch',{parameters:{host:'other'}},'readiness_binding_invalid']
 ])test(stage+': fail closed without retry: '+name,async()=>{
  const r=await driver(stage,config);assert.ok(r.error);assert.equal(r.attempts,1);assert.match(JSON.stringify(publicFailure(r.error)),new RegExp(code));assert.equal(r.rows[0].endCalls,1);
  assert.doesNotMatch(JSON.stringify(publicFailure(r.error)),/SYNTHETIC_PRIVATE|PRIVATE_UNKNOWN|password|SELECT|stack/);
 });
 for(const [name,mutate]of [['host',x=>x.readiness.host='127.0.0.1'],['socket',x=>x.readiness.host='/tmp'],['port',x=>x.readiness.port=5433],['user',x=>x.readiness.user='other'],['database',x=>x.readiness.database='other'],['fallback host',x=>x.host='localhost'],['password absent',x=>delete x.passwords.postgres]])test(stage+': wrong '+name+' rejected before connection',async()=>{
  const r=await driver(stage,{}, {input:mutate});assert.ok(r.error);assert.equal(r.attempts,1);assert.equal(r.rows[0].connects,0);assert.match(JSON.stringify(publicFailure(r.error)),/readiness_binding_invalid/);
 });
 test(stage+': primary auth error survives close error and diagnostic write failure',async()=>{
  const r=await driver(stage,{connectCode:'28P01',endCode:'EIO'},{rawWriteFailure:true});assert.equal(r.attempts,1);const d=probeCallsInFailure(publicFailure(r.error))[0];assert.equal(d.primary.sqlstate,'28P01');assert.equal(d.cleanup[0].nodeCode,'EIO');assert.match(JSON.stringify(publicFailure(r.error)),/evidence_write_failed/);
 });
 test(stage+': missing child diagnostic is blocking, not a startup retry',async()=>{const r=await driver(stage,{connectCode:'ECONNREFUSED',diagnosticMissing:true});assert.ok(r.error);assert.equal(r.attempts,1);assert.match(JSON.stringify(publicFailure(r.error)),/probe_diagnostic_missing/);});
 test(stage+': binding preserved through controller receipt and real receiver entry',async()=>{
  const h=await driver(stage,{connectCode:'28P01'}),data=fixture(),lines=[];const execute=h.n.execute.bind(h.n);
  h.n.execute=async phase=>{if(phase===(stage==='init'?'initialize':'restore'))throw h.error;return{verified:true,...data[phase]};};
  let error;try{await main({...opts,output:l=>lines.push(l)},h.n);}catch(e){error=e;}assert.ok(error);
  const received=parseReceipts(lines.join('\n'),opts.run,SOURCE,opts,{partial:true});assert.equal(received.proof.status,'PARTIAL_FAILURE_RECEIVED');receiver(lines.join('\n')).invoke();
  const rows=lines.map(x=>JSON.parse(Buffer.from(x.split(' ')[1],'base64'))),d=probeCallsInFailure(rows.find(x=>!x.ok).detail.failure)[0];assert.equal(d.binding.action,'postgres-ready-'+stage);assert.equal(d.primary.sqlstate,'28P01');
 });
}
test('old native readiness accepts local socket and performs DB work without any authenticated readiness request',async()=>{
 const h=harness(),fixtures={...require('./fixtures.cjs'),write(p,b){fs.writeFileSync(p,b,{flag:'wx',mode:0o600});return{path:p,sha256:common.sha(b)};}};
 const Old=load(path.relative(__dirname,path.resolve(__dirname,'../../../../ssb-probe-diagnostic-followup-20261010.pPlMqN/publication/.github/ssb-native-forward-recovery/native.cjs')),{'./fixtures.cjs':fixtures}).Native;
 try{await Old.prototype.initialize.call(h.n);await Old.prototype.restore.call(h.n);}catch(error){throw error.cause||error;}
 assert.equal(h.calls.filter(c=>c.args.includes('pg_isready')).length,2);
 assert.ok(!h.calls.some(c=>c.args.includes('/proof/probe.cjs')&&JSON.parse(c.o.input).action?.startsWith('postgres-ready-')));
});
for(const stage of ['init','restore'])test(stage+': transient refusal plus failed close is fatal, no additional attempt',async()=>{
 const r=await driver(stage,{connectCode:'ECONNREFUSED',endCode:'EIO'});assert.ok(r.error);assert.equal(r.attempts,1);const d=probeCallsInFailure(publicFailure(r.error))[0];assert.equal(d.primary.nodeCode,'ECONNREFUSED');assert.equal(d.cleanup[0].nodeCode,'EIO');
});
for(const stage of ['init','restore'])for(const boundary of ['overall','probe'])test(stage+': '+boundary+' deadline leaves 30 seconds untouched and starts no process',async()=>{
 let now=10000;const h=harness({now:()=>now});h.n.probeDeadline=now+90000;if(boundary==='overall')h.n.deadline=now+30000;else h.n.probeDeadline=now+30000;
 await assert.rejects(h.n.postgresReady(stage),e=>e.code==='readiness_deadline');assert.equal(h.calls.length,0);
});
test('readiness proof is strict: no Exit 0 bypass for missing checks, missing close, wrong action/target or extra data',()=>{
 const r=require('./postgres-readiness.cjs'),input={readiness:r.target('init'),diagnostic:{action:'postgres-ready-init'}},good={verified:true,counts:[1,1],ready:true,closed:true,target:input.readiness,binding:input.diagnostic};
 assert.equal(r.validateResult(good,input),good);
 for(const delta of [{counts:[]},{ready:false},{closed:false},{target:{...input.readiness,host:'restore-db'}},{binding:{action:'postgres-ready-restore'}},{extra:'unexpected'}])assert.throws(()=>r.validateResult({...good,...delta},input),e=>e.code==='readiness_proof_invalid');
});
for(const stage of ['init','restore'])for(const [name,config,success]of [['success',{},true],['wrong credentials',{badPassword:true},false],['delayed TCP',{delayed:1},true],['SQL error',{queryCode:'42501'},false]])test(stage+': real pg 8.20.0 Client authentication/query/end with socket-free server: '+name,async()=>{
 assert.ok(process.env.SSB_READY_PG);const r=await driver(stage,{...config,realPG:true});assert.equal(!r.error,success);assert.ok(r.rows.every(x=>x.realClient&&x.endEvent&&x.endCalls===1));
 if(success)assert.ok(r.rows.at(-1).authenticated);else assert.match(JSON.stringify(publicFailure(r.error)),new RegExp(config.badPassword?'28P01':'42501'));
});
