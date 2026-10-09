const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateWebsiteAnswerPilotOperatorReadiness,
} = require('../dist/knowledge-sources/website-answer-pilot-operator-readiness.js');
const {
  evaluateWebsiteAnswerPilotOperatorReviewChecklist,
} = require('../dist/knowledge-sources/website-answer-pilot-operator-review-checklist.js');

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

function evaluateChecklist(observabilityOverrides = {}) {
  const observability = createObservability(observabilityOverrides);
  const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(observability);
  const checklist = evaluateWebsiteAnswerPilotOperatorReviewChecklist({
    readiness,
    observability,
  });

  return { observability, readiness, checklist };
}

function findItem(checklist, id) {
  return checklist.items.find((item) => item.id === id);
}

test('valid internal operator readiness maps to internal review checklist only', () => {
  const { checklist } = evaluateChecklist();

  assert.equal(checklist.checklistStatus, 'internal_review_ready');
  assert.deepEqual(checklist.allowedFor, ['internal_operator_review']);
  assert.deepEqual(checklist.notAllowedFor, [
    'public_widget',
    'production',
    'real_pilot',
    'customer_demo',
    'provider_live',
  ]);
  assert.equal(checklist.internalOnly, true);
  assert.equal(checklist.mockOnly, true);
  assert.equal(checklist.readOnly, true);
  assert.equal(checklist.nonPersistent, true);
  assert.equal(checklist.publicWidgetEnabled, false);
  assert.equal(checklist.productionEnabled, false);
  assert.equal(checklist.realPilotEnabled, false);
  assert.deepEqual(
    checklist.items.map((item) => item.id),
    [
      'runtime_gate_passed',
      'answer_evaluation_passed',
      'retrieval_verified',
      'source_attribution_verified',
      'tenant_site_source_boundary_verified',
      'operator_readiness_internal_only',
      'public_widget_blocked',
      'production_live_blocked',
      'real_pilot_blocked',
      'customer_demo_blocked',
      'provider_live_blocked',
      'no_live_provider_calls',
      'no_live_llm_answers',
      'no_live_embeddings',
      'no_external_rag',
      'no_side_effects',
      'no_db_writes',
      'no_external_telemetry',
      'no_raw_content',
      'no_secrets',
      'no_approval_grants',
      'completion_unchanged',
      'runtime_readiness_unchanged',
    ],
  );
});

test('missing runtime gate blocks checklist', () => {
  const { checklist } = evaluateChecklist({
    gate: {
      evaluated: false,
      allowed: false,
      decisionCode: null,
      sanitizedMessage: null,
      requiresHumanReview: null,
      missingEvidence: ['runtime_gate'],
      warnings: [],
    },
  });

  assert.equal(checklist.checklistStatus, 'blocked');
  assert.equal(findItem(checklist, 'runtime_gate_passed').status, 'blocked');
  assert.ok(checklist.blockers.includes('runtime_gate_passed'));
});

test('missing answer evaluation blocks checklist', () => {
  const { checklist } = evaluateChecklist({
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
  });

  assert.equal(checklist.checklistStatus, 'blocked');
  assert.equal(findItem(checklist, 'answer_evaluation_passed').status, 'blocked');
});

test('missing retrieval and source attribution block checklist', () => {
  const { checklist } = evaluateChecklist({
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
  });

  assert.equal(checklist.checklistStatus, 'blocked');
  assert.equal(findItem(checklist, 'retrieval_verified').status, 'blocked');
  assert.equal(findItem(checklist, 'source_attribution_verified').status, 'blocked');
});

test('public widget, production, provider-live, unknown, cross-tenant, fake attribution, and insufficient evidence remain blocked', () => {
  const cases = [
    [
      'public_widget',
      {
        runtimeContext: 'public_widget',
        boundaries: {
          ...createObservability().boundaries,
          publicWidgetBlocked: true,
        },
      },
    ],
    [
      'production',
      {
        runtimeContext: 'production_live',
        environment: 'production',
        boundaries: {
          ...createObservability().boundaries,
          productionBlocked: true,
        },
      },
    ],
    [
      'provider_live',
      {
        answerMode: 'provider_live',
        boundaries: {
          ...createObservability().boundaries,
          providerLiveBlocked: true,
        },
        denials: {
          active: true,
          decisionCodes: ['live_provider_mode_blocked'],
          reasons: ['provider-live blocked'],
        },
      },
    ],
    [
      'unknown',
      {
        runtimeContext: 'unknown',
        denials: {
          active: true,
          decisionCodes: ['unknown_context_blocked'],
          reasons: ['unknown blocked'],
        },
      },
    ],
    [
      'cross_tenant',
      {
        denials: {
          active: true,
          decisionCodes: ['tenant_mismatch'],
          reasons: ['tenant mismatch'],
        },
      },
    ],
    [
      'fake_source',
      {
        denials: {
          active: true,
          decisionCodes: ['fake_source_attribution'],
          reasons: ['fake attribution'],
        },
      },
    ],
    [
      'insufficient_evidence',
      {
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
        denials: {
          active: true,
          decisionCodes: ['insufficient_evidence'],
          reasons: ['insufficient evidence'],
        },
      },
    ],
  ];

  for (const [, overrides] of cases) {
    const { checklist } = evaluateChecklist(overrides);
    assert.equal(checklist.checklistStatus, 'blocked');
  }
});

test('missing observability or readiness blocks checklist', () => {
  const checklistWithoutObservability = evaluateWebsiteAnswerPilotOperatorReviewChecklist({
    readiness: null,
    observability: null,
  });
  const readiness = evaluateWebsiteAnswerPilotOperatorReadiness(createObservability());
  const checklistWithoutReadiness = evaluateWebsiteAnswerPilotOperatorReviewChecklist({
    readiness: null,
    observability: createObservability(),
  });

  assert.equal(checklistWithoutObservability.checklistStatus, 'blocked');
  assert.ok(checklistWithoutObservability.blockers.includes('missing_observability'));
  assert.ok(checklistWithoutObservability.blockers.includes('missing_operator_readiness'));
  assert.equal(checklistWithoutReadiness.checklistStatus, 'blocked');
  assert.ok(checklistWithoutReadiness.blockers.includes('missing_operator_readiness'));
  assert.equal(readiness.operatorReady, true);
});

test('checklist remains sanitized and does not expose raw content, secrets, passwords, tokens, or stack traces', () => {
  const { checklist } = evaluateChecklist({
    warnings: [
      'authorization: [redacted]',
      'internal_error_redacted',
      'cookie: [redacted]',
    ],
  });

  const serialized = JSON.stringify(checklist);
  assert.equal(serialized.includes('top-secret'), false);
  assert.equal(serialized.includes('Bearer secret-token'), false);
  assert.equal(serialized.includes('password='), false);
  assert.equal(serialized.includes('apiKey='), false);
  assert.equal(serialized.includes('authorization: super-secret-token'), false);
  assert.equal(serialized.includes('cookie: raw-cookie-value'), false);
  assert.equal(serialized.includes('at Function.module.exports'), false);
  assert.equal(serialized.includes('https://example.com/faq?token='), false);
});
