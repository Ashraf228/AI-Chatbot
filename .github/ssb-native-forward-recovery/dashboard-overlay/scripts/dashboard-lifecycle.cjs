'use strict';
const fs=require('node:fs'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const contract=require('./dashboard-shutdown-contract.cjs');
const failure=code=>Object.assign(new Error(code),{code});
function persist(file,record) {
  const fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY|fs.constants.O_NOFOLLOW,0o600);
  try { fs.writeFileSync(fd,JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const directory=fs.openSync(path.dirname(file),fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}
function createLifecycle({binding,state,server,handle,upgrade,closeNext,closeUpgraded=async()=>{},receipt,
  now=()=>performance.now(),delay=ms=>new Promise(r=>setTimeout(r,ms)),write=persist,
  output=line=>{const b=Buffer.from(line);if(fs.writeSync(2,b)!==b.length)throw failure('receipt_failed');},exit=code=>process.exit(code)}) {
  contract.binding(binding);
  let stopping=false,completion,primary,stage='startup',settled=false,active=0,registrationClosed=false;
  const secondary=[],clients=new Set();
  const capture=(error,at=stage)=>{
    const point={stage:at,code:contract.reasons.includes(error?.code)?error.code:'unknown'};
    if(!primary) primary=point; else if(secondary.length<4) secondary.push(point);
  };
  const registerRedis=client=>{
    if(settled || registrationClosed || !client || typeof client.quit!=='function' || typeof client.once!=='function'
      ||clients.size>=16&&!clients.has(client)){const error=failure('redis_close_failed');capture(error,'redis');throw error;}
    clients.add(client);
  };
  const deny=res=>{res.statusCode=503;res.setHeader('connection','close');res.end();};
  async function tracked(req,target,action,isUpgrade=false) {
    if(stopping) { if(isUpgrade) target.destroy(); else deny(target); return; }
    let id;
    try { id=state.begin('http'); }
    catch(error) {
      if(!['admission_closed','generation_retired'].includes(error?.code)) capture(error,'admission');
      if(isUpgrade) target.destroy(); else deny(target); return;
    }
    active++;
    let aborted=false,bodyDone;
    const done=new Promise(resolve=>{bodyDone=resolve;});
    const finish=()=>bodyDone();
    const close=()=>{if(!isUpgrade&&!target.writableFinished&&!aborted){aborted=true;capture(failure('request_failed'),'work');}bodyDone();};
    target.once('finish',finish);target.once('close',close);
    let error;
    try { await action(); await done; if(aborted) throw failure('request_failed'); }
    catch(e) { error=e;capture(e,'work');if(!target.destroyed)target.destroy(); }
    finally {
      target.removeListener('finish',finish);target.removeListener('close',close);
      try { state.end(id,Boolean(error)); } catch(e) { capture(e,'work'); }
      active--;
    }
  }
  function request(req,res) { void tracked(req,res,()=>handle(req,res)); }
  function upgraded(req,socket,head) { void tracked(req,socket,()=>upgrade(req,socket,head),true); }
  function stop(signal) {
    if(completion) return completion;
    if(!['SIGTERM','SIGINT'].includes(signal)) throw failure('binding_invalid');
    stopping=true;
    const started=now(),record={version:1,binding,status:'failed',signal,admissionClosed:false,remainingWork:active,
      httpClosed:false,nextClosed:false,redisClosed:false,redisClients:clients.size,recordedAt:new Date().toISOString(),elapsedMs:0,failure:null,secondary:[]};
    let timer;
    const finish=success=>{
      if(settled) return;settled=true;
      record.elapsedMs=Math.max(0,now()-started);record.recordedAt=new Date().toISOString();record.remainingWork=active;
      if(record.elapsedMs>=contract.LIMIT) { capture(failure('deadline'));success=false; }
      record.status=success&&!primary?'graceful':'failed';record.failure=primary||null;record.secondary=[...secondary];
      record.redisClients=clients.size;
      try { contract.validate(record);write(receipt,record);if(now()-started>=contract.LIMIT)throw failure('deadline'); }
      catch(e) { capture(e,'receipt');record.status='failed';record.failure=primary;record.secondary=[...secondary]; }
      try { output('SSB_DASHBOARD_SHUTDOWN '+JSON.stringify(record)+'\n');if(now()-started>=contract.LIMIT)throw failure('deadline'); }
      catch(e) { capture(e,'receipt');record.status='failed';record.failure=primary;record.secondary=[...secondary]; }
      // Exit 0 is permitted only after all closes and durable receipt publication, never a remapped signal.
      clearTimeout(timer);exit(record.status==='graceful'?0:1);return record;
    };
    completion=(async()=>{
      timer=setTimeout(()=>{capture(failure('deadline'));finish(false);},contract.LIMIT);
      const within=()=>{if(settled || now()-started>=contract.LIMIT) throw failure('deadline');};
      try {
        stage='admission';try{state.stopAdmission();record.admissionClosed=true;}catch(e){capture(e);}
        stage='http';
        let httpFailed=false;
        const closed=server.listening===false?Promise.resolve():new Promise(resolve=>{
          try{server.close(error=>{if(error){httpFailed=true;capture(failure('http_close_failed'),'http');}resolve();});}
          catch(e){httpFailed=true;capture(failure('http_close_failed'),'http');resolve();}
        });
        try{await closeUpgraded();}catch(e){httpFailed=true;capture(e,'http');}
        await closed;within();record.httpClosed=!httpFailed;
        stage='work';
        while(active){within();await delay(5);}
        try{const work=state.processWorkStatus();if(work.running||work.uncertain)throw failure('work_uncertain');}catch(e){capture(e);}
        stage='next';try{await closeNext();record.nextClosed=true;}catch{capture(failure('next_close_failed'));}within();
        registrationClosed=true;
        stage='redis';
        let redisFailed=false;
        for(const client of clients) {try{
          if(client.status==='end')throw failure('redis_close_failed');
          const ended=new Promise(resolve=>{if(client.status==='end')resolve();else client.once('end',resolve);});
          if(client.status==='wait') client.disconnect(false);
          else if(client.status!=='end') { let result;try{result=await client.quit();}catch{throw failure('redis_close_failed');}if(result!=='OK')throw failure('redis_close_failed'); }
          await ended;within();if(client.status!=='end')throw failure('redis_close_failed');
        }catch(error){redisFailed=true;capture(error,'redis');within();}
        }
        record.redisClosed=!redisFailed;stage='verify';within();
        const final=state.processWorkStatus();if(active||final.running||final.uncertain)throw failure('work_uncertain');
        stage='receipt';return finish(!primary);
      }catch(error){if(!settled){capture(error);return finish(false);}return record;}
    })();
    return completion;
  }
  return {request,upgraded,stop,registerRedis,capture,get stopping(){return stopping;},get active(){return active;}};
}
module.exports={createLifecycle,persist};
