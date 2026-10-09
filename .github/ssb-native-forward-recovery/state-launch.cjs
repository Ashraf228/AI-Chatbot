'use strict';
const stateStages=['input','uid','module','initialize-state','initialize-window','initialize-owner','construct','retired-admission','open','snapshot','drained','action','bootstrap','entry-access','entry-load','entry-contract','load-check','output'];
const stateCodes=['EACCES','EPERM','ENOENT','ENOTDIR','EISDIR','EEXIST','ELOOP','EIO','ENOSPC','EMFILE','ENFILE','EPIPE','MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','ERR_REQUIRE_ESM','state_owner_required','binding_missing','private_directory_required','state_file_invalid','state_binding_invalid','generation_retired','admission_closed','unsupported_state_operation','invalid_input','node_version_required','entry_file_invalid','entry_contract_invalid','other'];
// This function is passed inline to Node: its first diagnostic needs no checkout module.
async function bootstrap(policy){
  let stage='bootstrap',fs;
  try{
    fs=require('node:fs');const path=require('node:path');
    if(process.version!=='v24.17.0')throw Object.assign(Error(),{code:'node_version_required'});
    const entry=process.argv[1],mode=process.argv[2];
    stage='input';
    if(!path.isAbsolute(entry||'')||!['run','load','load-runtime'].includes(mode))throw Object.assign(Error(),{code:'invalid_input'});
    const chunks=[];let size=0;
    for await(const chunk of process.stdin){size+=chunk.length;if(size>65536)throw Object.assign(Error(),{code:'invalid_input'});chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks));
    if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error(),{code:'invalid_input'});
    stage='entry-access';const stat=fs.lstatSync(entry);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Object.assign(Error(),{code:'entry_file_invalid'});
    fs.accessSync(entry,fs.constants.R_OK);
    stage='entry-load';const agent=require(entry);
    stage='entry-contract';const method=mode==='run'?'run':'loadCheck';
    if(typeof agent?.[method]!=='function')throw Object.assign(Error(),{code:'entry_contract_invalid'});
    stage=mode==='run'?'action':'load-check';
    const result=await agent[method](input,mode==='load-runtime');
    stage='output';fs.writeSync(1,JSON.stringify(result)+'\n');
  }catch(error){
    process.exitCode=1;
    const proposed=error?.stateDiagnostic;
    const valid=proposed&&Object.keys(proposed).sort().join(',')==='code,stage,version'&&proposed.version===1&&policy.stages.includes(proposed.stage)&&policy.codes.includes(proposed.code);
    const diagnostic=valid?proposed:{version:1,stage,code:policy.codes.includes(error?.code)?error.code:'other'};
    // Failure to write a diagnostic must not turn the primary failure into success or raw stderr.
    try{fs.writeSync(2,'SSB_STATE_DIAGNOSTIC_V1 '+JSON.stringify(diagnostic)+'\n');}catch{}
  }
}
const source='('+bootstrap.toString()+')('+JSON.stringify({stages:stateStages,codes:stateCodes})+');';
function stateArgs(entry,mode='run'){if(!['run','load','load-runtime'].includes(mode))throw Error('invalid state launch mode');return['--input-type=commonjs','-e',source,entry,mode];}
module.exports={stateArgs,stateStages,stateCodes};
