'use strict';
const {need,clock}=require('./common.cjs'),contract=require('./reporter-contract.cjs');
const own=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...k].sort());
const errors=['unknown','identity','deadline','invalid_json','regular_file_required','reporter_binding_invalid','reporter_diagnostic_missing','reporter_diagnostic_invalid','reporter_diagnostic_misbound','command_failed','command_timeout','output_limit','spawn_failed','process_completion_unverified','evidence_write_failed','probe_work_deadline','disk_floor','memory_floor','resource_floor_observed'];
const code=e=>errors.includes(e?.code)?e.code:'unknown';
function expected(operation){
 require('./diagnostics.cjs').startProtocol().binding(operation);
 need(operation.service==='reporter'&&['participant-helper','participant-postinspect','running-limit','mount-readability','reporter-closed-inspect'].includes(operation.operation),'reporter_binding_invalid');
 return contract.binding(operation.run,operation.generation,operation.publication);
}
function validate(value,operation){
 need(own(value,['version','binding','container','image','record'])&&value.version===1&&/^[a-f0-9]{64}$/.test(value.container)&&/^sha256:[a-f0-9]{64}$/.test(value.image),'reporter_diagnostic_invalid');
 contract.validateBinding(value.binding);if(operation)need(JSON.stringify(value.binding)===JSON.stringify(expected(operation)),'reporter_diagnostic_misbound');
 contract.validateRecord(value.record,value.binding);return value;
}
async function collect(native,primary,entry){
 try{
  const binding=expected(primary.startOperation);
  need(entry?.id&&entry.role==='reporter'&&entry.generation===binding.generation&&JSON.stringify(binding)===JSON.stringify(native.current.reporterBinding),'identity');
  const until=Math.min(clock()+1500,native.deadline-30000,native.probeDeadline-30000);
  const remaining=()=>{const n=Math.floor(until-clock());need(n>100,'deadline');return n;};
  const xs=await native.inspect(entry.id,{ms:remaining()});need(Array.isArray(xs)&&xs.length===1,'identity');const x=xs[0];
  need(x.Id===entry.id&&x.Image===entry.image&&x.Name==='/'+entry.name&&x.Config?.Labels?.['com.ssb.native-run']===binding.run&&x.Config.Labels['com.docker.compose.service']==='reporter'&&x.Config.Labels['com.docker.compose.project']===entry.project&&x.State?.Status==='exited'&&x.State.Running===false&&x.State.ExitCode!==0&&!x.State.OOMKilled,'identity');
  const env=(x.Config.Env||[]).filter(s=>s.startsWith('SSB_REPORTER_DIAGNOSTIC_BINDING='));
  need(env.length===1&&env[0]==='SSB_REPORTER_DIAGNOSTIC_BINDING='+JSON.stringify(binding),'identity');
  const finish=record=>{primary.reporterDiagnostic=validate({version:1,binding,container:entry.id,image:entry.image,record},primary.startOperation);};
  try{
   const r=await native.d(['logs','--tail','4',entry.id],{ms:remaining(),reporterLogs:{binding,container:entry.id}});finish(r.reporterRecord);
  }catch(error){
   // The validated record can survive failure to persist private process output.
   if(error.reporterRecord)finish(error.reporterRecord);
   primary.reporterError=code(error);
  }
 }catch(error){primary.reporterError=code(error);}
}
module.exports={errors,code,expected,validate,collect};
