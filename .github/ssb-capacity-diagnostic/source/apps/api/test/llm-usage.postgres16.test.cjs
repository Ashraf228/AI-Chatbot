const test=require('node:test');
const assert=require('node:assert/strict');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {readFile}=require('node:fs/promises');
const {join}=require('node:path');
const {Pool}=require('pg');
const {PrismaService}=require('../dist/db/prisma.service.js');
const {persistLlmUsage}=require('../dist/usage/persist-llm-usage.js');
const {UsageController}=require('../dist/usage/usage.controller.js');
const exec=promisify(execFile);
const docker=(...args)=>exec('docker',args,{timeout:30000});

async function withUsageTestCleanup(action, cleanups) {
 let result; let primary; let failed=false;
 try { result=await action(); } catch(error) { primary=error; failed=true; }
 const cleanupErrors=[];
 for(const cleanup of cleanups) {
  try { await cleanup(); } catch(error) { cleanupErrors.push(error); }
 }
 if(failed && cleanupErrors.length) {
  throw new AggregateError([primary,...cleanupErrors], 'Usage test and cleanup failed', {cause:primary});
 }
 if(failed) throw primary;
 if(cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Usage test cleanup failed');
 return result;
}

test('usage cleanup preserves the original failure when cleanup succeeds',async()=>{
 const primary=new Error('synthetic-primary');const calls=[];
 await assert.rejects(withUsageTestCleanup(async()=>{throw primary;},[async()=>calls.push('pool'),async()=>calls.push('container')]),e=>e===primary);
 assert.deepEqual(calls,['pool','container']);
});
test('usage cleanup retains primary stack and all pool/container failures',async()=>{
 const primary=Object.freeze(new Error('synthetic-primary'));
 const poolError=new Error('synthetic-pool'),containerError=new Error('synthetic-container');const stack=primary.stack;const calls=[];
 await assert.rejects(withUsageTestCleanup(async()=>{throw primary;},[
  async()=>{calls.push('pool');throw poolError;},async()=>{calls.push('container');throw containerError;},
 ]),e=>e instanceof AggregateError && e.cause===primary && e.errors[0]===primary && e.errors[1]===poolError && e.errors[2]===containerError);
 assert.deepEqual(calls,['pool','container']);assert.equal(primary.stack,stack);
});
test('usage cleanup reports failures after a successful body and still attempts every step',async()=>{
 const poolError=new Error('synthetic-pool');let removed=false;
 await assert.rejects(withUsageTestCleanup(async()=>42,[async()=>{throw poolError;},async()=>{removed=true;}]),e=>e instanceof AggregateError && e.errors[0]===poolError);
 assert.equal(removed,true);
});
test('usage cleanup preserves nested diagnostics rather than overwriting them',async()=>{
 const primary=new Error('synthetic-primary'),inner=new Error('synthetic-inner'),outer=new Error('synthetic-outer');
 await assert.rejects(withUsageTestCleanup(()=>withUsageTestCleanup(async()=>{throw primary;},[async()=>{throw inner;}]),[async()=>{throw outer;}]),e=>e.cause.cause===primary && e.cause.errors[1]===inner && e.errors[1]===outer);
});
test('usage cleanup preserves a falsy rejection value',async()=>{
 let completed=false;let caught=false;
 try {await withUsageTestCleanup(async()=>{throw undefined;},[async()=>{completed=true;}]);}catch(e){caught=true;assert.equal(e,undefined);}
 assert.equal(caught,true);assert.equal(completed,true);
});
test('usage cleanup returns successful results when every cleanup succeeds',async()=>{
 const calls=[];assert.equal(await withUsageTestCleanup(async()=>42,[async()=>calls.push('pool'),async()=>calls.push('container')]),42);assert.deepEqual(calls,['pool','container']);
});

test('isolated PostgreSQL16 usage migration, idempotency, rollback and isolation', {skip:process.env.POSTGRES16_LLM_USAGE_TEST!=='1'},async t=>{
 const name='llm-usage-test-'+process.pid+'-'+Date.now();let containerAttempted=false;let pool;
 await withUsageTestCleanup(async()=>{
  await docker('image','inspect','pgvector/pgvector:pg16');
  containerAttempted=true;
  await docker('run','-d','--name',name,'--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_PASSWORD=synthetic-test-password','-e','POSTGRES_DB=llm_usage_test','-p','127.0.0.1::5432','pgvector/pgvector:pg16');
  const port=Number((await docker('port',name,'5432/tcp')).stdout.trim().split('\n')[0].split(':').at(-1));
  pool=new Pool({connectionString:`postgres://postgres:synthetic-test-password@127.0.0.1:${port}/llm_usage_test`});
  let ready=false;
  for(let i=0;i<40;i++){try{await pool.query('SELECT 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  assert.equal(ready,true);
  await pool.query(await readFile(join(__dirname,'../migrations/001_initial_schema.sql'),'utf8'));
  await pool.query("INSERT INTO sites(id,tenant_id,name) VALUES ('site-1','tenant-1','Synthetic'),('site-2','tenant-2','Synthetic'); INSERT INTO conversations(id,tenant_id,site_id,session_id) VALUES ('conversation-1','tenant-1','site-1','session-1'),('conversation-2','tenant-2','site-2','session-2')");
  const legacy="INSERT INTO usage_events(id,tenant_id,site_id,conversation_id,session_id,model) VALUES ('legacy','tenant-1','site-1','conversation-1','session-1','legacy')";
  await pool.query(legacy);
  const migration=await readFile(join(__dirname,'../migrations/034_llm_usage_measurement.sql'),'utf8');
  const db=Object.create(PrismaService.prototype);db.pool=pool;
  const scope={tenantId:'tenant-1',siteId:'site-1',conversationId:'conversation-1',sessionId:'session-1'};
  const measurement={...scope,callId:'call-1',provider:'openai',model:'gpt-4.1-mini',startedAt:new Date().toISOString(),usage:{inputTokens:11,outputTokens:7,totalTokens:18,status:'confirmed'},outcome:'success',latencyMs:1};
  await t.test('migration is repeatable and preserves legacy writes',async()=>{
   await pool.query(migration);await pool.query(migration);
   assert.equal((await pool.query("SELECT usage_status FROM usage_events WHERE id='legacy'")).rows[0].usage_status,'legacy');
   await pool.query(legacy.replace("'legacy','tenant-1'","'legacy-after','tenant-1'"));
  });
  await t.test('concurrent repeated finalization counts tokens exactly once',async()=>{
   await Promise.all(Array.from({length:8},()=>persistLlmUsage(db,scope,measurement)));
   assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM usage_events WHERE id='call-1'")).rows[0].count,1);
   const d=(await pool.query('SELECT * FROM usage_daily')).rows[0];assert.equal(d.total_tokens,18);assert.equal(d.request_count,0);
  });
  await t.test('missing usage is NULL, zero usage is separately confirmed',async()=>{
   await persistLlmUsage(db,scope,{...measurement,callId:'missing',usage:{inputTokens:null,outputTokens:null,totalTokens:null,status:'missing'},outcome:'aborted'});
   await persistLlmUsage(db,scope,{...measurement,callId:'zero',usage:{inputTokens:0,outputTokens:0,totalTokens:0,status:'confirmed'}});
   const rows=(await pool.query("SELECT id,total_tokens,usage_status,estimated_cost FROM usage_events WHERE id IN ('missing','zero') ORDER BY id")).rows;
   assert.equal(rows[0].total_tokens,null);assert.equal(rows[0].estimated_cost,null);assert.equal(rows[1].total_tokens,0);assert.equal(rows[1].usage_status,'confirmed');
  });
  await t.test('aggregate failure rolls event back; same call can then be safely retried',async()=>{
   await pool.query("ALTER TABLE usage_daily ADD CONSTRAINT synthetic_fail CHECK(total_tokens <= 18)");
   await assert.rejects(persistLlmUsage(db,scope,{...measurement,callId:'retry'}));
   assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM usage_events WHERE id='retry'")).rows[0].count,0);
   await pool.query('ALTER TABLE usage_daily DROP CONSTRAINT synthetic_fail');
   await persistLlmUsage(db,scope,{...measurement,callId:'retry'});
   assert.equal((await pool.query('SELECT total_tokens FROM usage_daily')).rows[0].total_tokens,36);
  });
  await t.test('foreign tenant/site/conversation/session cannot record or enter scoped evaluation',async()=>{
   for(const key of ['tenantId','siteId','conversationId','sessionId'])await assert.rejects(persistLlmUsage(db,{...scope,[key]:'foreign'},{...measurement,callId:'foreign-'+key}));
   const controller=new UsageController(db);
   const result=await controller.summary('tenant-1','site-1');assert.equal(result.llm_usage.total_tokens,36);assert.equal(result.llm_usage.unmeasured_calls,1);assert.equal(result.llm_usage.legacy_events,2);
   const foreign=await controller.summary('tenant-2','site-1');assert.equal(foreign.llm_usage.total_tokens,null);assert.equal(foreign.llm_usage.confirmed_calls,0);
   const rows=await controller.list('tenant-1','site-1');assert.equal(rows[0].llm_usage.total_tokens,36);
  });
  await t.test('destructive NOT NULL rollback is refused while unknown records exist',async()=>{
   await assert.rejects(pool.query('ALTER TABLE usage_events ALTER COLUMN total_tokens SET NOT NULL'));
   await assert.rejects(pool.query("UPDATE usage_events SET total_tokens=999 WHERE id='call-1'"));
   assert.equal((await pool.query("SELECT total_tokens FROM usage_events WHERE id='missing'")).rows[0].total_tokens,null);
  });
 }, [async()=>{if(pool)await pool.end();},async()=>{if(containerAttempted)await docker('rm','-f','-v',name);}]);
});
