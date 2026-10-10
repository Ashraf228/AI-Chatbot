'use strict';
// Offline-only PG transport. The actual probe entry and readiness implementation execute unchanged.
const fs=require('node:fs'),Module=require('node:module'),{EventEmitter}=require('node:events'),assert=require('node:assert/strict');
const config=JSON.parse(process.env.SSB_READY_TEST),load=Module._load,write=fs.writeSync;
const record={connects:0,queries:0,endCalls:0,endEvent:false,options:null};
const error=code=>Object.assign(new Error('SYNTHETIC_PRIVATE_CONNECTION_DETAILS'),{code});
let realPG;
if(config.realPG){
 for(const module of ['node:net','node:dgram','node:http','node:https']){const api=require(module);for(const key of ['connect','createConnection','createServer','createSocket','request','get'])if(typeof api[key]==='function')api[key]=()=>{throw Error('offline_network_forbidden');};if(api.Socket)api.Socket.prototype.connect=()=>{throw Error('offline_network_forbidden');};}
 realPG=require('./postgres-readiness-pg-wire.cjs')(config,record,error);
}
Module._load=function(id,...args){
 if(id==='/app/node_modules/pg'&&realPG)return realPG;
 if(['node:net','net','node:dgram','dgram','node:http','http','node:https','https'].includes(id))throw Error('offline_network_forbidden');
 if(id==='/app/node_modules/pg')return{Client:class extends EventEmitter{
  constructor(options){super();this.connectionParameters={...options,...config.parameters};
   record.options={host:options.host,port:options.port,database:options.database,user:options.user,ssl:options.ssl,credentialMatchesExpected:options.password==='1'.repeat(64),connectionTimeoutMillis:options.connectionTimeoutMillis,statement_timeout:options.statement_timeout,query_timeout:options.query_timeout};
   assert.ok(record.options.credentialMatchesExpected);assert.equal(options.ssl,false);
  }
  async connect(){record.connects++;
   if(config.connectHang)return new Promise(()=>{});
   if(config.connectCode)throw error(config.connectCode);
   if(config.attempt<=(config.delayed||0))throw error(config.startupCode||'ECONNREFUSED');
   await new Promise(r=>setImmediate(r));
  }
  async query(sql){record.queries++;assert.equal(sql,'SELECT current_database() AS database, session_user AS username, inet_server_port() AS port');
   if(config.queryHang)return new Promise(()=>{});
   if(config.queryCode)throw error(config.queryCode);
   return{rows:config.rows||[{database:'synthetic',username:'postgres',port:5432}]};
  }
  async end(){record.endCalls++;
   if(config.endCode)throw error(config.endCode);
   if(config.endHang)return new Promise(()=>{});
   await new Promise(r=>setTimeout(r,config.endDelay||1));
   if(config.lateError)this.emit('error',error(config.lateError));
   if(!config.noEndEvent){record.endEvent=true;this.emit('end');}
  }
 }};
 return load.call(this,id,...args);
};
fs.writeSync=function(fd,data,...args){
 if(fd===2&&String(data).startsWith('SSB_INIT_PROBE_DIAGNOSTIC_V1 ')){
  if(config.diagnosticMissing)return String(data).length;
  if(config.diagnosticWriteFailure)throw error('ENOSPC');
 }
 return write.call(this,fd,data,...args);
};
process.on('exit',()=>fs.writeFileSync(config.record,JSON.stringify(record)+'\n',{flag:'wx',mode:0o600}));
