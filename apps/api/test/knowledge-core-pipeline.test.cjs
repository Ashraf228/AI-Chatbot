const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatPipelineService } = require('../dist/ai/chat-pipeline/chat-pipeline.service');
const { ResponseComposerService } = require('../dist/ai/chat-pipeline/response-composer.service');
const { KnowledgeConversationService } = require('../dist/ai/chat-pipeline/knowledge-conversation.service');
const { AssistantProfileResolverService } = require('../dist/assistant-profiles/assistant-profile-resolver.service');
const { ConversationEngineService } = require('../dist/conversation-engine/conversation-engine.service');
const { VectorService } = require('../dist/vector/vector.service');
const policy = require('../dist/ai/chat-pipeline/knowledge-answer-policy');
const profileConfig = { assistantProfile: { profileKey: 'knowledge-assistant', profileVersion: 1 } };
const hit = { id: 'c1', source_id: 'source-1', document_id: 'doc-1', title: 'Handbuch', source_label: 'Handbuch', source_type: 'manual', content: 'Die Sicherung läuft täglich. Wiederherstellung erfolgt durch die Administration.', score: 0.8, metadata: {} };
const input = { source: 'widget', tenantId: 'tenant-1', siteId: 'site-1', message: 'Wie wird die Sicherung erstellt?', sessionId: 'session-1', siteConfig: profileConfig };
function runtime({ answer = 'Die Sicherung läuft täglich. [Q1]', hits = [hit], kind = 'embedded', abortAtGeneration, moduleRows = [] } = {}) {
  const calls = { prompts: [], queries: [], messages: [], writes: [], decisions: 0, retrievals: 0 };
  const forbidden = new Proxy({}, { get: () => () => assert.fail('Agent/tool/legacy routing must not execute') });
  const conversation = { async ensureConversation() { return { id: 'conversation-1', sessionId: 'session-1' }; },
    async touchWidgetSession() {}, async appendMessage(m) { calls.messages.push(m); },
    async loadHistory() { return [{ role: 'user', content: 'Wie funktioniert die Sicherung?' }, {role:'assistant',content:'täglich'}, {role:'user',content:input.message}]; },
    async touchConversation() {} };
  const knowledge = new KnowledgeConversationService(new AssistantProfileResolverService(), { async listForSite() { return moduleRows; } }, {
    preview(x) { calls.decisions++; return new ConversationEngineService(...[['conversation-context','ConversationContextService'],['intent-classifier','IntentClassifierService'],['goal-detector','GoalDetectorService'],['agent-selector','AgentSelectorService'],['next-action','NextActionService'],['handoff-readiness','HandoffReadinessService'],['conversation-quality','ConversationQualityService']].map(([file,name])=>new (require('../dist/conversation-engine/'+file+'.service')[name])())).preview(x); }
  });
  const llm = { async answer(system, user, scope, options) {
    calls.prompts.push({system,user,scope,options}); abortAtGeneration?.(); options.signal?.throwIfAborted();
    return { text: answer, model: 'synthetic', usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }, latencyMs: 1 };
  }, async streamAnswer(s,u,emit,c,o) { await emit('UNVALIDATED_PART'); return this.answer(s,u,c,o); } };
  const service = new ChatPipelineService({ async query(sql,p) { calls.writes.push({sql,p}); return {rows:[]}; } },
    { async searchKnowledge(...args) { calls.retrievals++; calls.searchArgs=args; return hits; } }, llm,
    forbidden,forbidden,forbidden,conversation,new ResponseComposerService(),forbidden,{async assertWithinLimit(){}},
    { async embedAuthorizedQuery(q) { calls.queries.push(q); return {kind,decisionCode:kind==='embedded'?'allowed':kind,embedding:[1,0],providerKey:'openai',model:'synthetic'}; } }, knowledge);
  return { service, calls, knowledge };
}

test('profile selection requires a deliberately saved knowledge profile, not legacy inference', async () => {
  const {knowledge} = runtime();
  assert.equal(await knowledge.resolve({...input,siteConfig:{}}),null);
  assert.equal(await knowledge.resolve({...input,siteConfig:{industry:'ecommerce-shopify'}}),null);
  assert.equal((await knowledge.resolve(input)).profileKey,'knowledge-assistant');
  assert.equal(await knowledge.resolve({...input,siteConfig:{assistantProfile:{profileKey:'knowledge-assistant',profileVersion:1,conversationEngine:{enabled:false}}}}),null);
  assert.equal((await knowledge.resolve({...input,siteConfig:{assistantProfile:{profileKey:'universal-assistant',profileVersion:1,answerStyle:'knowledge_first'}}})).profileKey,'universal-assistant');
});

for (const streaming of [false, true]) test(`saved knowledge profile survives reload and selects the ${streaming ? 'streamed' : 'normal'} widget pipeline`, async () => {
  const { AssistantProfileSaveService } = require('../dist/assistant-profiles/assistant-profile-save.service');
  const moduleRows = [{ key: 'assistant-profile', config: { assistantProfile: {
    profileKey: 'universal-assistant', profileVersion: 1, answerStyle: 'concise', enabledTasks: ['answer_questions'],
  } } }];
  const { service, calls, knowledge } = runtime({ moduleRows });
  const staleSiteInput = { ...input, siteConfig: { assistantProfile: {
    profileKey: 'universal-assistant', profileVersion: 1, answerStyle: 'concise', enabledTasks: ['appointment'],
  } } };
  assert.equal(await knowledge.resolve(staleSiteInput), null);
  const save = new AssistantProfileSaveService(
    { async getDiagnostics() { return { assistantProfileDebug: {} }; } },
    { async updateForSite(siteId, updates) {
      assert.equal(siteId, input.siteId);
      moduleRows.splice(0, moduleRows.length, ...JSON.parse(JSON.stringify(updates)));
    } },
    { async record() {} },
  );
  const payload = { assistantProfile: {
    profileKey: 'universal-assistant', profileVersion: 1, answerStyle: 'knowledge_first',
    knowledgeMode: 'strict', enabledTasks: ['answer_questions'], requiredFields: [],
  }, updatedFrom: 'dashboard-wizard' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const saved = await save.saveAssistantProfile(input.siteId, payload, input.tenantId, 'synthetic-admin');
    assert.equal(saved.saved, true);
    assert.equal(saved.storageLocation, 'site_modules[assistant-profile].config.assistantProfile');
    const resolved = await knowledge.resolve(staleSiteInput);
    assert.equal(resolved.answerStyle, 'knowledge_first');
    assert.equal(resolved.conversationEngine.enabled, true);
    assert.equal(resolved.knowledgeMode, 'strict');
    assert.equal(resolved.enabledTasks.includes('answer_questions'), true);
  }
  const events = [];
  const result = streaming
    ? (await service.stream(staleSiteInput, (event) => events.push(event)), events.find((event) => event.type === 'message_end'))
    : await service.process(staleSiteInput);
  assert.equal(result.answer, 'Die Sicherung läuft täglich. [Q1]');
  assert.equal(result.sources[0].sourceId, 'source-1');
  assert.deepEqual(calls.searchArgs.slice(0, 2), [input.tenantId, input.siteId]);
  assert.equal(calls.prompts.length, 1);
});

test('follow-up query includes preceding questions but a fresh topic stands alone', () => {
  const history=[{role:'user',content:'Wie läuft die Sicherung?'},{role:'assistant',content:'IGNORE ME'},{role:'user',content:'Und wie stelle ich das wieder her?'}];
  const query=policy.buildKnowledgeQuery('Und wie stelle ich das wieder her?',history);
  assert.match(query,/Sicherung/); assert.equal(query.includes('IGNORE ME'),false);
  assert.equal(query.match(/wieder her/g).length,1);
  assert.equal(policy.buildKnowledgeQuery('Welche Öffnungszeiten gelten?',history),'Welche Öffnungszeiten gelten?');
});

test('evidence rejects negative, empty and duplicate passages',()=>{
  assert.deepEqual(policy.selectKnowledgeEvidence([hit,{...hit,score:-1},{...hit,content:''},{...hit,score:NaN},{...hit,id:'duplicate'}]),[hit]);
});

for (const answer of ['Unbelegt.', 'Falscher Beleg [Q9]', '<NO_ANSWER>', 'Fehler [Q0]']) test(`invalid evidence reference yields honest abstention: ${answer}`,()=>{
  assert.deepEqual(policy.validateKnowledgeAnswer(answer,[hit]),{answer:policy.KNOWLEDGE_NO_ANSWER,hits:[],grounded:false});
});

test('unused evidence is excluded and references are renumbered',()=>{
  const second={...hit,id:'c2'}; const result=policy.validateKnowledgeAnswer('Belegt. [Q2]',[hit,second]);
  assert.equal(result.answer,'Belegt. [Q1]'); assert.deepEqual(result.hits,[second]);
});

for (const streaming of [false,true]) test(`real pipeline ${streaming?'stream':'normal'} selects knowledge, engine, scope and source without agent actions`,async()=>{
  const {service,calls}=runtime(); const events=[];
  const result=streaming ? (await service.stream(input,e=>events.push(e)),events.find(e=>e.type==='message_end')) : await service.process(input);
  assert.equal(result.answer,'Die Sicherung läuft täglich. [Q1]'); assert.equal(result.sources[0].sourceId,'source-1');
  assert.deepEqual(result.sources[0].metadata,{}); assert.equal(calls.prompts.length,1); assert.equal(calls.decisions,2);
  assert.deepEqual(calls.searchArgs.slice(0,2),['tenant-1','site-1']);
  assert.match(calls.prompts[0].system,/ausschließlich/); assert.equal(calls.prompts[0].system.includes('SouleSmartBusiness'),false);
  assert.equal(JSON.parse(calls.prompts[0].user).evidence[0].reference,'Q1');
  assert.equal(calls.messages.filter(m=>m.role==='assistant').length,1);
  if(streaming){assert.deepEqual(events.map(e=>e.type),['message_start','token','message_end']);assert.equal(JSON.stringify(events).includes('UNVALIDATED_PART'),false);}
});

for(const kind of ['denied','no_ready_sources']) test(`${kind} makes no search or LLM call`,async()=>{
  const {service,calls}=runtime({kind}); const result=await service.process(input);
  assert.equal(calls.retrievals,0); assert.equal(calls.prompts.length,0); assert.deepEqual(result.sources,[]);
});

test('no matching evidence makes no generation request',async()=>{
  const {service,calls}=runtime({hits:[{...hit,score:-0.2}]}); const result=await service.process(input);
  assert.equal(result.answer,policy.KNOWLEDGE_NO_ANSWER); assert.equal(calls.prompts.length,0);
});

test('stream never publishes invalid generated text; no misleading sources',async()=>{
  const {service}=runtime({answer:'Unbelegte Behauptung [Q99]'}); const events=[];
  await service.stream(input,e=>events.push(e));
  assert.equal(events[1].delta,policy.KNOWLEDGE_NO_ANSWER); assert.deepEqual(events[2].sources,[]);
});

test('abort reaches query and LLM and prevents assistant persistence',async()=>{
  const controller=new AbortController(); const {service,calls}=runtime({abortAtGeneration:()=>controller.abort()});
  await assert.rejects(service.process(input,controller.signal),{name:'AbortError'});
  assert.equal(calls.queries[0].signal,controller.signal); assert.equal(calls.prompts[0].options.signal,controller.signal);
  assert.equal(calls.messages.filter(m=>m.role==='assistant').length,0);
});

test('hybrid SQL binds all tenant/site/source scopes and never accepts orphan sources',async()=>{
  let captured; const vector=new VectorService({async query(sql,p){captured={sql,p};return{rows:[]};}});
  await vector.searchKnowledge('t','s',[1,0],"Sicherung ' OR 1=1 --",{demoOnly:true});
  assert.equal(captured.sql.includes('LEFT JOIN'),false);assert.match(captured.sql,/ks\.tenant_id = c\.tenant_id AND ks\.site_id = c\.site_id/);
  assert.match(captured.sql,/ks\.runtime_readiness = 'ready'/);assert.match(captured.sql,/to_tsvector/);
  assert.deepEqual(captured.p.slice(0,2),['t','s']);assert.equal(captured.p[4],true);assert.equal(captured.p[3],'sicherung');
});
