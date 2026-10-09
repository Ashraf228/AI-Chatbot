require('./helpers/register-current-source.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {assertDatabaseUrl,assertDatabaseIdentity}=require('../dist/admin-writer/database-identity');
const {privateFile}=require('../dist/admin-writer/private-file');
const {reporterCredential,reporterSiteIds}=require('../../reporter/src/services/reporter-credentials.ts');
for(const role of ['ssb_runtime','ssb_admin_writer','ssb_migrator'])test(`explicit ${role} URL only; no pg defaults`,()=>{
  const value=`postgresql://${role}:synthetic@localhost:5432/synthetic`;
  assert.equal(assertDatabaseUrl(value,role),value);
  for(const bad of [undefined,'','postgresql://postgres:synthetic@localhost/synthetic','postgresql:///synthetic',value+'?user=postgres',value+'#other']){
    assert.throws(()=>assertDatabaseUrl(bad,role));
  }
  const before=process.env.PGUSER;try{process.env.PGUSER='postgres';assert.throws(()=>assertDatabaseUrl(value,role));}
  finally{if(before===undefined)delete process.env.PGUSER;else process.env.PGUSER=before;}
});
test('private mount reader rejects mode drift, symlink, hardlink and missing file',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'private-mount-'));t.after(()=>fs.rmSync(dir,{recursive:true}));
  const f=path.join(dir,'bound');fs.writeFileSync(f,'synthetic',{mode:0o600});assert.equal(privateFile(f),'synthetic');
  fs.chmodSync(f,0o644);assert.throws(()=>privateFile(f));fs.chmodSync(f,0o600);
  const alias=path.join(dir,'alias');fs.symlinkSync(f,alias);assert.throws(()=>privateFile(alias));
  fs.linkSync(f,path.join(dir,'hard'));assert.throws(()=>privateFile(f));assert.throws(()=>privateFile(undefined));
});
test('receipt ledger is required before accepting a writer pool',async()=>{
  const db={query:async q=>({rows:q.includes('current_user AS name')?[{name:'ssb_admin_writer',rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false}]:[]})};
  await assert.rejects(assertDatabaseIdentity(db,'ssb_admin_writer'),/Receipt ledger binding missing/);
});
test('receipt table without a valid id primary key cannot admit a pool',async()=>{
  const db={query:async q=>({rows:q.includes('current_user AS name')?[{name:'ssb_admin_writer',rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false}]
    :q.includes('SELECT c.relkind')?[{relkind:'r',owner:'ssb_migrator',can_read:true,can_insert:true,can_mutate:false}]
    :q.includes('SELECT EXISTS')?[{valid:false}]:[]})};
  await assert.rejects(assertDatabaseIdentity(db,'ssb_admin_writer'),/Receipt replay key invalid/);
});
test('reporter refuses migrator, operator and ambient PG bindings; validates exact scope',()=>{
  const before={...process.env};try{
    process.env.REPORTER_API_TOKEN='synthetic'.repeat(8);process.env.REPORTER_SITE_BINDINGS='[{"siteId":"s","tenantId":"t"}]';
    assert.equal(reporterCredential(),process.env.REPORTER_API_TOKEN);assert.deepEqual(reporterSiteIds(),['s']);
    for(const k of ['MIGRATOR_DATABASE_URL_FILE','MAINTENANCE_OPERATOR_FILE','PGUSER','ADMIN_KEY']){
      process.env[k]='forbidden';assert.throws(()=>reporterCredential());delete process.env[k];
    }
    for(const value of ['[]','[{"siteId":"s","tenantId":""}]','[{"siteId":"s","tenantId":"t","other":true}]']){
      process.env.REPORTER_SITE_BINDINGS=value;assert.throws(()=>reporterSiteIds());
    }
  }finally{for(const k of Object.keys(process.env))if(!(k in before))delete process.env[k];Object.assign(process.env,before);}
});
