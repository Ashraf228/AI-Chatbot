const test = require('node:test');
const assert = require('node:assert/strict');

const { WebsiteAnswerRuntimePilotService } = require('../dist/knowledge-sources/website-answer-runtime-pilot.service.js');

function createEvaluationResult(overrides = {}) {
  return {
    answered: true,
    decisionCode: 'answered',
    reason: 'website_answer_verified_with_mock_adapter',
    sanitizedMessage: 'ok',
    answerText: 'Interne Mock-Antwort auf "Wann ist geoeffnet?": Die Oeffnungszeiten sind Montag bis Freitag von 09 bis 17 Uhr.',
    sourceType: 'url',
    sourceActive: true,
    runtimeReadiness: 'ready',
    indexStatus: 'indexed',
    sourceAttributionVerified: true,
    retrievalVerified: true,
    sourceId: 'source-1',
    sourceUrl: 'https://example.com/faq',
    sourceTitle: 'Website Quelle',
    sourceDomain: 'example.com',
    missingEvidence: [],
    warnings: [],
    providerCallsUsed: false,
    liveLlmAnswerUsed: false,
    liveEmbeddingsUsed: false,
    ragUsed: false,
    ...overrides,
  };
}

function createGateResult(overrides = {}) {
  return {
    allowed: true,
    decisionCode: 'allowed_internal_mock_runtime',
    reason: 'website_answer_runtime_gate_internal_mock_allowed',
    sanitizedMessage: 'gate ok',
    runtimeMode: 'internal_mock_only',
    requiresHumanReview: false,
    sourceId: 'source-1',
    sourceUrl: 'https://example.com/faq',
    sourceTitle: 'Website Quelle',
    sourceDomain: 'example.com',
    missingEvidence: [],
    warnings: [],
    providerCallsUsed: false,
    liveLlmAnswerUsed: false,
    liveEmbeddingsUsed: false,
    ragUsed: false,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const evaluationCalls = [];
  const gateCalls = [];
  const evaluation = {
    async evaluateWebsiteAnswer(input) {
      evaluationCalls.push(input);
      return overrides.evaluationResult || createEvaluationResult();
    },
  };
  const gate = {
    evaluate(input) {
      gateCalls.push(input);
      return overrides.gateResult || createGateResult();
    },
  };
  return {
    evaluationCalls,
    gateCalls,
    service: new WebsiteAnswerRuntimePilotService(evaluation, gate),
  };
}

function createInput(overrides = {}) {
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

test('WebsiteAnswerRuntimePilotService returns a verified internal mock-only pilot answer', async () => {
  const { service, evaluationCalls, gateCalls } = createService();

  const result = await service.evaluatePilot(createInput());

  assert.equal(result.allowed, true);
  assert.equal(result.decisionCode, 'allowed_internal_mock_runtime_pilot');
  assert.match(result.answerText, /09 bis 17 Uhr/i);
  assert.equal(result.runtimeGateDecision.allowed, true);
  assert.equal(result.answerEvaluationResult.answered, true);
  assert.equal(result.sourceAttribution.verified, true);
  assert.equal(result.sourceAttribution.retrievalVerified, true);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].sourceId, 'source-1');
  assert.equal(result.internalOnly, true);
  assert.equal(result.publicWidgetEnabled, false);
  assert.equal(result.productionEnabled, false);
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.liveLlmAnswerUsed, false);
  assert.equal(result.liveEmbeddingsUsed, false);
  assert.equal(result.ragUsed, false);
  assert.equal(result.operatorReviewChecklist.checklistStatus, 'internal_review_ready');
  assert.deepEqual(result.operatorReviewChecklist.allowedFor, ['internal_operator_review']);
  assert.equal(evaluationCalls.length, 1);
  assert.equal(gateCalls.length, 1);
  assert.equal(gateCalls[0].runtimeContext, 'internal_admin_test');
  assert.equal(gateCalls[0].answerMode, 'mock');
});

test('WebsiteAnswerRuntimePilotService blocks pilot answer when runtime gate denies public widget contexts', async () => {
  const { service, gateCalls } = createService({
    gateResult: createGateResult({
      allowed: false,
      decisionCode: 'public_widget_context_blocked',
      reason: 'website_answer_runtime_public_widget_blocked',
      sanitizedMessage: 'public widget blocked',
      missingEvidence: ['internal_runtime_context'],
    }),
  });

  const result = await service.evaluatePilot(
    createInput({ runtimeContext: 'public_widget' }),
  );

  assert.equal(result.allowed, false);
  assert.equal(result.answerText, null);
  assert.equal(result.decisionCode, 'public_widget_context_blocked');
  assert.equal(result.runtimeGateDecision.allowed, false);
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.liveLlmAnswerUsed, false);
  assert.equal(result.liveEmbeddingsUsed, false);
  assert.equal(result.ragUsed, false);
  assert.equal(gateCalls.length, 1);
});

test('WebsiteAnswerRuntimePilotService blocks pilot answer when evaluation did not verify retrieval or source attribution', async () => {
  const { service } = createService({
    evaluationResult: createEvaluationResult({
      answered: false,
      decisionCode: 'insufficient_evidence',
      reason: 'website_answer_insufficient_evidence',
      sanitizedMessage: 'insufficient evidence',
      answerText: null,
      sourceAttributionVerified: false,
      retrievalVerified: false,
      missingEvidence: ['answer_evidence'],
    }),
    gateResult: createGateResult({
      allowed: false,
      decisionCode: 'insufficient_evidence',
      reason: 'website_answer_runtime_insufficient_evidence',
      sanitizedMessage: 'runtime blocked',
      missingEvidence: ['answer_evidence'],
    }),
  });

  const result = await service.evaluatePilot(createInput());

  assert.equal(result.allowed, false);
  assert.equal(result.answerText, null);
  assert.equal(result.decisionCode, 'insufficient_evidence');
  assert.equal(result.runtimeGateDecision, null);
  assert.equal(result.answerEvaluationResult.answered, false);
  assert.equal(result.sourceAttribution.verified, false);
  assert.equal(result.sourceAttribution.retrievalVerified, false);
});
