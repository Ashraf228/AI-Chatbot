'use strict';
// This file is also the byte-bound Reporter bootstrap. Before import it uses only Node builtins.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const SOURCE='94a25578e883a6d7bbd03f26c56735739f75e45e',MARKER='SSB_REPORTER_DIAGNOSTIC_V1 ';
const steps=Object.freeze(['entry','entry-import','maintenance-binding','maintenance-load','maintenance-construct','admission','action','work-close','completion','shutdown','diagnostic-write']);
const classes=Object.freeze(['Error','TypeError','SyntaxError','RangeError','ReferenceError','AggregateError','AssertionError','MaintenanceDenied','unknown']);
const nodeCodes=Object.freeze(['EACCES','EPERM','ENOENT','ENOTDIR','EISDIR','EEXIST','ENOSPC','EROFS','EIO','EMFILE','ENFILE','ELOOP','EPIPE','MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','ERR_UNKNOWN_FILE_EXTENSION','ERR_INVALID_ARG_TYPE','ERR_INVALID_ARG_VALUE','ERR_OUT_OF_RANGE','ERR_ASSERTION']);
const gates=Object.freeze(['binding_missing','private_directory_required','root_replaced','state_file_invalid','state_binding_invalid','work_record_invalid','transition_invalid','pilot_state_invalid','terminal_state_invalid','recovery_invalid','deployment_binding_invalid','state_capacity_exhausted','generation_retired','prior_work_uncertain','admission_closed','parent_not_active','external_work_uncertain','epoch_changed','work_cycle','work_capacity_exhausted','work_not_owned','drain_unproven']);
const own=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...keys].sort());
function need(ok,code){if(!ok)throw Object.assign(new Error(code),{code});}
const sha=s=>createHash('sha256').update(s).digest('hex');
function binding(run,generation,publication){
 const b={version:1,service:'reporter',run,generation,source:SOURCE,publication};
 b.call=sha(JSON.stringify(b));return validateBinding(b);
}
function validateBinding(b){
 need(own(b,['version','service','run','generation','source','publication','call'])&&b.version===1&&b.service==='reporter'&&typeof b.run==='string'&&/^[1-9][0-9]*$/.test(b.run)&&Number.isSafeInteger(Number(b.run))&&['release','forward','normal'].includes(b.generation)&&b.source===SOURCE&&typeof b.publication==='string'&&/^[a-f0-9]{64}$/.test(b.publication),'reporter_binding_invalid');
 const expected={version:1,service:'reporter',run:b.run,generation:b.generation,source:SOURCE,publication:b.publication};
 need(b.call===sha(JSON.stringify(expected)),'reporter_binding_invalid');return b;
}
function stateIo(value){
 need(own(value,['operation','resource','attempts','elapsedMs','limitMs'])&&['mutex-acquire','state-temp-create','mutex-release'].includes(value.operation),'reporter_diagnostic_invalid');
 need(value.resource===(value.operation==='state-temp-create'?'state-temp':'state-mutex'),'reporter_diagnostic_invalid');
 if(value.operation==='mutex-acquire')need(Number.isSafeInteger(value.attempts)&&value.attempts>=1&&Number.isSafeInteger(value.elapsedMs)&&value.elapsedMs>=0&&value.limitMs===50,'reporter_diagnostic_invalid');
 else need(value.attempts===null&&value.elapsedMs===null&&value.limitMs===null,'reporter_diagnostic_invalid');
 return value;
}
function mutexDetail(value){
 need(own(value,['origin','stage','attempts','elapsedMs','limitMs'])&&['deadline','filesystem'].includes(value.origin)&&['initial-check','waiter-create','queue-scan','ticket-create','queue-wait','mutex-create','mutex-release','waiter-cleanup'].includes(value.stage),'reporter_diagnostic_invalid');
 need(Number.isSafeInteger(value.attempts)&&value.attempts>=0&&Number.isSafeInteger(value.elapsedMs)&&value.elapsedMs>=0&&value.limitMs===50,'reporter_diagnostic_invalid');
 if(value.origin==='deadline')need(['initial-check','queue-scan','ticket-create','queue-wait','mutex-create'].includes(value.stage)&&value.elapsedMs>=50,'reporter_diagnostic_invalid');
 else need(!['initial-check','queue-wait'].includes(value.stage),'reporter_diagnostic_invalid');
 if(['mutex-create','mutex-release'].includes(value.stage))need(value.attempts>=1,'reporter_diagnostic_invalid');
 if(['initial-check','waiter-create','ticket-create'].includes(value.stage))need(value.attempts===0,'reporter_diagnostic_invalid');
 return value;
}
function classify(e,MaintenanceDenied,readStateIo,readMutex){
 const errorClass=MaintenanceDenied&&e instanceof MaintenanceDenied?'MaintenanceDenied':e instanceof TypeError?'TypeError':e instanceof SyntaxError?'SyntaxError':e instanceof RangeError?'RangeError':e instanceof ReferenceError?'ReferenceError':e instanceof AggregateError?'AggregateError':e instanceof require('node:assert/strict').AssertionError?'AssertionError':e instanceof Error?'Error':'unknown';
 let io;try{const value=readStateIo?.(e);if(value!==undefined)io=stateIo(value);}catch{}
 let mutex;try{const value=readMutex?.(e);if(value!==undefined)mutex=mutexDetail(value);}catch{mutex='unavailable';}
 return{errorClass,nodeCode:nodeCodes.includes(e?.code)?e.code:'unknown',gate:errorClass==='MaintenanceDenied'&&gates.includes(e?.code)?e.code:'unknown',...(io?{stateIo:io}:{}),...(mutex?{mutex}:{})};
}
function validatePoint(p){
 need(own(p,['step','lastConfirmed','errorClass','nodeCode','gate',...(Object.hasOwn(p,'stateIo')?['stateIo']:[]),...(Object.hasOwn(p,'mutex')?['mutex']:[])])&&steps.includes(p.step)&&(p.lastConfirmed==='none'||steps.includes(p.lastConfirmed))&&classes.includes(p.errorClass)&&(p.nodeCode==='unknown'||nodeCodes.includes(p.nodeCode))&&(p.gate==='unknown'||gates.includes(p.gate))&&(p.gate==='unknown'||p.errorClass==='MaintenanceDenied'),'reporter_diagnostic_invalid');
 if(Object.hasOwn(p,'stateIo')){
  stateIo(p.stateIo);need(['admission','action','work-close','completion','shutdown'].includes(p.step)&&p.gate==='unknown','reporter_diagnostic_invalid');
  if(p.stateIo.operation==='mutex-acquire'&&p.nodeCode==='EEXIST')need(p.stateIo.elapsedMs>=50,'reporter_diagnostic_invalid');
 }
 if(Object.hasOwn(p,'mutex')){
  need(['admission','action','work-close','completion','shutdown'].includes(p.step)&&p.gate==='unknown','reporter_diagnostic_invalid');
  if(p.mutex!=='unavailable'){
   mutexDetail(p.mutex);
   if(p.mutex.origin==='deadline')need(p.nodeCode==='EEXIST'&&p.errorClass==='Error'&&!Object.hasOwn(p,'stateIo'),'reporter_diagnostic_invalid');
   if(p.stateIo){
    const stage={'mutex-acquire':'mutex-create','mutex-release':'mutex-release'}[p.stateIo.operation];
    need(stage&&p.mutex.origin==='filesystem'&&p.mutex.stage===stage,'reporter_diagnostic_invalid');
    if(p.stateIo.operation==='mutex-acquire')need(p.mutex.attempts===p.stateIo.attempts&&p.mutex.limitMs===p.stateIo.limitMs,'reporter_diagnostic_invalid');
   }
  }
 }return p;
}
function validateRecord(r,expected){
 need(own(r,['version','binding','ok','primary','cleanup','truncated','delivery'])&&r.version===1&&r.ok===false&&typeof r.truncated==='boolean'&&Array.isArray(r.cleanup)&&r.cleanup.length<=2,'reporter_diagnostic_invalid');validateBinding(r.binding);
 if(expected)need(JSON.stringify(r.binding)===JSON.stringify(validateBinding(expected)),'reporter_diagnostic_misbound');
 validatePoint(r.primary);r.cleanup.forEach(validatePoint);
 const d=r.delivery;need(own(d,['channel','stderrBytes','writeError'])&&['stderr','stdout-fallback'].includes(d.channel)&&Number.isInteger(d.stderrBytes)&&d.stderrBytes>=0&&d.stderrBytes<4096,'reporter_diagnostic_invalid');
 if(d.channel==='stderr')need(d.stderrBytes===0&&d.writeError===null,'reporter_diagnostic_invalid');else{validatePoint(d.writeError);need(d.writeError.step==='diagnostic-write','reporter_diagnostic_invalid');}return r;
}
class Progress{
 constructor(b){this.binding=validateBinding(b);this.step='entry';this.lastConfirmed='none';this.primary=null;this.cleanup=[];this.truncated=false;this.seen=new Set();}
 enter(step){need(steps.includes(step),'reporter_diagnostic_invalid');this.step=step;}
 useMaintenanceDenied(ctor){need(typeof ctor==='function'&&ctor.prototype instanceof Error,'reporter_diagnostic_invalid');this.MaintenanceDenied=ctor;}
 useStateIoReader(reader){need(typeof reader==='function','reporter_diagnostic_invalid');this.readStateIo=reader;}
 useMutexReader(reader){need(typeof reader==='function','reporter_diagnostic_invalid');this.readMutex=reader;}
 confirm(){this.lastConfirmed=this.step;}
 capture(e,depth=0){
  if(this.seen.has(e))return;this.seen.add(e);
  if(depth>3){this.truncated=true;return;}
  if(e instanceof AggregateError){for(const child of e.errors.slice(0,4))this.capture(child,depth+1);if(e.errors.length>4)this.truncated=true;if(e.errors.length)return;}
  const mutexReader=['admission','action','work-close','completion','shutdown'].includes(this.step)?this.readMutex:undefined;
  const p={step:this.step,lastConfirmed:this.lastConfirmed,...classify(e,this.MaintenanceDenied,this.readStateIo,mutexReader)};
  if(!this.primary)this.primary=p;else if(this.cleanup.length<2)this.cleanup.push(p);else this.truncated=true;
 }
 result(){return validateRecord({version:1,binding:this.binding,ok:false,primary:this.primary,cleanup:this.cleanup,truncated:this.truncated,delivery:this.delivery||{channel:'stderr',stderrBytes:0,writeError:null}});}
}
function decode(stdout,stderr,expected){
 const out=Buffer.from(stdout).toString('utf8'),err=Buffer.from(stderr).toString('utf8');
 need(Buffer.byteLength(out)+Buffer.byteLength(err)<=8192,'reporter_diagnostic_invalid');
 const text=out||err;
 need(text.startsWith(MARKER),'reporter_diagnostic_missing');
 let record;try{record=JSON.parse(text.slice(MARKER.length));}catch{need(false,'reporter_diagnostic_invalid');}
 validateRecord(record,expected);need(text===MARKER+JSON.stringify(record)+'\n','reporter_diagnostic_invalid');
 if(!out)need(record.delivery.channel==='stderr','reporter_diagnostic_invalid');
 else{
  need(record.delivery.channel==='stdout-fallback'&&record.delivery.stderrBytes===Buffer.byteLength(err),'reporter_diagnostic_invalid');
  const original={...record,delivery:{channel:'stderr',stderrBytes:0,writeError:null}},bytes=Buffer.from(MARKER+JSON.stringify(original)+'\n');
  need(record.delivery.stderrBytes<bytes.length&&Buffer.from(err).equals(bytes.subarray(0,record.delivery.stderrBytes)),'reporter_diagnostic_invalid');
 }
 return record;
}
function writeAll(fd,text,write=fs.writeSync){const bytes=Buffer.from(text);let at=0;while(at<bytes.length){const n=write(fd,bytes,at,bytes.length-at);need(Number.isInteger(n)&&n>0&&n<=bytes.length-at,'reporter_diagnostic_write');at+=n;}}
function emit(progress,primary,write=fs.writeSync){
 progress.capture(primary);let sent=0;
 try{writeAll(2,MARKER+JSON.stringify(progress.result())+'\n',(fd,b,at,left)=>{const n=write(fd,b,at,left);if(Number.isInteger(n)&&n>0&&n<=left)sent+=n;return n;});}
 catch(first){
  progress.delivery={channel:'stdout-fallback',stderrBytes:sent,writeError:{step:'diagnostic-write',lastConfirmed:progress.lastConfirmed,...classify(first)}};
  try{writeAll(1,MARKER+JSON.stringify(progress.result())+'\n',write);}
  catch(second){progress.enter('diagnostic-write');progress.capture(second);throw new AggregateError([primary,first,second],'reporter_diagnostic_write_failed');}
 }
}
async function run({env=process.env,entry=path.join(__dirname,'main.js'),write=fs.writeSync}={}){
 let progress;
 try{
  const b=validateBinding(JSON.parse(env.SSB_REPORTER_DIAGNOSTIC_BINDING||'null'));
  need(env.MAINTENANCE_SERVICE==='ssb-native-'+b.run&&env.MAINTENANCE_GENERATION===b.generation&&env.MAINTENANCE_STATE_ROOT==='/run/ssb-maintenance','reporter_binding_invalid');
  progress=new Progress(b);progress.confirm();progress.enter('entry-import');
  const main=await import(pathToFileURL(entry).href);need(typeof main.startReporter==='function','reporter_entry_invalid');progress.confirm();
  await main.startReporter(progress);
 }catch(primary){
  if(progress)emit(progress,primary,write);
  else try{writeAll(2,'SSB_REPORTER_DIAGNOSTIC_UNBOUND\n',write);}catch(secondary){throw new AggregateError([primary,secondary],'reporter_diagnostic_write_failed');}
  throw primary;
 }
}
if(require.main===module)run().catch(()=>{process.exit(1);});
module.exports={SOURCE,MARKER,steps,classes,nodeCodes,gates,binding,validateBinding,stateIo,classify,validatePoint,validateRecord,Progress,decode,writeAll,emit,run};
