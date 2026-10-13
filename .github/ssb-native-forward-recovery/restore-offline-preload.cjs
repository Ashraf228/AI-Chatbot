'use strict';
// Synthetic protocol fixture only. No database or external transport is opened.
const fs=require('node:fs'),Module=require('node:module'),assert=require('node:assert/strict');
const cfg=JSON.parse(process.env.SSB_RESTORE_TEST||'{}'),load=Module._load,write=fs.writeSync;
const marker='SYNTHETIC_PRIVATE_RESTORE_SQL_PASSWORD_PATH';let bytes='',input,pools=0,ends=0;
process.stdin.on('data',b=>{bytes+=b;});
process.stdin.on('end',()=>{input=JSON.parse(bytes);});
const applies=()=>input.action===cfg.action&&(cfg.restoreStage===undefined||input.restoreStage===cfg.restoreStage);
function fault(step){
 if(!applies()||cfg.step!==step)return;
 if(cfg.kind==='type')throw new TypeError(marker);
 if(cfg.kind==='json')JSON.parse('{');
 if(cfg.kind==='assertion')assert.equal(1,2,marker);
 if(cfg.kind==='primitive')throw {null:null,undefined:undefined,false:false,zero:0,empty:''}[cfg.primitiveValue||'false'];
 throw Object.assign(Error(marker),{code:cfg.code||'UNKNOWN_PRIVATE',path:marker,detail:marker});
}
const rows=sql=>{
 if(sql.startsWith('SELECT version FROM')){fault('snapshot-migrations');return Array.from({length:34},(_,i)=>({version:String(i+1).padStart(3,'0')}));}
 if(sql.startsWith('SELECT rolname')){fault('snapshot-roles');return Array.from({length:4},(_,i)=>({rolname:'ssb_'+i}));}
 if(sql.includes('c.relacl::text')){fault('snapshot-tables');return[{nspname:'public',relname:'sites',owner:'ssb_migrator',acl:'synthetic-acl'}];}
 if(sql.includes('pg_get_constraintdef')){fault('snapshot-constraints');return[{nspname:'public',relname:'sites',conname:'synthetic_pk',definition:'PRIMARY KEY (id)'}];}
 if(sql.startsWith('SELECT id,tenant_id')){fault('snapshot-markers');return[{id:'synthetic-site',name:applies()&&cfg.step==='snapshot-compare'?'changed':'Synthetic'},{id:'foreign-site',name:'Foreign'}];}
 if(sql.startsWith('SELECT id,request_sha256')){fault('snapshot-receipts');return Array.from({length:7},(_,i)=>({id:String(i),request_sha256:'a'.repeat(64),completed_at:'2026-10-13T00:00:00.000Z'}));}
 if(sql.includes('FROM provider_approval_grants')){fault('snapshot-grants');return[{n:cfg.grants?1:0}];}
 if(sql.includes('FROM pg_stat_activity')){fault('snapshot-pools');return[{n:cfg.activePools?1:0}];}
 assert.fail('unexpected synthetic SQL');
};
Module._load=function(id,...args){
 if(['node:net','net','node:dgram','dgram','node:http','http','node:https','https'].includes(id))throw Error('offline_transport_forbidden');
 if(['node:child_process','child_process'].includes(id))return new Proxy({},{get:()=>()=>{throw Error('offline_process_forbidden');}});
 if(id==='/app/node_modules/pg')return{Client:class extends require('node:events').EventEmitter{
  constructor(options){super();this.connectionParameters=options;pools++;assert.equal(options.password,input.passwords.postgres);}
  async connect(){await new Promise(r=>setImmediate(r));}
  async query(sql){assert.equal(sql,'SELECT current_database() AS database, session_user AS username, inet_server_port() AS port');fault('readiness-query');return{rows:[{database:'synthetic',username:'postgres',port:5432}]};}
  async end(){ends++;await new Promise(r=>setImmediate(r));this.emit('end');}
 },Pool:class{
  constructor(options){this.options=options;this.role=options.user;pools++;assert.equal(options.host,input.host||'db');assert.equal(options.port,5432);assert.equal(options.database,'synthetic');assert.equal(options.password,input.passwords[this.role]);fault(this.role==='postgres'?'pool-create':'restore-pool-create');}
  async query(sql){await new Promise(r=>setImmediate(r));
   if(sql.startsWith('ALTER ROLE ')){fault('restore-password');assert.match(sql,/^ALTER ROLE ssb_(runtime|admin_writer) PASSWORD '[a-f0-9]{64}'$/);return{rows:[]};}
   if(sql==='SELECT session_user AS name'){fault('restore-session');return{rows:[{name:cfg.wrongUser?'postgres':this.role}]};}
   if(sql==='SET ROLE postgres'){fault('restore-denied');if(cfg.superuserAllowed)return{rows:[]};throw Object.assign(Error(marker),{code:'42501'});}
   return{rows:rows(sql)};
  }
  async end(){await new Promise(r=>setImmediate(r));ends++;if(applies()&&cfg.closeFailure)throw Object.assign(Error(marker),{code:'EIO'});fault(this.role==='postgres'?'pool-close':'restore-pool-close');}
 }};
 return load.call(this,id,...args);
};
global.fetch=()=>{throw Error('offline_transport_forbidden');};
fs.writeSync=function(fd,data,...args){
 if(fd===2&&String(data).startsWith('SSB_INIT_PROBE_DIAGNOSTIC_V1 ')&&applies()){
  let s=String(data),v=JSON.parse(s.slice(s.indexOf(' ')+1));
  if(cfg.output==='missing')return s.length;
  if(cfg.output==='truncated')s=s.slice(0,-8);
  if(cfg.output==='json')s='SSB_INIT_PROBE_DIAGNOSTIC_V1 {\n';
  if(['call','run','publication','action'].includes(cfg.output)){v.binding[cfg.output]=['call','publication'].includes(cfg.output)?'f'.repeat(64):cfg.output==='action'?'initialize':'999';s='SSB_INIT_PROBE_DIAGNOSTIC_V1 '+JSON.stringify(v)+'\n';}
  if(cfg.output==='private'){v.primary.message=marker;s='SSB_INIT_PROBE_DIAGNOSTIC_V1 '+JSON.stringify(v)+'\n';}
  if(cfg.output==='write-failed')throw Object.assign(Error(marker),{code:'ENOSPC'});
  if(cfg.output==='exit-zero')process.exitCode=0;
  return write.call(this,fd,s,...args);
 }
 return write.call(this,fd,data,...args);
};
process.on('exit',()=>{if(cfg.countsFile)fs.writeFileSync(cfg.countsFile,JSON.stringify({pools,ends}),{flag:'wx',mode:0o600});});
