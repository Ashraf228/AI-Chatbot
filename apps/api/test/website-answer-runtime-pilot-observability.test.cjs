const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
    sourceUrl: 'https://example.com/faq?token=should-not-leak',
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
    sourceUrl: 'https://example.com/faq?secret=hidden',
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
      if (typeof overrides.evaluate === 'function') {
        return overrides.evaluate(input);
      }
      return overrides.evaluationResult || createEvaluationResult();
    },
  };
  const gate = {
    evaluate(input) {
      gateCalls.push(input);
      if (typeof overrides.gateEvaluate === 'function') {
        return overrides.gateEvaluate(input);
      }
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
    requestId: 'pilot-run-1',
    correlationId: 'corr-1',
    ...overrides,
  };
}

test('allowed internal mock pilot includes sanitized observability envelope', async () => {
  const { service } = createService({
    evaluationResult: createEvaluationResult({
      answerText: 'API_KEY=abc123 Die Oeffnungszeiten sind Montag bis Freitag von 09 bis 17 Uhr.',
    }),
  });

  const result = await service.evaluatePilot(createInput());

  assert.equal(result.allowed, true);
  assert.equal(result.observability.observabilityVersion, '1');
  assert.equal(result.observability.runId, 'pilot-run-1');
  assert.equal(result.observability.internalOnly, true);
  assert.equal(result.observability.mockOnly, true);
  assert.equal(result.observability.publicWidgetEnabled, false);
  assert.equal(result.observability.productionEnabled, false);
  assert.equal(result.observability.runtimeContext, 'internal_admin_test');
  assert.equal(result.observability.answerMode, 'mock');
  assert.equal(result.observability.allowed, true);
  assert.equal(result.observability.gate.evaluated, true);
  assert.equal(result.observability.gate.allowed, true);
  assert.equal(result.observability.answerEvaluation.evaluated, true);
  assert.equal(result.observability.answerEvaluation.answered, true);
  assert.equal(result.observability.retrieval.verified, true);
  assert.equal(result.observability.retrieval.sourceCount, 1);
  assert.equal(result.observability.retrieval.usedReadySource, true);
  assert.equal(result.observability.sourceAttribution.verified, true);
  assert.deepEqual(result.observability.sourceAttribution.sourceIds, ['source-1']);
  assert.equal(result.observability.boundaries.externalRagBlocked, true);
  assert.equal(result.observability.boundaries.sideEffectsBlocked, true);
  assert.equal(result.observability.safety.noLiveProviderCalls, true);
  assert.equal(result.observability.safety.noExternalTelemetry, true);
  assert.equal(result.observability.safety.noPersistence, true);
});

test('observability does not include raw answer content, raw chunks, or secrets', async () => {
  const { service } = createService({
    evaluationResult: createEvaluationResult({
      answerText: 'Bearer secret-token top-secret opening hours',
      warnings: [
        'authorization: super-secret-token',
        'cookie: raw-cookie-value',
      ],
      sourceUrl: 'https://user:password@example.com/faq?token=abc#frag',
    }),
    gateResult: createGateResult({
      warnings: ['apiKey=secret-key'],
      sourceUrl: 'https://user:password@example.com/faq?secret=abc#frag',
    }),
  });

  const result = await service.evaluatePilot(createInput());
  const serialized = JSON.stringify(result.observability);

  assert.equal(serialized.includes('top-secret opening hours'), false);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal(serialized.includes('super-secret-token'), false);
  assert.equal(serialized.includes('raw-cookie-value'), false);
  assert.equal(serialized.includes('password@example.com'), false);
  assert.equal(serialized.includes('token=abc'), false);
  assert.equal(serialized.includes('Die Oeffnungszeiten sind Montag bis Freitag von 09 bis 17 Uhr.'), false);
  assert.match(serialized, /redacted|internal_error_redacted/i);
  assert.equal(result.answerText.includes('secret-token'), true);
});

test('denied public widget context includes denial observability and no response data leak', async () => {
  const { service } = createService({
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
  assert.equal(result.observability.denials.active, true);
  assert.ok(result.observability.denials.decisionCodes.includes('public_widget_context_blocked'));
  assert.equal(result.observability.boundaries.publicWidgetBlocked, true);
  assert.equal(result.observability.gate.allowed, false);
  assert.equal(result.answerText, null);
});

test('denied production and provider-live contexts remain observable as blocked', async () => {
  const { service } = createService({
    gateEvaluate(input) {
      if (input.answerMode === 'provider_live') {
        return createGateResult({
          allowed: false,
          decisionCode: 'live_provider_mode_blocked',
          reason: 'website_answer_runtime_live_provider_mode_blocked',
          sanitizedMessage: 'provider-live blocked',
          missingEvidence: ['mock_only_answer_mode'],
        });
      }
      return createGateResult({
        allowed: false,
        decisionCode: 'production_live_answer_context_blocked',
        reason: 'website_answer_runtime_production_context_blocked',
        sanitizedMessage: 'production blocked',
        missingEvidence: ['non_production_context'],
      });
    },
  });

  const productionResult = await service.evaluatePilot(
    createInput({ runtimeContext: 'production_live', environment: 'production' }),
  );
  const providerResult = await service.evaluatePilot(
    createInput({ answerMode: 'provider_live' }),
  );

  assert.equal(productionResult.observability.boundaries.productionBlocked, true);
  assert.ok(productionResult.observability.denials.decisionCodes.includes('production_live_answer_context_blocked'));
  assert.equal(productionResult.observability.safety.noLiveProviderCalls, true);
  assert.equal(providerResult.allowed, false);
  assert.equal(providerResult.observability.boundaries.providerLiveBlocked, true);
  assert.ok(providerResult.observability.denials.decisionCodes.includes('live_provider_mode_blocked'));
  assert.equal(providerResult.providerCallsUsed, false);
});

test('insufficient evidence, retrieval gaps, source attribution gaps, fake source attribution, cross-tenant, and unknown context remain observable as denied', async () => {
  const insufficient = await createService({
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
  }).service.evaluatePilot(createInput());

  const retrievalGap = await createService({
    evaluationResult: createEvaluationResult({
      answered: false,
      decisionCode: 'retrieval_not_verified',
      reason: 'website_answer_retrieval_not_verified',
      sanitizedMessage: 'retrieval not verified',
      answerText: null,
      sourceAttributionVerified: false,
      retrievalVerified: false,
      missingEvidence: ['retrieval_verification'],
    }),
  }).service.evaluatePilot(createInput());

  const sourceAttributionGap = await createService({
    evaluationResult: createEvaluationResult({
      answered: false,
      decisionCode: 'source_attribution_not_verified',
      reason: 'website_answer_source_attribution_not_verified',
      sanitizedMessage: 'source attribution not verified',
      answerText: null,
      sourceAttributionVerified: false,
      retrievalVerified: true,
      missingEvidence: ['source_attribution_verification'],
    }),
  }).service.evaluatePilot(createInput());

  const fakeSource = await createService({
    evaluationResult: createEvaluationResult({
      answered: false,
      decisionCode: 'fake_source_attribution',
      reason: 'website_answer_fake_source_attribution',
      sanitizedMessage: 'fake source attribution blocked',
      answerText: null,
      sourceAttributionVerified: false,
      retrievalVerified: true,
      missingEvidence: ['trusted_source_reference'],
    }),
  }).service.evaluatePilot(createInput());

  const crossTenant = await createService({
    evaluationResult: createEvaluationResult({
      answered: false,
      decisionCode: 'tenant_mismatch',
      reason: 'tenant_scope_mismatch',
      sanitizedMessage: 'tenant mismatch',
      answerText: null,
      sourceAttributionVerified: false,
      retrievalVerified: false,
      missingEvidence: ['tenant_match'],
    }),
  }).service.evaluatePilot(createInput());

  const unknownContext = await createService({
    gateResult: createGateResult({
      allowed: false,
      decisionCode: 'unknown_context_blocked',
      reason: 'website_answer_runtime_unknown_context_blocked',
      sanitizedMessage: 'unknown context blocked',
      missingEvidence: ['known_internal_context'],
    }),
  }).service.evaluatePilot(createInput({ runtimeContext: 'unknown' }));

  assert.ok(insufficient.observability.denials.decisionCodes.includes('insufficient_evidence'));
  assert.equal(insufficient.observability.answerEvaluation.insufficientEvidence, true);
  assert.ok(retrievalGap.observability.denials.decisionCodes.includes('retrieval_not_verified'));
  assert.equal(retrievalGap.observability.retrieval.verified, false);
  assert.ok(sourceAttributionGap.observability.denials.decisionCodes.includes('source_attribution_not_verified'));
  assert.equal(sourceAttributionGap.observability.sourceAttribution.verified, false);
  assert.ok(fakeSource.observability.denials.decisionCodes.includes('fake_source_attribution'));
  assert.equal(fakeSource.observability.sourceAttribution.verified, false);
  assert.ok(crossTenant.observability.denials.decisionCodes.includes('tenant_mismatch'));
  assert.ok(unknownContext.observability.denials.decisionCodes.includes('unknown_context_blocked'));
});

test('observability remains side-effect free and contains no persistence or approval grant wiring', async () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/knowledge-sources/website-answer-runtime-pilot.service.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /PrismaService|INSERT INTO|audit_logs|provider_approval_grants|provider_approval_audit_events/);
  assert.doesNotMatch(
    source,
    /segment\.(track|identify)|datadog|sentry\.(capture|init)|posthog|mixpanel|telemetryClient|analyticsClient/i,
  );
  assert.doesNotMatch(source, /email_jobs|webhook_jobs|agent_tickets/);
});
