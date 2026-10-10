'use strict';
// In-memory server events for the installed pg Client. Never opens a socket or runs SQL.
const {EventEmitter}=require('node:events'),assert=require('node:assert/strict');
module.exports=(config,record,error)=>{
 const pg=require(process.env.SSB_READY_PG);
 assert.equal(require(process.env.SSB_READY_PG+'/package.json').version,'8.20.0');
 class Connection extends EventEmitter{
  constructor(){super();this._connecting=false;this.parsedStatements={};this.stream={writable:true,destroyed:false,destroy:()=>this.end()};}
  connect(port,host){this._connecting=true;record.connects++;assert.equal(port,5432);assert.ok(['db','restore-db'].includes(host));
   setImmediate(()=>{if(config.connectCode||config.attempt<=(config.delayed||0)){this.emit('error',error(config.connectCode||'ECONNREFUSED'));this.end();}else this.emit('connect');});
  }
  startup(options){assert.equal(options.user,'postgres');assert.equal(options.database,'synthetic');setImmediate(()=>this.emit('authenticationCleartextPassword'));}
  password(value){record.authenticated=value==='1'.repeat(64)&&!config.badPassword;
   setImmediate(()=>{if(!record.authenticated){this.emit('errorMessage',error('28P01'));this.end();}else this.emit('readyForQuery');});
  }
  query(sql){record.queries++;assert.equal(sql,'SELECT current_database() AS database, session_user AS username, inet_server_port() AS port');
   setImmediate(()=>{
    if(config.queryCode)this.emit('errorMessage',error(config.queryCode));
    else{
     this.emit('rowDescription',{fields:[{name:'database',dataTypeID:25,format:'text'},{name:'username',dataTypeID:25,format:'text'},{name:'port',dataTypeID:23,format:'text'}]});
     const row=config.rows?.[0]||{database:'synthetic',username:'postgres',port:5432};this.emit('dataRow',{fields:[row.database,row.username,String(row.port)]});this.emit('commandComplete',{text:'SELECT 1'});
    }
    this.emit('readyForQuery');
   });
  }
  end(){if(this.stream.destroyed)return;this.stream.writable=false;this.stream.destroyed=true;setImmediate(()=>{record.endEvent=true;this.emit('end');});}
 }
 return{Client:class extends pg.Client{
  constructor(options){super({...options,connection:new Connection()});record.realClient=true;record.options={host:options.host,port:options.port,database:options.database,user:options.user,credentialMatchesExpected:options.password==='1'.repeat(64)};}
  end(...args){record.endCalls++;return super.end(...args);}
 }};
};
