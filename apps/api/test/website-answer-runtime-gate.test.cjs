const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WebsiteAnswerRuntimeGateService,
} = require('../dist/knowledge-sources/website-answer-runtime-gate.service.js');

function createEvaluation(overrides = {}) {
  return {
    answered: true,
    decisionCode: 'answered',
    answerText: 'Antwort: Verifizierte Website-Antwort.',
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
    ...overrides,
  };
}

function createInput(overrides = {}) {
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
    answerEvaluation: createEvaluation(),
    ...overrides,
  };
}

function createService() {
  return new WebsiteAnswerRuntimeGateService();
}

test('WebsiteAnswerRuntimeGateService allows only verified internal mock runtime answers', () => {
  const result = createService().evaluate(createInput());

  assert.equal(result.allowed, true);
  assert.equal(result.decisionCode, 'allowed_internal_mock_runtime');
  assert.equal(result.runtimeMode, 'internal_mock_only');
  assert.equal(result.requiresHumanReview, false);
  assert.equal(result.sourceId, 'source-1');
  assert.equal(result.sourceUrl, 'https://example.com/faq');
  assert.equal(result.providerCallsUsed, false);
  assert.equal(result.liveLlmAnswerUsed, false);
  assert.equal(result.liveEmbeddingsUsed, false);
  assert.equal(result.ragUsed, false);
});

test('WebsiteAnswerRuntimeGateService denies missing answer evaluation and missing verification inputs', () => {
  const service = createService();

  const missingEvaluation = service.evaluate(createInput({ answerEvaluation: null }));
  assert.equal(missingEvaluation.allowed, false);
  assert.equal(missingEvaluation.decisionCode, 'answer_evaluation_missing');

  const missingRetrieval = service.evaluate(
    createInput({
      answerEvaluation: createEvaluation({ retrievalVerified: false }),
    }),
  );
  assert.equal(missingRetrieval.allowed, false);
  assert.equal(missingRetrieval.decisionCode, 'retrieval_not_verified');

  const missingAttribution = service.evaluate(
    createInput({
      answerEvaluation: createEvaluation({ sourceAttributionVerified: false }),
    }),
  );
  assert.equal(missingAttribution.allowed, false);
  assert.equal(missingAttribution.decisionCode, 'source_attribution_not_verified');
});

test('WebsiteAnswerRuntimeGateService denies insufficient evidence and fake source attribution results', () => {
  const service = createService();

  const insufficientEvidence = service.evaluate(
    createInput({
      answerEvaluation: createEvaluation({
        answered: false,
        decisionCode: 'insufficient_evidence',
        missingEvidence: ['answer_evidence'],
      }),
    }),
  );
  assert.equal(insufficientEvidence.allowed, false);
  assert.equal(insufficientEvidence.decisionCode, 'insufficient_evidence');

  const fakeSource = service.evaluate(
    createInput({
      answerEvaluation: createEvaluation({
        answered: false,
        decisionCode: 'fake_source_attribution',
        sourceAttributionVerified: false,
        missingEvidence: ['trusted_source_reference'],
      }),
    }),
  );
  assert.equal(fakeSource.allowed, false);
  assert.equal(fakeSource.decisionCode, 'fake_source_attribution');
});

test('WebsiteAnswerRuntimeGateService denies non-ready, non-indexed, inactive and unsupported website sources', () => {
  const service = createService();

  const unsupportedType = service.evaluate(createInput({ sourceType: 'pdf' }));
  assert.equal(unsupportedType.allowed, false);
  assert.equal(unsupportedType.decisionCode, 'unsupported_source_type');

  const inactive = service.evaluate(createInput({ sourceActive: false }));
  assert.equal(inactive.allowed, false);
  assert.equal(inactive.decisionCode, 'source_inactive');

  const notReady = service.evaluate(createInput({ runtimeReadiness: 'blocked' }));
  assert.equal(notReady.allowed, false);
  assert.equal(notReady.decisionCode, 'source_not_ready');

  const notIndexed = service.evaluate(createInput({ indexStatus: 'pending' }));
  assert.equal(notIndexed.allowed, false);
  assert.equal(notIndexed.decisionCode, 'source_not_indexed');
});

test('WebsiteAnswerRuntimeGateService denies cross-tenant, cross-site and cross-source outcomes', () => {
  const service = createService();

  const tenantMismatch = service.evaluate(
    createInput({
      answerEvaluation: createEvaluation({
        answered: false,
        decisionCode: 'tenant_mismatch',
        missingEvidence: ['tenant_match'],
      }),
    }),
  );
  assert.equal(tenantMismatch.allowed, false);
  assert.equal(tenantMismatch.decisionCode, 'tenant_mismatch');

  const siteMismatch = service.evaluate(
    createInput({
      answerEvaluation: createEvaluation({
        answered: false,
        decisionCode: 'site_mismatch',
        missingEvidence: ['site_match'],
      }),
    }),
  );
  assert.equal(siteMismatch.allowed, false);
  assert.equal(siteMismatch.decisionCode, 'site_mismatch');

  const sourceMismatch = service.evaluate(
    createInput({
      sourceId: 'source-requested',
      answerEvaluation: createEvaluation({ sourceId: 'source-evaluated' }),
    }),
  );
  assert.equal(sourceMismatch.allowed, false);
  assert.equal(sourceMismatch.decisionCode, 'source_scope_mismatch');
});

test('WebsiteAnswerRuntimeGateService denies public widget, production/live, unknown context and unknown roles', () => {
  const service = createService();

  const publicWidget = service.evaluate(
    createInput({ runtimeContext: 'public_widget' }),
  );
  assert.equal(publicWidget.allowed, false);
  assert.equal(publicWidget.decisionCode, 'public_widget_context_blocked');

  const production = service.evaluate(
    createInput({ runtimeContext: 'production_live' }),
  );
  assert.equal(production.allowed, false);
  assert.equal(production.decisionCode, 'production_live_answer_context_blocked');

  const liveEnv = service.evaluate(
    createInput({ environment: 'live' }),
  );
  assert.equal(liveEnv.allowed, false);
  assert.equal(liveEnv.decisionCode, 'production_live_answer_context_blocked');

  const unknownContext = service.evaluate(
    createInput({ runtimeContext: 'unknown' }),
  );
  assert.equal(unknownContext.allowed, false);
  assert.equal(unknownContext.decisionCode, 'unknown_context_blocked');

  const unknownRole = service.evaluate(
    createInput({ actorRole: 'viewer' }),
  );
  assert.equal(unknownRole.allowed, false);
  assert.equal(unknownRole.decisionCode, 'unknown_context_blocked');
});

test('WebsiteAnswerRuntimeGateService denies provider-live mode and enforces mock-only operation', () => {
  const service = createService();

  const liveMode = service.evaluate(
    createInput({ answerMode: 'provider_live' }),
  );
  assert.equal(liveMode.allowed, false);
  assert.equal(liveMode.decisionCode, 'live_provider_mode_blocked');

  const missingMode = service.evaluate(
    createInput({ answerMode: null }),
  );
  assert.equal(missingMode.allowed, false);
  assert.equal(missingMode.decisionCode, 'mock_mode_required');
});

test('WebsiteAnswerRuntimeGateService stays side-effect-free for allowed and denied decisions', () => {
  const service = createService();

  const allowed = service.evaluate(createInput());
  const denied = service.evaluate(
    createInput({
      answerEvaluation: createEvaluation({ retrievalVerified: false }),
    }),
  );

  for (const result of [allowed, denied]) {
    assert.equal(result.providerCallsUsed, false);
    assert.equal(result.liveLlmAnswerUsed, false);
    assert.equal(result.liveEmbeddingsUsed, false);
    assert.equal(result.ragUsed, false);
    assert.equal(Array.isArray(result.missingEvidence), true);
    assert.equal(Array.isArray(result.warnings), true);
    assert.doesNotMatch(result.sanitizedMessage, /token|secret|password|api[-_ ]?key/i);
  }
});
