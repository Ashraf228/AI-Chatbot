'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
class GateError extends Error {constructor(code){super(code);this.code=code;}}
function need(ok,code){if(!ok)throw new GateError(code);}
function json(b){try{return JSON.parse(b);}catch{throw new GateError('invalid_json');}}
function regular(p,max=64*1024*1024){const s=fs.lstatSync(p);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=max,'regular_file_required');return fs.readFileSync(p);}
function bound(p,f){const b=regular(p);need(b.length===f.bytes&&sha(b)===f.sha256,'content_binding_changed');return b;}
const clock=()=>performance.now();
function failureRecord(error){
  let nodes=0;
  const visit=(e,depth)=>{
    if(++nodes>64||depth>8)return {kind:'truncated'};
    const r={kind:e instanceof AggregateError?'aggregate':'failure',code:typeof e?.code==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(e.code)?e.code:'unclassified'};
    if(typeof e?.ioCode==='string'&&/^[A-Z][A-Z0-9_]{0,31}$/.test(e.ioCode))r.ioCode=e.ioCode;
    r.frames=String(e?.stack||'').split('\n').slice(1,9).flatMap(line=>{const m=line.match(/([A-Za-z0-9_.-]+\.(?:cjs|mjs|js|ts)):(\d+):(\d+)\)?$/);return m?[{file:m[1],line:Number(m[2]),column:Number(m[3])}]:[];});
    if(e?.process){r.process={};for(const key of ['index','code','signal','closed','timeout','overflow','completionUnverified']){const value=e.process[key];if(typeof value==='boolean'||Number.isSafeInteger(value)||value===null||key==='signal'&&/^SIG[A-Z0-9]+$/.test(value||''))r.process[key]=value;}}
    if(Array.isArray(e?.errors))r.causes=e.errors.slice(0,64).map(x=>visit(x,depth+1));
    if(e?.cause)r.cause=visit(e.cause,depth+1);return r;
  };
  const r=visit(error,0);need(Buffer.byteLength(JSON.stringify(r))<=32768,'private_diagnostic_limit');return r;
}
class Processes {
  constructor({deadline,privateRoot,now=clock}){this.deadline=deadline;this.privateRoot=privateRoot;this.now=now;this.calls=[];this.children=new Set();this.bytes=0;this.workBytes=0;this.closureBytes=0;}
  async run(bin,args,{input,ms=10000,allowFailure=false,cwd,env,uid,gid,closure=false,deadline=this.deadline}={}){
    need(Array.isArray(args)&&args.every(a=>typeof a==='string'),'argv_invalid');
    need(Number.isFinite(deadline)&&deadline<=this.deadline,'deadline_binding');
    const limit=Math.min(ms,deadline-this.now()-(closure?0:30000));need(limit>100,'deadline');
    const index=this.calls.length;const rec={index,bin,argc:args.length,startedAt:new Date().toISOString(),closed:false};this.calls.push(rec);
    return await new Promise((resolve,reject)=>{
      const child=spawn(bin,args,{cwd,env:env||{PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8'},uid,gid,stdio:['pipe','pipe','pipe'],detached:true});
      this.children.add(child);let stdout=[],stderr=[],size=0,timeout=false,overflow=false,spawnError=false,killTimer,settled=false;
      const kill=s=>{try{if(child.pid)process.kill(-child.pid,s);}catch(e){if(e.code!=='ESRCH')spawnError=true;}};
      const abort=()=>{if(killTimer)return;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),100);};
      const timer=setTimeout(()=>{timeout=true;abort();},Math.max(1,limit-250));
      const completionTimer=setTimeout(()=>{
        if(settled)return;settled=true;timeout=true;kill('SIGKILL');
        Object.assign(rec,{closed:false,timeout:true,completionUnverified:true,endedAt:new Date().toISOString()});
        child.unref();for(const stream of [child.stdin,child.stdout,child.stderr])stream.unref?.();
        const error=new GateError('process_completion_unverified');error.process={...rec};reject(error);
      },limit);
      for(const [stream,list] of [[child.stdout,stdout],[child.stderr,stderr]])stream.on('data',b=>{
        size+=b.length;this.bytes+=b.length;this[closure?'closureBytes':'workBytes']+=b.length;
        if(size>8*1024*1024||this[closure?'closureBytes':'workBytes']>(closure?4*1024*1024-65536:28*1024*1024)){overflow=true;abort();return;}list.push(b);
      });
      child.on('error',()=>{spawnError=true;});child.stdin.on('error',()=>{});child.stdin.end(input);
      child.once('close',(code,signal)=>{
        clearTimeout(timer);clearTimeout(killTimer);clearTimeout(completionTimer);this.children.delete(child);
        if(settled){rec.lateClose={code,signal,utc:new Date().toISOString()};return;}settled=true;
        Object.assign(rec,{code,signal,closed:true,timeout,overflow,endedAt:new Date().toISOString()});
        const out=Buffer.concat(stdout),err=Buffer.concat(stderr);
        let primary;
        if(timeout||overflow||spawnError||(!allowFailure&&code!==0)||signal){primary=new GateError(timeout?'command_timeout':overflow?'output_limit':spawnError?'spawn_failed':'command_failed');primary.process={...rec};}
        try{fs.writeFileSync(`${this.privateRoot}/process-${index}.stdout`,out,{mode:0o600,flag:'wx'});fs.writeFileSync(`${this.privateRoot}/process-${index}.stderr`,err,{mode:0o600,flag:'wx'});}catch(e){const evidence=new GateError('evidence_write_failed');evidence.ioCode=e.code;if(closure&&!primary)evidence.result={stdout:out,stderr:err,code,signal,closed:true};reject(primary?new AggregateError([primary,evidence],'primary_and_evidence_failed'):evidence);return;}
        if(primary){reject(primary);return;}
        resolve({stdout:out,stderr:err,code,signal,closed:true});
      });
    });
  }
  assertClosed(){need(this.children.size===0&&this.calls.every(x=>x.closed),'process_completion_unverified');}
}
module.exports={sha,need,json,regular,bound,clock,GateError,Processes,failureRecord};
