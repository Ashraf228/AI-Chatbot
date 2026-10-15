'use strict';
const fs=require('node:fs'),path=require('node:path');
const {bound,regular,json,need,sha}=require('./common.cjs');
const overlayFiles=['apps/reporter/src/main.ts','apps/reporter/src/maintenance.ts','apps/reporter/scripts/reporter-entry.cjs','apps/reporter/scripts/build-maintenance.cjs','apps/api/src/maintenance/maintenance-state.ts','apps/api/src/maintenance/maintenance-mutex.ts','reporter.Dockerfile'];
function manifest(){
 const bytes=regular(path.join(__dirname,'reporter-source-manifest.json')),m=json(bytes);
 need(m.version===1&&m.base==='94a25578e883a6d7bbd03f26c56735739f75e45e'&&JSON.stringify(m.files.map(f=>f.path).sort())===JSON.stringify([...overlayFiles].sort()),'reporter_source_invalid');
 for(const f of m.files){need(f.mode===420,'reporter_source_invalid');bound(path.join(__dirname,'reporter-overlay',f.path),f);}
 need(regular(path.join(__dirname,'reporter-contract.cjs')).equals(regular(path.join(__dirname,'reporter-overlay/apps/reporter/scripts/reporter-entry.cjs'))),'reporter_source_invalid');
 return{m,hash:sha(bytes)};
}
function prepare(release,privateRoot){
 const {m,hash}=manifest(),source=path.join(release,'.github/ssb-capacity-diagnostic/source'),destination=path.join(privateRoot,'reporter-build');
 const catalogue=require('./release-source-manifest.json').files;
 const rows=catalogue.filter(f=>f.path==='.dockerignore'||f.path.startsWith('apps/reporter/')||f.path==='apps/api/src/maintenance/maintenance-state.ts');
 need(rows.length>10&&rows.some(f=>f.path==='apps/reporter/package-lock.json'),'reporter_source_invalid');
 for(const f of m.files){
  const original=f.path==='reporter.Dockerfile'?path.join(release,'.github/ssb-capacity-diagnostic/dockerfiles/reporter.Dockerfile'):path.join(source,f.path);
  need(f.before===null?!fs.existsSync(original):sha(regular(original))===f.before,'reporter_source_changed');
 }
 fs.mkdirSync(destination,{mode:0o700});
 for(const f of rows){const b=bound(path.join(source,f.path),f),to=path.join(destination,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,b,{flag:'wx',mode:0o644});}
 for(const f of m.files){const to=path.join(destination,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bound(path.join(__dirname,'reporter-overlay',f.path),f),{flag:f.before===null||f.path==='reporter.Dockerfile'?'wx':'w',mode:0o644});}
 for(const f of rows){const replacement=m.files.find(x=>x.path===f.path);bound(path.join(destination,f.path),replacement||f);}
 for(const f of m.files)bound(path.join(destination,f.path),f);
 const result={root:destination,hash};verify(result);return result;
}
function verify(prepared){
 const {m,hash}=manifest();need(prepared.hash===hash,'reporter_source_changed');
 const rows=require('./release-source-manifest.json').files.filter(f=>f.path==='.dockerignore'||f.path.startsWith('apps/reporter/')||f.path==='apps/api/src/maintenance/maintenance-state.ts');
 const expected=new Map(rows.map(f=>[f.path,f]));for(const f of m.files)expected.set(f.path,f);
 const walk=(dir,rel='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const r=path.join(rel,e.name),p=path.join(dir,e.name);need(!fs.lstatSync(p).isSymbolicLink(),'reporter_source_changed');return e.isDirectory()?walk(p,r):[r];});
 need(fs.lstatSync(prepared.root).isDirectory()&&!fs.lstatSync(prepared.root).isSymbolicLink()&&JSON.stringify(walk(prepared.root).sort())===JSON.stringify([...expected.keys()].sort()),'reporter_source_changed');
 for(const [p,f]of expected)bound(path.join(prepared.root,p),f);return prepared;
}
module.exports={manifest,prepare,verify,overlayFiles};
