'use strict';
const {sha,need,json}=require('./common.cjs');
const {validateDetail,publicFailure,probeCallsInFailure}=require('./diagnostics.cjs');
const phases=['preflight','bases','builds','initialize','roles','release-start','release-e1','release-drain','release-shutdown','forward-start','forward-e1','forward-drain','forward-shutdown','normal-start','normal-e1','normal-drain','normal-shutdown','restore','inventory','closure','complete'];
const MARKER='SSB_PUBLIC_RECEIPT_V2',LIMIT=2*1024*1024;
// Keep the reviewed generation contract together when native/probe obligations change.
const generationCounts=Object.freeze({start:Object.freeze({release:Object.freeze([5,5,0]),forward:Object.freeze([5,5,8]),normal:Object.freeze([5,5,16])}),e1:Object.freeze([11,7]),drain:Object.freeze([8,1,7]),shutdown:Object.freeze([5,2,0])});
const fields=['seq','run','source','workflowHead','dispatchNonce','phase','ok','counts','hashes','ids','elapsedMs','utc','previous','detail'];
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),unique=a=>new Set(a).size===a.length;
const runId=s=>typeof s==='string'&&/^[1-9][0-9]*$/.test(s)&&Number.isSafeInteger(Number(s));
function dispatchTitle(workflowHead,dispatchNonce){
  need(hex(workflowHead,40)&&hex(dispatchNonce,64),'dispatch_binding');
  return 'SSB native forward recovery / '+workflowHead+' / '+dispatchNonce;
}
function binding(run,source,b){
  need(runId(run)&&hex(source,40)&&b&&hex(b.workflowHead,40)&&hex(b.dispatchNonce,64),'receipt_binding');
}
function validate(r){
  need(r&&typeof r==='object'&&!Array.isArray(r)&&same(Object.keys(r).sort(),[...fields].sort()),'receipt_fields');
  binding(r.run,r.source,r);
  need(phases.includes(r.phase)&&typeof r.ok==='boolean'&&Number.isSafeInteger(r.seq)&&r.seq>=0&&hex(r.previous,64),'receipt_binding');
  need(Array.isArray(r.counts)&&r.counts.length<=32&&Array.from(r.counts).every(n=>Number.isSafeInteger(n)&&n>=0),'receipt_counts');
  need(Array.isArray(r.hashes)&&r.hashes.length<=64&&Array.from(r.hashes).every(s=>hex(s,64)),'receipt_hashes');
  need(Array.isArray(r.ids)&&r.ids.length<=64&&Array.from(r.ids).every(s=>typeof s==='string'&&/^(sha256:)?[a-f0-9]{64}$/.test(s)),'receipt_ids');
  need(Number.isFinite(r.elapsedMs)&&r.elapsedMs>=0&&r.elapsedMs<=990000&&typeof r.utc==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.utc)&&Number.isFinite(Date.parse(r.utc)),'receipt_time');
  validateDetail(r);
}
function validateEvidence(r,prior){
  for(const probe of probeCallsInFailure(r.detail.failure))need(probe.binding.publication===prior[0]?.hashes[0],'probe_publication_binding');
  const failed=prior.some(x=>!x.ok);
  need((r.phase===phases[prior.length]&&!failed)||(r.phase==='closure'&&failed&&!prior.some(x=>x.phase==='closure')),'receipt_phase_order');
  if(r.phase==='preflight'&&!r.ok)need(r.counts.length===0&&r.ids.length===0&&r.hashes.length<=1,'failed_preflight_shape');
  need(!prior.length||r.elapsedMs>=prior.at(-1).elapsedMs,'receipt_elapsed_order');
  if(r.phase==='closure')for(const o of r.detail.outcomes.filter(x=>x.state==='graceful')){const shutdown=prior.find(x=>x.ok&&x.phase===o.generation+'-shutdown');need(['api','admin-writer'].includes(o.role)&&shutdown?.ids[['api','admin-writer'].indexOf(o.role)]===o.id,'graceful_shutdown_receipt_missing');}
  if(!r.ok)return;
  if(failed){
    // Cleanup success is independent of work success; it must never authorize complete.
    need(r.phase==='closure'&&r.hashes.length===0,'partial_closure_phase');
    if(same(r.counts,[0])){
      need(prior.length===1&&prior[0].phase==='preflight'&&!prior[0].ok&&r.ids.length===0,'partial_closure_empty');return;
    }
    need(r.counts.length===3&&r.counts[0]<=19&&r.counts[1]===r.counts[0],'partial_closure_counts');
    need(r.ids.length>=r.counts[1]&&r.ids.length<=r.counts[1]+5&&r.ids.every(s=>hex(s,64))&&unique(r.ids),'partial_closure_ids');
    const cohorts=prior.filter(x=>x.ok&&x.phase.endsWith('-start')).flatMap(x=>x.ids);
    if(cohorts.length)need(r.counts[1]>=3+cohorts.length&&same(r.ids.slice(3,3+cohorts.length),cohorts),'partial_closure_cohorts');
    return;
  }
  const at=p=>prior.find(x=>x.phase===p),shape=(counts,ids,hashes)=>{
    need(same(r.counts,counts),'phase_counts');need(r.ids.length===ids&&r.hashes.length===hashes,'phase_cardinality');
  };
  const containerIds=()=>need(r.ids.every(s=>hex(s,64))&&unique(r.ids),'phase_container_ids');
  switch(r.phase){
    case 'preflight':shape([901,4],0,1);break;
    case 'bases':{
      const ids=require('./registry-bindings.json').images.map(x=>x.imageId);
      shape([ids.length],ids.length,0);need(same(r.ids,ids),'phase_base_ids');break;
    }
    case 'builds':
      // Native inserts api/dashboard/reporter/widget, then aliases admin-writer to api.
      shape([4,2],5,0);need(r.ids.every(s=>/^sha256:[a-f0-9]{64}$/.test(s))&&unique(r.ids.slice(0,4))&&r.ids[4]===r.ids[0]&&!r.ids.some(s=>at('bases').ids.includes(s)),'phase_build_ids');break;
    case 'initialize':shape([34,4,1],0,1);break;
    case 'roles':shape([32],0,0);break;
    case 'release-start':case 'forward-start':case 'normal-start':
      shape(generationCounts.start[r.phase.split('-')[0]],5,0);containerIds();need(!prior.filter(x=>x.phase.endsWith('-start')).some(x=>x.ids.some(id=>r.ids.includes(id))),'cohort_reused');break;
    case 'release-e1':case 'forward-e1':case 'normal-e1':
      shape(generationCounts.e1,0,2);need(unique(r.hashes),'phase_widget_hashes');
      if(r.phase!=='release-e1')need(same(r.hashes,at('release-e1').hashes),'widget_hashes_changed');break;
    case 'release-drain':case 'forward-drain':case 'normal-drain':shape(generationCounts.drain,0,0);break;
    case 'release-shutdown':case 'forward-shutdown':case 'normal-shutdown':
      shape(generationCounts.shutdown,5,2);containerIds();need(same(r.ids,at(r.phase.replace('-shutdown','-start')).ids),'shutdown_cohort_changed');
      need(unique(r.hashes)&&!prior.filter(x=>x.phase.endsWith('-shutdown')).some(x=>x.hashes.some(h=>r.hashes.includes(h))),'shutdown_receipts_reused');break;
    case 'restore':
      // database() returns migration/role counts and a variable retained writer-receipt count.
      need(r.counts.length===3&&r.counts[0]===34&&r.counts[1]===4&&r.counts[2]>=4,'phase_restore_counts');
      shape(r.counts,0,2);need(unique(r.hashes),'phase_restore_hashes');break;
    case 'inventory':{
      shape([19,5,2],24,0);containerIds();
      // Native owns three infrastructure containers, three ordered cohorts, then restore-postgres.
      const cohorts=['release','forward','normal'].flatMap(g=>at(g+'-start').ids);
      need(same(r.ids.slice(3,18),cohorts),'inventory_cohorts_changed');break;
    }
    case 'closure':
      need(r.counts.length===3&&r.counts[0]===19&&r.counts[1]===19&&r.counts[2]>0,'phase_closure_counts');
      shape(r.counts,24,0);need(same(r.ids,at('inventory').ids),'closure_inventory_changed');
      need(r.detail.outcomes.every(o=>['exited','graceful'].includes(o.state)&&o.exit===0),'closure_not_clean');
      for(const [i,g] of ['release','forward','normal'].entries())for(const [j,role] of ['api','admin-writer','dashboard','reporter','widget'].entries()){const o=r.detail.outcomes[3+i*5+j];need(o.role===role&&o.generation===g&&(j>1||o.state==='graceful'),'closure_generation_shutdown');}break;
    case 'complete':shape([],0,0);break;
    default:need(false,'unknown_phase');
  }
}
const canonical=r=>JSON.stringify(Object.fromEntries(fields.map(k=>[k,r[k]])));
const receiptLine=(bytes,digest)=>MARKER+' '+Buffer.from(bytes).toString('base64')+' '+digest;
class Receipts{
  constructor(run,source,context,output=console.log){binding(run,source,context);this.run=run;this.source=source;this.workflowHead=context.workflowHead;this.dispatchNonce=context.dispatchNonce;this.output=output;this.records=[];this.bytes=0;}
  emit(phase,ok,data={}){
    need(Object.keys(data).every(k=>['counts','hashes','ids','elapsedMs','detail'].includes(k)),'nonpublic_field');
    const r={seq:this.records.length,run:this.run,source:this.source,workflowHead:this.workflowHead,dispatchNonce:this.dispatchNonce,phase,ok,counts:[],hashes:[],ids:[],elapsedMs:0,...data,utc:new Date().toISOString(),previous:this.records.at(-1)?.sha256||'0'.repeat(64),detail:data.detail||{failure:ok?null:publicFailure(null),outcomes:[]}};
    validate(r);validateEvidence(r,this.records);
    const bytes=canonical(r),digest=sha(bytes),line=receiptLine(bytes,digest);
    need(this.bytes+Buffer.byteLength(line)+1<=LIMIT,'receipt_limit');
    this.output(line);this.bytes+=Buffer.byteLength(line)+1;this.records.push({...json(bytes),sha256:digest});return digest;
  }
}
function parseReceipts(text,run,source,context,{partial=false}={}){
  binding(run,source,context);need(typeof text==='string','receipt_input');
  const rows=[],lines=[];let bytes=0;
  for(const line of text.split(/\r?\n/)){
    need(!line.includes('SSB_PUBLIC_RECEIPT_V1'),'historical_receipt_version');
    if(!line.includes(MARKER))continue;
    // Only an unadorned record or GitHub's timestamp prefix is accepted, never arbitrary log prefixes.
    const m=line.match(/^(?:\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z )?SSB_PUBLIC_RECEIPT_V2 ([A-Za-z0-9+/]+={0,2}) ([a-f0-9]{64})$/);
    need(m&&m[0]===line,'malformed_receipt_marker');need(rows.length<phases.length,'receipt_limit');
    need(bytes+MARKER.length+m[1].length+67<=LIMIT,'receipt_limit');
    const b=Buffer.from(m[1],'base64');need(b.toString('base64')===m[1]&&sha(b)===m[2],'receipt_hash');
    const r=json(b);validate(r);need(canonical(r)===b.toString('utf8'),'receipt_noncanonical');
    need(r.run===run&&r.source===source&&r.workflowHead===context.workflowHead&&r.dispatchNonce===context.dispatchNonce&&r.seq===rows.length&&r.previous===(rows.at(-1)?.sha256||'0'.repeat(64)),'receipt_chain');
    validateEvidence(r,rows);const clean=receiptLine(canonical(r),m[2]);
    bytes+=Buffer.byteLength(clean)+1;need(bytes<=LIMIT,'receipt_limit');lines.push(clean);rows.push({...r,sha256:m[2]});
  }
  if(partial)need(rows.some(r=>!r.ok)&&rows.at(-1)?.phase==='closure'&&!rows.some(r=>r.phase==='complete'),'incomplete_failure_receipt');
  else need(rows.length===phases.length&&rows.every((r,i)=>r.phase===phases[i]&&r.ok),'incomplete_or_failed_receipt');
  const proof={status:partial?'PARTIAL_FAILURE_RECEIVED':'RECEIVED_AND_VERIFIED',run,source,workflowHead:context.workflowHead,dispatchNonce:context.dispatchNonce,phases:rows.length,publicationManifest:rows[0].hashes[0],finalSha256:rows.at(-1).sha256,bytes};
  return{proof,lines};
}
function receive(text,run,source,context){return parseReceipts(text,run,source,context).proof;}
module.exports={Receipts,receive,parseReceipts,phases,validate,validateEvidence,binding,dispatchTitle,runId,generationCounts};
