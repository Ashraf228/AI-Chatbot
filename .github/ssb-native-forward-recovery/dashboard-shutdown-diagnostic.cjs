'use strict';
const fs=require('node:fs'),path=require('node:path');
const {need,json,clock}=require('./common.cjs'),contract=require('./dashboard-shutdown-contract.cjs');
const MARKER='SSB_DASHBOARD_SHUTDOWN ',LIMIT=4096;
const errors=Object.freeze(['unknown','identity','deadline','ENOENT','EACCES','EPERM','EIO','ENOSPC','EROFS','ELOOP',
  'regular_file_required','invalid_json','dashboard_shutdown_unverified','dashboard_shutdown_missing','dashboard_shutdown_invalid',
  'command_failed','command_timeout','output_limit','spawn_failed','process_completion_unverified','evidence_write_failed',
  'probe_work_deadline','resource_floor_observed','disk_floor','memory_floor']);
const code=e=>errors.includes(e?.code)?e.code:'unknown';
const own=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...k].sort());
function bytes(file){
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  let primary;
  try{
    const s=fs.fstatSync(fd);need(s.isFile()&&s.nlink===1&&s.size>0&&s.size<=LIMIT,'regular_file_required');
    const b=Buffer.alloc(LIMIT+1);let size=0,n;
    while(size<b.length&&(n=fs.readSync(fd,b,size,b.length-size,null)))size+=n;
    need(size===s.size&&size<=LIMIT,'regular_file_required');return b.subarray(0,size);
  }catch(error){primary=error;throw error;}
  finally{try{fs.closeSync(fd);}catch(error){if(!primary)throw error;}}
}
function decode(b,expected){
  need(Buffer.isBuffer(b)&&b.length>0&&b.length<=LIMIT,'dashboard_shutdown_invalid');
  const r=json(b);contract.validate(r,expected);
  need(b.equals(Buffer.from(JSON.stringify(r))),'dashboard_shutdown_invalid');return r;
}
function logs(stdout,stderr,expected){
  need(Buffer.isBuffer(stdout)&&Buffer.isBuffer(stderr)&&stdout.length+stderr.length<=LIMIT*2,'dashboard_shutdown_invalid');
  const candidates=[stdout,stderr].flatMap(b=>b.toString('utf8').split('\n').filter(l=>l.includes('SSB_DASHBOARD_SHUTDOWN')));
  need(candidates.length>0,'dashboard_shutdown_missing');
  need(candidates.length===1&&candidates[0].startsWith(MARKER),'dashboard_shutdown_invalid');
  const line=candidates[0];
  need([stdout,stderr].some(b=>b.includes(Buffer.from(line+'\n'))),'dashboard_shutdown_invalid');
  return decode(Buffer.from(line.slice(MARKER.length)),expected);
}
function validate(v){
  need(own(v,['version','binding','container','origin','record'])&&v.version===1
    &&typeof v.container==='string'&&/^[a-f0-9]{64}$/.test(v.container)&&['file','logs'].includes(v.origin),'dashboard_shutdown_invalid');
  contract.binding(v.binding);contract.validate(v.record,v.binding);return v;
}
async function collect(native,primary,entry,until){
  try{
    need(entry?.role==='dashboard'&&entry.generation===native.current.generation&&native.owned.includes(entry)
      &&typeof entry.id==='string'&&/^[a-f0-9]{64}$/.test(entry.id)&&!(native.initial?.containers||[]).includes(entry.id)
      &&entry.image===native.images.dashboard&&entry.name===`${native.prefix}-${entry.generation}-dashboard`,'identity');
    const binding=contract.binding({version:1,run:native.options.run,source:contract.SOURCE,publication:native.verifiedPublicationManifest,
      service:native.prefix,generation:entry.generation,participant:entry.name,imageId:entry.image});
    const finish=(record,origin)=>{primary.dashboardShutdown=validate({version:1,binding,container:entry.id,origin,record});};
    let b;
    try{b=bytes(path.join(native.stateRoot,`shutdown-${entry.name}.json`));}
    catch(error){if(error.code!=='ENOENT')throw error;}
    if(b){finish(decode(b,binding),'file');return;}
    // Spend only unused stop-window time; Native.d still enforces resources and the closure reserve.
    const ms=Math.floor(Math.min(1500,until-clock()));need(ms>250,'deadline');
    const result=await native.d(['logs','--tail','4',entry.id],{ms});
    finish(logs(result.stdout,result.stderr,binding),'logs');
  }catch(error){primary.dashboardShutdownError=code(error);}
}
module.exports={LIMIT,MARKER,errors,code,bytes,decode,logs,validate,collect};
