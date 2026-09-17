const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { LlmService } = require('../dist/vector/llm.service.js');
const { ProviderApprovalStorageLookupService } = require('../dist/knowledge-sources/provider-approval-storage-lookup.service.js');
const { persistLlmUsage } = require('../dist/usage/persist-llm-usage.js');
const { UsageController } = require('../dist/usage/usage.controller.js');
const { ChatPipelineService } = require('../dist/ai/chat-pipeline/chat-pipeline.service.js');
const { WidgetChatService } = require('../dist/modules/widget/services/widget-chat.service.js');
const context = { tenantId: 'tenant-1', siteId: 'site-1' };
const storedContext = { ...context, conversationId: 'conversation-1', sessionId: 'session-1' };
const usage = { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18, prompt_tokens_details: { cached_tokens: 5 }, completion_tokens_details: { reasoning_tokens: 3 } };
function grantRow(overrides = {}) {
  return {
    id: 'llm-grant-1',
    scope_kind: 'site_runtime',
    tenant_id: 'tenant-1',
    site_id: 'site-1',
    source_id: null,
    source_types: [],
    usage_contexts: ['llm_generation'],
    environment: 'non_production',
    provider_key: 'openai',
    model: 'gpt-4.1-mini',
    embedding_dimension: null,
    provider_region: 'eu',
    data_categories: ['synthetic_support_message'],
    customer_data_approved: true,
    production_approved: false,
    provider_dpa_approved: true,
    purpose: 'llm_generation',
    retention_policy: 'no_provider_payload_storage',
    redaction_policy: 'runtime_input_redaction',
    logging_policy: 'metadata_only',
    deletion_policy: 'conversation_retention_policy',
    reindex_policy: null,
    rate_limit: 'synthetic-rate-limit',
    cost_limit: 'synthetic-cost-limit',
    valid_from: new Date(Date.now() - 60_000).toISOString(),
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    revoked_at: null,
    approved_by: 'synthetic-security-owner',
    approval_evidence_ref: 'synthetic-evidence-ref',
    ...overrides,
  };
}


function ledger() {
  const events = new Map(); const daily = []; const queries = [];
  return { events, daily, queries, async transaction(fn) {
    const before = new Map(events); const length = daily.length;
    try { return await fn({ query: async (sql, p) => {
      queries.push({sql,p});
      if (/SELECT c.id FROM conversations/.test(sql)) return { rows: p[0] === 'conversation-1' && p[1] === 'tenant-1' && p[2] === 'site-1' && p[3] === 'session-1' ? [{id:p[0]}] : [] };
      if (/INSERT INTO usage_events/.test(sql)) {
        if (events.has(p[0])) return {rows:[]}; events.set(p[0], p); return {rows:[{id:p[0]}]};
      }
      if (/INSERT INTO usage_daily/.test(sql)) { daily.push(p); return {rows:[]}; }
      throw Error('unexpected SQL');
    }}); } catch(e) { events.clear(); for(const [k,v] of before) events.set(k,v); daily.length=length; throw e; }
  }};
}
async function runtime(fetcher, fn, allowed = true) {
  const keys = ['NODE_ENV','APP_ENV','OPENAI_API_KEY','OPENAI_MODEL','OPENAI_BASE_URL','OPENAI_LOG'];
  const env = Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const originalFetch = globalThis.fetch;
  const logs=[]; const methods=['debug','info','warn','error']; const spies=methods.map(k=>console[k]);
  let requests=0;
  try {
    process.env.NODE_ENV='test'; delete process.env.APP_ENV; process.env.OPENAI_API_KEY='synthetic-key'; process.env.OPENAI_MODEL='gpt-4.1-mini'; delete process.env.OPENAI_BASE_URL; process.env.OPENAI_LOG='debug';
    methods.forEach(k=>console[k]=(...args)=>logs.push([k,...args]));
    globalThis.fetch=async (...args)=>{ requests++; return fetcher(...args); };
    const db={async query(sql,p){
      if (/FROM provider_approval_grants/.test(sql)) return {rows:allowed?[grantRow()]:[]};
      if (/FROM sites/.test(sql)) return {rows:[{id:p[0]}]};
      throw Error('unexpected SQL');
    }};
    const service=new LlmService(db,new ProviderApprovalStorageLookupService(db));
    const measurements=[]; const store=ledger();
    const onUsage=async m=>{ measurements.push(m); await persistLlmUsage(store,storedContext,m); };
    await fn({service,measurements,store,onUsage,requests:()=>requests});
    assert.deepEqual(logs,[],'SDK logging must remain off, including all arguments');
  } finally {
    globalThis.fetch=originalFetch; methods.forEach((k,i)=>console[k]=spies[i]);
    for(const k of keys) if(env[k]===undefined) delete process.env[k]; else process.env[k]=env[k];
  }
}
function jsonResponse(value=usage) { return new Response(JSON.stringify({choices:[{message:{content:'synthetic'}}],usage:value}),{headers:{'content-type':'application/json'}}); }
function chunk(delta='',u=null) {return {id:'synthetic-completion',object:'chat.completion.chunk',created:0,model:'gpt-4.1-mini',choices:delta?[{index:0,delta:{content:delta},finish_reason:null}]:[],usage:u};}
function sse(parts) {return new Response(parts.map(p=>'data: '+JSON.stringify(p)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});}

for(const streaming of [false,true]) test(`actual SDK ${streaming?'streaming':'normal'} confirmed usage is counted once`,async()=>{
  await runtime(async (_url,init)=>{
    assert.equal(init.redirect,'error'); const body=JSON.parse(init.body);
    if(streaming) assert.deepEqual(body.stream_options,{include_usage:true});
    return streaming?sse([chunk('a'),chunk('b'),chunk('',usage),chunk('',usage)]):jsonResponse();
  },async({service,measurements,store,onUsage,requests})=>{
    const chunks=[];
    const result=streaming?await service.streamAnswer('system','user',v=>chunks.push(v),context,{onUsage}):await service.answer('system','user',context,{onUsage});
    assert.deepEqual(result.usage,{inputTokens:11,outputTokens:7,totalTokens:18,status:'confirmed'});
    assert.equal(requests(),1); assert.equal(measurements.length,1); assert.equal(store.events.size,1); assert.equal(store.daily.length,1);
    await persistLlmUsage(store,storedContext,measurements[0]); assert.equal(store.daily.length,1);
    assert.deepEqual(store.daily[0].slice(3,6),[11,7,18]);
    if(streaming) assert.deepEqual(chunks,['a','b']);
  });
});

test('usage-only final event is processed even with no answer text',async()=>runtime(()=>sse([chunk('',usage)]),async({service,onUsage,measurements})=>{
  const result=await service.streamAnswer('s','u',()=>assert.fail('no text expected'),context,{onUsage});
  assert.equal(result.text,''); assert.equal(measurements[0].usage.totalTokens,18);
}));
for(const streaming of [false,true]) for(const [name,value,status] of [['missing',undefined,'missing'],['partial',{prompt_tokens:11},'incomplete'],['invalid',{prompt_tokens:11,completion_tokens:7,total_tokens:999},'incomplete'],['zero',{prompt_tokens:0,completion_tokens:0,total_tokens:0},'confirmed']]) test(`${streaming?'stream':'normal'} ${name} usage`,async()=>runtime(()=>streaming?sse([chunk('text'),chunk('',value)]):jsonResponse(value===undefined?null:value),async({service,onUsage,measurements,store})=>{
  if(streaming) await service.streamAnswer('s','u',()=>{},context,{onUsage});else await service.answer('s','u',context,{onUsage});
  const m=measurements[0]; assert.equal(m.usage.status,status);
  if(name==='missing') assert.deepEqual([m.usage.inputTokens,m.usage.outputTokens,m.usage.totalTokens],[null,null,null]);
  assert.deepEqual(store.daily[0].slice(3,6),[0,0,0]);
  if(status!=='confirmed') assert.equal([...store.events.values()][0][9],null);
}));

test('grant denial is before transport and has no usage record',async()=>runtime(()=>assert.fail('no transport'),async({service,onUsage,measurements,requests})=>{
  await assert.rejects(service.answer('s','u',context,{onUsage}));
  await assert.rejects(service.streamAnswer('s','u',()=>{},context,{onUsage}));
  assert.equal(requests(),0);assert.equal(measurements.length,0);
},false));
for(const streaming of [false,true]) test(`${streaming?'stream':'normal'} provider error records started unmeasured once, no SDK retry`,async()=>runtime(()=>new Response(JSON.stringify({error:{message:'synthetic'}}),{status:500,headers:{'content-type':'application/json'}}),async({service,onUsage,measurements,requests})=>{
  if(streaming) await assert.rejects(service.streamAnswer('s','u',()=>{},context,{onUsage}));else await assert.rejects(service.answer('s','u',context,{onUsage}));
  assert.equal(requests(),1);assert.equal(measurements[0].outcome,'error');assert.equal(measurements[0].usage.status,'missing');
}));
test('stream provider error after text preserves incomplete measurement',async()=>runtime(()=>sse([chunk('text'),{error:{message:'synthetic-stream-error'}}]),async({service,onUsage,measurements})=>{
  await assert.rejects(service.streamAnswer('s','u',()=>{},context,{onUsage}));
  assert.equal(measurements[0].outcome,'error');assert.equal(measurements[0].usage.status,'missing');
}));
test('abort before transport creates no record',async()=>runtime(()=>assert.fail('no transport'),async({service,onUsage,measurements,requests})=>{
  const c=new AbortController();c.abort();
  await assert.rejects(service.streamAnswer('s','u',()=>{},context,{onUsage,signal:c.signal}));
  assert.equal(requests(),0);assert.equal(measurements.length,0);
}));
test('abort after first chunk reaches SDK transport and stops consumption',async()=>{
  let transportSignal;
  await runtime((_u,init)=>{transportSignal=init.signal;return sse([chunk('one'),chunk('two'),chunk('',usage)]);},async({service,onUsage,measurements})=>{
    const c=new AbortController();let chunks=0;
    await assert.rejects(service.streamAnswer('s','u',()=>{chunks++;c.abort();},context,{onUsage,signal:c.signal}));
    assert.equal(chunks,1);assert.equal(transportSignal.aborted,true);
    assert.equal(measurements[0].outcome,'aborted');assert.equal(measurements[0].usage.status,'missing');
  });
});
test('multiple actual calls share conversation but have independent IDs',async()=>runtime(()=>jsonResponse(),async({service,onUsage,measurements,store})=>{
  await Promise.all([service.answer('s','u',context,{onUsage}),service.answer('s','u',context,{onUsage})]);
  assert.notEqual(measurements[0].callId,measurements[1].callId);assert.equal(store.events.size,2);
  assert.equal(store.daily.reduce((sum,p)=>sum+p[5],0),36);
}));
for(const key of ['tenantId','siteId','conversationId','sessionId']) test(`storage rejects mismatched ${key}`,async()=>runtime(()=>jsonResponse(),async({service,measurements})=>{
  await service.answer('s','u',context,{onUsage:async m=>measurements.push(m)});
  const store=ledger();await assert.rejects(persistLlmUsage(store,{...storedContext,[key]:'foreign'},measurements[0]));assert.equal(store.events.size,0);
}));

test('usage evaluation applies both tenant and site filters to event aggregation',async()=>{
 const calls=[];const c=new UsageController({async query(sql,p){calls.push({sql,p});return {rows:/usage_daily/.test(sql)?[{total_requests:0}]:[{confirmed_calls:0,unmeasured_calls:2,legacy_events:1,input_tokens:null,output_tokens:null,total_tokens:null}]};}});
 const result=await c.summary('tenant-a','site-a');assert.equal(result.llm_usage.total_tokens,null);assert.equal(result.llm_usage.unmeasured_calls,2);
 assert.equal(calls.length,2);for(const call of calls){assert.deepEqual(call.p,['tenant-a','site-a']);assert.match(call.sql,/tenant_id = \$1 AND site_id = \$2/);}
});

function pipeline(service, store) {
 const p=Object.create(ChatPipelineService.prototype);p.db=store;p.llm=service;
 p.usageLimits={async assertWithinLimit(){}};
 p.prepareConversation=async()=>({id:'conversation-1',sessionId:'session-1'});
 p.prepareRoutedAnswer=async()=>({routeDecision:{route:'general'},sources:[],systemPrompt:'s',userPrompt:'u',advisorContext:{products:[],collections:[]},retrievalTime:0});
 p.responseComposer={buildParts:()=>[]};
 p.conversationState={async appendMessage(){},async touchConversation(){}};
 store.responseWrites=[];store.query=async(sql,params)=>{store.responseWrites.push({sql,params});return {rows:[]};};
 return p;
}
for(const streaming of [false,true]) test(`production pipeline ${streaming?'stream':'normal'} persists provider measurement without duplicate legacy event`,async()=>runtime(()=>streaming?sse([chunk('answer'),chunk('',usage)]):jsonResponse(),async({service,store})=>{
 const p=pipeline(service,store);const input={...storedContext,message:'synthetic',source:'api',evaluationMode:true};
 const events=[];
 if(streaming) await p.stream(input,e=>events.push(e));else await p.process(input);
 assert.equal(store.events.size,1);assert.equal(store.daily.length,1);
 assert.equal(store.responseWrites.filter(c=>/INSERT INTO usage_events/.test(c.sql)).length,0);
 const daily=store.responseWrites.find(c=>/INSERT INTO usage_daily/.test(c.sql));
 assert.deepEqual(daily.params.slice(2,9),[1,1,1,0,0,0,0],'message budgets unchanged; no double tokens/cost');
 assert.equal(JSON.stringify(events).includes('usage'),false);
}));
test('production pipeline forwards caller abort and records failed call without success counters',async()=>runtime(()=>sse([chunk('answer'),chunk('',usage)]),async({service,store})=>{
 const p=pipeline(service,store);const controller=new AbortController();
 await assert.rejects(p.stream({...storedContext,message:'synthetic',source:'api',evaluationMode:true},e=>{if(e.type==='token')controller.abort();},controller.signal));
 assert.equal(store.events.size,1);assert.equal([...store.events.values()][0][15],'aborted');assert.equal(store.responseWrites.length,0);
}));
test('widget disconnect propagates abort and removes listeners without new public fields',async()=>{
 const req=new EventEmitter();req.headers={};const res=new EventEmitter();res.status=()=>res;res.setHeader=()=>{};res.write=()=>{};res.end=()=>{};res.writableEnded=false;
 let signal;
 const service=new WidgetChatService({async getSiteByKey(){return {id:'site-1',tenantId:'tenant-1',config:{}};}},{},
 {async enforceOrigin(){},async assertSessionBelongsToSite(){},async enforceRateLimit(){},getClientIp(){return '127.0.0.1';}},
 {async stream(input,emit,s){signal=s;res.emit('close');assert.equal(s.aborted,true);}},
 {async listForSite(){return[];}},{resolve(){return {deliveryChannels:{},enabledTasks:[],enabledAgents:[],requiredFields:[]};}});
 await service.streamMessage({siteKey:'synthetic',sessionId:'session-1',message:'synthetic'},undefined,req,res);
 assert.equal(signal.aborted,true);assert.equal(req.listenerCount('aborted'),0);assert.equal(res.listenerCount('close'),0);
});

for(const providerFails of [false,true]) test(`accounting failure ${providerFails?'preserves primary provider error':'fails closed after success'}`,async()=>runtime(()=>providerFails?new Response('{"error":{"message":"synthetic-provider-error"}}',{status:500,headers:{'content-type':'application/json'}}):jsonResponse(),async({service,requests})=>{
 let callbacks=0;
 await assert.rejects(service.answer('s','u',context,{onUsage:async()=>{callbacks++;throw Error('synthetic-storage-error');}}),e=>providerFails?e.status===500:e.getStatus()===503);
 assert.equal(callbacks,1);assert.equal(requests(),1);
}));
test('secondary storage failure does not replace user abort',async()=>runtime(()=>sse([chunk('one')]),async({service})=>{
 const c=new AbortController();
 await assert.rejects(service.streamAnswer('s','u',()=>c.abort(),context,{signal:c.signal,onUsage:async()=>{throw Error('synthetic-storage-error');}}),e=>e.name==='AbortError');
}));
test('normal in-flight abort reaches actual fetch signal and records unmeasured attempt',async()=>{
 const c=new AbortController();
 await runtime((_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});setImmediate(()=>c.abort());}),async({service,onUsage,measurements,requests})=>{
  await assert.rejects(service.answer('s','u',context,{signal:c.signal,onUsage}));
  assert.equal(requests(),1);assert.equal(measurements[0].outcome,'aborted');assert.equal(measurements[0].usage.status,'missing');
 });
});
test('confirmed provider usage survives a later stream error without invented extra tokens',async()=>runtime(()=>sse([chunk('',usage),{error:{message:'synthetic'}}]),async({service,onUsage,measurements,store})=>{
 await assert.rejects(service.streamAnswer('s','u',()=>{},context,{onUsage}));
 assert.equal(measurements[0].outcome,'error');assert.equal(measurements[0].usage.status,'confirmed');assert.equal(store.daily[0][5],18);
}));
