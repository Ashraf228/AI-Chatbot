'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {parseReceipts,binding,dispatchTitle,runId}=require('./evidence.cjs'),{need,sha}=require('./common.cjs');
const SOURCE='94a25578e883a6d7bbd03f26c56735739f75e45e';
function main(args){
  const [run,job,head,dispatchNonce,destination]=args;need(args.length===5&&runId(job)&&typeof destination==='string'&&path.isAbsolute(destination),'receipt_arguments');
  const context={workflowHead:head,dispatchNonce};binding(run,SOURCE,context);
  const api=route=>execFileSync('gh',['api',`repos/Ashraf228/AI-Chatbot/${route}`],{encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
  const r=JSON.parse(api(`actions/runs/${run}`)),j=JSON.parse(api(`actions/jobs/${job}`));
  need(r.id===Number(run)&&r.event==='workflow_dispatch'&&r.run_attempt===1&&r.head_sha===head&&r.display_title===dispatchTitle(head,dispatchNonce)&&r.status==='completed'&&['success','failure'].includes(r.conclusion)&&r.path==='.github/workflows/ssb-native-forward-recovery.yml','run_provenance');
  need(j.id===Number(job)&&j.run_id===Number(run)&&j.conclusion===r.conclusion&&j.name==='Native forward recovery'&&Array.isArray(j.labels)&&j.labels.includes('ubuntu-24.04')&&!j.labels.includes('self-hosted'),'job_provenance');
  const log=api(`actions/jobs/${job}/logs`),{proof,lines}=parseReceipts(log,run,SOURCE,context,{partial:r.conclusion==='failure'});
  need(proof.publicationManifest===sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),'received_publication_binding');
  // Raw public job logs are deliberately not copied; save only validated receipt records and metadata.
  const receiptLines=lines.join('\n')+'\n';
  const output={...proof,job,receivedUTC:new Date().toISOString(),publicReceiptSha256:sha(receiptLines)};
  fs.mkdirSync(destination,{mode:0o700});fs.writeFileSync(path.join(destination,'receipts.txt'),receiptLines,{flag:'wx',mode:0o600});fs.writeFileSync(path.join(destination,'Empfang.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(output));
}
if(require.main===module){try{main(process.argv.slice(2));}catch{console.error('RECEIPT_NOT_CONFIRMED: no acceptance recorded');process.exitCode=1;}}
module.exports={main};
