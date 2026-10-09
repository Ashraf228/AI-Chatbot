const test=require('node:test');const assert=require('node:assert/strict');
const crawler=require('../dist/ingest/website-crawl');
const {WebsiteKnowledgeIndexService}=require('../dist/ingest/website-knowledge-index.service');
const {IngestionEmbeddingService}=require('../dist/ingest/ingestion-embedding.service');
const {ProviderApprovalStorageLookupService}=require('../dist/knowledge-sources/provider-approval-storage-lookup.service');
const {IngestController}=require('../dist/ingest/ingest.controller');
const {DatabaseService}=require('../dist/db/database.service');
const {EventEmitter}=require('node:events');
const source={id:'source-1',siteId:'site-1',tenantId:'tenant-1',type:'url',isActive:true,url:'https://example.com/',title:'Website',runtimeReadiness:'ready'};
async function indexFixture(options,fn){
 const original=crawler.crawlWebsite;const calls={sql:[],embeddings:0,ready:0,chunks:0};
 crawler.crawlWebsite=async()=>({pages:[{finalUrl:source.url,extractedText:'Synthetische Informationen zur Datensicherung.',pageTitle:'Handbuch'}],complete:options.complete!==false,maxPages:20,excluded:[]});
 const client={on(){},removeListener(){},release(){},async query(sql,p){calls.sql.push({sql,p});
   if(/FOR UPDATE/.test(sql))return{rows:options.conflict?[]:[{id:source.id}]};
   if(/INSERT INTO documents/.test(sql)&&options.writeError)throw Error('PRIVATE_WRITE_ERROR');
   return{rows:[]};}};
 const db=Object.create(DatabaseService.prototype);db.pool={async connect(){return client;}};
 db.query=async(sql,p)=>{calls.sql.push({sql,p});return{rows:[{revision:'2026-01-01 00:00:00+00'}]};};
 const service=new WebsiteKnowledgeIndexService(db,{async getById(){return source;},async markReady(_id,metadata,tx){calls.ready++;calls.metadata=metadata;assert.notEqual(tx,db);}},
 {resolveConfig(){return {providerKey:'openai',model:'text-embedding-3-small'};},async embed(_text,ctx){calls.embeddings++;assert.equal(ctx.purpose,'website_ingest_runtime_indexing');assert.equal(calls.sql.some(x=>/DELETE FROM documents/.test(x.sql)),false);if(options.providerError)throw Error('PRIVATE_PROVIDER_ERROR');return Array(1536).fill(0.1);}},
 {async upsertChunk(c,tx){calls.chunks++;assert.notEqual(tx,db);assert.equal(c.metadata.pageUrl,source.url);return{skipped:false};}});
 try{await fn(service,calls);}finally{crawler.crawlWebsite=original;}
}
test('all embeddings precede atomic document replacement and ready marking on the real transaction wrapper',()=>indexFixture({},async(s,c)=>{
 const result=await s.index(source.id);assert.equal(result.chunks,1);assert.equal(c.ready,1);assert.equal(c.metadata.providerFree,false);
 assert.ok(c.sql.find(x=>x.sql==='BEGIN'));assert.ok(c.sql.find(x=>/FOR UPDATE/.test(x.sql)));assert.ok(c.sql.find(x=>x.sql==='COMMIT'));
 assert.deepEqual(c.sql.find(x=>/DELETE FROM documents/.test(x.sql)).p,['source-1','site-1','tenant-1']);
}));
for(const [label,options,status] of [['provider failure',{providerError:true},502],['incomplete crawl',{complete:false},400],['source changed',{conflict:true},409],['storage failure',{writeError:true},502]])test(`${label} preserves previous index transaction and readiness`,()=>indexFixture(options,async(s,c)=>{
 await assert.rejects(s.index(source.id),e=>e.getStatus()===status&&!e.message.includes('PRIVATE'));assert.equal(c.ready,0);assert.equal(c.sql.some(x=>x.sql==='COMMIT'),false);
 if(options.conflict||options.writeError)assert.ok(c.sql.find(x=>x.sql==='ROLLBACK'));
 if(!options.writeError)assert.equal(c.sql.some(x=>/DELETE FROM documents/.test(x.sql)),false);
 if(options.complete===false)assert.equal(c.embeddings,0);
}));

function grant(overrides={}){return{id:'g',scope_kind:'source',tenant_id:'tenant-1',site_id:'site-1',source_id:'source-1',source_types:['url'],usage_contexts:['website_ingest_runtime_indexing'],purpose:'website_ingest_runtime_indexing',environment:'non_production',provider_key:'openai',model:'text-embedding-3-small',embedding_dimension:1536,provider_region:'synthetic-region',data_categories:['synthetic-text'],customer_data_approved:true,production_approved:false,provider_dpa_approved:true,retention_policy:'synthetic',redaction_policy:'synthetic',logging_policy:'metadata_only',deletion_policy:'synthetic',reindex_policy:'synthetic',rate_limit:'synthetic',cost_limit:'synthetic',valid_from:'2020-01-01T00:00:00Z',expires_at:'2099-01-01T00:00:00Z',revoked_at:null,approved_by:'synthetic',approval_evidence_ref:'synthetic',...overrides};}
async function transportFixture(row,fn){
 const keys=['NODE_ENV','APP_ENV','OPENAI_API_KEY','OPENAI_BASE_URL','OPENAI_EMBED_MODEL','OPENAI_EMBED_PROVIDER','OPENAI_LOG'];const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const fetch=globalThis.fetch;
 const calls={fetch:0,lookup:0};
 try{for(const k of keys)delete process.env[k];process.env.NODE_ENV='test';process.env.OPENAI_API_KEY='synthetic';process.env.OPENAI_LOG='debug';
 globalThis.fetch=async(url,init)=>{calls.fetch++;assert.equal(String(url),'https://api.openai.com/v1/embeddings');assert.equal(init.redirect,'error');assert.equal(calls.lookup,calls.fetch);return new Response(JSON.stringify({data:[{embedding:Array(1536).fill(0.1)}]}),{headers:{'content-type':'application/json'}});};
 const db={async query(sql,p){if(/knowledge_sources ks/.test(sql)){assert.deepEqual(p,['source-1','site-1','tenant-1']);return{rows:[{source_type:'url',is_active:true}]};}calls.lookup++;return{rows:row?[row]:[]};}};
 await fn(new IngestionEmbeddingService(db,new ProviderApprovalStorageLookupService(db)),calls);
 }finally{globalThis.fetch=fetch;for(const k of keys)if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}}
const context={tenantId:'tenant-1',siteId:'site-1',sourceId:'source-1',purpose:'website_ingest_runtime_indexing'};
test('actual SDK website transport requires exact persistent website grant for each chunk',()=>transportFixture(grant(),async(s,c)=>{
 await s.embed('Synthetischer Text A',context);await s.embed('Synthetischer Text B',context);assert.equal(c.fetch,2);assert.equal(c.lookup,2);
}));
for(const [name,row] of [['missing',null],['revoked',grant({revoked_at:'2026-01-01'})],['foreign tenant',grant({tenant_id:'foreign'})],['wrong dimension',grant({embedding_dimension:3})],...['website_ingest_mock_validation','knowledge_ingest','query_embedding','llm_generation'].map(p=>[p,grant({purpose:p,usage_contexts:[p]})])])test(`website ${name} grant allows zero SDK transports`,()=>transportFixture(row,async(s,c)=>{
 await assert.rejects(s.embed('synthetic',context));assert.equal(c.fetch,0);
}));
test('website request aborted before SDK transport makes zero calls',()=>transportFixture(grant(),async(s,c)=>{
 const a=new AbortController();a.abort();await assert.rejects(s.embed('synthetic',context,{signal:a.signal}));assert.equal(c.fetch,0);
}));

test('crawl endpoint authorizes the source site before invoking crawler',async()=>{
 let invoked=0;const controller=new IngestController({async getSource(){return source;}},{},
 {getAuth(){return{role:'customer'};},async assertSiteAccess(){throw Object.assign(Error('denied'),{status:403});}}, {},{}, {async index(){invoked++;}});
 await assert.rejects(controller.crawlIndex(source.id,{},{}));assert.equal(invoked,0);
});
test('closed HTTP response aborts indexing and listeners are removed',async()=>{
 const response=new EventEmitter();const request=new EventEmitter();let signal;
 const controller=new IngestController({async getSource(){return source;}},{async record(){}},
 {getAuth(){return{role:'admin'};},async assertSiteAccess(){}},{async allow(){return{allowed:true};}}, {},
 {async index(_id,opts){signal=opts.signal;response.emit('close');signal.throwIfAborted();}});
 await assert.rejects(controller.crawlIndex(source.id,{},request,response),{name:'AbortError'});assert.equal(signal.aborted,true);
 assert.equal(response.listenerCount('close'),0);assert.equal(request.listenerCount('aborted'),0);
});

test('legacy resync cannot downgrade an indexed website or bypass the bounded crawl endpoint',async()=>{
 const {IngestService}=require('../dist/ingest/ingest.service');let writes=0;
 const service=new IngestService({async query(){writes++;throw Error('unexpected write');}}, {}, {},
 {async getById(){return{...source,metadata:{websiteCrawl:{pages:1,complete:true,maxPages:20}}};}});
 await assert.rejects(service.resyncSource(source.id),e=>e.getStatus()===400);assert.equal(writes,0);
});

function deferredRead() {
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
const flushReadJobs=()=>new Promise(resolve=>setImmediate(resolve));
async function initialReadFixture(blocked,fn) {
 return indexFixture({},async(service,calls)=>{
   const reads={source:deferredRead(),snapshot:deferredRead()};
   const values={source,snapshot:{rows:[{revision:'2026-01-01 00:00:00+00'}]}};
   calls.sourceReads=0;calls.snapshotReads=0;calls.crawls=0;
   service.knowledge.getById=()=>{calls.sourceReads++;return blocked.includes('source')?reads.source.promise:Promise.resolve(values.source);};
   service.db.query=(sql,p)=>{
     calls.snapshotReads++;calls.sql.push({sql,p});
     assert.deepEqual(p,['source-1','site-1','tenant-1',source.url]);
     return blocked.includes('snapshot')?reads.snapshot.promise:Promise.resolve(values.snapshot);
   };
   const crawl=crawler.crawlWebsite;
   crawler.crawlWebsite=async(...args)=>{calls.crawls++;calls.crawlSignal=args[1].signal;return crawl(...args);};
   let operation;
   const outcome={state:'pending'};
   const start=(options={})=>{
     operation=service.index(source.id,options);
     operation.then(value=>{outcome.state='fulfilled';outcome.value=value;},error=>{outcome.state='rejected';outcome.error=error;});
     return outcome;
   };
   try {await fn({service,calls,reads,values,start,outcome});}
   finally {
     reads.source.resolve(values.source);reads.snapshot.resolve(values.snapshot);
     if(operation)await operation.catch(()=>{});
   }
 });
}
function assertStoppedInitialRead(calls,stage) {
 assert.equal(calls.sourceReads,1);
 assert.equal(calls.snapshotReads,stage==='snapshot'?1:0);
 assert.equal(calls.crawls,0);assert.equal(calls.embeddings,0);
 assert.equal(calls.ready,0);assert.equal(calls.chunks,0);
 assert.equal(calls.sql.some(({sql})=>!/SELECT/.test(sql)),false);
}
for(const stage of ['source','snapshot'])for(const mode of ['abort','deadline']) {
 test(`initial ${stage} read respects ${mode} before the read settles`,async t=>{
   t.mock.timers.enable({apis:['setTimeout']});
   await initialReadFixture([stage],async({calls,reads,values,start,outcome})=>{
     const controller=new AbortController();start({signal:controller.signal});
     await flushReadJobs();assert.equal(calls[`${stage}Reads`],1);
     if(mode==='abort')controller.abort(new Error('PRIVATE_ABORT_REASON'));
     else t.mock.timers.tick(45_000);
     await flushReadJobs();
     assert.equal(outcome.state,'rejected','index() must reject while the initial read is still pending');
     assert.equal(outcome.error.getStatus(),502);assert.equal(outcome.error.message.includes('PRIVATE'),false);
     assertStoppedInitialRead(calls,stage);
     reads[stage].resolve(values[stage]);await flushReadJobs();
     assertStoppedInitialRead(calls,stage);
   });
 });
 test(`late rejection of initial ${stage} read after ${mode} is observed without further work`,async t=>{
   t.mock.timers.enable({apis:['setTimeout']});
   await initialReadFixture([stage],async({calls,reads,start,outcome})=>{
     const controller=new AbortController();start({signal:controller.signal});await flushReadJobs();
     if(mode==='abort')controller.abort();else t.mock.timers.tick(45_000);
     await flushReadJobs();assert.equal(outcome.state,'rejected');const error=outcome.error;
     reads[stage].reject(new Error('PRIVATE_LATE_READ_ERROR'));await flushReadJobs();await flushReadJobs();
     assert.equal(outcome.error,error);assertStoppedInitialRead(calls,stage);
   });
 });
}
test('already aborted indexing starts no initial source or snapshot read',()=>initialReadFixture([],async({calls,start,outcome})=>{
 const controller=new AbortController();controller.abort();start({signal:controller.signal});await flushReadJobs();
 assert.equal(outcome.state,'rejected');assert.equal(outcome.error.getStatus(),502);
 assert.equal(calls.sourceReads,0);assert.equal(calls.snapshotReads,0);assert.equal(calls.crawls,0);assert.equal(calls.sql.length,0);
}));
test('initial source and snapshot reads share one 45000 ms deadline without restarting it',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 await initialReadFixture(['source','snapshot'],async({calls,reads,values,start,outcome})=>{
   start();await flushReadJobs();t.mock.timers.tick(20_000);reads.source.resolve(values.source);await flushReadJobs();
   assert.equal(calls.snapshotReads,1);t.mock.timers.tick(24_999);await flushReadJobs();assert.equal(outcome.state,'pending');
   t.mock.timers.tick(1);await flushReadJobs();assert.equal(outcome.state,'rejected');assertStoppedInitialRead(calls,'snapshot');
   reads.snapshot.resolve(values.snapshot);await flushReadJobs();assertStoppedInitialRead(calls,'snapshot');
 });
});
for(const stage of ['source','snapshot'])test(`initial ${stage} read failure is sanitized and starts no downstream work`,()=>initialReadFixture([stage],async({calls,reads,start,outcome})=>{
 start();await flushReadJobs();reads[stage].reject(new Error('PRIVATE_DB_ERROR'));await flushReadJobs();
 assert.equal(outcome.state,'rejected');assert.equal(outcome.error.getStatus(),502);assert.equal(outcome.error.message.includes('PRIVATE'),false);
 assertStoppedInitialRead(calls,stage);
}));
test('successful delayed initial reads preserve the scoped atomic refresh and clear the deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 await initialReadFixture(['source','snapshot'],async({calls,reads,values,start,outcome})=>{
   start();await flushReadJobs();t.mock.timers.tick(15_000);reads.source.resolve(values.source);await flushReadJobs();
   t.mock.timers.tick(15_000);reads.snapshot.resolve(values.snapshot);await flushReadJobs();
   assert.equal(outcome.state,'fulfilled');assert.equal(outcome.value.runtimeReadiness,'ready');
   assert.equal(calls.crawls,1);assert.equal(calls.embeddings,1);assert.equal(calls.ready,1);assert.equal(calls.chunks,1);
   assert.equal(calls.sql.filter(({sql})=>sql==='COMMIT').length,1);
   t.mock.timers.tick(45_000);await flushReadJobs();assert.equal(calls.crawlSignal.aborted,false);
 });
});
