'use strict';
const fs=require('node:fs'),path=require('node:path');
async function run(input){
  const {MaintenanceState}=require(path.join(input.toolsRoot,'apps/api/dist/maintenance/maintenance-state.js'));
  if(process.getuid()!==1000)throw Error('state owner required');
  const b=input.binding,root=b.root;
  if(input.action==='initialize'){
    fs.writeFileSync(path.join(root,'runtime-state.json'),JSON.stringify({version:1,service:b.service,generations:['seed'],epoch:0,phase:'closed',legacy:'new-empty-service',work:{}}),{flag:'wx',mode:0o600});
    fs.mkdirSync(path.join(root,'maintenance-window'),{mode:0o700});fs.writeFileSync(path.join(root,'maintenance-window/owner.json'),JSON.stringify({version:1,owner:input.owner}),{flag:'wx',mode:0o600});
    return {epoch:0,syntheticNewService:true};
  }
  const state=new MaintenanceState(b);
  if(input.action==='retired-admission')return require('./probe.cjs').retiredAdmission(input,MaintenanceState);
  if(input.action==='open'){
    state.drained(input.owner,input.epoch);state.open(input.owner,input.epoch);
    fs.renameSync(path.join(root,'maintenance-window'),path.join(root,`retained-window-${b.generation}-${input.epoch}`));
    return{opened:true};
  }
  if(input.action==='snapshot')return state.snapshot();
  if(input.action==='drained')return state.drained(input.owner,input.epoch);
  throw Error('unsupported state operation');
}
if(require.main===module){let b='';process.stdin.on('data',c=>{b+=c;if(b.length>65536)throw Error('input limit');});process.stdin.on('end',async()=>{try{process.stdout.write(JSON.stringify(await run(JSON.parse(b)))+'\n');}catch{process.stderr.write('state-operation-failed\n');process.exitCode=1;}});}
module.exports={run};
