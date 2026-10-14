'use strict';
const {need,clock}=require('./common.cjs');
const {Receipts,phases}=require('./evidence.cjs');
const {publicFailure}=require('./diagnostics.cjs');
const SOURCE='94a25578e883a6d7bbd03f26c56735739f75e45e';
async function main(options,backend){
  need(options?.authorization==='ONE_NATIVE_FORWARD_RECOVERY'&&/^[0-9]+$/.test(options.run||'')&&options.attempt==='1','execution_not_authorized');
  const started=clock(),receipts=new Receipts(options.run,SOURCE,options,options.output);let phase,primary,failed=false;
  try{
    for(phase of phases.filter(x=>!['closure','complete'].includes(x))){
      need(clock()-started<960000,'overall_work_deadline');
      const result=await backend.execute(phase);need(result&&result.verified===true,'phase_result_invalid');
      receipts.emit(phase,true,{counts:result.counts===undefined?[]:result.counts,ids:result.ids===undefined?[]:result.ids,hashes:result.hashes===undefined?[]:result.hashes,...(phase==='restore'?{detail:result.detail}:{}),elapsedMs:Math.round(clock()-started)});
    }
  }catch(e){primary=e;failed=true;try{
    const verified=backend.verifiedPublicationManifest;
    const hashes=phase==='preflight'&&typeof verified==='string'&&/^[a-f0-9]{64}$/.test(verified)?[verified]:[];
    receipts.emit(phase,false,{hashes,detail:{failure:publicFailure(e),outcomes:[]},elapsedMs:Math.round(clock()-started)});
  }catch(recordError){primary=new AggregateError([primary,recordError],'primary_and_record_failed');}}
  let closed,closureStage='backend';
  try{
    closed=await backend.close(failed);need(closed?.verified===true,'closure_unverified');
    closureStage='validation';
    receipts.emit('closure',true,{counts:closed.counts===undefined?[]:closed.counts,ids:closed.ids===undefined?[]:closed.ids,hashes:closed.hashes===undefined?[]:closed.hashes,...(closed.detail?{detail:closed.detail}:{}),elapsedMs:Math.round(clock()-started)},()=>{closureStage='output';});
  }catch(e){
    const prior=primary,hadPrimary=failed,secondary=[];failed=true;
    try{
    const candidate=closed||e?.publicReceipt;
    const closure={version:1,stage:closureStage,observations:'unavailable',rejectedBy:null};
    let data={detail:{failure:publicFailure(e),outcomes:[],closure},elapsedMs:Math.round(clock()-started)};
    if(candidate){
      const observed={counts:candidate.counts===undefined?[]:candidate.counts,ids:candidate.ids===undefined?[]:candidate.ids,hashes:candidate.hashes===undefined?[]:candidate.hashes,detail:{failure:data.detail.failure,outcomes:candidate.detail?.outcomes===undefined?[]:candidate.detail.outcomes,closure:{...closure,observations:'retained'}},elapsedMs:data.elapsedMs};
      try{
        // Retain observations only after the regular failure-receipt and binding checks.
        receipts.check('closure',false,observed);data=observed;
      }catch(validationError){
        closure.observations='rejected';closure.rejectedBy=publicFailure(validationError).code;
        secondary.push(validationError);
      }
    }
    receipts.emit('closure',false,data);
    }catch(recordError){secondary.push(recordError);}
    // Keep the original work/closure error first without extra nesting per write failure.
    primary=hadPrimary||secondary.length?new AggregateError([...(hadPrimary?[prior]:[]),e,...secondary],'primary_and_closure_failed'):e;
  }
  if(failed)throw primary;
  receipts.emit('complete',true,{elapsedMs:Math.round(clock()-started)});return receipts.records;
}
async function reportFailure(backend,error,output=console.error){
  try{await backend.recordFailure(error);}catch{output('SSB_PRIVATE_DIAGNOSTIC_NOT_PERSISTED');}
  output('SSB_NATIVE_FORWARD_RECOVERY_FAILED: inspect bounded receipt phase; raw diagnostics remain private');
}
if(require.main===module){
  const {Native}=require('./native.cjs');
  const options={authorization:process.env.SSB_EXECUTION_APPROVAL,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,workflowHead:process.env.GITHUB_SHA,dispatchNonce:process.env.SSB_DISPATCH_NONCE};
  const native=new Native(options);
  main(options,native).catch(async error=>{await reportFailure(native,error);process.exitCode=1;});
}
module.exports={main,reportFailure,SOURCE};
