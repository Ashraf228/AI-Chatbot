const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHmac, randomUUID, randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { DatabaseMigrationsService } = require('../dist/db/database-migrations.service');
const { PrismaService } = require('../dist/db/prisma.service');
const { AdminWriter } = require('../dist/admin-writer/admin-writer');
const { assertDatabaseIdentity } = require('../dist/admin-writer/database-identity');
const runtime = require('../dist/maintenance/maintenance-runtime');
const { writerHandler } = require('../dist/admin-writer/server');
const { operatorWrite } = require('../dist/admin-writer/operator');
const { createServer } = require('node:http');

test('separate admin writer: actual schema-034 roles, cascades and authorized operations', {
  skip: process.env.ADMIN_WRITER_POSTGRES_TEST !== '1', timeout: 90000,
}, async t => {
  const env = { ...process.env }, pools = [], root = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-test-'));
  const connectionString = process.env.DATABASE_URL;
  assert.equal(new URL(connectionString).pathname, '/synthetic');
  const migrationDb = new PrismaService();
  const db = new Pool({ connectionString, max: 2 });
  t.after(async () => {
    await Promise.all(pools.map(p => p.end())); await db.end(); await migrationDb.close();
    for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env); fs.rmSync(root, { recursive: true });
  });
  await new DatabaseMigrationsService(migrationDb).runPendingMigrations();
  assert.equal((await db.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n, 34);
  await db.query(fs.readFileSync(process.env.ADMIN_WRITER_ROLES_SQL, 'utf8'));
  for (const role of ['ssb_runtime','ssb_admin_writer','ssb_reporter','ssb_migrator']) {
    await db.query(`ALTER ROLE ${role} LOGIN PASSWORD 'synthetic-only'`);
  }
  const connect = name => {
    const u = new URL(connectionString); u.username = name; u.password = 'synthetic-only';
    const p = new Pool({ connectionString: u.toString(), max: 3, application_name: `synthetic-${name}` }); pools.push(p); return p;
  };
  const api = connect('ssb_runtime'), reporter = connect('ssb_reporter'), writerPool = connect('ssb_admin_writer');
  const key = randomBytes(48).toString('hex');
  const writer = new AdminWriter(writerPool, key);
  function state(extra = {}) {
    fs.chmodSync(root, 0o700);
    fs.writeFileSync(path.join(root, 'runtime-state.json'), JSON.stringify({ version: 1, service: 'synthetic-api',
      generations: ['one','two'], epoch: 0, phase: 'open', legacy: 'new-empty-service', work: {}, ...extra }), { mode: 0o600 });
    Object.assign(process.env, { APP_ENV: 'synthetic', MAINTENANCE_STATE_ROOT: root, MAINTENANCE_SERVICE: 'synthetic-api', MAINTENANCE_GENERATION: 'one' });
  }
  state();
  function request(method, route, body = {}, claims = { role: 'admin', sub: 'dashboard-admin' }) {
    const now = Date.now();
    const session = { exp: now + 60000, ...claims };
    const encoded = Buffer.from(JSON.stringify({ ...session, iat: now,
      sessionIssuedAt: new Date(now).toISOString(), sessionExpiresAt: new Date(session.exp).toISOString(), jti: randomUUID() })).toString('base64url');
    const token = encoded + '.' + createHmac('sha256',process.env.ADMIN_SESSION_SECRET || key).update(encoded).digest('base64url');
    const payload = JSON.stringify({ version: 1, id: randomUUID(), issuedAt: now, expiresAt: now + 30000,
      method, path: route, body, session: { role:session.role,sub:session.sub,exp:session.exp,tenantId:session.tenantId,tenantUserId:session.tenantUserId }, authorization: `Bearer ${token}`,
      sessionProof: createHmac('sha256', key).update(`writer-session-v1:${token}`).digest('hex') });
    return [payload, createHmac('sha256', key).update(payload).digest('hex')];
  }
  async function seed(suffix) {
    const tenant = `t-${suffix}`, site = `s-${suffix}`;
    await db.query('INSERT INTO tenants(id,name) VALUES ($1,$1)', [tenant]);
    await db.query('INSERT INTO sites(id,tenant_id,site_key,name) VALUES ($1,$2,$1,$1)', [site,tenant]);
    await db.query(`INSERT INTO knowledge_sources(id,tenant_id,site_id,source_type,label) VALUES ($1,$2,$3,'text',$1)`, [`source-${suffix}`,tenant,site]);
    await db.query(`INSERT INTO provider_approval_grants(id,tenant_id,site_id,scope_kind,source_types,usage_contexts,environment,provider_key,model,data_categories,purpose,retention_policy,redaction_policy,logging_policy,deletion_policy,rate_limit,cost_limit,valid_from,expires_at,approved_by,approval_evidence_ref)
      VALUES ($1,$2,$3,'site_runtime','[]','["query_embedding"]','production','openai','synthetic-model','["synthetic"]','query_embedding','synthetic','synthetic','synthetic','synthetic','synthetic','synthetic',now(),now()+interval '10 minutes','synthetic-admin','synthetic-evidence')`, [`grant-${suffix}`,tenant,site]);
    return { tenant,site };
  }
  const f = await seed('protected'); await seed('comparison');
  const inventory = async () => (await db.query(`SELECT json_build_object(
    'sites',(SELECT json_agg(s ORDER BY id) FROM sites s),
    'sources',(SELECT json_agg(s ORDER BY id) FROM knowledge_sources s),
    'grants',(SELECT json_agg(s ORDER BY id) FROM provider_approval_grants s)) AS data`)).rows[0].data;
  await t.test('effective identity, ownership, memberships and real FK inventory', async () => {
    await assertDatabaseIdentity(api, 'ssb_runtime'); await assertDatabaseIdentity(writerPool, 'ssb_admin_writer');
    await assertDatabaseIdentity(connect('ssb_migrator'), 'ssb_migrator');
    const fks = (await db.query(`SELECT confrelid::regclass::text parent, confupdtype, confdeltype FROM pg_constraint
      WHERE conrelid='provider_approval_grants'::regclass AND contype='f' ORDER BY parent`)).rows;
    assert.ok(fks.some(x => x.parent === 'sites' && x.confdeltype === 'c' && x.confupdtype === 'c'));
    assert.ok(fks.some(x => x.parent === 'tenants' && x.confdeltype === 'c' && x.confupdtype === 'c'));
    assert.ok(fks.some(x => x.parent === 'knowledge_sources' && x.confdeltype === 'n' && x.confupdtype === 'c'));
    console.log('FK_INVENTORY ' + JSON.stringify(fks));
  });
  for (const [label,pool] of [['runtime',api],['reporter',reporter]]) {
    for (const sql of [
      'DELETE FROM provider_approval_grants', "UPDATE provider_approval_grants SET revoked_at=now()",
      "DELETE FROM sites WHERE id='s-protected'", "UPDATE sites SET id='other' WHERE id='s-protected'",
      "UPDATE sites SET tenant_id='t-comparison' WHERE id='s-protected'", "DELETE FROM tenants WHERE id='t-protected'",
      "UPDATE tenants SET id='other' WHERE id='t-protected'", "DELETE FROM knowledge_sources WHERE id='source-protected'",
      "UPDATE knowledge_sources SET id='other' WHERE id='source-protected'",
      "UPDATE knowledge_sources SET site_id='s-comparison' WHERE id='source-protected'",
      'TRUNCATE sites CASCADE', 'SET ROLE ssb_admin_writer', 'SET ROLE ssb_migrator',
      'ALTER TABLE sites DISABLE TRIGGER ALL', 'CREATE TABLE public.unauthorized(id int)',
      "UPDATE tenant_users SET role='admin'", "UPDATE tenant_subscriptions SET status='internal'",
    ]) await t.test(`${label} denies ${sql.split(' ').slice(0,3).join(' ')} without any grant/parent mutation`, async () => {
      const before = await inventory();
      const qualified = sql.replace(/\b(provider_approval_grants|sites|tenants|knowledge_sources|tenant_users|tenant_subscriptions)\b/g,'public.$1');
      await assert.rejects(pool.query(qualified), e => e.code === '42501');
      assert.deepEqual(await inventory(), before);
    });
  }
  await t.test('runtime positive site read/session work and source status remain available', async () => {
    assert.equal((await api.query('SELECT id FROM sites WHERE id=$1',[f.site])).rowCount,1);
    await api.query("INSERT INTO widget_sessions(id,site_id,visitor_id) VALUES ('session-positive',$1,'synthetic')",[f.site]);
    await api.query("UPDATE widget_sessions SET last_seen_at=now() WHERE id='session-positive'");
    await api.query("UPDATE knowledge_sources SET label='updated' WHERE id='source-protected'");
    await assert.rejects(reporter.query('SELECT * FROM public.sites'),e=>e.code==='42501');
  });
  await t.test('untrusted API session cannot become writer authority, nor arbitrary SQL', async () => {
    const [payload] = request('DELETE',`/admin/sites/${f.site}`,{confirmation:'löschen'});
    await assert.rejects(writer.execute(payload,'0'.repeat(64)));
    const r = JSON.parse(payload); delete r.sessionProof;
    const forged=JSON.stringify(r);
    await assert.rejects(writer.execute(forged,createHmac('sha256',key).update(forged).digest('hex')));
    r.path='/sql';r.sessionProof='0'.repeat(64);
    const arbitrary=JSON.stringify(r);
    await assert.rejects(writer.execute(arbitrary,createHmac('sha256',key).update(arbitrary).digest('hex')));
  });
  await t.test('wrong tenant, role, confirmation and rollback leave full state unchanged', async () => {
    const before = await inventory();
    await assert.rejects(writer.execute(...request('DELETE',`/admin/sites/${f.site}`,{confirmation:'no'})));
    await assert.rejects(writer.execute(...request('DELETE',`/admin/sites/${f.site}`,{confirmation:'löschen'}, {role:'operator',sub:'operator'})));
    await assert.rejects(writer.execute(...request('DELETE',`/admin/sites/${f.site}`,{confirmation:'löschen'}, {role:'customer',sub:'customer',tenantId:'t-comparison',tenantUserId:'missing'})));
    assert.deepEqual(await inventory(),before);
    assert.ok(Object.values(runtime.runtimeState().snapshot().work).every(w=>w.state==='completed'));
  });
  await t.test('authorized Site deletion cascades only its own data; replay is rejected', async () => {
    const comparison = (await db.query("SELECT * FROM provider_approval_grants WHERE site_id='s-comparison'")).rows;
    const req=request('DELETE',`/admin/sites/${f.site}`,{confirmation:'löschen'});
    const result=await writer.execute(...req);
    assert.equal(result.ok,true);
    assert.equal((await db.query('SELECT * FROM sites WHERE id=$1',[f.site])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM provider_approval_grants WHERE site_id=$1',[f.site])).rows.length,0);
    assert.deepEqual((await db.query("SELECT * FROM provider_approval_grants WHERE site_id='s-comparison'")).rows,comparison);
    await assert.rejects(writer.execute(...req), e=>e.getStatus()===409);
  });
  await t.test('tenant/site administration, default subscription, personal authentication and authority updates', async () => {
    await writer.execute(...request('POST','/admin/tenants',{id:'t-new',name:'Synthetic new'}));
    const site=await writer.execute(...request('POST','/admin/sites',{id:'s-new',tenantId:'t-new',name:'Synthetic',allowedDomains:[]}));
    assert.equal(site.id,'s-new');
    assert.equal((await db.query("SELECT * FROM tenant_subscriptions WHERE tenant_id='t-new'")).rowCount,1);
    const user=await writer.execute(...request('POST','/admin/tenant-users',{tenantId:'t-new',email:'synthetic@example.invalid',displayName:'Synthetic',role:'editor',password:'synthetic-local-password'}));
    await writer.execute(...request('PUT',`/admin/tenant-users/${user.id}/customer-workspace-access`,{siteIds:['s-new']}));
    const auth=await writer.execute(...request('POST','/admin/tenant-users/authenticate',{tenantId:'t-new',email:'synthetic@example.invalid',password:'synthetic-local-password'},{role:'login',sub:'login'}));
    assert.equal(auth.id,user.id);
    await writer.execute(...request('DELETE',`/admin/tenant-users/${user.id}/customer-workspace-access`));
    await writer.execute(...request('PATCH',`/admin/tenant-users/${user.id}`,{isActive:false}));
    await assert.rejects(writer.execute(...request('POST','/admin/tenant-users/authenticate',{tenantId:'t-new',email:'synthetic@example.invalid',password:'synthetic-local-password'},{role:'login',sub:'login'})));
    await assert.rejects(writer.execute(...request('POST','/admin/sites',{id:'s-new',tenantId:'t-comparison',name:'Other',allowedDomains:[]})));
    const before=(await db.query("SELECT * FROM tenant_subscriptions WHERE tenant_id='t-new' ORDER BY id")).rows;
    await db.query("CREATE FUNCTION public.reject_subscription() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic subscription failure'; END $$");
    await db.query('CREATE TRIGGER reject_subscription BEFORE INSERT ON tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION public.reject_subscription()');
    try { await assert.rejects(writer.execute(...request('PATCH','/admin/billing/plan',{tenantId:'t-new',planCode:'enterprise'}))); }
    finally { await db.query('DROP TRIGGER reject_subscription ON tenant_subscriptions'); await db.query('DROP FUNCTION public.reject_subscription()'); }
    assert.deepEqual((await db.query("SELECT * FROM tenant_subscriptions WHERE tenant_id='t-new' ORDER BY id")).rows,before);
    await writer.execute(...request('PATCH','/admin/billing/plan',{tenantId:'t-new',planCode:'enterprise'}));
  });
  await t.test('whole document/source deletion rolls back on audit failure and succeeds on valid retry', async () => {
    await seed('document');
    await db.query("INSERT INTO documents(id,site_id,tenant_id,source_id,type) VALUES ('doc-synthetic','s-document','t-document','source-document','text')");
    await db.query("CREATE FUNCTION public.reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$");
    await db.query('CREATE TRIGGER reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_audit()');
    try { await assert.rejects(writer.execute(...request('DELETE','/admin/ingest/knowledge/doc-synthetic'))); }
    finally { await db.query('DROP TRIGGER reject_audit ON audit_logs'); await db.query('DROP FUNCTION public.reject_audit()'); }
    assert.equal((await db.query("SELECT id FROM documents WHERE id='doc-synthetic'")).rowCount,1);
    assert.equal((await db.query("SELECT id FROM knowledge_sources WHERE id='source-document'")).rowCount,1);
    await writer.execute(...request('DELETE','/admin/ingest/knowledge/doc-synthetic'));
    assert.equal((await db.query("SELECT id FROM knowledge_sources WHERE id='source-document'")).rowCount,0);
  });
  await t.test('source-scoped grant cannot orphan on source deletion; whole authorized Site deletion still succeeds',async()=>{
    await seed('source-grant');
    await db.query("UPDATE provider_approval_grants SET scope_kind='source',source_id='source-source-grant',source_types='[\"text\"]',usage_contexts='[\"ingestion_embedding\"]',purpose='ingestion_embedding' WHERE id='grant-source-grant'");
    await db.query("INSERT INTO documents(id,site_id,tenant_id,source_id,type) VALUES ('doc-grant-1','s-source-grant','t-source-grant','source-source-grant','text'),('doc-grant-2','s-source-grant','t-source-grant','source-source-grant','text')");
    await writer.execute(...request('DELETE','/admin/ingest/knowledge/doc-grant-1'));
    await assert.rejects(writer.execute(...request('DELETE','/admin/ingest/knowledge/doc-grant-2')),e=>e.getStatus()===409);
    assert.equal((await db.query("SELECT id FROM documents WHERE id='doc-grant-2'")).rowCount,1);
    await db.query("UPDATE provider_approval_grants SET revoked_at=now(),revoked_by='synthetic',revocation_reason='synthetic' WHERE id='grant-source-grant'");
    const before=await inventory();
    await assert.rejects(writer.execute(...request('DELETE','/admin/ingest/sources/source-source-grant')),e=>e.getStatus()===409);
    assert.deepEqual(await inventory(),before);
    const comparison=(await db.query("SELECT * FROM provider_approval_grants WHERE site_id='s-comparison' ORDER BY id")).rows;
    await db.query("CREATE FUNCTION public.reject_site_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic Site audit failure'; END $$");
    await db.query('CREATE TRIGGER reject_site_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_site_audit()');
    try { await assert.rejects(writer.execute(...request('DELETE','/admin/sites/s-source-grant',{confirmation:'löschen'}))); }
    finally { await db.query('DROP TRIGGER reject_site_audit ON audit_logs');await db.query('DROP FUNCTION public.reject_site_audit()'); }
    assert.deepEqual(await inventory(),before);
    const deleted=await writer.execute(...request('DELETE','/admin/sites/s-source-grant',{confirmation:'löschen'}));
    assert.equal(deleted.ok,true);assert.equal(deleted.deleted.providerApprovalGrants,1);
    assert.equal((await db.query("SELECT metadata->>'grants' n FROM audit_logs WHERE action='site.grants_deleted' AND resource_id='s-source-grant'")).rows[0].n,'1');
    assert.equal((await db.query("SELECT id FROM knowledge_sources WHERE site_id='s-source-grant'")).rowCount,0);
    assert.equal((await db.query("SELECT id FROM provider_approval_grants WHERE site_id='s-source-grant'")).rowCount,0);
    assert.deepEqual((await db.query("SELECT * FROM provider_approval_grants WHERE site_id='s-comparison' ORDER BY id")).rows,comparison);
  });
  await t.test('personal operator creates and revokes both purposes with atomic audit and current capability', async () => {
    process.env.ADMIN_SESSION_SECRET=randomBytes(32).toString('hex');process.env.DASHBOARD_INTERNAL_TOKEN=randomBytes(32).toString('hex');
    process.env.APP_ENV='staging';process.env.EMBEDDING_PROVIDER='openai';process.env.EMBEDDING_MODEL='text-embedding-3-small';process.env.OPENAI_MODEL='gpt-4o-mini';
    process.env.ADMIN_WRITER_RUNTIME_FILE=path.join(root,'runtime-binding.json');
    fs.writeFileSync(process.env.ADMIN_WRITER_RUNTIME_FILE,JSON.stringify({version:1,service:'synthetic-api',generation:'one',environment:'non_production',
      query_embedding:{providerKey:'openai',model:'text-embedding-3-small',supported:true},
      llm_generation:{providerKey:'openai',model:'gpt-4o-mini',supported:true}}),{mode:0o600});
    assert.equal(process.env.OPENAI_API_KEY,undefined);
    await writer.execute(...request('POST','/admin/tenants',{id:'t-default',name:'Synthetic internal'}));
    const capability={enabled:true,targets:[{tenantId:'t-comparison',siteIds:['s-comparison']}]};
    const user=await writer.execute(...request('POST','/admin/tenant-users',{tenantId:'t-default',email:'operator@example.invalid',displayName:'Synthetic',role:'admin',metadata:{siteRuntimeGrantOperatorV1:capability},password:'synthetic-local-password'}));
    const claims={role:'customer',sub:'customer:t-default:operator@example.invalid',tenantId:'t-default',tenantUserId:user.id,email:'operator@example.invalid',displayName:'Synthetic'};
    const terms={validFrom:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),embeddingDimension:1536,providerRegion:null,dataCategories:['synthetic'],customerDataApproved:true,productionApproved:false,providerDpaApproved:true,retentionPolicy:'synthetic',redactionPolicy:'synthetic',loggingPolicy:'synthetic',deletionPolicy:'synthetic',reindexPolicy:null,rateLimit:'synthetic',costLimit:'synthetic',approvalEvidenceRef:'synthetic'};
    for(const namespace of ['site-runtime-grants','site-runtime-llm-grants']) {
      const route=`/internal/${namespace}/t-comparison/s-comparison`;
      const result=await writer.execute(...request('POST',route,{...terms,embeddingDimension:namespace.includes('llm')?null:1536},claims));
      assert.equal(result.kind,'created');
      assert.equal((await db.query('SELECT * FROM provider_approval_audit_events WHERE approval_grant_id=$1',[result.grant.id])).rowCount,1);
      const repeated=await writer.execute(...request('POST',route,{...terms,embeddingDimension:namespace.includes('llm')?null:1536},claims));
      assert.equal(repeated.grant.id,result.grant.id);
      assert.equal((await db.query('SELECT * FROM provider_approval_audit_events WHERE approval_grant_id=$1',[result.grant.id])).rowCount,1);
      await assert.rejects(writer.execute(...request('POST',route,{...terms,approvalEvidenceRef:'different-synthetic-evidence',embeddingDimension:namespace.includes('llm')?null:1536},claims)),e=>e.getStatus()===409);
      await writer.execute(...request('POST',`${route}/${result.grant.id}/revoke`,{revocationReason:'synthetic cleanup'},claims));
      const audits=(await db.query('SELECT * FROM provider_approval_audit_events WHERE approval_grant_id=$1',[result.grant.id])).rows;
      assert.equal(audits.length,2);assert.ok(audits.every(row=>row.tenant_id==='t-comparison' && row.site_id==='s-comparison'));
    }
    await writer.execute(...request('PATCH',`/admin/tenant-users/${user.id}`,{isActive:false}));
    await assert.rejects(writer.execute(...request('POST','/internal/site-runtime-grants/t-comparison/s-comparison',terms,claims)));
    process.env.APP_ENV='synthetic';
  });
  await t.test('real writer HTTP preserves site-limit contract and authenticates requests', async () => {
    await writer.execute(...request('POST','/admin/tenants',{id:'t-http',name:'Synthetic HTTP'}));
    await writer.execute(...request('POST','/admin/sites',{id:'s-http',siteKey:'synthetic-http',tenantId:'t-http',name:'Synthetic HTTP',allowedDomains:[]}));
    const server=createServer(writerHandler(writer));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const url=`http://127.0.0.1:${server.address().port}/v1/write`;
    const send=async(values)=>fetch(url,{method:'POST',body:values[0],headers:{'X-Admin-Writer-Signature':values[1]}});
    try {
      const values=request('POST','/admin/sites',{id:'s-over-limit',tenantId:'t-http',name:'Synthetic',allowedDomains:[]});
      let expected;
      try { await writer.execute(...values); } catch(e) { expected=e.getResponse(); }
      assert.equal(expected.code,'limit_exceeded');
      const response=await send(values);assert.equal(response.status,403);
      assert.deepEqual(await response.json(),expected);
      const denied=await send([values[0],'0'.repeat(64)]);assert.equal(denied.status,401);
      assert.equal((await db.query("SELECT id FROM sites WHERE id='s-over-limit'")).rowCount,0);
    } finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
  });
  await t.test('customer template deletion retains current capability and tenant/site isolation',async()=>{
    const user=await writer.execute(...request('POST','/admin/tenant-users',{tenantId:'t-new',email:'poweruser@example.invalid',displayName:'Synthetic',role:'editor',metadata:{knowledgeManagementV1:{enabled:true,siteIds:['s-new']}},password:'synthetic-local-password'}));
    const claims={role:'customer',sub:'customer:t-new:poweruser@example.invalid',tenantId:'t-new',tenantUserId:user.id,email:'poweruser@example.invalid',displayName:'Synthetic'};
    await db.query("INSERT INTO knowledge_sources(id,tenant_id,site_id,source_type,label,is_active,runtime_readiness) VALUES ('template-own','t-new','s-new','it_support_template','Synthetic',false,'not_ready'),('template-foreign','t-comparison','s-comparison','it_support_template','Synthetic',false,'not_ready')");
    const before=await inventory();
    await assert.rejects(writer.execute(...request('DELETE','/customer/it-knowledge/s-comparison/templates/template-foreign',{},claims)));
    await assert.rejects(writer.execute(...request('DELETE','/customer/it-knowledge/s-new/templates/template-foreign',{},claims)));
    assert.deepEqual(await inventory(),before);
    await seed('template-grant');
    await db.query("UPDATE provider_approval_grants SET tenant_id='t-new',site_id='s-new',scope_kind='source',source_id='template-own',source_types='[\"it_support_template\"]',usage_contexts='[\"ingestion_embedding\"]',purpose='ingestion_embedding' WHERE id='grant-template-grant'");
    const withGrant=await inventory();
    await assert.rejects(writer.execute(...request('DELETE','/customer/it-knowledge/s-new/templates/template-own',{},claims)),e=>e.getStatus()===409);
    assert.deepEqual(await inventory(),withGrant);
    await db.query("DELETE FROM provider_approval_grants WHERE id='grant-template-grant'");
    assert.equal((await writer.execute(...request('DELETE','/customer/it-knowledge/s-new/templates/template-own',{},claims))).ok,true);
    assert.equal((await db.query("SELECT id FROM knowledge_sources WHERE id='template-foreign'")).rowCount,1);
    await writer.execute(...request('PATCH',`/admin/tenant-users/${user.id}`,{metadata:{knowledgeManagementV1:{enabled:false,siteIds:['s-new']}}}));
    await assert.rejects(writer.execute(...request('DELETE','/customer/it-knowledge/s-new/templates/template-own',{},claims)),e=>e.getStatus()===403);
  });
  await t.test('confirmed commit stays completed when client release subsequently fails', async () => {
    const releaseError=new Error('synthetic release failure');
    const wrapped={connect:async()=>{
      const client=await writerPool.connect(),release=client.release.bind(client);
      client.release=(...args)=>{release(...args);throw releaseError;};return client;
    }};
    const values=request('POST','/admin/tenants',{id:'t-release',name:'Synthetic release'});
    await assert.rejects(new AdminWriter(wrapped,key).execute(...values),e=>e===releaseError);
    assert.equal((await db.query("SELECT id FROM tenants WHERE id='t-release'")).rowCount,1);
    assert.equal((await writerPool.query('SELECT id FROM maintenance_admin.writer_receipts WHERE id=$1',[JSON.parse(values[0]).id])).rowCount,1);
    assert.ok(Object.values(runtime.runtimeState().snapshot().work).every(w=>w.state==='completed'));
  });
  await t.test('operator rejects a stale bound epoch after the asynchronous database identity check', async () => {
    const s=runtime.runtimeState(),owner=randomBytes(32).toString('hex');
    const window=path.join(root,'maintenance-window');fs.mkdirSync(window,{mode:0o700});
    fs.writeFileSync(path.join(window,'owner.json'),JSON.stringify({version:1,owner}),{mode:0o600});
    const epoch=s.close(owner),before=await inventory();
    const operatorFile=path.join(root,'operator.json'),dbFile=path.join(root,'writer-db');
    fs.writeFileSync(operatorFile,JSON.stringify({service:'synthetic-api',generation:'one',owner,epoch}),{mode:0o600});
    const u=new URL(connectionString);u.username='ssb_admin_writer';u.password='synthetic-only';
    fs.writeFileSync(dbFile,u.toString(),{mode:0o600});
    const saved={...process.env};delete process.env.DATABASE_URL;
    process.env.MAINTENANCE_OPERATOR_FILE=operatorFile;process.env.ADMIN_WRITER_DATABASE_URL_FILE=dbFile;
    const original=Pool.prototype.query;let changed=false;
    Pool.prototype.query=async function(sql,...args){
      const result=await original.call(this,sql,...args);
      if(!changed&&typeof sql==='string'&&sql.includes('current_user AS name')){changed=true;s.open(owner,epoch);s.close(owner);}
      return result;
    };
    try { await assert.rejects(operatorWrite('prepare-defaults'),e=>e.code==='epoch_changed');assert.equal(changed,true); }
    finally { Pool.prototype.query=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);s.open(owner,s.snapshot().epoch);fs.rmSync(window,{recursive:true}); }
    assert.deepEqual(await inventory(),before);
  });
  await t.test('owner loss during confirmed COMMIT reports failure without hiding committed effects or repeating work',async()=>{
    const s=runtime.runtimeState(),owner=randomBytes(32).toString('hex'),window=path.join(root,'maintenance-window');
    fs.mkdirSync(window,{mode:0o700});const file=path.join(window,'owner.json');
    const bytes=JSON.stringify({version:1,owner});fs.writeFileSync(file,bytes,{mode:0o600});const epoch=s.close(owner);
    const wrapped={connect:async()=>{const client=await writerPool.connect(),originalQuery=client.query,query=client.query.bind(client),release=client.release.bind(client);client.release=(...args)=>{client.query=originalQuery;return release(...args)};client.query=async(sql,...args)=>{
      const result=await query(sql,...args);if(sql==='COMMIT')fs.writeFileSync(file,JSON.stringify({version:1,owner:randomBytes(32).toString('hex')}));return result;
    };return client;}};
    try {
      await assert.rejects(runtime.withMaintenanceOwner(owner,()=>new AdminWriter(wrapped,key).execute(...request('POST','/admin/tenants',{id:'t-owner-commit',name:'Synthetic'})),epoch));
      assert.equal((await db.query("SELECT id FROM tenants WHERE id='t-owner-commit'")).rowCount,1);
      assert.ok(Object.values(s.snapshot().work).every(w=>w.state==='completed'));
    } finally {fs.writeFileSync(file,bytes);s.open(owner,epoch);fs.rmSync(window,{recursive:true});}
  });
  await t.test('closed maintenance window denies a new writer without partial effects', async () => {
    const blocker=await db.connect();
    await blocker.query('BEGIN');await blocker.query('SELECT pg_advisory_xact_lock(1397965313,2)');
    const pending=writer.execute(...request('DELETE','/admin/sites/s-comparison',{confirmation:'löschen'}));
    const rejected=assert.rejects(pending);
    try {
    let waiting=false;
    for(let i=0;i<50;i++) {
      const row=(await db.query("SELECT 1 FROM pg_stat_activity WHERE application_name='synthetic-ssb_admin_writer' AND wait_event_type='Lock'")).rows;
      if(row.length){waiting=true;break;} await new Promise(r=>setTimeout(r,10));
    }
    assert.equal(waiting,true,'writer must actually be waiting at PostgreSQL');
    const owner=randomBytes(32).toString('hex');
    fs.mkdirSync(path.join(root,'maintenance-window'),{mode:0o700});
    fs.writeFileSync(path.join(root,'maintenance-window','owner.json'),JSON.stringify({version:1,owner,pid:process.pid}),{mode:0o600});
    const s=runtime.runtimeState(),epoch=s.close(owner),before=await inventory();
    assert.throws(()=>s.drained(owner,epoch),{code:'drain_unproven'});
    await assert.rejects(writer.execute(...request('DELETE','/admin/sites/s-comparison',{confirmation:'löschen'})));
    await blocker.query('ROLLBACK');await rejected;
    assert.deepEqual(await inventory(),before);assert.equal(s.drained(owner,epoch).completed,true);
    } finally { await blocker.query('ROLLBACK');blocker.release();await rejected; }
  });
});
