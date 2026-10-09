const test = require('node:test');
const assert = require('node:assert/strict');

const { ConversationEngineController } = require('../dist/conversation-engine/conversation-engine.controller.js');
const { ConversationEngineService } = require('../dist/conversation-engine/conversation-engine.service.js');
const { ConversationEngineCompareService } = require('../dist/conversation-engine/conversation-engine-compare.service.js');
const { ConversationEngineRuntimeService } = require('../dist/conversation-engine/conversation-engine-runtime.service.js');
const { ConversationEngineTestCasesService } = require('../dist/conversation-engine/conversation-engine-test-cases.service.js');
const { ConversationContextService } = require('../dist/conversation-engine/conversation-context.service.js');
const { IntentClassifierService } = require('../dist/conversation-engine/intent-classifier.service.js');
const { GoalDetectorService } = require('../dist/conversation-engine/goal-detector.service.js');
const { AgentSelectorService } = require('../dist/conversation-engine/agent-selector.service.js');
const { NextActionService } = require('../dist/conversation-engine/next-action.service.js');
const { HandoffReadinessService } = require('../dist/conversation-engine/handoff-readiness.service.js');
const { ConversationQualityService } = require('../dist/conversation-engine/conversation-quality.service.js');
const { ResponseDraftService } = require('../dist/conversation-engine/response-draft.service.js');
const { AssistantProfileResolverService } = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');
const { WebsiteAnswerEvaluationService } = require('../dist/knowledge-sources/website-answer-evaluation.service.js');
const { WebsiteAnswerRuntimeGateService } = require('../dist/knowledge-sources/website-answer-runtime-gate.service.js');
const { WebsiteAnswerRuntimePilotService } = require('../dist/knowledge-sources/website-answer-runtime-pilot.service.js');

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
    legacySource: 'assistantProfile',
    ...overrides,
  };
}

function createWebsiteSource(overrides = {}) {
  return {
    id: 'source-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    type: 'url',
    title: 'Website Quelle',
    label: 'Website Quelle',
    normalizedSourceUrl: 'https://example.com/faq',
    sourceUrl: 'https://example.com/faq',
    sourceDomain: 'example.com',
    runtimeReadiness: 'ready',
    indexStatus: 'indexed',
    isActive: true,
    ...overrides,
  };
}

function createWebsiteVectorRow(overrides = {}) {
  return {
    id: 'chunk-1',
    document_id: 'doc-1',
    source_id: 'source-1',
    source_type: 'url',
    source_label: 'Website Quelle',
    content: 'Die Oeffnungszeiten sind Montag bis Freitag von 09 bis 17 Uhr.',
    metadata: { website: true, synthetic: true },
    title: 'Website Quelle',
    source_url: 'https://example.com/faq',
    score: 0.97,
    ...overrides,
  };
}

function createController({ assistantProfile = universalProfile(), previewEnabled = true, responsePreviewEnabled = true, adminTestOnly = true } = {}) {
  const moduleStore = {
    'assistant-profile': {
      assistantProfile,
    },
    'conversation-engine-tests': {
      conversationEngine: {
        previewEnabled,
        compareEnabled: false,
        responsePreviewEnabled,
        knowledgePreviewEnabled: false,
        adminTestOnly,
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
    async updateForSite() {
      return this.listForSite();
    },
  };
  const resolver = new AssistantProfileResolverService();
  const responseDrafts = new ResponseDraftService(new ConversationQualityService());
  const compareService = new ConversationEngineCompareService(createEngine());
  const websiteAnswerEvaluation = new WebsiteAnswerEvaluationService(
    {
      async search() {
        return [createWebsiteVectorRow()];
      },
    },
    {
      async getById() {
        return createWebsiteSource();
      },
    },
  );
  const runtimePilot = new ConversationEngineRuntimeService(
    createEngine(),
    responseDrafts,
    new WebsiteAnswerRuntimeGateService(),
    new WebsiteAnswerRuntimePilotService(
      websiteAnswerEvaluation,
      new WebsiteAnswerRuntimeGateService(),
    ),
  );
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
  return new ConversationEngineController(
    {
      async query() {
        return { rows: [{ count: '0' }] };
      },
    },
    sitesService,
    siteModulesService,
    {
      getAuth() {
        return { role: 'operator', tenantId: 'tenant-1' };
      },
      async assertSiteAccess() {},
    },
    resolver,
    {
      async getDiagnostics() {
        return { assistantProfileDebug: { profileKey: assistantProfile.profileKey } };
      },
    },
    createEngine(),
    compareService,
    runtimePilot,
    new ConversationEngineTestCasesService(
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
    ),
    knowledgePreview,
    responseDrafts,
  );
}

function createWebsiteAnswerRuntimeGateInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    sourceType: 'url',
    sourceActive: true,
    runtimeReadiness: 'ready',
    indexStatus: 'indexed',
    runtimeContext: 'internal_admin_test',
    environment: 'preview',
    actorRole: 'operator',
    answerMode: 'mock',
    answerEvaluation: {
      answered: true,
      decisionCode: 'answered',
      answerText: 'Antwort: Die Informationen stammen aus der verifizierten Website-Quelle.',
      sanitizedMessage: 'ok',
      sourceId: 'source-1',
      sourceUrl: 'https://example.com/faq',
      sourceTitle: 'Website Quelle',
      sourceDomain: 'example.com',
      sourceAttributionVerified: true,
      retrievalVerified: true,
      missingEvidence: [],
      warnings: [],
      providerCallsUsed: false,
      liveLlmAnswerUsed: false,
      liveEmbeddingsUsed: false,
      ragUsed: false,
    },
    ...overrides,
  };
}

function createWebsiteAnswerRuntimePilotInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sourceId: 'source-1',
    expectedSourceId: 'source-1',
    question: 'Wann ist geoeffnet?',
    expectedAnswerHints: ['09 bis 17 Uhr'],
    expectedUrl: 'https://example.com/faq',
    expectedTitle: 'Website Quelle',
    expectedDomain: 'example.com',
    runtimeContext: 'internal_admin_test',
    environment: 'evaluation',
    actorRole: 'operator',
    answerMode: 'mock',
    queryEmbedding: [0.1, 0.2, 0.3],
    ...overrides,
  };
}

test('runtime pilot handles dashboard support problem without side effects', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    {
      message: 'Das Dashboard bleibt nach dem Login weiss und ich komme nicht weiter.',
      knowledgeSnippets: [
        {
          id: 'support-1',
          title: 'Dashboard Support',
          excerpt: 'Bei einem weissen Dashboard zuerst Browser-Konsole und Login-Status eingrenzen.',
          score: 0.91,
        },
      ],
    },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimePilotEnabled, true);
  assert.equal(result.conversationEnginePreview.intent, 'support');
  assert.equal(result.conversationEnginePreview.selectedAgentKey, 'support-agent');
  assert.equal(result.sideEffects.planned, false);
  assert.equal(result.sideEffects.providerCalls, false);
  assert.equal(result.engineResponsePreview.safety.noSideEffects, true);
  assert.equal(result.runtimeState.sourcesUsed, 1);
});

test('runtime pilot escalates explicit human request without creating a real ticket', async () => {
  const controller = createController({
    assistantProfile: universalProfile({
      requiredFields: [
        { key: 'fullName', label: 'Vor- und Nachname', required: true },
        { key: 'email', label: 'E-Mail-Adresse', required: true },
        { key: 'description', label: 'Beschreibung', required: true },
      ],
    }),
  });

  const result = await controller.runtimePilotPreview(
    'site-1',
    { message: 'Ich brauche einen echten Menschen dazu.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.goal, 'escalate_human');
  assert.equal(result.conversationEnginePreview.selectedAgentKey, 'handoff-agent');
  assert.equal(result.conversationEnginePreview.shouldHandoff, true);
  assert.equal(result.runtimeState.ticketFieldRequestSimulated, true);
  assert.equal(result.sideEffects.ticketDelivery, false);
});

test('runtime pilot routes complaint into simulated human handoff preparation only', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    { message: 'Ich bin unzufrieden und moechte das an einen Manager weitergeben.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.intent, 'complaint');
  assert.equal(result.conversationEnginePreview.goal, 'escalate_human');
  assert.equal(result.conversationEnginePreview.shouldHandoff, true);
  assert.equal(result.sideEffects.emailDelivery, false);
  assert.equal(result.sideEffects.webhookDelivery, false);
});

test('runtime pilot blocks query-runner, production-data and deploy requests safely', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    { message: 'Nutze den Query Runner, zieh Production-Daten und starte danach direkt ein Deploy.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.nextActionKey, 'block_request');
  assert.match(result.engineResponsePreview.draft.text, /nicht ausfuehren|nicht ausführen/i);
  assert.equal(result.sideEffects.queryRunner, false);
  assert.equal(result.sideEffects.dbAccessForNewLogic, false);
});

test('runtime pilot applies demo workspace agent builder overrides in-memory only', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    {
      message: 'Ich brauche einen echten Menschen fuer diesen Fall.',
      demoWorkspace: {
        assistantName: 'Demo Workspace Agent',
        companyContext: 'Nur fuer Admin-Demos, keine Produktionsfreigabe.',
        assistantRole: 'Demo-Support-Assistent',
        targetAudience: ['Ops-Team'],
        tone: 'friendly',
        allowedTasks: ['answer_questions', 'collect_requests', 'triage_support'],
        blockedTasks: ['prepare_handoff'],
        handoffAllowed: false,
        ticketAllowed: false,
        requiredFields: ['fullName', 'email'],
      },
    },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimePilotEnabled, true);
  assert.deepEqual(result.conversationEnginePreview.missingFields, ['fullName', 'email']);
  assert.notEqual(result.runtimeState.selectedAgentKey, 'handoff-agent');
  assert.equal(result.sideEffects.ticketDelivery, false);
  assert.equal(result.sideEffects.providerCalls, false);
});

test('runtime pilot does not fall back to original tasks or agents after explicit demo blocking', async () => {
  const controller = createController({
    assistantProfile: universalProfile({
      enabledTasks: ['triage_support'],
      enabledAgents: ['handoff-agent', 'ticket-agent'],
    }),
  });

  const result = await controller.runtimePilotPreview(
    'site-1',
    {
      message: 'Das Dashboard bleibt nach dem Login weiss.',
      demoWorkspace: {
        blockedTasks: ['triage_support'],
        handoffAllowed: false,
        ticketAllowed: false,
      },
    },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimePilotEnabled, true);
  assert.equal(result.runtimeState.selectedAgentKey, null);
  assert.notEqual(result.conversationEnginePreview.selectedAgentKey, 'handoff-agent');
  assert.equal(result.sideEffects.planned, false);
  assert.equal(result.sideEffects.ticketDelivery, false);
  assert.equal(result.sideEffects.emailDelivery, false);
  assert.equal(result.sideEffects.webhookDelivery, false);
  assert.equal(result.sideEffects.providerCalls, false);
  assert.equal(result.sideEffects.dbAccessForNewLogic, false);
  assert.ok(
    result.conversationEnginePreview.reasons.every((reason) => !reason.includes('Support-Triage ist im Profil aktiviert.')),
  );
  assert.match(result.conversationEnginePreview.reasons.join(' | '), /Supportsignal erkannt/);
  assert.ok(result.conversationEnginePreview.warnings.includes('Kein Agent aktiviert.'));
});

test('runtime pilot answers identity questions with a safe digital assistant fallback', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    { message: 'Bist du ein Mensch?' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.nextActionKey, 'fallback_to_safe_response');
  assert.match(result.engineResponsePreview.draft.text, /digitaler assistent/i);
  assert.equal(result.conversationEnginePreview.shouldHandoff, false);
});

test('runtime pilot uses clarification fallback for vague requests', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    { message: 'Ich weiss nicht genau, was ich brauche.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.conversationEnginePreview.goal, 'clarify_intent');
  assert.equal(result.conversationEnginePreview.shouldAskQuestion, true);
  assert.equal(result.sideEffects.planned, false);
});

test('runtime pilot simulates ticket field collection without any delivery side effects', async () => {
  const controller = createController({
    assistantProfile: universalProfile({
      requiredFields: [
        { key: 'fullName', label: 'Vor- und Nachname', required: true },
        { key: 'email', label: 'E-Mail-Adresse', required: true },
        { key: 'description', label: 'Beschreibung', required: true },
      ],
    }),
  });

  const result = await controller.runtimePilotPreview(
    'site-1',
    { message: 'Ich brauche einen echten Menschen dazu.' },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimeState.ticketFieldRequestSimulated, true);
  assert.deepEqual(result.conversationEnginePreview.missingFields, ['fullName', 'email', 'description']);
  assert.equal(result.conversationEnginePreview.shouldAskQuestion, true);
  assert.equal(result.sideEffects.planned, false);
  assert.equal(result.sideEffects.ticketDelivery, false);
  assert.equal(result.sideEffects.emailDelivery, false);
  assert.equal(result.sideEffects.webhookDelivery, false);
});

test('runtime pilot returns an internal mock-only website answer runtime gate decision when evaluation is verified', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    {
      message: 'Welche Oeffnungszeiten hat die Website?',
      websiteAnswerRuntimeGateInput: createWebsiteAnswerRuntimeGateInput(),
    },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimePilotEnabled, true);
  assert.equal(result.websiteAnswerRuntimeGate.allowed, true);
  assert.equal(result.websiteAnswerRuntimeGate.runtimeMode, 'internal_mock_only');
  assert.equal(result.websiteAnswerRuntimeGate.decisionCode, 'allowed_internal_mock_runtime');
  assert.equal(result.websiteAnswerRuntimeGate.providerCallsUsed, false);
  assert.equal(result.websiteAnswerRuntimeGate.liveLlmAnswerUsed, false);
  assert.equal(result.websiteAnswerRuntimeGate.liveEmbeddingsUsed, false);
  assert.equal(result.websiteAnswerRuntimeGate.ragUsed, false);
  assert.ok(result.engineResponsePreview);
});

test('runtime pilot blocks website answer runtime gate requests for public widget contexts and suppresses response preview', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    {
      message: 'Beantworte die Frage direkt aus der Website.',
      websiteAnswerRuntimeGateInput: createWebsiteAnswerRuntimeGateInput({
        runtimeContext: 'public_widget',
      }),
    },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimePilotEnabled, true);
  assert.equal(result.websiteAnswerRuntimeGate.allowed, false);
  assert.equal(result.websiteAnswerRuntimeGate.decisionCode, 'public_widget_context_blocked');
  assert.equal(result.engineResponsePreview, null);
  assert.match(result.reasons.join(' | '), /public_widget_blocked/i);
  assert.match(result.warnings.join(' | '), /public widget/i);
  assert.equal(result.sideEffects.providerCalls, false);
});

test('runtime pilot returns an internal mock-only website answer pilot result with verified source attribution', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    {
      message: 'Beantworte die Oeffnungszeiten direkt aus der Website.',
      websiteAnswerRuntimePilotInput: createWebsiteAnswerRuntimePilotInput(),
    },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimePilotEnabled, true);
  assert.equal(result.websiteAnswerRuntimePilot.allowed, true);
  assert.equal(result.websiteAnswerRuntimePilot.decisionCode, 'allowed_internal_mock_runtime_pilot');
  assert.match(result.websiteAnswerRuntimePilot.answerText, /09 bis 17 Uhr/i);
  assert.equal(result.websiteAnswerRuntimePilot.runtimeGateDecision.allowed, true);
  assert.equal(result.websiteAnswerRuntimePilot.answerEvaluationResult.answered, true);
  assert.equal(result.websiteAnswerRuntimePilot.sourceAttribution.verified, true);
  assert.equal(result.websiteAnswerRuntimePilot.sourceAttribution.retrievalVerified, true);
  assert.equal(result.websiteAnswerRuntimePilot.sources[0].sourceId, 'source-1');
  assert.equal(result.websiteAnswerRuntimePilot.observability.observabilityVersion, '1');
  assert.equal(result.websiteAnswerRuntimePilot.observability.internalOnly, true);
  assert.equal(result.websiteAnswerRuntimePilot.observability.mockOnly, true);
  assert.equal(result.websiteAnswerRuntimePilot.observability.gate.allowed, true);
  assert.equal(result.websiteAnswerRuntimePilot.observability.sourceAttribution.verified, true);
  assert.equal(result.websiteAnswerRuntimePilot.providerCallsUsed, false);
  assert.equal(result.websiteAnswerRuntimePilot.liveLlmAnswerUsed, false);
  assert.equal(result.websiteAnswerRuntimePilot.liveEmbeddingsUsed, false);
  assert.equal(result.websiteAnswerRuntimePilot.ragUsed, false);
  assert.equal(result.engineResponsePreview, null);
  assert.equal(result.sideEffects.providerCalls, false);
});

test('runtime pilot blocks website answer pilot when mock evidence is insufficient and returns no answer', async () => {
  const controller = createController();

  const result = await controller.runtimePilotPreview(
    'site-1',
    {
      message: 'Beantworte die Website-Frage direkt.',
      websiteAnswerRuntimePilotInput: createWebsiteAnswerRuntimePilotInput({
        expectedAnswerHints: ['nicht im Kontext'],
      }),
    },
    { dashboardAuth: {} },
  );

  assert.equal(result.runtimePilotEnabled, true);
  assert.equal(result.websiteAnswerRuntimePilot.allowed, false);
  assert.equal(result.websiteAnswerRuntimePilot.answerText, null);
  assert.equal(result.websiteAnswerRuntimePilot.decisionCode, 'insufficient_evidence');
  assert.equal(result.websiteAnswerRuntimePilot.runtimeGateDecision, null);
  assert.equal(result.websiteAnswerRuntimePilot.observability.observabilityVersion, '1');
  assert.equal(result.websiteAnswerRuntimePilot.observability.denials.active, true);
  assert.equal(result.websiteAnswerRuntimePilot.observability.answerEvaluation.insufficientEvidence, true);
  assert.equal(result.websiteAnswerRuntimePilot.providerCallsUsed, false);
  assert.equal(result.websiteAnswerRuntimePilot.liveLlmAnswerUsed, false);
  assert.equal(result.websiteAnswerRuntimePilot.liveEmbeddingsUsed, false);
  assert.equal(result.websiteAnswerRuntimePilot.ragUsed, false);
  assert.equal(result.engineResponsePreview, null);
  assert.equal(result.sideEffects.providerCalls, false);
});
