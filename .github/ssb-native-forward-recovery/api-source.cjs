'use strict';
const fs=require('node:fs'),path=require('node:path');
const {bound,regular,json,need,sha}=require('./common.cjs');
const overlayFiles=['src/maintenance/maintenance-state.ts','src/maintenance/maintenance-runtime.ts','src/maintenance/maintenance-mutex.ts','api.Dockerfile'];
function manifest(){
 const bytes=regular(path.join(__dirname,'api-source-manifest.json')),m=json(bytes);
 need(m.version===1&&m.base==='94a25578e883a6d7bbd03f26c56735739f75e45e'&&JSON.stringify(m.files.map(f=>f.path).sort())===JSON.stringify([...overlayFiles].sort()),'api_source_invalid');
 for(const f of m.files){need(f.mode===420,'api_source_invalid');bound(path.join(__dirname,'api-overlay',f.path),f);}
 return {m,hash:sha(bytes)};
}
function catalogue(){return require('./release-source-manifest.json').files.filter(f=>f.path.startsWith('apps/api/')).map(f=>({...f,path:f.path.slice(9)}));}
function prepare(release,privateRoot){
 const {m,hash}=manifest(),source=path.join(release,'.github/ssb-capacity-diagnostic/source/apps/api'),root=path.join(privateRoot,'api-build');
 need(catalogue().some(f=>f.path==='package-lock.json'),'api_source_invalid');
 for(const f of m.files){const original=f.path==='api.Dockerfile'?path.join(release,'.github/ssb-capacity-diagnostic/dockerfiles/api.Dockerfile'):path.join(source,f.path);need(f.before===null?!fs.existsSync(original):sha(regular(original))===f.before,'api_source_changed');}
 fs.mkdirSync(root,{mode:0o700});
 for(const f of catalogue()){const to=path.join(root,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bound(path.join(source,f.path),f),{flag:'wx',mode:0o644});}
 for(const f of m.files){const to=path.join(root,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bound(path.join(__dirname,'api-overlay',f.path),f),{flag:f.before===null||f.path==='api.Dockerfile'?'wx':'w',mode:0o644});}
 const result={root,hash};verify(result);return result;
}
function verify(prepared){
 const {m,hash}=manifest();need(prepared.hash===hash,'api_source_changed');const expected=new Map(catalogue().map(f=>[f.path,f]));for(const f of m.files)expected.set(f.path,f);
 const walk=(dir,rel='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name),r=path.join(rel,e.name);need(!fs.lstatSync(p).isSymbolicLink(),'api_source_changed');return e.isDirectory()?walk(p,r):[r];});
 need(fs.lstatSync(prepared.root).isDirectory()&&!fs.lstatSync(prepared.root).isSymbolicLink()&&JSON.stringify(walk(prepared.root).sort())===JSON.stringify([...expected.keys()].sort()),'api_source_changed');
 for(const [p,f]of expected)bound(path.join(prepared.root,p),f);return prepared;
}
module.exports={manifest,prepare,verify,overlayFiles};
