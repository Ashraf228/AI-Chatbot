'use strict';
const fs=require('node:fs'),path=require('node:path');
const {need,GateError,sha}=require('./common.cjs');
const {ProbeProgress,validateProbe}=require('./diagnostics.cjs');
const SQL='SELECT current_database() AS database, session_user AS username, inet_server_port() AS port';
function target(stage){
 need(stage==='init'||stage==='restore','readiness_binding_invalid');
 return{host:stage==='init'?'db':'restore-db',port:5432,database:'synthetic',user:'postgres'};
}
function validateResult(result,input){
 const expected={verified:true,counts:[1,1],ready:true,closed:true,target:input.readiness,binding:input.diagnostic};
 need(JSON.stringify(result)===JSON.stringify(expected),'readiness_proof_invalid');return result;
}
function retryable(error,action){
 if(error?.code!=='command_failed'||error.cause||!error.process?.closed||error.process.code!==1||error.process.signal||error.process.timeout||!error.probeDiagnostic)return false;
 const d=validateProbe(error.probeDiagnostic),p=d.primary;
 return d.binding.action===action&&d.cleanup.length===0&&p.step==='readiness-connect'&&p.errorClass==='Error'&&p.gate==='unknown'&&p.assertionCode==='unknown'&&((p.nodeCode==='ECONNREFUSED'&&p.sqlstate==='unknown')||(p.sqlstate==='57P03'&&p.nodeCode==='unknown'));
}
async function check(input){
 const trace=new ProbeProgress(input.diagnostic);let client,primary,attempted=false,ended=false,endEvent,asynchronousError;
 const deadline=performance.now()+input.readinessTimeoutMs;
 const bounded=async(fn,ms,reserve=250)=>{
  const left=Math.min(ms,deadline-performance.now()-reserve);need(Number.isFinite(left)&&left>0,'readiness_deadline');let timer;
  try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new GateError('readiness_deadline')),left);})]);}finally{clearTimeout(timer);}
 };
 try{
  trace.enter('readiness-binding');
  need(['postgres-ready-init','postgres-ready-restore'].includes(input.action)&&input.diagnostic.action===input.action&&input.source===input.diagnostic.source&&input.service==='ssb-native-'+input.diagnostic.run,'readiness_binding_invalid');
  const expected=target(input.action==='postgres-ready-init'?'init':'restore');
  need(JSON.stringify(input.readiness)===JSON.stringify(expected)&&!Object.hasOwn(input,'host')&&!Object.hasOwn(input,'port')&&Number.isInteger(input.readinessTimeoutMs)&&input.readinessTimeoutMs>400&&input.readinessTimeoutMs<=1100,'readiness_binding_invalid');
  need(sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json')))===input.diagnostic.publication,'readiness_binding_invalid');
  need(typeof input.passwords?.postgres==='string'&&/^[a-f0-9]{64}$/.test(input.passwords.postgres),'readiness_binding_invalid');trace.confirm();
  const {Client}=require('/app/node_modules/pg');
  client=new Client({...expected,password:input.passwords.postgres,ssl:false,connectionTimeoutMillis:500,statement_timeout:500,query_timeout:500});
  client.on('error',error=>{asynchronousError??=error;});
  endEvent=new Promise(resolve=>client.once('end',()=>{ended=true;resolve();}));
  for(const key of ['host','port','database','user'])need(client.connectionParameters[key]===expected[key],'readiness_binding_invalid');
  trace.enter('readiness-connect');attempted=true;await bounded(()=>client.connect(),500);if(asynchronousError)throw asynchronousError;trace.confirm();
  trace.enter('readiness-query');const result=await bounded(()=>client.query(SQL),500);if(asynchronousError)throw asynchronousError;trace.confirm();
  trace.enter('readiness-identity');
  need(Array.isArray(result.rows)&&result.rows.length===1&&result.rows[0].database===expected.database&&result.rows[0].username===expected.user&&result.rows[0].port===expected.port,'readiness_identity_invalid');trace.confirm();
 }catch(error){trace.capture(error);primary=error;}
 if(client){
  trace.enter('readiness-close');
  try{
   await bounded(async()=>{await client.end();if(attempted)await endEvent;},250,0);
   need(!attempted||ended,'readiness_close_unverified');if(!primary&&asynchronousError)throw asynchronousError;need(performance.now()<=deadline,'readiness_deadline');trace.confirm();
  }catch(error){trace.capture(error);primary=primary?new AggregateError([primary,error],'readiness_cleanup_failed'):error;}
 }
 if(primary){const error=new Error('postgres_readiness_failed',{cause:primary});error.probeDiagnostic=trace.diagnostic();throw error;}
 return{verified:true,counts:[1,1],ready:true,closed:true,target:input.readiness,binding:input.diagnostic};
}
module.exports={check,target,validateResult,retryable,SQL};
