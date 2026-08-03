const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateWebsiteAnswerPilotOperatorReadiness,
} = require('../dist/knowledge-sources/website-answer-pilot-operator-readiness.js');
const {
  WebsiteAnswerRuntimePilotService,
} = require('../dist/knowledge-sources/website-answer-runtime-pilot.service.js');

function createObservability(overrides = {}) {
  return {
    runId: 'pilot-run-1',
    internalOnly: true,
    mockOnly: true,
    publicWidgetEnabled: false,
    productionEnabled: false,
    runtimeContext: 'internal_admin_test',
    environment: 'evaluation',
    actorRole: 'operator',
    answerMode: 'mock',
    allowed: true,
    decisionCode: 'allowed_internal_mock_runtime_pilot',
    sanitizedMessage: 'pilot ok',
    gate: {
      evaluated: true,
      allowed: true,
      decisionCode: 'allowed_internal_mock_runtime',
      sanitizedMessage: 'gate ok',
      requiresHumanReview: false,
      missingEvidence: [],
      warnings: [],
    },
    answerEvaluation: {
      evaluated: true,
      answered: true,
      decisionCode: 'answered',
      insufficientEvidence: false,
      sourceAttributionVerified: true,
      retrievalVerified: true,
      missingEvidence: [],
      warnings: [],
    },
    retrieval: {
      verified: true,
      sourceCount: 1,
      usedReadySource: true,
    },
    sourceAttribution: {
      verified: true,
      sourceIds: ['source-1'],
      sources: [
        {
          sourceId: 'source-1',
          sourceUrl: 'https://example.com/faq',
          sourceTitle: 'Website Quelle',
          sourceDomain: 'example.com',
        },
      ],
    },
    boundaries: {
      publicWidgetBlocked: false,
      productionBlocked: false,
      providerLiveBlocked: false,
      externalRagBlocked: true,
      sideEffectsBlocked: true,
      persistenceBlocked: true,
      externalTelemetryBlocked: true,
    },
    denials: {
      active: false,
      decisionCodes: [],
      reasons: [],
    },
    safety: {
      noLiveProviderCalls: true,
      noLiveLlmAnswers: true,
      noLiveEmbeddings: true,
      noRag: true,
      noTicketsEmailsWebhooks: true,
      noApprovalGrants: true,
      noDeploy: true,
      noProductionData: true,
      noCustomerData: true,
      noExternalTelemetry: true,
      noPersistence: true,
      noSecretsInEnvelope: true,
      noRawContentInEnvelope: true,
      noStackTracesInEnvelope: true,
    },
    warnings: [],
    ...overrides,
  };
}

function createEvaluationResult(overrides = {}) {
  return {
    answered: true,
    decisionCode: 'answered',
    reason: 'website_answer_verified_with_mock_adapter',
    sanitizedMessage: 'ok',
    answerText:
      'Interne Mock-Antwort auf "Wann ist geoeffnet?": Die Oeffnungszeiten sind Montag bis Freitag von 09 bis 17 Uhr.',
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
  const evaluation = {
    async evaluateWebsiteAnswer() {
      return overrides.evaluationResult || createEvaluationResult();
    },
  };
  const gate = {
    evaluate() {
      return overrides.gateResult || createGateResult();
    },
  };
  return new WebsiteAnswerRuntimePilotService(evaluation, gate);
}

function createPilotInput(overrides = {}) {
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
    requestId: 'pilot-run-1',
    ...overrides,
  };
}

test('valid internal mock observability maps to internal operator review readiness only', () => {
  const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(createObservability());

  assert.equal(readiness.operatorReady, true);
  assert.equal(readiness.readinessLevel, 'internal_mock_review_ready');
  assert.equal(readiness.decisionCode, 'internal_mock_review_ready');
  assert.deepEqual(readiness.allowedFor, ['internal_operator_review']);
  assert.deepEqual(readiness.notAllowedFor, [
    'public_widget',
    'production',
    'real_pilot',
    'customer_demo',
    'provider_live',
  ]);
  assert.equal(readiness.internalOnly, true);
  assert.equal(readiness.mockOnly, true);
  assert.equal(readiness.publicWidgetEnabled, false);
  assert.equal(readiness.productionEnabled, false);
  assert.equal(readiness.realPilotEnabled, false);
  assert.equal(readiness.requiredChecks.runtimeGate, true);
  assert.equal(readiness.requiredChecks.answerEvaluation, true);
  assert.equal(readiness.requiredChecks.retrieval, true);
  assert.equal(readiness.requiredChecks.sourceAttribution, true);
  assert.equal(readiness.requiredChecks.noProvider, true);
  assert.equal(readiness.requiredChecks.noLiveAnswer, true);
  assert.equal(readiness.requiredChecks.noRag, true);
  assert.equal(readiness.requiredChecks.noSideEffects, true);
  assert.equal(readiness.requiredChecks.noRawContent, true);
  assert.equal(readiness.requiredChecks.noSecrets, true);
  assert.deepEqual(readiness.missingChecks, []);
  assert.deepEqual(readiness.blockers, []);
});

test('missing runtime gate blocks readiness', () => {
  const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(
    createObservability({
      gate: {
        evaluated: false,
        allowed: false,
        decisionCode: null,
        sanitizedMessage: null,
        requiresHumanReview: null,
        missingEvidence: ['runtime_gate'],
        warnings: [],
      },
    }),
  );

  assert.equal(readiness.operatorReady, false);
  assert.equal(readiness.decisionCode, 'missing_runtime_gate');
  assert.ok(readiness.missingChecks.includes('runtimeGate'));
  assert.ok(readiness.blockers.includes('missing_runtime_gate'));
});

test('missing answer evaluation blocks readiness', () => {
  const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(
    createObservability({
      answerEvaluation: {
        evaluated: false,
        answered: false,
        decisionCode: null,
        insufficientEvidence: false,
        sourceAttributionVerified: false,
        retrievalVerified: false,
        missingEvidence: ['answer_evaluation'],
        warnings: [],
      },
    }),
  );

  assert.equal(readiness.operatorReady, false);
  assert.equal(readiness.decisionCode, 'missing_answer_evaluation');
  assert.ok(readiness.missingChecks.includes('answerEvaluation'));
});

test('missing retrieval and source attribution block readiness', () => {
  const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(
    createObservability({
      answerEvaluation: {
        evaluated: true,
        answered: true,
        decisionCode: 'answered',
        insufficientEvidence: false,
        sourceAttributionVerified: false,
        retrievalVerified: false,
        missingEvidence: ['retrieval_verification', 'source_attribution'],
        warnings: [],
      },
      retrieval: {
        verified: false,
        sourceCount: 0,
        usedReadySource: false,
      },
      sourceAttribution: {
        verified: false,
        sourceIds: [],
        sources: [],
      },
    }),
  );

  assert.equal(readiness.operatorReady, false);
  assert.equal(readiness.decisionCode, 'missing_retrieval_verification');
  assert.ok(readiness.missingChecks.includes('retrieval'));
  assert.ok(readiness.missingChecks.includes('sourceAttribution'));
});

test('public widget, production, provider-live, unknown, cross-tenant, fake attribution, and insufficient evidence remain blocked', () => {
  const cases = [
    [
      'public_widget_context_blocked',
      createObservability({
        runtimeContext: 'public_widget',
        boundaries: { ...createObservability().boundaries, publicWidgetBlocked: true },
      }),
    ],
    [
      'production_live_context_blocked',
      createObservability({
        runtimeContext: 'production_live',
        environment: 'production',
        boundaries: { ...createObservability().boundaries, productionBlocked: true },
      }),
    ],
    [
      'provider_live_mode_blocked',
      createObservability({
        answerMode: 'provider_live',
        denials: {
          active: true,
          decisionCodes: ['live_provider_mode_blocked'],
          reasons: ['provider-live blocked'],
        },
      }),
    ],
    [
      'unknown_context_blocked',
      createObservability({
        runtimeContext: 'unknown',
        denials: {
          active: true,
          decisionCodes: ['unknown_context_blocked'],
          reasons: ['unknown blocked'],
        },
      }),
    ],
    [
      'cross_tenant_blocked',
      createObservability({
        denials: {
          active: true,
          decisionCodes: ['tenant_mismatch'],
          reasons: ['tenant mismatch'],
        },
      }),
    ],
    [
      'fake_source_attribution_blocked',
      createObservability({
        denials: {
          active: true,
          decisionCodes: ['fake_source_attribution'],
          reasons: ['fake attribution'],
        },
      }),
    ],
    [
      'insufficient_evidence',
      createObservability({
        answerEvaluation: {
          evaluated: true,
          answered: false,
          decisionCode: 'insufficient_evidence',
          insufficientEvidence: true,
          sourceAttributionVerified: false,
          retrievalVerified: false,
          missingEvidence: ['answer_evidence'],
          warnings: [],
        },
        denials: {
          active: true,
          decisionCodes: ['insufficient_evidence'],
          reasons: ['insufficient evidence'],
        },
      }),
    ],
  ];

  for (const [expectedCode, observability] of cases) {
    const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(observability);
    assert.equal(readiness.operatorReady, false);
    assert.equal(readiness.decisionCode, expectedCode);
  }
});

test('operator readiness remains sanitized and does not expose raw content, secrets, tokens, passwords, or stack traces', () => {
  const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(
    createObservability({
      warnings: [
        'authorization: [redacted]',
        'internal_error_redacted',
        'cookie: [redacted]',
      ],
      sourceAttribution: {
        verified: true,
        sourceIds: ['source-1'],
        sources: [
          {
            sourceId: 'source-1',
            sourceUrl: 'https://example.com/faq',
            sourceTitle: 'Website Quelle',
            sourceDomain: 'example.com',
          },
        ],
      },
    }),
  );

  const serialized = JSON.stringify(readiness);
  assert.equal(serialized.includes('top-secret'), false);
  assert.equal(serialized.includes('Bearer secret-token'), false);
  assert.equal(serialized.includes('password='), false);
  assert.equal(serialized.includes('apiKey='), false);
  assert.equal(serialized.includes('authorization: super-secret-token'), false);
  assert.equal(serialized.includes('cookie: raw-cookie-value'), false);
  assert.equal(serialized.includes('at Function.module.exports'), false);
});

test('pilot service returns operator readiness without changing runtime safety boundaries or adding side effects', async () => {
  const service = createService();

  const result = await service.evaluatePilot(createPilotInput());

  assert.equal(result.operatorReadiness.operatorReady, true);
  assert.equal(
    result.operatorReadiness.decisionCode,
    'internal_mock_review_ready',
  );
  assert.equal(result.operatorReadiness.safety.noProvider, true);
  assert.equal(result.operatorReadiness.safety.noSideEffects, true);
  assert.equal(result.operatorReadiness.safety.noPersistence, true);
  assert.equal(result.operatorReadiness.safety.noExternalTelemetry, true);
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.liveLlmAnswerUsed, false);
  assert.equal(result.liveEmbeddingsUsed, false);
  assert.equal(result.ragUsed, false);
  assert.equal(result.publicWidgetEnabled, false);
  assert.equal(result.productionEnabled, false);
});
