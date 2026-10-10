'use strict';
// Test-only preload. No Docker, database socket or provider transport is available here.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const config=JSON.parse(process.env.SSB_PROBE_TEST||'{}'),read=fs.readFileSync,readdir=fs.readdirSync,lstat=fs.lstatSync,write=fs.writeSync;
const source=process.env.SSB_PROBE_TEST_SOURCE;
assert.ok(source&&path.isAbsolute(source));
const marker='SYNTHETIC_PRIVATE_SQL_PASSWORD_PATH';
let migration=0,poolQueries=0,releaseCalls=0,endCalls=0;
const error=()=>{
 if(config.kind==='json'){try{JSON.parse('{');}catch(e){return e;}}
 if(config.kind==='type')return new TypeError(marker);
 if(config.kind==='assertion'){try{assert.equal(1,2,marker);}catch(e){return e;}}
 return Object.assign(Error(marker),{code:config.code||'UNRECOGNIZED',path:'/synthetic-private',detail:marker});
};
const fault=step=>{if(config.step===step&&(config.migration===undefined||migration===config.migration))throw error();};
const realPath=p=>{
 if(typeof p==='string'&&p.startsWith('/source/'))return path.join(source,p.slice(8));
 if(p==='/proof/adapters/scripts/ops/admin-writer-roles.sql')return path.join(__dirname,'adapters/scripts/ops/admin-writer-roles.sql');
 return p;
};
fs.readdirSync=function(p,...args){if(p==='/source/apps/api/migrations')fault('migration-list');return readdir.call(this,realPath(p),...args);};
fs.lstatSync=function(p,...args){if(String(p).startsWith('/source/apps/api/migrations/'))fault('migration-read');return lstat.call(this,realPath(p),...args);};
fs.readFileSync=function(p,...args){
 if(p==='/proof/adapters/scripts/ops/admin-writer-roles.sql')fault('roles-read');
 return read.call(this,realPath(p),...args);
};
fs.writeSync=function(fd,data,...args){
 if(fd===2&&String(data).startsWith('SSB_INIT_PROBE_DIAGNOSTIC_V1 ')){
  if(config.writeFailure)throw Object.assign(Error(marker),{code:'ENOSPC'});
  let s=String(data),v=JSON.parse(s.slice(s.indexOf(' ')+1));
  if(config.output==='empty')return s.length;
  if(config.output==='truncated')s=s.slice(0,-15);
  if(config.output==='json')s='SSB_INIT_PROBE_DIAGNOSTIC_V1 {\n';
  if(['call','run','publication','action'].includes(config.output)){v.binding[config.output]=config.output==='call'||config.output==='publication'?'f'.repeat(64):config.output==='run'?'999':'roles';s='SSB_INIT_PROBE_DIAGNOSTIC_V1 '+JSON.stringify(v)+'\n';}
  if(config.output==='private'){v.primary.message=marker;s='SSB_INIT_PROBE_DIAGNOSTIC_V1 '+JSON.stringify(v)+'\n';}
  if(config.output==='extra')s+='UNEXPECTED_PRIVATE_TEXT';
  if(config.output==='stdout')write.call(this,1,'UNEXPECTED_SYNTHETIC_OUTPUT');
  if(config.exitZero)process.exitCode=0;
  if(config.exitTwo)process.exitCode=2;
  return write.call(this,fd,s,...args);
 }
 return write.call(this,fd,data,...args);
};
const load=Module._load;
Module._load=function(id,...args){
 if(['node:net','net','node:dgram','dgram','node:http','http','node:https','https'].includes(id))throw Error('offline_network_forbidden');
 if(id==='/app/node_modules/pg')return{Pool:class{
  constructor(){fault('pool-create');}
  async query(){
   const steps=['schema-ledger','roles-apply','role-password-apply','role-password-apply','role-password-apply','role-password-apply','tenant-site-fixture','user-fixture','site-config-fixture','database-readback'];
   const step=steps[poolQueries++];assert.ok(step,'unexpected synthetic query');fault(step);
   if(step==='database-readback')return{rows:[{version:config.step==='database-assertions'?'0':'160013',vector:'0.8.0',migrations:34}]};
   return{rows:[]};
  }
  async connect(){migration++;fault('migration-connect');return{
   query:async(sql)=>{const step=sql==='BEGIN'?'migration-begin':sql==='COMMIT'?'migration-commit':sql.startsWith('INSERT INTO schema_migrations')?'migration-record':'migration-execute';fault(step);await new Promise(r=>setImmediate(r));return{rows:[]};},
   release:()=>{releaseCalls++;if(config.releaseFailure&&(config.migration===undefined||migration===config.migration))throw Object.assign(Error(marker),{code:'EIO'});fault('client-release');}
  };}
  async end(){endCalls++;await new Promise(r=>setImmediate(r));if(config.endFailure)throw Object.assign(Error(marker),{code:'ECONNRESET'});fault('pool-close');}
 }};
 return load.call(this,id,...args);
};
process.on('exit',()=>{if(config.countsFile)fs.writeFileSync(config.countsFile,JSON.stringify({poolQueries,migration,releaseCalls,endCalls}),{flag:'wx',mode:0o600});});
