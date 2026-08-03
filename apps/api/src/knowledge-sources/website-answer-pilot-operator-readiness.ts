export type WebsiteAnswerPilotOperatorReadinessLevel =
  | 'internal_mock_review_ready'
  | 'needs_attention'
  | 'blocked';

export type WebsiteAnswerPilotOperatorReadinessDecisionCode =
  | 'internal_mock_review_ready'
  | 'internal_mock_review_needs_attention'
  | 'missing_runtime_gate'
  | 'runtime_gate_blocked'
  | 'missing_answer_evaluation'
  | 'answer_evaluation_blocked'
  | 'missing_retrieval_verification'
  | 'missing_source_attribution_verification'
  | 'public_widget_context_blocked'
  | 'production_live_context_blocked'
  | 'provider_live_mode_blocked'
  | 'unknown_context_blocked'
  | 'cross_tenant_blocked'
  | 'fake_source_attribution_blocked'
  | 'insufficient_evidence'
  | 'internal_mock_only_required';

export type WebsiteAnswerPilotOperatorReadinessCheckKey =
  | 'runtimeGate'
  | 'answerEvaluation'
  | 'retrieval'
  | 'sourceAttribution'
  | 'tenantSiteSourceBoundary'
  | 'noProvider'
  | 'noLiveAnswer'
  | 'noRag'
  | 'noSideEffects'
  | 'noRawContent'
  | 'noSecrets';

export type WebsiteAnswerPilotOperatorReviewAudience =
  | 'internal_operator_review'
  | 'public_widget'
  | 'production'
  | 'real_pilot'
  | 'customer_demo'
  | 'provider_live';

export type WebsiteAnswerPilotOperatorReadinessObservabilityInput = {
  runId: string | null;
  internalOnly: true;
  mockOnly: true;
  publicWidgetEnabled: false;
  productionEnabled: false;
  runtimeContext: 'internal_admin_test' | 'public_widget' | 'production_live' | 'unknown';
  environment: string | null;
  actorRole: string | null;
  answerMode: 'mock' | 'provider_live' | null;
  allowed: boolean;
  decisionCode: string;
  sanitizedMessage: string;
  gate: {
    evaluated: boolean;
    allowed: boolean;
    decisionCode: string | null;
    sanitizedMessage: string | null;
    requiresHumanReview: boolean | null;
    missingEvidence: string[];
    warnings: string[];
  };
  answerEvaluation: {
    evaluated: boolean;
    answered: boolean;
    decisionCode: string | null;
    insufficientEvidence: boolean;
    sourceAttributionVerified: boolean;
    retrievalVerified: boolean;
    missingEvidence: string[];
    warnings: string[];
  };
  retrieval: {
    verified: boolean;
    sourceCount: number;
    usedReadySource: boolean;
  };
  sourceAttribution: {
    verified: boolean;
    sourceIds: string[];
    sources: Array<{
      sourceId: string | null;
      sourceUrl: string | null;
      sourceTitle: string | null;
      sourceDomain: string | null;
    }>;
  };
  boundaries: {
    publicWidgetBlocked: boolean;
    productionBlocked: boolean;
    providerLiveBlocked: boolean;
    externalRagBlocked: true;
    sideEffectsBlocked: true;
    persistenceBlocked: true;
    externalTelemetryBlocked: true;
  };
  denials: {
    active: boolean;
    decisionCodes: string[];
    reasons: string[];
  };
  safety: {
    noLiveProviderCalls: true;
    noLiveLlmAnswers: true;
    noLiveEmbeddings: true;
    noRag: true;
    noTicketsEmailsWebhooks: true;
    noApprovalGrants: true;
    noDeploy: true;
    noProductionData: true;
    noCustomerData: true;
    noExternalTelemetry: true;
    noPersistence: true;
    noSecretsInEnvelope: true;
    noRawContentInEnvelope: true;
    noStackTracesInEnvelope: true;
  };
  warnings: string[];
};

export type WebsiteAnswerPilotOperatorReadiness = {
  readinessVersion: '1';
  operatorReady: boolean;
  readinessLevel: WebsiteAnswerPilotOperatorReadinessLevel;
  decisionCode: WebsiteAnswerPilotOperatorReadinessDecisionCode;
  sanitizedMessage: string;
  internalOnly: true;
  mockOnly: true;
  readOnly: true;
  nonPersistent: true;
  publicWidgetEnabled: false;
  productionEnabled: false;
  realPilotEnabled: false;
  allowedFor: ['internal_operator_review'];
  notAllowedFor: [
    'public_widget',
    'production',
    'real_pilot',
    'customer_demo',
    'provider_live',
  ];
  requiredChecks: Record<WebsiteAnswerPilotOperatorReadinessCheckKey, boolean>;
  missingChecks: WebsiteAnswerPilotOperatorReadinessCheckKey[];
  blockers: string[];
  warnings: string[];
  safety: {
    noProvider: true;
    noLiveAnswer: true;
    noLiveEmbeddings: true;
    noRag: true;
    noSideEffects: true;
    noPersistence: true;
    noExternalTelemetry: true;
    noApprovalGrants: true;
    noRawContent: true;
    noSecrets: true;
    noStackTraces: true;
    noCustomerData: true;
    noProductionData: true;
    noDeploy: true;
  };
  evidence: {
    runId: string | null;
    runtimeContext: 'internal_admin_test' | 'public_widget' | 'production_live' | 'unknown';
    environment: string | null;
    actorRole: string | null;
    answerMode: 'mock' | 'provider_live' | null;
    pilotDecisionCode: string;
    gateDecisionCode: string | null;
    answerEvaluationDecisionCode: string | null;
    denialDecisionCodes: string[];
    sourceIds: string[];
    sourceCount: number;
    usedReadySource: boolean;
  };
};

const NOT_ALLOWED_FOR: WebsiteAnswerPilotOperatorReadiness['notAllowedFor'] = [
  'public_widget',
  'production',
  'real_pilot',
  'customer_demo',
  'provider_live',
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function lowerText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function createBaseChecks(
  observability: WebsiteAnswerPilotOperatorReadinessObservabilityInput,
): Record<WebsiteAnswerPilotOperatorReadinessCheckKey, boolean> {
  return {
    runtimeGate: observability.gate.evaluated === true && observability.gate.allowed === true,
    answerEvaluation:
      observability.answerEvaluation.evaluated === true &&
      observability.answerEvaluation.answered === true,
    retrieval:
      observability.answerEvaluation.retrievalVerified === true &&
      observability.retrieval.verified === true &&
      observability.retrieval.usedReadySource === true,
    sourceAttribution:
      observability.answerEvaluation.sourceAttributionVerified === true &&
      observability.sourceAttribution.verified === true &&
      observability.sourceAttribution.sourceIds.length > 0,
    tenantSiteSourceBoundary: !hasCrossTenantDenial(observability),
    noProvider:
      observability.answerMode !== 'provider_live' &&
      !observability.denials.decisionCodes.includes('live_provider_mode_blocked'),
    noLiveAnswer: observability.safety.noLiveLlmAnswers === true,
    noRag: observability.safety.noRag === true,
    noSideEffects:
      observability.boundaries.sideEffectsBlocked === true &&
      observability.boundaries.persistenceBlocked === true &&
      observability.safety.noTicketsEmailsWebhooks === true &&
      observability.safety.noApprovalGrants === true,
    noRawContent: observability.safety.noRawContentInEnvelope === true,
    noSecrets:
      observability.safety.noSecretsInEnvelope === true &&
      observability.safety.noStackTracesInEnvelope === true,
  };
}

function hasCrossTenantDenial(
  observability: WebsiteAnswerPilotOperatorReadinessObservabilityInput,
) {
  return observability.denials.decisionCodes.some((decisionCode) =>
    ['tenant_mismatch', 'site_mismatch', 'source_scope_mismatch'].includes(decisionCode),
  );
}

function hasFakeAttributionDenial(
  observability: WebsiteAnswerPilotOperatorReadinessObservabilityInput,
) {
  return observability.denials.decisionCodes.includes('fake_source_attribution');
}

function detectDecisionCode(
  observability: WebsiteAnswerPilotOperatorReadinessObservabilityInput,
  missingChecks: WebsiteAnswerPilotOperatorReadinessCheckKey[],
): WebsiteAnswerPilotOperatorReadinessDecisionCode {
  if (observability.runtimeContext === 'public_widget') {
    return 'public_widget_context_blocked';
  }
  if (
    observability.runtimeContext === 'production_live' ||
    observability.boundaries.productionBlocked === true
  ) {
    return 'production_live_context_blocked';
  }
  if (
    observability.runtimeContext === 'unknown' ||
    observability.denials.decisionCodes.includes('unknown_context_blocked')
  ) {
    return 'unknown_context_blocked';
  }
  if (
    observability.answerMode === 'provider_live' ||
    observability.denials.decisionCodes.includes('live_provider_mode_blocked')
  ) {
    return 'provider_live_mode_blocked';
  }
  if (!observability.mockOnly) {
    return 'internal_mock_only_required';
  }
  if (hasCrossTenantDenial(observability)) {
    return 'cross_tenant_blocked';
  }
  if (hasFakeAttributionDenial(observability)) {
    return 'fake_source_attribution_blocked';
  }
  if (!observability.gate.evaluated) {
    return 'missing_runtime_gate';
  }
  if (!observability.gate.allowed) {
    return 'runtime_gate_blocked';
  }
  if (!observability.answerEvaluation.evaluated) {
    return 'missing_answer_evaluation';
  }
  if (!observability.answerEvaluation.answered) {
    return observability.answerEvaluation.insufficientEvidence
      ? 'insufficient_evidence'
      : 'answer_evaluation_blocked';
  }
  if (!observability.retrieval.verified || !observability.retrieval.usedReadySource) {
    return observability.answerEvaluation.insufficientEvidence
      ? 'insufficient_evidence'
      : 'missing_retrieval_verification';
  }
  if (
    !observability.sourceAttribution.verified ||
    observability.sourceAttribution.sourceIds.length === 0
  ) {
    return observability.answerEvaluation.insufficientEvidence
      ? 'insufficient_evidence'
      : 'missing_source_attribution_verification';
  }
  if (missingChecks.length > 0) {
    return 'internal_mock_review_needs_attention';
  }
  return observability.warnings.length > 0 || observability.gate.requiresHumanReview === true
    ? 'internal_mock_review_needs_attention'
    : 'internal_mock_review_ready';
}

function buildSanitizedMessage(
  decisionCode: WebsiteAnswerPilotOperatorReadinessDecisionCode,
  observability: WebsiteAnswerPilotOperatorReadinessObservabilityInput,
): string {
  switch (decisionCode) {
    case 'internal_mock_review_ready':
      return 'Der mock-only Website-Answer-Pilot ist ausschliesslich fuer die interne Operator-Pruefung bereit.';
    case 'internal_mock_review_needs_attention':
      return 'Der mock-only Website-Answer-Pilot ist intern pruefbar, erfordert aber vor der Operator-Pruefung Aufmerksamkeit auf Warnungen oder fehlende Evidenz.';
    case 'public_widget_context_blocked':
      return 'Die Operator-Readiness blockiert Public-Widget-Kontexte weiterhin vollstaendig.';
    case 'production_live_context_blocked':
      return 'Die Operator-Readiness blockiert Production- und Live-Kontexte weiterhin vollstaendig.';
    case 'provider_live_mode_blocked':
      return 'Die Operator-Readiness erlaubt keine Live-Provider-Modi und bleibt ausschliesslich mock-only.';
    case 'unknown_context_blocked':
      return 'Die Operator-Readiness blockiert unbekannte oder nicht explizit interne Kontexte.';
    case 'cross_tenant_blocked':
      return 'Die Operator-Readiness blockiert tenant-, site- oder source-uebergreifende Evidenz weiterhin vollstaendig.';
    case 'fake_source_attribution_blocked':
      return 'Die Operator-Readiness blockiert ungueltige oder nicht verifizierte Source Attribution.';
    case 'missing_runtime_gate':
      return 'Die Operator-Readiness verlangt ein erfolgreich ausgewertetes Runtime Gate.';
    case 'runtime_gate_blocked':
      return observability.gate.sanitizedMessage ||
        'Das Runtime Gate blockiert die interne Operator-Readiness.';
    case 'missing_answer_evaluation':
      return 'Die Operator-Readiness verlangt eine erfolgreich ausgefuehrte Answer Evaluation.';
    case 'answer_evaluation_blocked':
      return observability.sanitizedMessage ||
        'Die Answer Evaluation blockiert die interne Operator-Readiness.';
    case 'missing_retrieval_verification':
      return 'Die Operator-Readiness verlangt verifiziertes Retrieval aus einer ready/indexed Quelle.';
    case 'missing_source_attribution_verification':
      return 'Die Operator-Readiness verlangt verifizierte Source Attribution ohne Raw Content.';
    case 'insufficient_evidence':
      return 'Die Operator-Readiness bleibt blockiert, weil die vorhandene Evidenz fuer eine interne Mock-Pruefung nicht ausreicht.';
    case 'internal_mock_only_required':
    default:
      return 'Die Operator-Readiness bleibt auf einen internen, read-only und mock-only Pfad begrenzt.';
  }
}

export function evaluateWebsiteAnswerPilotOperatorReadiness(
  observability: WebsiteAnswerPilotOperatorReadinessObservabilityInput,
): WebsiteAnswerPilotOperatorReadiness {
  const requiredChecks = createBaseChecks(observability);
  const missingChecks = (Object.entries(requiredChecks) as Array<
    [WebsiteAnswerPilotOperatorReadinessCheckKey, boolean]
  >)
    .filter(([, passed]) => passed !== true)
    .map(([key]) => key);

  const blockers = unique([
    observability.runtimeContext === 'public_widget' ? 'public_widget_context_blocked' : '',
    observability.runtimeContext === 'production_live' ||
    observability.boundaries.productionBlocked === true
      ? 'production_live_context_blocked'
      : '',
    observability.runtimeContext === 'unknown' ||
    observability.denials.decisionCodes.includes('unknown_context_blocked')
      ? 'unknown_context_blocked'
      : '',
    observability.answerMode === 'provider_live' ||
    observability.denials.decisionCodes.includes('live_provider_mode_blocked')
      ? 'provider_live_mode_blocked'
      : '',
    hasCrossTenantDenial(observability) ? 'cross_tenant_blocked' : '',
    hasFakeAttributionDenial(observability) ? 'fake_source_attribution_blocked' : '',
    !observability.gate.evaluated ? 'missing_runtime_gate' : '',
    observability.gate.evaluated && !observability.gate.allowed ? 'runtime_gate_blocked' : '',
    !observability.answerEvaluation.evaluated ? 'missing_answer_evaluation' : '',
    observability.answerEvaluation.evaluated &&
    !observability.answerEvaluation.answered &&
    observability.answerEvaluation.insufficientEvidence !== true
      ? 'answer_evaluation_blocked'
      : '',
    observability.answerEvaluation.insufficientEvidence === true ||
    observability.retrieval.sourceCount < 1
      ? 'insufficient_evidence'
      : '',
    !observability.retrieval.verified || !observability.retrieval.usedReadySource
      ? 'missing_retrieval_verification'
      : '',
    !observability.sourceAttribution.verified ||
    observability.sourceAttribution.sourceIds.length < 1
      ? 'missing_source_attribution_verification'
      : '',
  ]);

  const decisionCode = detectDecisionCode(observability, missingChecks);
  const operatorReady =
    decisionCode === 'internal_mock_review_ready' ||
    decisionCode === 'internal_mock_review_needs_attention';
  const readinessLevel: WebsiteAnswerPilotOperatorReadinessLevel =
    decisionCode === 'internal_mock_review_ready'
      ? 'internal_mock_review_ready'
      : operatorReady
        ? 'needs_attention'
        : 'blocked';

  return {
    readinessVersion: '1',
    operatorReady,
    readinessLevel,
    decisionCode,
    sanitizedMessage: buildSanitizedMessage(decisionCode, observability),
    internalOnly: true,
    mockOnly: true,
    readOnly: true,
    nonPersistent: true,
    publicWidgetEnabled: false,
    productionEnabled: false,
    realPilotEnabled: false,
    allowedFor: ['internal_operator_review'],
    notAllowedFor: NOT_ALLOWED_FOR,
    requiredChecks,
    missingChecks,
    blockers,
    warnings: unique([
      ...observability.gate.warnings,
      ...observability.answerEvaluation.warnings,
      ...observability.warnings,
      observability.gate.requiresHumanReview === true ? 'runtime_gate_requires_human_review' : '',
      lowerText(observability.actorRole) === 'admin' ||
      lowerText(observability.actorRole) === 'operator'
        ? ''
        : 'actor_role_not_internal_operator',
    ]),
    safety: {
      noProvider: true,
      noLiveAnswer: true,
      noLiveEmbeddings: true,
      noRag: true,
      noSideEffects: true,
      noPersistence: true,
      noExternalTelemetry: true,
      noApprovalGrants: true,
      noRawContent: true,
      noSecrets: true,
      noStackTraces: true,
      noCustomerData: true,
      noProductionData: true,
      noDeploy: true,
    },
    evidence: {
      runId: observability.runId,
      runtimeContext: observability.runtimeContext,
      environment: observability.environment,
      actorRole: observability.actorRole,
      answerMode: observability.answerMode,
      pilotDecisionCode: observability.decisionCode,
      gateDecisionCode: observability.gate.decisionCode,
      answerEvaluationDecisionCode: observability.answerEvaluation.decisionCode,
      denialDecisionCodes: unique(observability.denials.decisionCodes),
      sourceIds: unique(observability.sourceAttribution.sourceIds),
      sourceCount: observability.retrieval.sourceCount,
      usedReadySource: observability.retrieval.usedReadySource === true,
    },
  };
}
