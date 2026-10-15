'use strict';
const fs=require('node:fs'),path=require('node:path');
const {bound,regular,json,need,sha}=require('./common.cjs');
const overlayFiles=['lib/redis.ts','scripts/dashboard-entry.cjs','scripts/dashboard-lifecycle.cjs',
  'scripts/dashboard-shutdown-contract.cjs','scripts/dashboard-next-close.cjs','scripts/compile-state.cjs','scripts/maintenance-state.ts','scripts/maintenance-mutex.ts','dashboard.Dockerfile'];
function manifest(){
  const bytes=regular(path.join(__dirname,'dashboard-source-manifest.json')),m=json(bytes);
  need(m.version===1&&m.base==='94a25578e883a6d7bbd03f26c56735739f75e45e'
    &&JSON.stringify(m.files.map(f=>f.path).sort())===JSON.stringify([...overlayFiles].sort()),'dashboard_source_invalid');
  for(const f of m.files){need(f.mode===420,'dashboard_source_invalid');bound(path.join(__dirname,'dashboard-overlay',f.path),f);}
  for(const p of ['dashboard-overlay/scripts/dashboard-shutdown-contract.cjs','adapters/scripts/ops/dashboard-shutdown-contract.cjs'])
    need(regular(path.join(__dirname,p)).equals(regular(path.join(__dirname,'dashboard-shutdown-contract.cjs'))),'dashboard_source_invalid');
  return{m,hash:sha(bytes)};
}
function catalogue(){
  return require('./release-source-manifest.json').files.filter(f=>f.path.startsWith('apps/dashboard/')).map(f=>({...f,path:f.path.slice(15)}))
    .concat({...require('./release-source-manifest.json').files.find(f=>f.path==='apps/api/src/maintenance/maintenance-state.ts'),path:'scripts/maintenance-state.ts'});
}
function prepare(release,privateRoot){
  const {m,hash}=manifest(),source=path.join(release,'.github/ssb-capacity-diagnostic/source'),root=path.join(privateRoot,'dashboard-build');
  need(catalogue().some(f=>f.path==='package-lock.json'),'dashboard_source_invalid');fs.mkdirSync(root,{mode:0o700});
  for(const f of catalogue()){
    const original=f.path==='scripts/maintenance-state.ts'?path.join(source,'apps/api/src/maintenance/maintenance-state.ts'):path.join(source,'apps/dashboard',f.path);
    const to=path.join(root,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bound(original,f),{flag:'wx',mode:0o644});
  }
  for(const f of m.files){
    const original=f.path==='dashboard.Dockerfile'?path.join(release,'.github/ssb-capacity-diagnostic/dockerfiles/dashboard.Dockerfile'):f.path==='scripts/maintenance-state.ts'?path.join(source,'apps/api/src/maintenance/maintenance-state.ts'):path.join(source,'apps/dashboard',f.path);
    need(f.before===null?!fs.existsSync(original):sha(regular(original))===f.before,'dashboard_source_changed');
    const to=path.join(root,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});
    fs.writeFileSync(to,bound(path.join(__dirname,'dashboard-overlay',f.path),f),{flag:f.before===null||f.path==='dashboard.Dockerfile'?'wx':'w',mode:0o644});
  }
  const prepared={root,hash};verify(prepared);return prepared;
}
function verify(prepared){
  const {m,hash}=manifest();need(prepared.hash===hash,'dashboard_source_changed');
  const expected=new Map(catalogue().map(f=>[f.path,f]));for(const f of m.files)expected.set(f.path,f);
  const walk=(dir,rel='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const r=path.join(rel,e.name),p=path.join(dir,e.name);need(!fs.lstatSync(p).isSymbolicLink(),'dashboard_source_changed');return e.isDirectory()?walk(p,r):[r];});
  need(fs.lstatSync(prepared.root).isDirectory()&&!fs.lstatSync(prepared.root).isSymbolicLink()
    &&JSON.stringify(walk(prepared.root).sort())===JSON.stringify([...expected.keys()].sort()),'dashboard_source_changed');
  for(const [p,f]of expected)bound(path.join(prepared.root,p),f);return prepared;
}
module.exports={manifest,prepare,verify,overlayFiles};
