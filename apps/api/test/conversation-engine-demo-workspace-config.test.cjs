const test = require('node:test');
const assert = require('node:assert/strict');

const { ConversationEngineController } = require('../dist/conversation-engine/conversation-engine.controller.js');
const { ConversationEngineTestCasesService } = require('../dist/conversation-engine/conversation-engine-test-cases.service.js');
const { AssistantProfileResolverService } = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');
const { ConversationEngineCompareService } = require('../dist/conversation-engine/conversation-engine-compare.service.js');
const { ConversationEngineService } = require('../dist/conversation-engine/conversation-engine.service.js');
const { ConversationContextService } = require('../dist/conversation-engine/conversation-context.service.js');
const { IntentClassifierService } = require('../dist/conversation-engine/intent-classifier.service.js');
const { GoalDetectorService } = require('../dist/conversation-engine/goal-detector.service.js');
const { AgentSelectorService } = require('../dist/conversation-engine/agent-selector.service.js');
const { NextActionService } = require('../dist/conversation-engine/next-action.service.js');
const { HandoffReadinessService } = require('../dist/conversation-engine/handoff-readiness.service.js');
const { ConversationQualityService } = require('../dist/conversation-engine/conversation-quality.service.js');
const { ConversationEngineRuntimeService } = require('../dist/conversation-engine/conversation-engine-runtime.service.js');
const { ResponseDraftService } = require('../dist/conversation-engine/response-draft.service.js');

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

function createController(role = 'operator') {
  const moduleStore = {
    'assistant-profile': {
      assistantProfile: {
        profileKey: 'universal-assistant',
        profileVersion: 1,
        assistantName: 'Universal-Assistent',
        role: 'Allgemeiner digitaler Assistent',
        businessDescription: '',
        targetUsers: [],
        tone: 'professional',
        answerStyle: 'structured',
        knowledgeMode: 'flexible',
        enabledTasks: ['answer_questions'],
        enabledAgents: ['knowledge-agent'],
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
        legacySource: 'assistantProfile',
      },
    },
    'conversation-engine-tests': {
      conversationEngine: {
        previewEnabled: true,
        compareEnabled: false,
        responsePreviewEnabled: true,
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
          conversationEngine: { previewEnabled: true },
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
  const compareService = new ConversationEngineCompareService(createEngine());
  const responseDrafts = new ResponseDraftService(new ConversationQualityService());
  const knowledgePreview = {
    async retrieve() {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        snippets: [],
        warnings: [],
        reasons: ['disabled'],
      };
    },
  };

  const testCasesService = new ConversationEngineTestCasesService(
    {
      async query() {
        return { rows: [{ count: '0' }] };
      },
    },
    sitesService,
    siteModulesService,
    resolver,
    compareService,
    knowledgePreview,
    responseDrafts,
  );

  return {
    moduleStore,
    controller: new ConversationEngineController(
      {
        async query() {
          return { rows: [{ count: '0' }] };
        },
      },
      sitesService,
      siteModulesService,
      {
        getAuth() {
          return { role, tenantId: 'tenant-1', actorId: `${role}-1` };
        },
        async assertSiteAccess(_auth, _siteId, options) {
          if (!options.allowedRoles.includes(role)) {
            throw new Error('Forbidden');
          }
        },
      },
      resolver,
      {
        async getDiagnostics() {
          return { assistantProfileDebug: {} };
        },
      },
      createEngine(),
      compareService,
      new ConversationEngineRuntimeService(createEngine(), responseDrafts),
      testCasesService,
      knowledgePreview,
      responseDrafts,
    ),
  };
}

function createResponseRecorder() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name, value);
    },
  };
}

test('demo workspace config endpoint saves only allowed config fields', async () => {
  const { controller, moduleStore } = createController('admin');
  const response = createResponseRecorder();

  const result = await controller.updateDemoWorkspaceConfig(
    'site-1',
    {
      assistantName: 'Persist Demo Agent',
      companyContext: 'Nur interne Demo.',
      assistantRole: 'Demo-Support',
      targetAudience: ['Ops-Team', 'Support-Leads'],
      tone: 'friendly',
      allowedTasks: ['answer_questions', 'prepare_handoff'],
      blockedTasks: ['deploy'],
      handoffAllowed: true,
      ticketAllowed: false,
      requiredFields: ['fullName', 'email'],
      knowledgeSnippets: [{ title: 'forbidden' }],
      extractedPdfText: 'forbidden',
      history: [{ role: 'user', content: 'forbidden' }],
      testMessage: 'forbidden',
    },
    { dashboardAuth: {} },
    response,
  );

  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.saved, true);
  assert.equal(result.hasSavedConfig, true);
  assert.equal(result.savedConfig.assistantName, 'Persist Demo Agent');
  assert.deepEqual(result.savedConfig.targetAudience, ['Ops-Team', 'Support-Leads']);
  assert.deepEqual(result.savedConfig.allowedTasks, ['answer_questions', 'prepare_handoff']);
  assert.equal(result.savedConfig.metadata.updatedByRole, 'admin');
  assert.equal(result.savedConfig.metadata.knowledgePersistenceEnabled, false);
  assert.equal(moduleStore['conversation-engine-tests'].demoWorkspaceConfig.knowledgeSnippets, undefined);
  assert.equal(moduleStore['conversation-engine-tests'].demoWorkspaceConfig.extractedPdfText, undefined);
  assert.equal(moduleStore['conversation-engine-tests'].demoWorkspaceConfig.history, undefined);
});

test('demo workspace config endpoint loads saved config and keeps no-store boundary', async () => {
  const { controller } = createController('operator');
  const saveResponse = createResponseRecorder();
  const loadResponse = createResponseRecorder();

  await controller.updateDemoWorkspaceConfig(
    'site-1',
    {
      assistantName: 'Stored Demo Agent',
      companyContext: 'Persistierter Kontext.',
      assistantRole: 'Stored Role',
      targetAudience: ['Finance'],
      tone: 'consultative',
      allowedTasks: ['answer_questions'],
      blockedTasks: ['deploy'],
      handoffAllowed: false,
      ticketAllowed: true,
      requiredFields: ['fullName'],
    },
    { dashboardAuth: {} },
    saveResponse,
  );

  const result = await controller.getDemoWorkspaceConfig('site-1', { dashboardAuth: {} }, loadResponse);

  assert.equal(loadResponse.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.hasSavedConfig, true);
  assert.equal(result.savedConfig.assistantName, 'Stored Demo Agent');
  assert.equal(result.savedConfig.metadata.updatedByRole, 'operator');
});

test('demo workspace config endpoint delete removes persisted config without touching test cases', async () => {
  const { controller, moduleStore } = createController('admin');
  const response = createResponseRecorder();
  moduleStore['conversation-engine-tests'].testCases = [{ id: 'case-1', message: 'keep', createdAt: 'x', updatedAt: 'x', name: 'Keep' }];

  await controller.updateDemoWorkspaceConfig(
    'site-1',
    { assistantName: 'To Remove' },
    { dashboardAuth: {} },
    createResponseRecorder(),
  );

  const result = await controller.deleteDemoWorkspaceConfig('site-1', { dashboardAuth: {} }, response);

  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.deleted, true);
  assert.equal(result.hadSavedConfig, true);
  assert.equal(result.hasSavedConfig, false);
  assert.equal(result.savedConfig, null);
  assert.equal(moduleStore['conversation-engine-tests'].demoWorkspaceConfig, undefined);
  assert.equal(moduleStore['conversation-engine-tests'].testCases.length, 1);
});

test('demo workspace config endpoint rejects customer access', async () => {
  const { controller } = createController('customer');

  await assert.rejects(
    controller.getDemoWorkspaceConfig('site-1', { dashboardAuth: {} }, createResponseRecorder()),
    /Forbidden/,
  );
});
