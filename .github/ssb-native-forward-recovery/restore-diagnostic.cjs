'use strict';
const {need,GateError}=require('./common.cjs');
const source='94a25578e883a6d7bbd03f26c56735739f75e45e';
const steps=Object.freeze(['database-before','dump','dump-check','postgres-create','postgres-start','postgres-ready','role-dump','role-filter','role-import','database-import','role-logins','database-after','result']);
const gates=Object.freeze(['command_failed','command_timeout','output_limit','spawn_failed','process_completion_unverified','evidence_write_failed','dump_limit','invalid_json','proof_receipt_missing','proof_failed','mandatory_proof_missing','mandatory_digest_missing','probe_work_deadline','deadline','deadline_binding','resource_limit','created_id','created_security','service_not_running','running_resource_limit','readiness_deadline','readiness_proof_invalid','probe_diagnostic_missing','probe_diagnostic_invalid','probe_diagnostic_misbound','probe_binding_invalid']);
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...k].sort());
function binding(b){
 need(keys(b,['run','source','publication'])&&typeof b.run==='string'&&/^[1-9][0-9]*$/.test(b.run)&&Number.isSafeInteger(Number(b.run))&&b.source===source&&typeof b.publication==='string'&&/^[a-f0-9]{64}$/.test(b.publication),'restore_binding_invalid');return b;
}
function validate(v){
 need(keys(v,['version','binding','step','lastConfirmed','errorClass','nodeCode','sqlstate','assertionCode','gate'])&&v.version===1,'restore_diagnostic_invalid');binding(v.binding);
 const i=steps.indexOf(v.step);need(i>=0&&v.lastConfirmed===(i?steps[i-1]:'none'),'restore_diagnostic_invalid');
 const d=require('./diagnostics.cjs');
 need(['GateError','AssertionError','TypeError','SyntaxError','RangeError','ReferenceError','AggregateError','Error','unknown'].includes(v.errorClass)&&(v.nodeCode==='unknown'||d.probeNodeCodes.includes(v.nodeCode))&&(v.sqlstate==='unknown'||d.probeSqlStates.includes(v.sqlstate))&&(v.assertionCode==='unknown'||v.assertionCode==='ERR_ASSERTION'&&v.errorClass==='AssertionError')&&(v.gate==='unknown'||gates.includes(v.gate)&&v.errorClass==='GateError'),'restore_diagnostic_invalid');return v;
}
class RestoreProgress{
 constructor(b){this.binding=binding(b);this.lastConfirmed='none';}
 async at(step,fn){
  need(steps.indexOf(step)===steps.indexOf(this.lastConfirmed)+1,'restore_step_invalid');
  try{const result=await fn();this.lastConfirmed=step;return result;}catch(cause){
   const d=require('./diagnostics.cjs'),A=require('node:assert/strict').AssertionError;
   const errorClass=cause instanceof A?'AssertionError':cause instanceof GateError?'GateError':cause instanceof TypeError?'TypeError':cause instanceof SyntaxError?'SyntaxError':cause instanceof RangeError?'RangeError':cause instanceof ReferenceError?'ReferenceError':cause instanceof AggregateError?'AggregateError':cause instanceof Error?'Error':'unknown';
   const record=validate({version:1,binding:this.binding,step,lastConfirmed:this.lastConfirmed,errorClass,nodeCode:d.probeNodeCodes.includes(cause?.code)?cause.code:'unknown',sqlstate:d.probeSqlStates.includes(cause?.code)?cause.code:'unknown',assertionCode:cause instanceof A?'ERR_ASSERTION':'unknown',gate:cause instanceof GateError&&gates.includes(cause.code)?cause.code:'unknown'});
   const error=cause instanceof Error?cause:new Error('restore_failed',{cause});error.restoreDiagnostic=record;throw error;
  }
 }
}
async function probeScope(input,body){
 const {ProbeProgress}=require('./diagnostics.cjs');
 const trace=input.diagnostic?new ProbeProgress(input.diagnostic):null;
 const step=async(name,fn)=>{trace?.enter(name);try{const r=await fn();trace?.confirm();return r;}catch(e){trace?.capture(e);throw e;}};
 const using=async(createName,closeName,factory,fn)=>{
  const p=await step(createName,factory);let result,primary,failed=false;
  try{result=await fn(p);}catch(e){primary=e;failed=true;}
  try{await step(closeName,()=>p.end());}catch(e){primary=failed?new AggregateError([primary,e],'probe_cleanup_failed'):e;failed=true;}
  if(failed)throw primary;return result;
 };
 try{
  if(trace){
   need(['database','restore-logins'].includes(input.action)&&input.action===trace.binding.action&&input.source===trace.binding.source&&input.service==='ssb-native-'+trace.binding.run&&require('./common.cjs').sha(require('node:fs').readFileSync(require('node:path').join(__dirname,'publication-manifest.json')))===trace.binding.publication,'probe_binding_invalid');
   if(input.action==='database'){
    need(input.restoreStage===trace.binding.restoreStage&&input.noPools===true&&(input.restoreStage==='before'?input.host===undefined&&input.expected===undefined:input.host==='restore-db'&&/^[a-f0-9]{64}$/.test(input.expected||'')),'probe_binding_invalid');
    if(input.restoreStage==='after')require('./snapshot-diagnostic.cjs').baseline(input.snapshotBaseline,trace.binding,input.expected);
    else need(!Object.hasOwn(input,'snapshotBaseline'),'snapshot_binding_invalid');
   }
   else need(input.host==='restore-db','probe_binding_invalid');
   trace.confirm();
  }
  const observe={record(value){need(trace?.binding.restoreStage==='after','snapshot_binding_invalid');trace.snapshot=require('./snapshot-diagnostic.cjs').comparison(value,trace.binding,input.snapshotBaseline);},failure(error){if(trace){if(!trace.primary)trace.capture(error);if(trace.binding.restoreStage==='after')trace.snapshotError=require('./snapshot-diagnostic.cjs').errorCode(error);}}};
  return await body(step,using,observe);
 }catch(cause){const error=cause instanceof Error?cause:new Error('restore_probe_failed',{cause});if(trace){if(!trace.primary)trace.capture(cause);error.probeDiagnostic=trace.diagnostic();}throw error;}
}
module.exports={RestoreProgress,validate,binding,steps,probeScope};
