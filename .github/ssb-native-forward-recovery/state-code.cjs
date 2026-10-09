'use strict';
const fs=require('node:fs'),path=require('node:path');
const {need,bound}=require('./common.cjs');
const names=Object.freeze(['state-agent.cjs','diagnostics.cjs','common.cjs','base-diagnostics.cjs','state-launch.cjs','registry-bindings.json','probe.cjs']);
function prepareStateCode(bundle,privateRoot,manifest){
  const parent=fs.lstatSync(privateRoot);
  need(parent.isDirectory()&&!parent.isSymbolicLink()&&parent.uid===0&&(parent.mode&0o777)===0o711,'state_code_parent_invalid');
  // Only this public allowlist is copied; private state/raw directories never become readable.
  const files=names.map(name=>{
    const matches=manifest.files.filter(f=>f.path==='.github/ssb-native-forward-recovery/'+name);
    need(matches.length===1&&matches[0].mode===0o644&&matches[0].gitMode==='100644','state_code_binding_invalid');
    return{name,binding:matches[0],bytes:bound(path.join(bundle,name),matches[0])};
  });
  const directory=path.join(privateRoot,'state-code');fs.mkdirSync(directory,{mode:0o700});
  for(const f of files){const target=path.join(directory,f.name);fs.writeFileSync(target,f.bytes,{flag:'wx',mode:0o400});fs.chmodSync(target,0o444);}
  fs.chmodSync(directory,0o555);
  const dir=fs.lstatSync(directory);need(dir.isDirectory()&&!dir.isSymbolicLink()&&dir.uid===0&&(dir.mode&0o777)===0o555,'state_code_directory_invalid');
  need(JSON.stringify(fs.readdirSync(directory).sort())===JSON.stringify([...names].sort()),'state_code_scope_invalid');
  for(const f of files){const target=path.join(directory,f.name),s=fs.lstatSync(target);need(s.uid===0&&(s.mode&0o777)===0o444,'state_code_mode_invalid');bound(target,f.binding);}
  return path.join(directory,'state-agent.cjs');
}
module.exports={prepareStateCode,names};
