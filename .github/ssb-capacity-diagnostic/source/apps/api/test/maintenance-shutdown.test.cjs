const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),http=require('node:http');
function request(port,url) {return new Promise((resolve,reject)=>{const q=http.get({host:'127.0.0.1',port,path:url,agent:false},r=>{
  r.resume();r.on('end',()=>resolve(r.statusCode));});q.setTimeout(9000,()=>q.destroy(Error('synthetic request timeout')));q.on('error',reject);});}
function child(t,mode) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'shutdown-proof-')));fs.chmodSync(root,0o700);
  fs.writeFileSync(path.join(root,'runtime-state.json'),JSON.stringify({version:1,service:'synthetic',generations:['release'],epoch:0,phase:'open',legacy:'new-empty-service',work:{}}),{mode:0o600});
  const receipt=path.join(root,'shutdown-synthetic-release-api.json');
  const env={...process.env,APP_ENV:'test',DATABASE_URL:'postgresql://synthetic:synthetic@invalid/synthetic',
    MAINTENANCE_STATE_ROOT:root,MAINTENANCE_SERVICE:'synthetic',MAINTENANCE_GENERATION:'release',
    MAINTENANCE_PARTICIPANT_ID:'synthetic-release-api',MAINTENANCE_IMAGE_ID:'sha256:'+'1'.repeat(64)};
  if(mode==='missing-binding')delete env.MAINTENANCE_PARTICIPANT_ID;
  if(mode==='reused-binding')fs.writeFileSync(receipt,'{}',{mode:0o600});
  const p=spawn(process.execPath,[path.join(__dirname,'helpers/shutdown-child.cjs'),mode],{env,stdio:['ignore','pipe','pipe','ipc']});
  let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const messages=[],waiters=[];
  p.on('message',m=>{messages.push(m);for(const w of [...waiters])if(w.predicate(m)){waiters.splice(waiters.indexOf(w),1);w.resolve(m);}});
  const exit=new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',(code,signal)=>resolve({code,signal,stdout,stderr}));});
  const next=predicate=>{const prior=messages.find(predicate);return prior?Promise.resolve(prior):Promise.race([
    new Promise(resolve=>waiters.push({predicate,resolve})),exit.then(r=>{throw Error('synthetic child exited before IPC: '+JSON.stringify(r));})]);};
  t.after(async()=>{if(p.exitCode===null&&p.signalCode===null)p.kill('SIGKILL');await exit;fs.rmSync(root,{recursive:true,force:true});});
  return {p,exit,next,root,receipt};
}
test('real SIGTERM: reject new HTTP, finish admitted query, close Nest and both pools once, then exit 0', {timeout:10000},async t=>{
  const f=child(t,'success'),{port}=await f.next(m=>m.ready);
  const work=request(port,'/work');await f.next(m=>m.working);
  f.p.kill('SIGTERM');await new Promise(r=>setTimeout(r,30));
  f.p.kill('SIGINT');assert.equal(await request(port,'/check'),503);
  assert.equal(await work,200);const result=await f.exit;
  assert.equal(result.code,0);assert.equal(result.signal,null);
  const events=JSON.parse(result.stdout.trim().split('\n').at(-1)).events;
  for(const e of ['work-finished','pg-close','pg-closed','redis-close','redis-closed','app-closed'])assert.equal(events.filter(v=>v===e).length,1);
  assert.ok(events.indexOf('work-finished')<events.indexOf('pg-close'));
  const receipt=JSON.parse(fs.readFileSync(f.receipt));assert.equal(receipt.status,'graceful');assert.equal(receipt.poolsClosed,true);
  const state=JSON.parse(fs.readFileSync(path.join(f.root,'runtime-state.json')));
  assert.equal(state.phase,'closed');assert.ok(Object.values(state.work).every(w=>w.state==='completed'));
});
for(const mode of ['pool-failure','uncertain','hang-work','hang-pool','redis-quit-failure','redis-quit-race','redis-hang'])test(`no graceful proof on ${mode}`,{timeout:12000},async t=>{
  const f=child(t,mode),{port}=await f.next(m=>m.ready);let work;
  if(mode==='hang-work'){work=request(port,'/work').catch(()=>undefined);await f.next(m=>m.working);}
  const start=performance.now();f.p.kill('SIGTERM');const result=await f.exit;await work;
  assert.equal(result.code,1);assert.equal(result.signal,null);assert.ok(performance.now()-start<8500);
  assert.equal(fs.existsSync(f.receipt),false);assert.match(result.stderr,/"graceful":false/);
  assert.doesNotMatch(result.stderr,/synthetic-private/);assert.doesNotMatch(result.stdout,/shutdown_complete/);
  if(mode==='redis-quit-failure'||mode==='redis-quit-race')assert.match(result.stderr,/"reason":"redis_quit_failed"/);
});
for(const mode of ['missing-binding','reused-binding'])test(`startup denies ${mode}`,{timeout:4000},async t=>{
  const f=child(t,mode),r=await f.exit;assert.equal(r.code,2);assert.match(r.stderr,/synthetic_start_failed/);
});
test('external SIGKILL proves only process termination, never graceful completion',{timeout:5000},async t=>{
  const f=child(t,'success');await f.next(m=>m.ready);f.p.kill('SIGKILL');const r=await f.exit;
  assert.equal(r.signal,'SIGKILL');assert.equal(fs.existsSync(f.receipt),false);assert.doesNotMatch(r.stdout,/shutdown_complete/);
});
