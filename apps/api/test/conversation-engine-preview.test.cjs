const test = require('node:test');
const assert = require('node:assert/strict');
const { ConversationEngineService } = require('../dist/conversation-engine/conversation-engine.service.js');
const { ConversationEngineCompareService } = require('../dist/conversation-engine/conversation-engine-compare.service.js');
const { ConversationEngineTestCasesService } = require('../dist/conversation-engine/conversation-engine-test-cases.service.js');
const { ConversationContextService } = require('../dist/conversation-engine/conversation-context.service.js');
const { IntentClassifierService } = require('../dist/conversation-engine/intent-classifier.service.js');
const { GoalDetectorService } = require('../dist/conversation-engine/goal-detector.service.js');
const { AgentSelectorService } = require('../dist/conversation-engine/agent-selector.service.js');
const { NextActionService } = require('../dist/conversation-engine/next-action.service.js');
const { HandoffReadinessService } = require('../dist/conversation-engine/handoff-readiness.service.js');
const { ConversationQualityService } = require('../dist/conversation-engine/conversation-quality.service.js');
const { ConversationEngineController } = require('../dist/conversation-engine/conversation-engine.controller.js');
const { ResponseDraftService } = require('../dist/conversation-engine/response-draft.service.js');
const { AssistantProfileResolverService } = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');

function createEngine() {
  return new ConversationEngineService(
    new ConversationContextService(),
    new IntentClassifierService(),
    new GoalDetectorService(),
    new AgentSelectorService(),
    new NextActionService(),
    new HandoffReadinessService(),
    new ConversationQualityService(),
  );
}

function createCompareService() {
  return new ConversationEngineCompareService(createEngine());
}

function localServiceProfile(overrides = {}) {
  return {
    profileKey: 'local-service-first-contact',
    profileVersion: 1,
    assistantName: 'Handwerker-Erstkontakt',
    role: 'Geführter Erstkontakt',
    businessDescription: '',
    targetUsers: [],
    tone: 'formal',
    answerStyle: 'guided',
    knowledgeMode: 'flexible',
    enabledTasks: ['local_service_intake', 'capture_lead', 'answer_questions', 'prepare_handoff'],
    enabledAgents: ['lead-sales-agent', 'knowledge-agent'],
    requiredFields: [
      { key: 'problem', label: 'Problem', required: true },
      { key: 'phone', label: 'Telefon', required: true },
    ],
    handoffRules: {
      enabled: true,
      requireAllFields: true,
      summarizeBeforeHandoff: true,
      handoffWhenUncertain: false,
    },
    deliveryChannels: { email: { enabled: false }, webhook: { enabled: false } },
    conversationEngine: {
      enabled: true,
      autoDetectIntent: true,
      autoSelectAgent: true,
      askOnlyOneQuestionAtATime: true,
      maxQuestionsBeforeSummary: 5,
      summarizeBeforeHandoff: true,
      handoffWhenUncertain: false,
    },
    agents: [],
    legacySource: 'default',
    ...overrides,
  };
}

function universalProfile(overrides = {}) {
  return {
    profileKey: 'universal-assistant',
    profileVersion: 1,
    assistantName: 'Universal-Assistent',
    role: 'Allgemeiner digitaler Assistent',
    businessDescription: '',
    targetUsers: [],
    tone: 'professional',
    answerStyle: 'structured',
    knowledgeMode: 'flexible',
    enabledTasks: [
      'answer_questions',
      'collect_context',
      'triage_support',
      'prepare_handoff',
      'recommend_products',
      'schedule_appointments',
    ],
    enabledAgents: [
      'knowledge-agent',
      'support-agent',
      'sales-agent',
      'appointment-agent',
      'product-advisor-agent',
      'handoff-agent',
    ],
    requiredFields: [],
    handoffRules: {
      enabled: true,
      requireAllFields: false,
      summarizeBeforeHandoff: true,
      handoffWhenUncertain: true,
    },
    deliveryChannels: { email: { enabled: false }, webhook: { enabled: false } },
    conversationEngine: {
      enabled: true,
      autoDetectIntent: true,
      autoSelectAgent: true,
      askOnlyOneQuestionAtATime: true,
      maxQuestionsBeforeSummary: 5,
      summarizeBeforeHandoff: true,
      handoffWhenUncertain: false,
    },
    agents: [],
    legacySource: 'default',
    ...overrides,
  };
}

test('conversation engine preview selects support-agent for support questions when active', () => {
  const decision = createEngine().preview({
    assistantProfile: localServiceProfile({
      enabledTasks: ['triage_support', 'answer_questions'],
      enabledAgents: ['support-agent', 'knowledge-agent'],
      requiredFields: [],
    }),
    latestUserMessage: 'Mein VPN funktioniert nicht',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'support');
  assert.equal(decision.goal, 'solve_problem');
  assert.equal(decision.selectedAgentKey, 'support-agent');
});

test('conversation engine preview prioritizes support solving for support problems', () => {
  const decision = createEngine().preview({
    assistantProfile: universalProfile(),
    latestUserMessage: 'Ich brauche Hilfe, mein VPN funktioniert nicht.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'support');
  assert.equal(decision.goal, 'solve_problem');
  assert.equal(decision.selectedAgentKey, 'support-agent');
  assert.equal(decision.shouldUseKnowledge, true);
});

test('conversation engine preview prioritizes product-advisor for product advice', () => {
  const decision = createEngine().preview({
    assistantProfile: universalProfile(),
    latestUserMessage: 'Welches Produkt passt für unser Unternehmen?',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'product_advice');
  assert.equal(decision.goal, 'recommend_product');
  assert.equal(decision.selectedAgentKey, 'product-advisor-agent');
  assert.equal(decision.shouldUseKnowledge, true);
});

test('conversation engine preview prioritizes appointment-agent for appointments', () => {
  const decision = createEngine().preview({
    assistantProfile: universalProfile(),
    latestUserMessage: 'Ich möchte einen Termin vereinbaren.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'appointment');
  assert.equal(['prepare_contact', 'trigger_integration'].includes(decision.goal), true);
  assert.notEqual(decision.selectedAgentKey, 'knowledge-agent');
  assert.equal(['appointment-agent', 'handoff-agent'].includes(decision.selectedAgentKey), true);
});

test('conversation engine preview prioritizes handoff for complaints', () => {
  const decision = createEngine().preview({
    assistantProfile: universalProfile(),
    latestUserMessage: 'Ich bin unzufrieden, weil sich niemand gemeldet hat.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'complaint');
  assert.equal(decision.goal, 'escalate_human');
  assert.equal(['handoff-agent', 'support-agent'].includes(decision.selectedAgentKey), true);
  assert.equal(decision.shouldHandoff, true);
});

test('conversation engine preview keeps unclear need as clarify intent', () => {
  const decision = createEngine().preview({
    assistantProfile: universalProfile(),
    latestUserMessage: 'Ich weiß nicht genau, was ich brauche.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'unknown');
  assert.equal(decision.goal, 'clarify_intent');
  assert.equal(decision.shouldAskQuestion, true);
  assert.match(decision.nextAction, /Support.*Beratung.*Kontaktaufnahme/);
});

test('conversation engine preview keeps price questions out of product advice', () => {
  const decision = createEngine().preview({
    assistantProfile: universalProfile(),
    latestUserMessage: 'Was kostet das?',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(['sales', 'question'].includes(decision.intent), true);
  assert.notEqual(decision.intent, 'product_advice');
  assert.equal(['prepare_contact', 'answer_from_knowledge'].includes(decision.goal), true);
});

test('conversation engine preview maps callback request to prepare_contact', () => {
  const decision = createEngine().preview({
    assistantProfile: localServiceProfile(),
    latestUserMessage: 'Ich möchte zurückgerufen werden',
    knowledgeAvailable: false,
    testMode: true,
  });

  assert.equal(decision.intent, 'handoff');
  assert.equal(decision.goal, 'prepare_contact');
  assert.equal(decision.selectedAgentKey, 'lead-sales-agent');
});

test('conversation engine preview clarifies unclear messages', () => {
  const decision = createEngine().preview({
    assistantProfile: localServiceProfile({ requiredFields: [] }),
    latestUserMessage: 'hm',
    knowledgeAvailable: false,
    testMode: true,
  });

  assert.equal(decision.intent, 'unknown');
  assert.equal(decision.goal, 'clarify_intent');
  assert.equal(decision.shouldAskQuestion, true);
});

test('conversation engine preview reports missing required fields and skips known fields', () => {
  const decision = createEngine().preview({
    assistantProfile: localServiceProfile(),
    latestUserMessage: 'Mein Abfluss ist verstopft',
    conversationHistory: [{ role: 'user', content: 'Meine Nummer ist 017600000000' }],
    knowledgeAvailable: false,
    testMode: true,
  });

  assert.ok(decision.knownFields.includes('phone'));
  assert.ok(decision.knownFields.includes('problem'));
  assert.equal(decision.missingFields.includes('phone'), false);
  assert.equal(decision.missingFields.includes('problem'), false);
});

function createController({ previewEnabled = true, siteConfig = {}, moduleConfig = {}, knowledgeCount = 1 } = {}) {
  const calls = [];
  const dbQueries = [];
  const knowledgePreviewCalls = [];
  const moduleStore = {
    'assistant-profile': moduleConfig,
    'conversation-engine-tests': {
      conversationEngine: {
        previewEnabled: false,
        compareEnabled: false,
        responsePreviewEnabled: false,
        knowledgePreviewEnabled: false,
        adminTestOnly: true,
      },
      testCases: [],
    },
  };
  const sitesService = {
    async getSite(siteId) {
      return {
        id: siteId,
        tenant_id: 'tenant-1',
        config: {
          conversationEngine: { previewEnabled },
          ...siteConfig,
        },
      };
    },
  };
  const siteModulesService = {
    async listForSite() {
      return Object.entries(moduleStore).map(([key, config]) => ({
        key,
        config,
        isEnabled: key === 'conversation-engine-tests',
      }));
    },
    async updateForSite(_siteId, modules) {
      for (const module of modules) {
        moduleStore[module.key] = module.config || {};
      }
      return this.listForSite();
    },
  };
  const resolver = new AssistantProfileResolverService();
  const compareService = createCompareService();
  const responseDrafts = new ResponseDraftService(new ConversationQualityService());
  const knowledgePreview = {
    async retrieve(input) {
      knowledgePreviewCalls.push(input);
      if (!input.enabled) {
        return {
          enabled: false,
          attempted: false,
          status: 'disabled',
          snippets: [],
          warnings: [],
          reasons: ['disabled'],
        };
      }
      return {
        enabled: true,
        attempted: true,
        status: 'available',
        snippets: [{
          id: 'snippet-1',
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          sourceId: 'source-1',
          title: 'VPN Hilfe',
          sourceType: 'faq',
          score: 0.92,
          excerpt: 'VPN-Verbindungen sollen zuerst anhand der Fehlermeldung eingegrenzt werden.',
          scope: 'site',
        }],
        warnings: [],
        reasons: ['Test-Snippet'],
      };
    },
  };
  const db = {
    async query(sql) {
      dbQueries.push(String(sql));
      return { rows: [{ count: String(knowledgeCount) }] };
    },
  };
  const controller = new ConversationEngineController(
    db,
    sitesService,
    siteModulesService,
    {
      getAuth(req) {
        calls.push({ method: 'getAuth', req });
        return { role: 'operator', tenantId: 'tenant-1' };
      },
      async assertSiteAccess(auth, siteId, options) {
        calls.push({ method: 'assertSiteAccess', auth, siteId, options });
      },
    },
    resolver,
    {
      async getDiagnostics() {
        return { assistantProfileDebug: { profileKey: 'universal-assistant' } };
      },
    },
    createEngine(),
    compareService,
    new ConversationEngineTestCasesService(db, sitesService, siteModulesService, resolver, compareService, knowledgePreview, responseDrafts),
    knowledgePreview,
    responseDrafts,
  );
  return { controller, calls, dbQueries, moduleStore, knowledgePreviewCalls };
}

test('conversation engine admin preview returns no decision when feature flag is disabled', async () => {
  const { controller } = createController({ previewEnabled: false });

  const result = await controller.preview('site-1', { message: 'Mein VPN geht nicht' }, { dashboardAuth: {} });

  assert.equal(result.previewEnabled, false);
  assert.equal(result.conversationEnginePreview, null);
});

test('conversation engine admin preview returns decision when feature flag is enabled', async () => {
  const { controller } = createController({ previewEnabled: true });

  const result = await controller.preview('site-1', { message: 'Was kostet das?' }, { dashboardAuth: {} });

  assert.equal(result.previewEnabled, true);
  assert.equal(result.conversationEnginePreview.intent, 'sales');
  assert.equal(result.assistantProfileDebug.profileKey, 'universal-assistant');
});

test('conversation engine admin preview checks site access before decision', async () => {
  const { controller, calls } = createController({ previewEnabled: true });

  await controller.preview('site-1', { message: 'Kontakt bitte' }, { dashboardAuth: { role: 'operator' } });

  assert.deepEqual(calls[1], {
    method: 'assertSiteAccess',
    auth: { role: 'operator', tenantId: 'tenant-1' },
    siteId: 'site-1',
    options: { allowedRoles: ['admin', 'operator'] },
  });
});

test('conversation engine compare returns disabled status when compare flag is false', async () => {
  const { controller } = createController({
    previewEnabled: true,
    siteConfig: {
      conversationEngine: { previewEnabled: true, compareEnabled: false },
    },
  });

  const result = await controller.compare('site-1', { message: 'Kontakt bitte' }, { dashboardAuth: {} });

  assert.equal(result.compareEnabled, false);
  assert.equal(result.legacy, null);
  assert.equal(result.engine, null);
  assert.equal(result.comparison.status, 'unknown');
});

test('conversation engine compare returns legacy, engine and comparison when enabled', async () => {
  const { controller, dbQueries } = createController({
    previewEnabled: true,
    siteConfig: {
      conversationEngine: { previewEnabled: true, compareEnabled: true },
    },
  });

  const result = await controller.compare('site-1', { message: 'Was kostet das?' }, { dashboardAuth: {} });

  assert.equal(result.compareEnabled, true);
  assert.ok(result.legacy);
  assert.ok(result.engine.conversationDecision);
  assert.ok(result.comparison.status);
  assert.equal(dbQueries.length, 1);
  assert.match(dbQueries[0], /FROM knowledge_sources/);
  assert.doesNotMatch(dbQueries.join('\n'), /\b(insert|update|delete)\b/i);
});

test('conversation engine compare marks contact request as aligned or partial without side effects', () => {
  const result = createCompareService().compare({
    assistantProfile: localServiceProfile(),
    latestUserMessage: 'Ich möchte zurückgerufen werden',
    knowledgeAvailable: false,
    testMode: true,
  });

  assert.equal(['aligned', 'partial'].includes(result.comparison.status), true);
  assert.equal(result.legacy.wouldTriggerIntegration, false);
  assert.equal(result.legacy.wouldCreateTicket, false);
  assert.match(result.legacy.warnings.join(' '), /trocken simuliert/);
});

test('conversation engine compare flags support conflict when legacy local-service would start intake', () => {
  const result = createCompareService().compare({
    assistantProfile: localServiceProfile({
      enabledTasks: ['local_service_intake', 'triage_support', 'answer_questions'],
      enabledAgents: ['support-agent', 'lead-sales-agent', 'knowledge-agent'],
    }),
    latestUserMessage: 'Mein VPN funktioniert nicht',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(result.legacy.route, 'local_service_intake');
  assert.equal(result.engine.conversationDecision.intent, 'support');
  assert.equal(result.comparison.status, 'conflict');
});

test('conversation engine compare marks legacy unknown as partial when engine matches expectations', () => {
  const result = createCompareService().compare({
    assistantProfile: universalProfile(),
    latestUserMessage: 'Ich bin unzufrieden, weil sich niemand gemeldet hat.',
    knowledgeAvailable: true,
    expectedIntent: 'complaint',
    expectedGoal: 'escalate_human|prepare_contact',
    testMode: true,
  });

  assert.equal(result.legacy.route, 'unknown');
  assert.equal(result.engine.conversationDecision.intent, 'complaint');
  assert.equal(result.engine.conversationDecision.goal, 'escalate_human');
  assert.equal(result.comparison.status, 'partial');
});

test('conversation engine test flags default to false and can be enabled per site', async () => {
  const { controller } = createController();

  const initial = await controller.settings('site-1', { dashboardAuth: {} });
  assert.equal(initial.settings.previewEnabled, false);
  assert.equal(initial.settings.compareEnabled, false);
  assert.equal(initial.settings.responsePreviewEnabled, false);
  assert.equal(initial.settings.knowledgePreviewEnabled, false);
  assert.equal(initial.settings.adminTestOnly, true);

  const updated = await controller.updateSettings(
    'site-1',
    { previewEnabled: true, compareEnabled: true, adminTestOnly: false },
    { dashboardAuth: {} },
  );

  assert.equal(updated.settings.previewEnabled, true);
  assert.equal(updated.settings.compareEnabled, true);
  assert.equal(updated.settings.knowledgePreviewEnabled, false);
  assert.equal(updated.settings.adminTestOnly, true);
});

test('conversation engine response preview is disabled by default', async () => {
  const { controller } = createController();

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Ich brauche Hilfe, mein VPN funktioniert nicht.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.responsePreviewEnabled, false);
  assert.equal(result.engineResponsePreview, null);
  assert.equal(result.conversationEnginePreview, null);
});

test('conversation engine response preview returns support draft when enabled', async () => {
  const { controller, dbQueries } = createController({
    siteConfig: {
      conversationEngine: { previewEnabled: true, responsePreviewEnabled: true },
    },
  });

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Ich brauche Hilfe, mein VPN funktioniert nicht.', includeLegacyCompare: true },
    { dashboardAuth: {} },
  );

  assert.equal(result.responsePreviewEnabled, true);
  assert.equal(result.conversationEnginePreview.intent, 'support');
  assert.equal(result.engineResponsePreview.draft.mode, 'support_guidance');
  assert.match(result.engineResponsePreview.draft.text, /Supportfall/);
  assert.equal((result.engineResponsePreview.draft.text.match(/\?/g) || []).length <= 1, true);
  assert.equal(result.engineResponsePreview.draft.shouldHandoff, false);
  assert.equal(result.engineResponsePreview.quality.status, 'good');
  assert.ok(result.legacy);
  assert.equal(dbQueries.some((sql) => /\b(insert|update|delete)\b/i.test(sql)), false);
});

test('conversation engine response preview uses knowledge snippets only when knowledge preview is enabled', async () => {
  const { controller, knowledgePreviewCalls } = createController({
    siteConfig: {
      conversationEngine: {
        previewEnabled: true,
        responsePreviewEnabled: true,
        knowledgePreviewEnabled: true,
        adminTestOnly: true,
      },
    },
  });

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Ich brauche Hilfe, mein VPN funktioniert nicht.', includeKnowledge: true },
    { dashboardAuth: {} },
  );

  assert.equal(result.responsePreviewEnabled, true);
  assert.equal(result.knowledgePreviewEnabled, true);
  assert.equal(result.knowledgeRetrieval.status, 'available');
  assert.equal(knowledgePreviewCalls.length, 1);
  assert.equal(result.engineResponsePreview.draft.usedKnowledgeSources.length, 1);
  assert.equal(result.engineResponsePreview.draft.groundingStatus, 'grounded');
  assert.match(result.engineResponsePreview.draft.text, /VPN Hilfe/);
  assert.doesNotMatch(JSON.stringify(result), /test@example\.com|017600000000|sk-/i);
});

test('conversation engine response preview drafts product advice without immediate handoff', async () => {
  const { controller } = createController({
    siteConfig: {
      conversationEngine: { previewEnabled: true, responsePreviewEnabled: true },
    },
  });

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Welches Produkt passt für unser Unternehmen?' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.intent, 'product_advice');
  assert.equal(result.engineResponsePreview.draft.mode, 'product_advice');
  assert.equal(result.engineResponsePreview.draft.shouldHandoff, false);
  assert.match(result.engineResponsePreview.draft.text, /eingrenzen/);
});

test('conversation engine response preview drafts appointment preparation', async () => {
  const { controller } = createController({
    siteConfig: {
      conversationEngine: { previewEnabled: true, responsePreviewEnabled: true },
    },
  });

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Ich möchte einen Termin vereinbaren.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.intent, 'appointment');
  assert.equal(result.engineResponsePreview.draft.mode, 'appointment_preparation');
  assert.equal(['appointment-agent', 'handoff-agent'].includes(result.conversationEnginePreview.selectedAgentKey), true);
});

test('conversation engine response preview drafts complaint escalation', async () => {
  const { controller } = createController({
    siteConfig: {
      conversationEngine: { previewEnabled: true, responsePreviewEnabled: true },
    },
  });

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Ich bin unzufrieden, weil sich niemand gemeldet hat.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.intent, 'complaint');
  assert.equal(result.engineResponsePreview.draft.mode, 'complaint_escalation');
  assert.equal(result.engineResponsePreview.draft.shouldHandoff, true);
});

test('conversation engine response preview clarifies unknown need with options', async () => {
  const { controller } = createController({
    siteConfig: {
      conversationEngine: { previewEnabled: true, responsePreviewEnabled: true },
    },
  });

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Ich weiß nicht genau, was ich brauche.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.goal, 'clarify_intent');
  assert.equal(result.engineResponsePreview.draft.mode, 'clarification');
  assert.match(result.engineResponsePreview.draft.text, /Fragen automatisch beantworten/);
  assert.equal((result.engineResponsePreview.draft.text.match(/\?/g) || []).length <= 1, true);
});

test('conversation engine response preview does not invent prices', async () => {
  const { controller } = createController({
    siteConfig: {
      conversationEngine: { previewEnabled: true, responsePreviewEnabled: true },
    },
    knowledgeCount: 0,
  });

  const result = await controller.responsePreview(
    'site-1',
    { message: 'Was kostet das?' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.intent, 'sales');
  assert.doesNotMatch(result.engineResponsePreview.draft.text, /\b\d+[,.]?\d*\s?(€|euro)\b/i);
});

test('conversation engine test cases can be created, updated and deleted without storing raw contact data', async () => {
  const { controller } = createController();

  const created = await controller.createTestCase(
    'site-1',
    {
      name: 'Kontakt 0176 00000000',
      message: 'Bitte melden bei test@example.com oder 017600000000',
      expectedIntent: 'handoff',
    },
    { dashboardAuth: {} },
  );

  assert.equal(created.testCases.length, 1);
  assert.match(created.testCases[0].name, /\[TELEFON\]/);
  assert.match(created.testCases[0].message, /\[E-MAIL\]/);
  assert.match(created.testCases[0].message, /\[TELEFON\]/);

  const updated = await controller.updateTestCase(
    'site-1',
    created.testCases[0].id,
    { name: 'Supportfrage', message: 'Mein VPN funktioniert nicht' },
    { dashboardAuth: {} },
  );
  assert.equal(updated.testCases[0].name, 'Supportfrage');
  assert.equal(updated.testCases[0].message, 'Mein VPN funktioniert nicht');

  const deleted = await controller.deleteTestCase('site-1', created.testCases[0].id, { dashboardAuth: {} });
  assert.equal(deleted.testCases.length, 0);
});

test('conversation engine test case run stores compare results and metrics without write side effects beyond config', async () => {
  const { controller, dbQueries } = createController({
    siteConfig: { conversationEngine: { previewEnabled: false, compareEnabled: false } },
  });

  await controller.updateSettings(
    'site-1',
    { previewEnabled: true, compareEnabled: true },
    { dashboardAuth: {} },
  );
  await controller.createTestCase(
    'site-1',
    { name: 'Support', message: 'Mein VPN funktioniert nicht', expectedIntent: 'support' },
    { dashboardAuth: {} },
  );
  await controller.createTestCase(
    'site-1',
    { name: 'Kontakt', message: 'Ich möchte zurückgerufen werden', expectedIntent: 'handoff' },
    { dashboardAuth: {} },
  );

  const result = await controller.runTestCases('site-1', {}, { dashboardAuth: {} });

  assert.equal(result.testCases.length, 2);
  assert.equal(result.metrics.total, 2);
  assert.equal(result.metrics.conflict >= 0, true);
  assert.ok(result.testCases.every((testCase) => testCase.lastComparison));
  assert.ok(result.testCases.every((testCase) => testCase.resultStatus));
  assert.match(dbQueries.join('\n'), /FROM knowledge_sources/);
  assert.doesNotMatch(dbQueries.join('\n'), /\b(widget_leads|email_jobs|webhook_jobs|tickets|conversations)\b/i);
});

test('conversation engine test case run skips response preview when requested but disabled', async () => {
  const { controller } = createController();

  await controller.updateSettings(
    'site-1',
    { previewEnabled: true, compareEnabled: true, responsePreviewEnabled: false },
    { dashboardAuth: {} },
  );
  await controller.createTestCase(
    'site-1',
    { name: 'Support', message: 'Mein VPN funktioniert nicht', expectedIntent: 'support' },
    { dashboardAuth: {} },
  );

  const result = await controller.runTestCases('site-1', { includeResponsePreview: true }, { dashboardAuth: {} });

  assert.equal(result.testCases[0].responsePreview, undefined);
  assert.equal(result.testCases[0].responsePreviewSkippedReason, 'responsePreviewEnabled=false');
  assert.equal(result.responseQualitySummary.totalWithPreview, 0);
});

test('conversation engine test case run stores response preview and quality summary when enabled', async () => {
  const { controller, dbQueries } = createController();

  await controller.updateSettings(
    'site-1',
    { previewEnabled: true, compareEnabled: true, responsePreviewEnabled: true },
    { dashboardAuth: {} },
  );
  await controller.createTestCase(
    'site-1',
    { name: 'Support', message: 'Mein VPN funktioniert nicht', expectedIntent: 'support' },
    { dashboardAuth: {} },
  );
  await controller.createTestCase(
    'site-1',
    { name: 'Unklar', message: 'Ich weiß nicht genau, was ich brauche.', expectedIntent: 'unknown' },
    { dashboardAuth: {} },
  );

  const result = await controller.runTestCases('site-1', { includeResponsePreview: true }, { dashboardAuth: {} });

  assert.equal(result.testCases.length, 2);
  assert.ok(result.testCases.every((testCase) => testCase.responsePreview));
  assert.match(result.testCases[0].responsePreview.draftTextPreview, /Supportfall/);
  assert.equal(result.responseQualitySummary.totalWithPreview, 2);
  assert.equal(result.responseQualitySummary.goodCount >= 1, true);
  assert.equal(result.responseQualitySummary.averageQualityScore > 0, true);
  assert.doesNotMatch(JSON.stringify(result), /test@example\.com|017600000000|sk-/i);
  assert.doesNotMatch(dbQueries.join('\n'), /\b(widget_leads|email_jobs|webhook_jobs|tickets|conversations)\b/i);
});

test('conversation engine test case run stores knowledge grounding summary when enabled', async () => {
  const { controller, knowledgePreviewCalls } = createController();

  await controller.updateSettings(
    'site-1',
    { previewEnabled: true, compareEnabled: true, responsePreviewEnabled: true, knowledgePreviewEnabled: true },
    { dashboardAuth: {} },
  );
  await controller.createTestCase(
    'site-1',
    { name: 'Support', message: 'Mein VPN funktioniert nicht', expectedIntent: 'support' },
    { dashboardAuth: {} },
  );

  const result = await controller.runTestCases(
    'site-1',
    { includeResponsePreview: true, includeKnowledge: true },
    { dashboardAuth: {} },
  );

  assert.equal(knowledgePreviewCalls.length, 1);
  assert.equal(result.testCases[0].responsePreview.groundingStatus, 'grounded');
  assert.equal(result.testCases[0].responsePreview.usedKnowledgeSources.length, 1);
  assert.equal(result.knowledgeSummary.totalAttempted, 1);
  assert.equal(result.knowledgeSummary.groundedCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /test@example\.com|017600000000|sk-/i);
});

test('conversation engine test case run is blocked when compare flags are disabled', async () => {
  const { controller } = createController();

  await controller.createTestCase(
    'site-1',
    { name: 'Support', message: 'Mein VPN funktioniert nicht' },
    { dashboardAuth: {} },
  );

  await assert.rejects(
    () => controller.runTestCases('site-1', {}, { dashboardAuth: {} }),
    /deaktiviert/,
  );
});
