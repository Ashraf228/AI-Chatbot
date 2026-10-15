'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {sha}=require('./common.cjs');
const source=process.env.SSB_PROBE_TEST_SOURCE,deps=process.env.SSB_REPORTER_TEST_DEPS;
const release=path.resolve(source,'../../..'),expected='5b3e40deedc42a3e4934fb100e4275c35490b10cc1fd1b1951b34b4fdf351dbf';
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ssb-mutex-binding-'));
const helper={api:'src/maintenance/maintenance-mutex.ts',reporter:'apps/api/src/maintenance/maintenance-mutex.ts',dashboard:'scripts/maintenance-mutex.ts'};
test('all three source manifests bind the identical reviewed mutex without replacing dependency files',()=>{
 for(const app of ['api','reporter','dashboard']){const m=require('./'+app+'-source.cjs').manifest().m;assert.equal(m.files.find(f=>f.path===helper[app]).sha256,expected);assert(!m.files.some(f=>/package(?:-lock)?\.json$/.test(f.path)));}
});
for(const app of ['api','reporter','dashboard'])test('actual '+app+' source preparation, missing helper, extra file and changed bytes are checked',()=>{
 const driver=require('./'+app+'-source.cjs'),p=driver.prepare(release,tmp()),target=path.join(p.root,helper[app]);
 assert.equal(sha(fs.readFileSync(target)),expected);driver.verify(p);
 const original=fs.readFileSync(target);fs.appendFileSync(target,' ');assert.throws(()=>driver.verify(p));fs.writeFileSync(target,original);
 const moved=path.join(path.dirname(p.root),'retained-helper.ts');fs.renameSync(target,moved);assert.throws(()=>driver.verify(p));fs.renameSync(moved,target);
 const extra=path.join(p.root,'unexpected.txt');fs.writeFileSync(extra,'synthetic',{flag:'wx'});assert.throws(()=>driver.verify(p));
});
for(const app of ['reporter','dashboard'])test('actual '+app+' compiler emits and loads both bound CJS modules',()=>{
 const driver=require('./'+app+'-source.cjs'),p=driver.prepare(release,tmp());driver.verify(p);
 const project=app==='reporter'?path.join(p.root,'apps/reporter'):p.root;
 fs.symlinkSync(deps,path.join(project,'node_modules'),'dir');
 const script=path.join(project,'scripts',app==='reporter'?'build-maintenance.cjs':'compile-state.cjs');
 const out=cp.spawnSync(process.execPath,[script],{cwd:project,env:{PATH:path.dirname(process.execPath)+':/usr/bin:/bin',LANG:'C.UTF-8'},encoding:'utf8',timeout:10000,maxBuffer:16384});
 assert.equal(out.status,0,out.stderr);assert.equal(out.signal,null);assert(!out.error);
 const output=path.join(project,app==='reporter'?'dist':'scripts'),state=require(path.join(output,'maintenance-state.cjs'));
 assert.equal(typeof require(path.join(output,'maintenance-mutex.cjs')).acquireStateMutex,'function');
 const root=tmp();fs.chmodSync(root,0o700);fs.writeFileSync(path.join(root,'runtime-state.json'),JSON.stringify({version:1,service:'synthetic',generations:['release'],epoch:0,phase:'closed',legacy:'new-empty-service',work:{}}),{flag:'wx',mode:0o600});const s=new state.MaintenanceState({root,service:'synthetic',generation:'release'});assert.equal(s.snapshot().phase,'closed');
 assert.equal(fs.existsSync(path.join(root,'runtime-state-mutex')),false);assert.equal(fs.readdirSync(root).some(n=>n.startsWith('runtime-state-wait-')),false);
});
test('API overlay keeps every migration and its standalone dependency lock byte-identical',()=>{
 const p=require('./api-source.cjs').prepare(release,tmp());for(const f of require('./release-source-manifest.json').files.filter(f=>f.path.startsWith('apps/api/migrations/')||['apps/api/package.json','apps/api/package-lock.json'].includes(f.path)))assert.equal(sha(fs.readFileSync(path.join(p.root,f.path.slice(9)))),f.sha256);
});
test('host maintenance code copy includes state and mutex with exact file modes',()=>{
 const code=fs.readFileSync(path.join(__dirname,'native.cjs'),'utf8');assert.match(code,/for\(const name of \['maintenance-state.js','maintenance-mutex.js'\]\)await this\.d/);assert.match(code,/for\(const name of \['maintenance-state.js','maintenance-mutex.js'\]\)fs\.chmodSync\(path\.join\(dist,name\),0o644\)/);
});
