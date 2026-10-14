'use strict';
const {need,sha}=require('./common.cjs');
const names=Object.freeze(['migrations','roles','tables','constraints','markers','receipts']);
const fields=Object.freeze({migrations:['version'],roles:['rolname','rolsuper','rolinherit','rolcreaterole','rolcreatedb','rolcanlogin','rolreplication','rolbypassrls'],tables:['nspname','relname','owner','acl'],constraints:['nspname','relname','conname','definition'],markers:['id','tenant_id','name'],receipts:['id','request_sha256','completed_at']});
const own=(v,k)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const count=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function probeBinding(b,stage){
 require('./diagnostics.cjs').validateProbeBinding(b);
 need(b.action==='database'&&(!stage||b.restoreStage===stage),'snapshot_binding_invalid');return b;
}
function summary(v,expected){
 need(own(v,['version','binding','hash','components'])&&v.version===1&&hex(v.hash),'snapshot_diagnostic_invalid');probeBinding(v.binding);
 if(expected)need(same(v.binding,probeBinding(expected)),'snapshot_binding_invalid');
 need(Array.isArray(v.components)&&v.components.length===names.length,'snapshot_diagnostic_invalid');
 v.components.forEach((x,i)=>need(own(x,['name','rows','hash'])&&x.name===names[i]&&count(x.rows)&&hex(x.hash),'snapshot_diagnostic_invalid'));
 return v;
}
function measure(snapshot,binding){
 need(own(snapshot,names),'snapshot_diagnostic_invalid');
 return summary({version:1,binding:probeBinding(binding),hash:sha(JSON.stringify(snapshot)),components:names.map(name=>{
  need(Array.isArray(snapshot[name]),'snapshot_diagnostic_invalid');
  return{name,rows:snapshot[name].length,hash:sha(JSON.stringify(snapshot[name]))};
 })},binding);
}
function baseline(v,after,expectedHash){
 need(own(v,['version','archive','before'])&&v.version===1&&hex(v.archive),'snapshot_diagnostic_invalid');summary(v.before);probeBinding(v.before.binding,'before');
 if(after){probeBinding(after,'after');for(const key of ['run','source','publication'])need(after[key]===v.before.binding[key],'snapshot_binding_invalid');need(after.call!==v.before.binding.call,'snapshot_binding_invalid');}
 if(expectedHash!==undefined)need(v.before.hash===expectedHash,'snapshot_binding_invalid');return v;
}
function bind(before,archive){return baseline({version:1,archive,before});}
function comparison(v,after,expectedBaseline){
 need(own(v,['version','binding','beforeHash','afterHash','components'])&&v.version===1&&hex(v.beforeHash)&&hex(v.afterHash),'snapshot_diagnostic_invalid');
 const b=v.binding;
 need(own(b,['run','source','publication','beforeCall','afterCall','archive'])&&hex(b.beforeCall)&&hex(b.afterCall)&&b.beforeCall!==b.afterCall&&hex(b.archive),'snapshot_binding_invalid');
 const binding={version:1,action:'database',run:b.run,source:b.source,publication:b.publication,call:b.afterCall,restoreStage:'after'};probeBinding(binding,'after');
 if(after)need(same(binding,probeBinding(after,'after')),'snapshot_binding_invalid');
 need(Array.isArray(v.components)&&v.components.length===names.length,'snapshot_diagnostic_invalid');
 v.components.forEach((x,i)=>need(own(x,['name','beforeHash','afterHash','beforeRows','afterRows','equal'])&&x.name===names[i]&&hex(x.beforeHash)&&hex(x.afterHash)&&count(x.beforeRows)&&count(x.afterRows)&&typeof x.equal==='boolean'&&x.equal===(x.beforeHash===x.afterHash&&x.beforeRows===x.afterRows),'snapshot_diagnostic_invalid'));
 if(expectedBaseline){
  baseline(expectedBaseline,binding,v.beforeHash);need(b.archive===expectedBaseline.archive&&b.beforeCall===expectedBaseline.before.binding.call,'snapshot_binding_invalid');
  v.components.forEach((x,i)=>need(x.beforeHash===expectedBaseline.before.components[i].hash&&x.beforeRows===expectedBaseline.before.components[i].rows,'snapshot_binding_invalid'));
 }
 return v;
}
function compare(base,after){
 summary(after);baseline(base,after.binding);const b=after.binding;
 return comparison({version:1,binding:{run:b.run,source:b.source,publication:b.publication,beforeCall:base.before.binding.call,afterCall:b.call,archive:base.archive},beforeHash:base.before.hash,afterHash:after.hash,components:names.map((name,i)=>{
  const x=base.before.components[i],y=after.components[i];return{name,beforeHash:x.hash,afterHash:y.hash,beforeRows:x.rows,afterRows:y.rows,equal:x.hash===y.hash&&x.rows===y.rows};
 })},b,base);
}
const errors=Object.freeze(['snapshot_binding_invalid','snapshot_diagnostic_invalid','unknown']);
function errorCode(error){return errors.includes(error?.code)?error.code:'unknown';}
function counts(v,proof){
 summary(v);const n=Object.fromEntries(v.components.map(x=>[x.name,x.rows]));
 need(n.migrations===34&&n.roles===4&&n.markers===2&&n.receipts>=4,'snapshot_diagnostic_invalid');
 if(proof!==undefined)need(Array.isArray(proof)&&proof.length===3&&same(proof,[n.migrations,n.roles,n.receipts]),'snapshot_diagnostic_invalid');
 return v;
}
function completed(v,base,proof){
 comparison(v,undefined,base);counts(base.before,proof);
 need(v.beforeHash===v.afterHash&&v.components.every(x=>x.equal),'snapshot_binding_invalid');return v;
}
function result(r,b,base){
 summary(r.snapshot,b);need(Array.isArray(r.counts),'snapshot_diagnostic_invalid');counts(r.snapshot,r.counts);need(Array.isArray(r.hashes)&&r.hashes[0]===r.snapshot.hash,'snapshot_binding_invalid');
 if(b.restoreStage==='before')need(!Object.hasOwn(r,'snapshotComparison'),'snapshot_diagnostic_invalid');
 else{comparison(r.snapshotComparison,b,base);need(same(r.snapshotComparison,compare(base,r.snapshot))&&r.snapshotComparison.beforeHash===r.snapshotComparison.afterHash,'snapshot_binding_invalid');}
 return r;
}
module.exports={names,fields,summary,measure,baseline,bind,comparison,compare,errors,errorCode,result,counts,completed};
