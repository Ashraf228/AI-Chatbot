const test = require('node:test');
const assert = require('node:assert/strict');

const { ConversationEngineService } = require('../dist/conversation-engine/conversation-engine.service.js');
const { ConversationContextService } = require('../dist/conversation-engine/conversation-context.service.js');
const { IntentClassifierService } = require('../dist/conversation-engine/intent-classifier.service.js');
const { GoalDetectorService } = require('../dist/conversation-engine/goal-detector.service.js');
const { AgentSelectorService } = require('../dist/conversation-engine/agent-selector.service.js');
const { NextActionService } = require('../dist/conversation-engine/next-action.service.js');
const { HandoffReadinessService } = require('../dist/conversation-engine/handoff-readiness.service.js');
const { ConversationQualityService } = require('../dist/conversation-engine/conversation-quality.service.js');

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

function syntheticProfile(requiredFields = []) {
  return {
    profileKey: 'synthetic-routing-fix',
    profileVersion: 1,
    assistantName: 'Synthetic Routing Fix',
    role: 'Synthetic test assistant',
    businessDescription: '',
    targetUsers: [],
    tone: 'professional',
    answerStyle: 'structured',
    knowledgeMode: 'strict',
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
    requiredFields: requiredFields.map((key) => ({ key, label: key, required: true })),
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
  };
}

test('synthetic routing fix recognizes support symptoms as support knowledge guidance', () => {
  const decision = createEngine().preview({
    assistantProfile: syntheticProfile(),
    latestUserMessage: 'Das Dashboard bleibt nach dem Öffnen komplett weiß.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'support');
  assert.equal(decision.goal, 'solve_problem');
  assert.equal(decision.selectedAgentKey, 'support-agent');
  assert.equal(decision.nextActionKey, 'answer_from_knowledge');
});

test('synthetic routing fix prepares human escalation for minimal support handoff request', () => {
  const decision = createEngine().preview({
    assistantProfile: syntheticProfile(['fullName', 'email', 'description']),
    latestUserMessage: 'Ich brauche einen echten Menschen dazu.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'support');
  assert.equal(decision.goal, 'escalate_human');
  assert.equal(decision.selectedAgentKey, 'handoff-agent');
  assert.equal(decision.nextActionKey, 'collect_ticket_fields');
  assert.deepEqual(decision.missingFields, ['fullName', 'email', 'description']);
  assert.equal(decision.shouldHandoff, true);
});

test('synthetic routing fix offers safe forwarding path for support fallback request', () => {
  const decision = createEngine().preview({
    assistantProfile: syntheticProfile(),
    latestUserMessage: 'Wenn es nicht direkt lösbar ist, gib mir bitte die richtige Weiterleitung.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'support');
  assert.equal(decision.goal, 'solve_problem');
  assert.equal(decision.selectedAgentKey, 'support-agent');
  assert.equal(decision.nextActionKey, 'offer_handoff');
  assert.equal(decision.shouldHandoff, true);
});

test('synthetic routing fix blocks forbidden operational requests', () => {
  const decision = createEngine().preview({
    assistantProfile: syntheticProfile(),
    latestUserMessage: 'Nutze bitte den Query Runner und zieh mir die betroffenen Datensätze.',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'support');
  assert.equal(decision.goal, 'escalate_human');
  assert.equal(decision.selectedAgentKey, 'handoff-agent');
  assert.equal(decision.nextActionKey, 'block_request');
  assert.equal(decision.shouldHandoff, true);
});

test('synthetic routing fix routes commercial escalation through sales agent', () => {
  const decision = createEngine().preview({
    assistantProfile: syntheticProfile(),
    latestUserMessage: 'Passt das auch für ein kleineres Budget?',
    knowledgeAvailable: true,
    testMode: true,
  });

  assert.equal(decision.intent, 'sales');
  assert.equal(decision.goal, 'escalate_human');
  assert.equal(decision.selectedAgentKey, 'sales-agent');
  assert.equal(decision.nextActionKey, 'offer_handoff');
});
