'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {randomBytes,randomUUID,createHmac} = require('node:crypto');
module.exports = async function proof(input) {
  const result = {checks:[],phase:'bootstrap',synthetic:true,proof:'NATIVE_IMAGE_LOGIN_AND_POOLS'};
  const pools = [], services = []; let writer;
  const {Pool} = require('/app/node_modules/pg');
  const identity = require('/app/dist/admin-writer/database-identity');
  const runtime = require('/app/dist/maintenance/maintenance-runtime');
  const {DatabaseService} = require('/app/dist/db/database.service');
  const {PrismaService} = require('/app/dist/db/prisma.service');
  const check = async (label,fn) => {result.phase=label;await fn();result.checks.push({label,pass:true});};
  const connect = (role,password=input.passwords[role]) => {
    const p = new Pool({host:input.host,port:5432,user:role,password,database:'synthetic',
      connectionTimeoutMillis:3000,statement_timeout:3000,max:2,application_name:'ssb-synthetic-'+role});
    pools.push(p);return p;
  };
  const url = role => `postgresql://${role}:${input.passwords[role]}@${input.host}:5432/synthetic`;
  const privateWrite = (name,value) => fs.writeFileSync('/tmp/proof/'+name, value,{flag:'wx',mode:0o600});
  try {
    fs.mkdirSync('/tmp/proof',{mode:0o700});fs.mkdirSync('/tmp/proof/state',{mode:0o700});
    privateWrite('state/runtime-state.json',JSON.stringify({version:1,service:'synthetic-role-proof',generations:['release'],epoch:0,phase:'open',legacy:'new-empty-service',work:{}}));
    privateWrite('runtime.json',JSON.stringify({version:1,service:'synthetic-role-proof',generation:'release',environment:'production',
      query_embedding:{providerKey:'openai',model:'text-embedding-3-small',supported:true},
      llm_generation:{providerKey:'openai',model:'',supported:false}}));
    Object.assign(process.env,{NODE_ENV:'production',APP_ENV:'production',MAINTENANCE_SERVICE:'synthetic-role-proof',MAINTENANCE_GENERATION:'release',
      MAINTENANCE_STATE_ROOT:'/tmp/proof/state',ADMIN_WRITER_RUNTIME_FILE:'/tmp/proof/runtime.json',
      MAINTENANCE_PARTICIPANT_ID:'synthetic-role-proof-writer',MAINTENANCE_IMAGE_ID:input.imageId,
      DASHBOARD_INTERNAL_TOKEN:randomBytes(32).toString('hex')});
    for(const k of Object.keys(process.env)) if(k.startsWith('PG') || ['DATABASE_URL','OPENAI_API_KEY','ADMIN_KEY','REDIS_URL'].includes(k)) delete process.env[k];
    const api = connect('ssb_runtime'), admin = connect('ssb_admin_writer');
    for (const [name,pool] of [['ssb_runtime',api],['ssb_admin_writer',admin]]) {
      await check('real TCP login '+name,async()=>{
        const row=(await pool.query('SELECT session_user, current_user, inet_client_addr()::text AS addr')).rows[0];
        assert.equal(row.session_user,name);assert.equal(row.current_user,name);assert.ok(row.addr);
        await identity.assertDatabaseIdentity(pool,name);
      });
      await check('wrong password denied '+name,async()=>assert.rejects(connect(name,randomBytes(32).toString('hex')).query('SELECT 1'),e=>e.code==='28P01'));
    }
    for(const role of ['ssb_reporter','ssb_migrator']) await check('NOLOGIN '+role,async()=>
      assert.rejects(connect(role).query('SELECT 1'),e=>e.code==='28000'));
    for(const [role,pool,sql] of [
      ['runtime',api,'SET ROLE ssb_admin_writer'],['runtime',api,'SET ROLE postgres'],
      ['runtime',api,'CREATE TABLE public.unauthorized(id integer)'],
      ['runtime',api,"UPDATE public.sites SET tenant_id='foreign' WHERE id='synthetic-site'"],
      ['runtime',api,'DELETE FROM public.sites'],['runtime',api,'UPDATE public.provider_approval_grants SET revoked_at=now()'],
      ['runtime',api,'SELECT * FROM maintenance_admin.writer_receipts'],
      ['writer',admin,'SET ROLE postgres'],['writer',admin,'DELETE FROM maintenance_admin.writer_receipts'],
      ['writer',admin,'UPDATE maintenance_admin.writer_receipts SET completed_at=now()'],
      ['writer',admin,'CREATE TABLE public.unauthorized(id integer)']
    ]) await check('SQL denied '+role+' '+sql.split(' ').slice(0,3).join(' '),async()=>assert.rejects(pool.query(sql),e=>e.code==='42501'));
    process.env.DATABASE_URL=url('ssb_runtime');
    await check('actual production startup pool guard',()=>identity.assertRuntimeDatabase());
    for(const value of [undefined,url('ssb_runtime').replace('ssb_runtime','postgres')]) await check('startup rejects '+(value?'postgres':'missing URL'),async()=>{
      if(value)process.env.DATABASE_URL=value;else delete process.env.DATABASE_URL;
      await assert.rejects(identity.assertRuntimeDatabase(),/database|Database/);
    });
    process.env.DATABASE_URL=url('ssb_runtime');process.env.PGUSER='postgres';
    await check('PGUSER fallback rejected',async()=>assert.rejects(identity.assertRuntimeDatabase(),/binding invalid/));delete process.env.PGUSER;
    for(const Type of [DatabaseService,PrismaService]) await check('actual app pool '+Type.name,async()=>{
      const app=new Type();services.push(app);const row=(await app.query('SELECT session_user, current_user')).rows[0];
      assert.equal(row.session_user,'ssb_runtime');assert.equal(row.current_user,'ssb_runtime');
      await app.transaction(async tx=>assert.equal((await tx.query('SELECT id FROM sites WHERE id=$1',['synthetic-site'])).rows.length,1));
    });
    await check('runtime permitted session DML',async()=>{
      await services[0].query("INSERT INTO widget_sessions(id,site_id,visitor_id) VALUES ('synthetic-session','synthetic-site','synthetic')");
      await services[0].query("UPDATE widget_sessions SET last_seen_at=now() WHERE id='synthetic-session'");
    });
    delete process.env.DATABASE_URL;
    const key=randomBytes(48).toString('hex');process.env.ADMIN_SESSION_SECRET=key;
    privateWrite('writer-url',url('ssb_admin_writer'));privateWrite('writer-key',key);
    Object.assign(process.env,{ADMIN_WRITER_DATABASE_URL_FILE:'/tmp/proof/writer-url',ADMIN_WRITER_SIGNING_KEY_FILE:'/tmp/proof/writer-key',ADMIN_WRITER_PORT:'3011'});
    const {startAdminWriter}=require('/app/dist/admin-writer/server');
    await check('writer rejects inherited postgres URL',async()=>{
      process.env.DATABASE_URL=url('ssb_runtime').replace('ssb_runtime','postgres');
      await assert.rejects(startAdminWriter(),/inherit runtime credentials/);delete process.env.DATABASE_URL;
    });
    await check('actual writer server and Pool',async()=>{
      writer=await startAdminWriter();const row=(await writer.pool.query('SELECT session_user,current_user')).rows[0];
      assert.equal(row.session_user,'ssb_admin_writer');assert.equal(row.current_user,'ssb_admin_writer');
    });
    function request(route, body) {
      const now=Date.now(),session={role:'admin',sub:'dashboard-admin',exp:now+60000};
      const encoded=Buffer.from(JSON.stringify({...session,iat:now,sessionIssuedAt:new Date(now).toISOString(),sessionExpiresAt:new Date(session.exp).toISOString(),jti:randomUUID()})).toString('base64url');
      const token=encoded+'.'+createHmac('sha256',key).update(encoded).digest('base64url');
      const payload=JSON.stringify({version:1,id:randomUUID(),issuedAt:now,expiresAt:now+30000,method:'PATCH',path:route,body,session,
        authorization:'Bearer '+token,sessionProof:createHmac('sha256',key).update('writer-session-v1:'+token).digest('hex')});
      return {payload,signature:createHmac('sha256',key).update(payload).digest('hex'),id:JSON.parse(payload).id};
    }
    async function send(req) {
      const response=await fetch('http://127.0.0.1:3011/v1/write',{method:'POST',redirect:'error',signal:AbortSignal.timeout(4000),
        headers:{'content-type':'application/json','x-admin-writer-signature':req.signature},body:req.payload});
      await response.text();return response.status;
    }
    const req=request('/admin/sites/synthetic-site',{name:'Synthetic revised'});
    await check('HTTP writer commits effect and receipt',async()=>{
      assert.equal(await send(req),200);
      assert.equal((await api.query("SELECT name FROM sites WHERE id='synthetic-site'")).rows[0].name,'Synthetic revised');
      assert.equal((await admin.query('SELECT id FROM maintenance_admin.writer_receipts WHERE id=$1',[req.id])).rowCount,1);
    });
    await check('HTTP replay denied',async()=>assert.equal(await send(req),409));
    const failed=request('/admin/sites/nonexistent',{name:'Synthetic rollback'});
    await check('HTTP failed write rolls back receipt',async()=>{
      assert.equal(await send(failed),404);
      assert.equal((await admin.query('SELECT id FROM maintenance_admin.writer_receipts WHERE id=$1',[failed.id])).rowCount,0);
    });
    const state=runtime.runtimeState(),root='/tmp/proof/state';let release;
    const pending=runtime.maintenanceWork('handler',()=>new Promise(r=>{release=r;}));
    const owner=randomBytes(32).toString('hex');fs.mkdirSync(root+'/maintenance-window',{mode:0o700});
    privateWrite('state/maintenance-window/owner.json',JSON.stringify({version:1,owner}));
    const epoch=state.close(owner);
    await check('admission closes while prior work remains',async()=>{
      assert.throws(()=>state.drained(owner,epoch),e=>e.code==='drain_unproven');
      await assert.rejects(runtime.maintenanceWork('handler',async()=>{}));
      assert.equal(await send(request('/admin/sites/synthetic-site',{name:'must not write'})),503);
    });
    release();await pending;
    await check('actual registered work finishes before drain',async()=>assert.equal(state.drained(owner,epoch).completed,true));
    await check('reopen preserves receipts and normal work',async()=>{
      state.open(owner,epoch);fs.renameSync(root+'/maintenance-window',root+'/completed-window');
      assert.equal((await services[0].query('SELECT current_user')).rows[0].current_user,'ssb_runtime');
      assert.equal(await send(req),409);
    });
    result.status='PASS';
  } catch(e) {
    result.status='FAIL';result.failure={name:e.name,code:e.code||null,phase:result.phase,
      message:String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted-db-url]').slice(0,800),
      stack:String(e.stack).split('\n').filter(x=>/^\s+at /.test(x)).slice(0,6)};
  } finally {
    const errors=[];
    if(writer) {
      try {await new Promise((resolve,reject)=>writer.server.close(e=>e?reject(e):resolve()));await writer.pool.end();assert.equal(writer.pool.totalCount,0);}
      catch(e){errors.push({phase:'writer-close',name:e.name,code:e.code||null});}
    }
    for(const app of services)try{await app.close();}catch(e){errors.push({phase:'app-pool-close',name:e.name});}
    for(const p of pools)try{await p.end();assert.equal(p.totalCount,0);}catch(e){errors.push({phase:'pool-close',name:e.name});}
    result.poolCleanup={completed:errors.length===0,errors};if(errors.length)result.status='FAIL';
  }
  return result;
};
