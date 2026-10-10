'use strict';
const {need,GateError}=require('./common.cjs');
const {validateBase}=require('./base-diagnostics.cjs');
const {stateStages:stages,stateCodes}=require('./state-launch.cjs');
const codes=['readiness_deadline','readiness_binding_invalid','readiness_identity_invalid','readiness_close_unverified','readiness_proof_invalid','probe_diagnostic_missing','probe_diagnostic_invalid','probe_diagnostic_misbound','probe_binding_invalid','probe_manifest_invalid','probe_migration_invalid','init_failed','unclassified','truncated','aggregate','command_failed','command_timeout','output_limit','spawn_failed','process_completion_unverified','evidence_write_failed','state_operation_failed','state_diagnostic_missing','state_diagnostic_invalid','cleanup_identity_unverified','cleanup_preexisting_forbidden','cleanup_ownership','container_completion_unverified','never_started_on_success','infrastructure_shutdown_failed','postgres_clean_shutdown_missing','closure_incomplete','overall_deadline','deadline','deadline_binding','primary_and_closure_failed','primary_and_record_failed','closure_and_record_failed'];
const signals=['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV'];
const roles=['postgres','redis','probe','restore-postgres','api','admin-writer','dashboard','reporter','widget'];
const states=['never_started','exited','exited_unclean','graceful','unverified'];
const own=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...keys].sort());
// Fixed vocabulary only: no message, stack, path or request content enters receipts.
const initSteps=Object.freeze(['probe-window','volume-preflight','network-create','network-inspect','volume-list','volume-create','volume-inspect','postgres-env-write','postgres-create','redis-create','probe-create','probe-ingress-connect','probe-writer-connect','maintenance-directory','maintenance-copy','maintenance-permissions','runtime-load','state-initialize','postgres-start','redis-start','probe-start','postgres-ready','redis-ping','redis-version','database-initialize']);
const initGates=Object.freeze(['readiness_deadline','readiness_proof_invalid','invalid_json','regular_file_required','content_binding_changed','preexisting_volume_forbidden','network_id','internal_network_required','volume_name_changed','volume_inspect_invalid','volume_ownership_invalid','resource_limit','created_id','created_security','state_entry_unbound','state_diagnostic_invalid','state_diagnostic_missing','service_not_running','running_resource_limit','postgres_not_ready','redis_not_ready','redis_version','proof_receipt_missing','proof_failed','mandatory_proof_missing','mandatory_digest_missing','resource_floor_observed','disk_floor','memory_floor','probe_work_deadline','argv_invalid','deadline_binding','deadline','command_failed','command_timeout','output_limit','spawn_failed','process_completion_unverified','evidence_write_failed','probe_diagnostic_missing','probe_diagnostic_invalid','probe_diagnostic_misbound','probe_binding_invalid']);
const initClasses=Object.freeze(['GateError','TypeError','SyntaxError','RangeError','ReferenceError','AggregateError','Error','unknown']);
const initFsCodes=Object.freeze(['EACCES','EPERM','ENOENT','ENOTDIR','EISDIR','EEXIST','ENOSPC','EROFS','EIO','EMFILE','ENFILE','ELOOP','ENAMETOOLONG']);
function classifyInit(error,progress){
 const errorClass=error instanceof GateError?'GateError':error instanceof TypeError?'TypeError':error instanceof SyntaxError?'SyntaxError':error instanceof RangeError?'RangeError':error instanceof ReferenceError?'ReferenceError':error instanceof AggregateError?'AggregateError':error instanceof Error?'Error':'unknown';
 const gate=error instanceof GateError&&initGates.includes(error.code)?error.code:'unknown';
 const fsCode=initFsCodes.includes(error?.code)?error.code:initFsCodes.includes(error?.ioCode)?error.ioCode:'unknown';
 return{version:1,step:progress.step,lastConfirmed:progress.lastConfirmed,gate,errorClass,fsCode};
}
function validateInit(v){
 need(own(v,['version','step','lastConfirmed','gate','errorClass','fsCode'])&&v.version===1&&initSteps.includes(v.step)&&(v.lastConfirmed==='none'||initSteps.includes(v.lastConfirmed))&&(v.gate==='unknown'||initGates.includes(v.gate))&&initClasses.includes(v.errorClass)&&(v.fsCode==='unknown'||initFsCodes.includes(v.fsCode)),'init_diagnostic_invalid');
 need(v.gate==='unknown'||v.errorClass==='GateError','init_gate_class_invalid');return v;
}
class InitProgress{
 constructor(){this.step='probe-window';this.lastConfirmed='none';}
 enter(step){need(initSteps.includes(step),'init_step_invalid');this.step=step;}
 confirm(){this.lastConfirmed=this.step;}
 failure(cause){const error=new Error('init_failed',{cause});error.code=cause instanceof GateError?cause.code:'init_failed';error.initDiagnostic=classifyInit(cause,this);return error;}
}
function stateDiagnostic(error,stage){return{version:1,stage:stages.includes(stage)?stage:'action',code:stateCodes.includes(error?.code)?error.code:'other'};}
function validateState(v){need(own(v,['version','stage','code'])&&v.version===1&&stages.includes(v.stage)&&stateCodes.includes(v.code),'state_diagnostic_invalid');return v;}
function decodeState(stderr){const s=stderr.toString();need(s.length<=1024&&s.startsWith('SSB_STATE_DIAGNOSTIC_V1 '),'state_diagnostic_missing');let v;try{v=JSON.parse(s.slice(24));}catch{need(false,'state_diagnostic_invalid');}validateState(v);need(s==='SSB_STATE_DIAGNOSTIC_V1 '+JSON.stringify(v)+'\n','state_diagnostic_invalid');return v;}
function publicFailure(error){let count=0;const visit=(e,depth,inheritedInit)=>{if(++count>16||depth>4)return{code:'truncated',process:null,state:null,causes:[]};const code=codes.includes(e?.code)?e.code:e instanceof AggregateError?'aggregate':'unclassified';let process=null,state=null;if(e?.process){const p=e.process;process={index:Number.isInteger(p.index)&&p.index>=0&&p.index<=10000?p.index:null,exit:Number.isInteger(p.code)&&p.code>=-4096&&p.code<=255?p.code:null,signal:signals.includes(p.signal)?p.signal:null,closed:p.closed===true,timeout:p.timeout===true};}if(e?.stateDiagnostic){try{state=validateState(e.stateDiagnostic);}catch{}}
 let init=null;try{if(e?.initDiagnostic)init=validateInit(e.initDiagnostic);else if(inheritedInit)init=validateInit(classifyInit(e,inheritedInit));}catch{}
 const causes=[];for(const child of (Array.isArray(e?.errors)?e.errors.slice(0,4):e?.cause?[e.cause]:[])){if(count>=16){causes.push({code:'truncated',process:null,state:null,causes:[]});break;}causes.push(visit(child,depth+1,init));}const result={code,process,state,causes};if(e?.probeDiagnostic){validateProbe(e.probeDiagnostic);need(code==='command_failed'&&process?.closed&&process.exit===1&&!process.timeout&&!process.signal,'probe_process_invalid');result.probe=JSON.parse(JSON.stringify(e.probeDiagnostic));}if(init)result.init={...init};if(e?.baseDiagnostic&&code==='command_failed'&&process?.closed&&process.exit!==null&&process.exit!==0&&!process.timeout&&!process.signal&&state===null){try{const b=validateBase(e.baseDiagnostic);result.base={reference:b.reference,category:b.category,httpStatus:b.httpStatus};}catch{}}return result;};return visit(error,0);}
function validateFailure(v,depth=0,counter={n:0}){need(++counter.n<=32&&depth<=5&&own(v,['code','process','state','causes',...(v&&Object.hasOwn(v,'base')?['base']:[]),...(v&&Object.hasOwn(v,'init')?['init']:[]),...(v&&Object.hasOwn(v,'probe')?['probe']:[])])&&codes.includes(v.code)&&Array.isArray(v.causes)&&v.causes.length<=4,'public_diagnostic_invalid');if(v.process!==null){const p=v.process;need(own(p,['index','exit','signal','closed','timeout'])&&(p.index===null||Number.isInteger(p.index)&&p.index>=0&&p.index<=10000)&&(p.exit===null||Number.isInteger(p.exit)&&p.exit>=-4096&&p.exit<=255)&&(p.signal===null||signals.includes(p.signal))&&typeof p.closed==='boolean'&&typeof p.timeout==='boolean','public_process_invalid');}if(Object.hasOwn(v,'probe')){validateProbe(v.probe);need(v.code==='command_failed'&&v.process?.closed&&v.process.exit===1&&!v.process.timeout&&!v.process.signal&&v.state===null,'probe_process_invalid');}if(v.state!==null)validateState(v.state);if(Object.hasOwn(v,'init'))validateInit(v.init);if(Object.hasOwn(v,'base')){validateBase(v.base);need(v.code==='command_failed'&&v.process?.closed&&v.process.exit!==null&&v.process.exit!==0&&!v.process.timeout&&!v.process.signal&&v.state===null,'base_process_invalid');}for(const c of v.causes)validateFailure(c,depth+1,counter);}
function validateDetail(r){const d=r.detail;need(own(d,['failure','outcomes'])&&Array.isArray(d.outcomes)&&d.outcomes.length<=19,'receipt_detail_invalid');if(d.failure!==null)validateFailure(d.failure);need(r.ok?d.failure===null:d.failure!==null,'receipt_failure_required');if(r.phase!=='closure')need(d.outcomes.length===0,'unexpected_outcomes');for(const o of d.outcomes){need(own(o,['id','role','generation','state','exit','code'])&&(o.id===null||/^[a-f0-9]{64}$/.test(o.id))&&roles.includes(o.role)&&['seed','release','forward','normal'].includes(o.generation)&&states.includes(o.state)&&(o.exit===null||Number.isInteger(o.exit)&&o.exit>=0&&o.exit<=255)&&['none','forced_or_nonzero',...codes].includes(o.code),'closure_outcome_invalid');if(o.state==='never_started')need(o.id!==null&&o.exit===null&&o.code==='none','never_started_invalid');if(o.state==='graceful'||o.state==='exited')need(o.id!==null&&o.exit===0&&o.code==='none','clean_exit_invalid');if(o.state==='exited_unclean')need(o.id!==null&&Number.isInteger(o.exit)&&o.exit>0&&o.code==='forced_or_nonzero','unclean_exit_invalid');if(o.state==='unverified')need(o.code!=='none','unverified_code_required');}
 const checkBasePhase=v=>{if(!v)return;if(Object.hasOwn(v,'probe'))need(r.phase===(v.probe.binding.action==='postgres-ready-restore'?'restore':'initialize')&&!r.ok&&v.probe.binding.run===r.run&&v.probe.binding.source===r.source,'probe_receipt_binding');if(Object.hasOwn(v,'init'))need(r.phase==='initialize'&&!r.ok,'init_phase_invalid');if(Object.hasOwn(v,'base'))need(r.phase==='bases'&&!r.ok,'base_phase_invalid');for(const c of v.causes)checkBasePhase(c);};checkBasePhase(d.failure);
 if(r.phase==='closure'){if(!r.ok&&r.counts.length===0){need(r.ids.length===0&&d.outcomes.length===0,'unknown_closure_scope');return;}const count=r.counts[0];need(Number.isInteger(count)&&d.outcomes.length===count,'closure_outcomes_missing');need(new Set(d.outcomes.filter(x=>x.id).map(x=>x.id)).size===d.outcomes.filter(x=>x.id).length,'closure_outcome_duplicate');need(JSON.stringify(d.outcomes.filter(x=>x.id).map(x=>x.id))===JSON.stringify(r.ids.slice(0,r.counts[1]||0)),'closure_outcome_binding');if(r.ok)need(d.outcomes.every(o=>o.state!=='unverified'),'closure_outcome_unverified');}}
const probeSteps=Object.freeze(['readiness-binding','readiness-connect','readiness-query','readiness-identity','readiness-close','binding','pool-create','migration-list','schema-ledger','migration-connect','migration-begin','migration-read','migration-execute','migration-record','migration-commit','client-release','roles-read','roles-apply','role-password-check','role-password-apply','tenant-site-fixture','user-fixture','site-config-fixture','database-readback','database-assertions','pool-close']);
const probeSqlStates=Object.freeze(['08000','08001','08003','08004','08006','08P01','0A000','22001','22003','22007','22023','22P02','23502','23503','23505','23514','25001','25P02','28000','28P01','3D000','3F000','40001','40P01','42501','42601','42701','42703','42704','42804','42883','42P01','42P07','42P17','53000','53100','53200','53300','53400','55P03','57014','57P01','57P02','57P03','58000','58030','58P01','XX000']);
const probeNodeCodes=Object.freeze([...initFsCodes,'EPIPE','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH','ENOTFOUND','EAI_AGAIN','MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','ERR_INVALID_ARG_TYPE','ERR_INVALID_ARG_VALUE','ERR_OUT_OF_RANGE']);
const probeGates=Object.freeze(['readiness_deadline','readiness_binding_invalid','readiness_identity_invalid','readiness_close_unverified','probe_binding_invalid','probe_manifest_invalid','probe_migration_invalid','content_binding_changed','regular_file_required']);
const probeClasses=Object.freeze(['GateError','AssertionError','TypeError','SyntaxError','RangeError','ReferenceError','AggregateError','Error','unknown']);
const probeMarker='SSB_INIT_PROBE_DIAGNOSTIC_V1 ';
function validateProbeBinding(b){
 need(own(b,['version','action','run','source','publication','call'])&&b.version===1&&['initialize','postgres-ready-init','postgres-ready-restore'].includes(b.action)&&typeof b.run==='string'&&/^[1-9][0-9]*$/.test(b.run)&&Number.isSafeInteger(Number(b.run))&&b.source==='94a25578e883a6d7bbd03f26c56735739f75e45e'&&typeof b.publication==='string'&&/^[a-f0-9]{64}$/.test(b.publication)&&typeof b.call==='string'&&/^[a-f0-9]{64}$/.test(b.call),'probe_binding_invalid');return b;
}
// Lazy catalogue access preserves the already verified seven-module State load contract.
function probeMigrations(){
 const m=require('./release-source-manifest.json');
 need(m.releaseCommit==='94a25578e883a6d7bbd03f26c56735739f75e45e','probe_manifest_invalid');
 const rows=m.files.filter(f=>/^apps\/api\/migrations\/\d{3}_[a-zA-Z0-9_-]+\.sql$/.test(f.path));
 need(rows.length===34&&rows.every((f,i)=>Number(f.path.split('/').at(-1).slice(0,3))===i+1&&/^[a-f0-9]{64}$/.test(f.sha256)),'probe_manifest_invalid');return rows;
}
function classifyProbe(error){
 const A=require('node:assert/strict').AssertionError;
 const errorClass=error instanceof A?'AssertionError':error instanceof GateError?'GateError':error instanceof TypeError?'TypeError':error instanceof SyntaxError?'SyntaxError':error instanceof RangeError?'RangeError':error instanceof ReferenceError?'ReferenceError':error instanceof AggregateError?'AggregateError':error instanceof Error?'Error':'unknown';
 return{errorClass,sqlstate:probeSqlStates.includes(error?.code)?error.code:'unknown',nodeCode:probeNodeCodes.includes(error?.code)?error.code:'unknown',assertionCode:error instanceof A&&error.code==='ERR_ASSERTION'?'ERR_ASSERTION':'unknown',gate:error instanceof GateError&&probeGates.includes(error.code)?error.code:'unknown'};
}
function validateProbePoint(v){
 need(own(v,['step','lastConfirmed','migration','lastMigration','errorClass','sqlstate','nodeCode','assertionCode','gate'])&&probeSteps.includes(v.step)&&(v.lastConfirmed==='none'||probeSteps.includes(v.lastConfirmed))&&probeClasses.includes(v.errorClass)&&(v.sqlstate==='unknown'||probeSqlStates.includes(v.sqlstate))&&(v.nodeCode==='unknown'||probeNodeCodes.includes(v.nodeCode))&&(v.assertionCode==='unknown'||v.assertionCode==='ERR_ASSERTION')&&(v.gate==='unknown'||probeGates.includes(v.gate)),'probe_diagnostic_invalid');
 for(const [step,n]of [[v.step,v.migration],[v.lastConfirmed,v.lastMigration]]){const isMigration=step.startsWith('migration-')&&step!=='migration-list'||step==='client-release';need(isMigration?Number.isInteger(n)&&probeMigrations().some(f=>Number(f.path.split('/').at(-1).slice(0,3))===n):n===null,'probe_migration_invalid');}
 need(v.assertionCode==='unknown'||v.errorClass==='AssertionError','probe_diagnostic_invalid');need(v.gate==='unknown'||v.errorClass==='GateError','probe_diagnostic_invalid');return v;
}
function validateProbe(v,expected){
 need(own(v,['version','binding','primary','cleanup'])&&v.version===1&&Array.isArray(v.cleanup)&&v.cleanup.length<=2,'probe_diagnostic_invalid');validateProbeBinding(v.binding);
 if(expected)need(JSON.stringify(v.binding)===JSON.stringify(validateProbeBinding(expected)),'probe_diagnostic_misbound');
 validateProbePoint(v.primary);
 const ready=v.binding.action!=='initialize',validStep=step=>ready?(step==='binding'||step.startsWith('readiness-')):!step.startsWith('readiness-');
 need(validStep(v.primary.step)&&(v.primary.lastConfirmed==='none'||validStep(v.primary.lastConfirmed)),'probe_diagnostic_invalid');
 for(const c of v.cleanup){validateProbePoint(c);need((ready?['readiness-close']:['client-release','pool-close']).includes(c.step)&&(c.lastConfirmed==='none'||validStep(c.lastConfirmed)),'probe_diagnostic_invalid');}return v;
}
function decodeProbe(stderr,expected){
 need(Buffer.isBuffer(stderr)&&stderr.length>0,'probe_diagnostic_missing');
 need(stderr.length<=4096,'probe_diagnostic_invalid');
 const s=stderr.toString();need(s.startsWith(probeMarker),'probe_diagnostic_invalid');
 let v;try{v=JSON.parse(s.slice(probeMarker.length));}catch{throw new GateError('probe_diagnostic_invalid');}
 validateProbe(v,expected);need(s===probeMarker+JSON.stringify(v)+'\n','probe_diagnostic_invalid');return v;
}
class ProbeProgress{
 constructor(binding){this.binding=validateProbeBinding(binding);this.step='binding';this.lastConfirmed='none';this.migration=null;this.lastMigration=null;this.primary=null;this.cleanup=[];}
 enter(step,migration=null){need(probeSteps.includes(step),'probe_diagnostic_invalid');this.step=step;this.migration=migration;}
 confirm(){this.lastConfirmed=this.step;this.lastMigration=this.migration;}
 capture(error){const point={step:this.step,lastConfirmed:this.lastConfirmed,migration:this.migration,lastMigration:this.lastMigration,...classifyProbe(error)};validateProbePoint(point);if(!this.primary)this.primary=point;else this.cleanup.push(point);}
 diagnostic(){return validateProbe({version:1,binding:this.binding,primary:this.primary,cleanup:this.cleanup});}
}
function probeCallsInFailure(v){return v?[...(v.probe?[v.probe]:[]),...v.causes.flatMap(probeCallsInFailure)]:[];}
module.exports={InitProgress,classifyInit,validateInit,initSteps,initGates,initFsCodes,stateDiagnostic,validateState,decodeState,publicFailure,validateFailure,validateDetail,stages,stateCodes,codes,ProbeProgress,validateProbeBinding,validateProbe,decodeProbe,probeMarker,probeMigrations,probeSteps,probeSqlStates,probeNodeCodes,probeCallsInFailure};
