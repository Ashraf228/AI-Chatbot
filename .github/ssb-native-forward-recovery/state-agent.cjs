'use strict';
const fs=require('node:fs'),path=require('node:path');
const {stateDiagnostic}=require('./diagnostics.cjs');
async function run(input){
  let stage='uid';try{
  if(process.getuid()!==1000)throw Object.assign(Error('state owner required'),{code:'state_owner_required'});
  stage='module';
  const {MaintenanceState}=require(path.join(input.toolsRoot,'apps/api/dist/maintenance/maintenance-state.js'));
  const b=input.binding,root=b.root;
  if(input.action==='initialize'){
    stage='initialize-state';
    fs.writeFileSync(path.join(root,'runtime-state.json'),JSON.stringify({version:1,service:b.service,generations:['seed'],epoch:0,phase:'closed',legacy:'new-empty-service',work:{}}),{flag:'wx',mode:0o600});
    stage='initialize-window';fs.mkdirSync(path.join(root,'maintenance-window'),{mode:0o700});stage='initialize-owner';fs.writeFileSync(path.join(root,'maintenance-window/owner.json'),JSON.stringify({version:1,owner:input.owner}),{flag:'wx',mode:0o600});
    return {epoch:0,syntheticNewService:true};
  }
  stage='construct';const state=new MaintenanceState(b);stage=input.action;
  if(input.action==='retired-admission')return require('./probe.cjs').retiredAdmission(input,MaintenanceState);
  if(input.action==='open'){
    state.drained(input.owner,input.epoch);state.open(input.owner,input.epoch);
    fs.renameSync(path.join(root,'maintenance-window'),path.join(root,`retained-window-${b.generation}-${input.epoch}`));
    return{opened:true};
  }
  if(input.action==='snapshot')return state.snapshot();
  if(input.action==='drained')return state.drained(input.owner,input.epoch);
  throw Object.assign(Error('unsupported state operation'),{code:'unsupported_state_operation'});
  }catch(error){error.stateDiagnostic=stateDiagnostic(error,stage);throw error;}
}
if(require.main===module){let b='',oversized=false;process.stdin.on('data',c=>{if(!oversized){b+=c;if(Buffer.byteLength(b)>65536){oversized=true;b='';}}});process.stdin.on('end',async()=>{try{if(oversized)throw Object.assign(Error('input limit'),{code:'invalid_input'});process.stdout.write(JSON.stringify(await run(JSON.parse(b)))+'\n');}catch(error){process.stderr.write('SSB_STATE_DIAGNOSTIC_V1 '+JSON.stringify(error.stateDiagnostic||stateDiagnostic(error,'input'))+'\n');process.exitCode=1;}});}
module.exports={run};
