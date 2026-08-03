import { Injectable } from '@nestjs/common';
import {
  evaluateWebsiteAnswerPilotOperatorReviewChecklist,
  type WebsiteAnswerPilotOperatorReviewChecklist,
} from './website-answer-pilot-operator-review-checklist';
import {
  evaluateWebsiteAnswerPilotOperatorReadiness,
  type WebsiteAnswerPilotOperatorReadiness,
} from './website-answer-pilot-operator-readiness';
import {
  WebsiteAnswerEvaluationResult,
  WebsiteAnswerEvaluationService,
} from './website-answer-evaluation.service';
import {
  WebsiteAnswerRuntimeGateResult,
  WebsiteAnswerRuntimeGateService,
} from './website-answer-runtime-gate.service';

export type WebsiteAnswerRuntimePilotContext =
  | 'internal_admin_test'
  | 'public_widget'
  | 'production_live'
  | 'unknown';

export type WebsiteAnswerRuntimePilotMode = 'mock' | 'provider_live';

export type WebsiteAnswerRuntimePilotInput = {
  tenantId?: string | null;
  siteId?: string | null;
  sourceId?: string | null;
  expectedSourceId?: string | null;
  question?: string | null;
  expectedAnswerHints?: string[] | null;
  expectedUrl?: string | null;
  expectedTitle?: string | null;
  expectedDomain?: string | null;
  runtimeContext?: WebsiteAnswerRuntimePilotContext | null;
  environment?: string | null;
  actorRole?: string | null;
  answerMode?: WebsiteAnswerRuntimePilotMode | null;
  queryEmbedding?: number[] | null;
  requestId?: string | null;
  correlationId?: string | null;
};

export type WebsiteAnswerRuntimePilotDecisionCode =
  | 'allowed_internal_mock_runtime_pilot'
  | 'answer_evaluation_missing'
  | 'retrieval_not_verified'
  | 'source_attribution_not_verified'
  | 'insufficient_evidence'
  | 'source_not_found'
  | 'source_not_ready'
  | 'source_not_indexed'
  | 'source_inactive'
  | 'unsupported_source_type'
  | 'source_scope_mismatch'
  | 'tenant_mismatch'
  | 'site_mismatch'
  | 'question_missing'
  | 'query_embedding_missing'
  | 'mock_mode_required'
  | 'live_provider_mode_blocked'
  | 'public_widget_context_blocked'
  | 'production_live_answer_context_blocked'
  | 'unknown_context_blocked'
  | 'fake_source_attribution'
  | 'runtime_gate_error'
  | 'runtime_pilot_error';

export type WebsiteAnswerRuntimePilotSourceSummary = {
  sourceId: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDomain: string | null;
};

export type WebsiteAnswerRuntimePilotSourceAttribution = {
  verified: boolean;
  retrievalVerified: boolean;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDomain: string | null;
};

export type WebsiteAnswerRuntimePilotObservabilitySource = {
  sourceId: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDomain: string | null;
};

export type WebsiteAnswerRuntimePilotObservability = {
  observabilityVersion: '1';
  runId: string | null;
  internalOnly: true;
  mockOnly: true;
  publicWidgetEnabled: false;
  productionEnabled: false;
  runtimeContext: WebsiteAnswerRuntimePilotContext;
  environment: string | null;
  actorRole: string | null;
  answerMode: WebsiteAnswerRuntimePilotMode | null;
  allowed: boolean;
  decisionCode: WebsiteAnswerRuntimePilotDecisionCode;
  reason: string;
  sanitizedMessage: string;
  gate: {
    evaluated: boolean;
    allowed: boolean;
    decisionCode: WebsiteAnswerRuntimeGateResult['decisionCode'] | null;
    reason: string | null;
    sanitizedMessage: string | null;
    requiresHumanReview: boolean | null;
    missingEvidence: string[];
    warnings: string[];
  };
  answerEvaluation: {
    evaluated: boolean;
    answered: boolean;
    decisionCode: WebsiteAnswerEvaluationResult['decisionCode'] | null;
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
    sources: WebsiteAnswerRuntimePilotObservabilitySource[];
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

export type WebsiteAnswerRuntimePilotResult = {
  allowed: boolean;
  decisionCode: WebsiteAnswerRuntimePilotDecisionCode;
  reason: string;
  sanitizedMessage: string;
  answerText: string | null;
  internalOnly: true;
  publicWidgetEnabled: false;
  productionEnabled: false;
  runtimeGateDecision: WebsiteAnswerRuntimeGateResult | null;
  answerEvaluationResult: WebsiteAnswerEvaluationResult | null;
  sourceAttribution: WebsiteAnswerRuntimePilotSourceAttribution;
  sources: WebsiteAnswerRuntimePilotSourceSummary[];
  warnings: string[];
  missingEvidence: string[];
  providerCallsUsed: false;
  liveLlmAnswerUsed: false;
  liveEmbeddingsUsed: false;
  ragUsed: false;
  observability: WebsiteAnswerRuntimePilotObservability;
  operatorReadiness: WebsiteAnswerPilotOperatorReadiness;
  operatorReviewChecklist: WebsiteAnswerPilotOperatorReviewChecklist;
};

type WebsiteAnswerRuntimePilotBaseResult = Omit<
  WebsiteAnswerRuntimePilotResult,
  'observability' | 'operatorReadiness' | 'operatorReviewChecklist'
>;

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : [];
}

function buildSourceSummary(
  evaluation: WebsiteAnswerEvaluationResult | null,
): WebsiteAnswerRuntimePilotSourceSummary {
  return {
    sourceId: evaluation?.sourceId ?? null,
    sourceUrl: evaluation?.sourceUrl ?? null,
    sourceTitle: evaluation?.sourceTitle ?? null,
    sourceDomain: evaluation?.sourceDomain ?? null,
  };
}

function buildSourceAttribution(
  evaluation: WebsiteAnswerEvaluationResult | null,
): WebsiteAnswerRuntimePilotSourceAttribution {
  return {
    verified: evaluation?.sourceAttributionVerified === true,
    retrievalVerified: evaluation?.retrievalVerified === true,
    sourceId: evaluation?.sourceId ?? null,
    sourceUrl: evaluation?.sourceUrl ?? null,
    sourceTitle: evaluation?.sourceTitle ?? null,
    sourceDomain: evaluation?.sourceDomain ?? null,
  };
}

function sanitizeRunId(value: unknown) {
  const text = asText(value)
    .replace(/[^a-zA-Z0-9._:-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return text || null;
}

function sanitizeObservabilityText(value: unknown) {
  let text = asText(value)
    .replace(/\s+/g, ' ')
    .slice(0, 240);

  if (!text) {
    return '';
  }

  const replacements: Array<[RegExp, string]> = [
    [/\b(authorization|cookie)\s*:\s*[^\s,;]+/gi, '$1: [redacted]'],
    [/\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]'],
    [/\b(bearer)\s+[a-z0-9._-]+/gi, '$1 [redacted]'],
    [/\b(sk|gho|ghp|xoxb|xoxp|xapp)-[a-z0-9._-]+/gi, '[redacted]'],
    [/https?:\/\/[^/\s:@]+:[^@\s]+@/gi, 'https://[redacted]@'],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  if (/ at [^(]+\([^)]*:\d+:\d+\)/.test(text) || /Error:\s/.test(text)) {
    return 'internal_error_redacted';
  }

  return text;
}

function sanitizeObservabilityList(value: string[] | null | undefined, limit = 8) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => sanitizeObservabilityText(entry))
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeSourceUrl(value: unknown) {
  const text = asText(value);
  if (!text) {
    return null;
  }
  try {
    const parsed = new URL(text);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

function sanitizeSourceMetadata(
  source: WebsiteAnswerRuntimePilotSourceSummary,
): WebsiteAnswerRuntimePilotObservabilitySource {
  return {
    sourceId: asText(source.sourceId).slice(0, 120) || null,
    sourceUrl: sanitizeSourceUrl(source.sourceUrl),
    sourceTitle: asText(source.sourceTitle).slice(0, 160) || null,
    sourceDomain: asText(source.sourceDomain).slice(0, 120) || null,
  };
}

function buildObservability(
  input: WebsiteAnswerRuntimePilotInput,
  result: WebsiteAnswerRuntimePilotBaseResult,
): WebsiteAnswerRuntimePilotObservability {
  const gate = result.runtimeGateDecision;
  const evaluation = result.answerEvaluationResult;
  const runtimeContext = input.runtimeContext ?? 'unknown';
  const environment = asText(input.environment) || null;
  const actorRole = asText(input.actorRole).toLowerCase() || null;
  const answerMode = input.answerMode ?? null;
  const sanitizedSources = result.sources.map((source) => sanitizeSourceMetadata(source));
  const denialCodes = [
    result.allowed ? null : result.decisionCode,
    gate && !gate.allowed ? gate.decisionCode : null,
    evaluation && !evaluation.answered ? evaluation.decisionCode : null,
  ].filter((entry): entry is Exclude<typeof entry, null> => Boolean(entry));
  const denialReasons = [
    result.allowed ? null : result.reason,
    gate && !gate.allowed ? gate.reason : null,
    evaluation && !evaluation.answered ? evaluation.reason : null,
  ]
    .map((entry) => sanitizeObservabilityText(entry))
    .filter(Boolean);

  return {
    observabilityVersion: '1',
    runId: sanitizeRunId(input.requestId || input.correlationId),
    internalOnly: true,
    mockOnly: true,
    publicWidgetEnabled: false,
    productionEnabled: false,
    runtimeContext,
    environment,
    actorRole,
    answerMode,
    allowed: result.allowed,
    decisionCode: result.decisionCode,
    reason: sanitizeObservabilityText(result.reason),
    sanitizedMessage: sanitizeObservabilityText(result.sanitizedMessage),
    gate: {
      evaluated: Boolean(gate),
      allowed: gate?.allowed === true,
      decisionCode: gate?.decisionCode ?? null,
      reason: gate ? sanitizeObservabilityText(gate.reason) : null,
      sanitizedMessage: gate ? sanitizeObservabilityText(gate.sanitizedMessage) : null,
      requiresHumanReview: gate?.requiresHumanReview ?? null,
      missingEvidence: gate?.missingEvidence ?? [],
      warnings: sanitizeObservabilityList(gate?.warnings),
    },
    answerEvaluation: {
      evaluated: Boolean(evaluation),
      answered: evaluation?.answered === true,
      decisionCode: evaluation?.decisionCode ?? null,
      insufficientEvidence:
        evaluation?.decisionCode === 'insufficient_evidence' ||
        evaluation?.decisionCode === 'retrieval_empty',
      sourceAttributionVerified: evaluation?.sourceAttributionVerified === true,
      retrievalVerified: evaluation?.retrievalVerified === true,
      missingEvidence: evaluation?.missingEvidence ?? [],
      warnings: sanitizeObservabilityList(evaluation?.warnings),
    },
    retrieval: {
      verified: result.sourceAttribution.retrievalVerified === true,
      sourceCount: sanitizedSources.length,
      usedReadySource:
        evaluation?.sourceActive === true &&
        evaluation?.runtimeReadiness === 'ready' &&
        evaluation?.indexStatus === 'indexed',
    },
    sourceAttribution: {
      verified: result.sourceAttribution.verified === true,
      sourceIds: sanitizedSources
        .map((source) => source.sourceId)
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0),
      sources: sanitizedSources,
    },
    boundaries: {
      publicWidgetBlocked:
        runtimeContext === 'public_widget' ||
        result.decisionCode === 'public_widget_context_blocked' ||
        gate?.decisionCode === 'public_widget_context_blocked',
      productionBlocked:
        runtimeContext === 'production_live' ||
        environment === 'production' ||
        environment === 'live' ||
        result.decisionCode === 'production_live_answer_context_blocked' ||
        gate?.decisionCode === 'production_live_answer_context_blocked',
      providerLiveBlocked:
        answerMode === 'provider_live' ||
        result.decisionCode === 'live_provider_mode_blocked' ||
        gate?.decisionCode === 'live_provider_mode_blocked',
      externalRagBlocked: true,
      sideEffectsBlocked: true,
      persistenceBlocked: true,
      externalTelemetryBlocked: true,
    },
    denials: {
      active: result.allowed !== true,
      decisionCodes: [...new Set(denialCodes)],
      reasons: [...new Set(denialReasons)],
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
    warnings: sanitizeObservabilityList(result.warnings, 12),
  };
}

function withObservability(
  input: WebsiteAnswerRuntimePilotInput,
  result: WebsiteAnswerRuntimePilotBaseResult,
): WebsiteAnswerRuntimePilotResult {
  const observability = buildObservability(input, result);
  const operatorReadiness = evaluateWebsiteAnswerPilotOperatorReadiness(observability);
  return {
    ...result,
    observability,
    operatorReadiness,
    operatorReviewChecklist: evaluateWebsiteAnswerPilotOperatorReviewChecklist({
      readiness: operatorReadiness,
      observability,
    }),
  };
}

function deny(input: {
  decisionCode: WebsiteAnswerRuntimePilotDecisionCode;
  reason: string;
  sanitizedMessage: string;
  runtimeGateDecision?: WebsiteAnswerRuntimeGateResult | null;
  answerEvaluationResult?: WebsiteAnswerEvaluationResult | null;
  warnings?: string[];
  missingEvidence?: string[];
}): WebsiteAnswerRuntimePilotBaseResult {
  const evaluation = input.answerEvaluationResult ?? null;
  return {
    allowed: false,
    decisionCode: input.decisionCode,
    reason: input.reason,
    sanitizedMessage: input.sanitizedMessage,
    answerText: null,
    internalOnly: true,
    publicWidgetEnabled: false,
    productionEnabled: false,
    runtimeGateDecision: input.runtimeGateDecision ?? null,
    answerEvaluationResult: evaluation,
    sourceAttribution: buildSourceAttribution(evaluation),
    sources: evaluation?.sourceId ? [buildSourceSummary(evaluation)] : [],
    warnings: input.warnings ?? [],
    missingEvidence: input.missingEvidence ?? [],
    providerCallsUsed: false,
    liveLlmAnswerUsed: false,
    liveEmbeddingsUsed: false,
    ragUsed: false,
  };
}

function allow(input: {
  answerText: string;
  runtimeGateDecision: WebsiteAnswerRuntimeGateResult;
  answerEvaluationResult: WebsiteAnswerEvaluationResult;
}): WebsiteAnswerRuntimePilotBaseResult {
  return {
    allowed: true,
    decisionCode: 'allowed_internal_mock_runtime_pilot',
    reason: 'website_answer_runtime_pilot_internal_mock_allowed',
    sanitizedMessage:
      'Der interne Website-Answer-Runtime-Pilot wurde im Mock-only-Modus mit verifiziertem Retrieval, Source Attribution und Runtime Gate freigegeben.',
    answerText: input.answerText,
    internalOnly: true,
    publicWidgetEnabled: false,
    productionEnabled: false,
    runtimeGateDecision: input.runtimeGateDecision,
    answerEvaluationResult: input.answerEvaluationResult,
    sourceAttribution: buildSourceAttribution(input.answerEvaluationResult),
    sources: [buildSourceSummary(input.answerEvaluationResult)],
    warnings: [
      ...input.answerEvaluationResult.warnings,
      ...input.runtimeGateDecision.warnings,
    ],
    missingEvidence: [],
    providerCallsUsed: false,
    liveLlmAnswerUsed: false,
    liveEmbeddingsUsed: false,
    ragUsed: false,
  };
}

function mapPilotDecisionCode(
  decisionCode:
    | WebsiteAnswerEvaluationResult['decisionCode']
    | WebsiteAnswerRuntimeGateResult['decisionCode'],
): WebsiteAnswerRuntimePilotDecisionCode {
  if (decisionCode === 'answered') {
    return 'allowed_internal_mock_runtime_pilot';
  }
  return decisionCode as WebsiteAnswerRuntimePilotDecisionCode;
}

function buildMockAnswerText(question: string, contexts: string[]) {
  const normalizedQuestion = asText(question);
  const primaryContext = contexts.find(Boolean) || '';
  if (!primaryContext) {
    return '';
  }
  if (!normalizedQuestion) {
    return `Interne Mock-Antwort: ${primaryContext}`;
  }
  return `Interne Mock-Antwort auf "${normalizedQuestion}": ${primaryContext}`;
}

function requiresGateBoundaryCheck(input: WebsiteAnswerRuntimePilotInput) {
  return (
    input.runtimeContext === 'public_widget' ||
    input.runtimeContext === 'production_live' ||
    input.runtimeContext === 'unknown' ||
    asText(input.environment).toLowerCase() === 'production' ||
    asText(input.environment).toLowerCase() === 'live' ||
    (asText(input.actorRole).toLowerCase() &&
      !['admin', 'operator'].includes(asText(input.actorRole).toLowerCase())) ||
    input.answerMode === 'provider_live'
  );
}

@Injectable()
export class WebsiteAnswerRuntimePilotService {
  constructor(
    private readonly websiteAnswerEvaluation: WebsiteAnswerEvaluationService,
    private readonly websiteAnswerRuntimeGate: WebsiteAnswerRuntimeGateService,
  ) {}

  async evaluatePilot(
    input: WebsiteAnswerRuntimePilotInput,
  ): Promise<WebsiteAnswerRuntimePilotResult> {
    try {
      const question = asText(input.question);
      const evaluation = await this.websiteAnswerEvaluation.evaluateWebsiteAnswer({
        tenantId: input.tenantId,
        siteId: input.siteId,
        sourceId: input.sourceId,
        expectedSourceId: input.expectedSourceId,
        question,
        expectedAnswerHints: asStringList(input.expectedAnswerHints),
        expectedUrl: input.expectedUrl,
        expectedTitle: input.expectedTitle,
        expectedDomain: input.expectedDomain,
        evaluationMode: 'mock',
        queryEmbedding: Array.isArray(input.queryEmbedding)
          ? input.queryEmbedding.filter(
              (entry): entry is number => typeof entry === 'number' && Number.isFinite(entry),
            )
          : null,
        answerAdapter: {
          mode: 'mock',
          label: 'website-answer-runtime-pilot-mock',
          async answer(adapterInput) {
            const joinedContexts = adapterInput.contexts.join('\n').toLowerCase();
            const expectedHints = adapterInput.expectedAnswerHints
              .map((hint) => hint.toLowerCase())
              .filter(Boolean);
            const hintsSatisfied =
              expectedHints.length === 0 ||
              expectedHints.every((hint) => joinedContexts.includes(hint));

            if (!adapterInput.contexts.length || !hintsSatisfied) {
              return {
                decision: 'insufficient_evidence',
                answerText: '',
                usedSourceId: adapterInput.sourceId,
                warnings: hintsSatisfied
                  ? ['Kein belastbarer Mock-Kontext fuer die Website-Antwort verfuegbar.']
                  : ['Die erwarteten Antwort-Hinweise konnten im Mock-Kontext nicht bestaetigt werden.'],
              };
            }

            return {
              decision: 'answered',
              answerText: buildMockAnswerText(question, adapterInput.contexts),
              usedSourceId: adapterInput.sourceId,
              warnings: [],
            };
          },
        },
      });

      if (!evaluation.answered && !requiresGateBoundaryCheck(input)) {
        return withObservability(input, deny({
          decisionCode: mapPilotDecisionCode(evaluation.decisionCode),
          reason: evaluation.reason,
          sanitizedMessage: evaluation.sanitizedMessage,
          answerEvaluationResult: evaluation,
          warnings: [...evaluation.warnings],
          missingEvidence: evaluation.missingEvidence,
        }));
      }

      const runtimeGateDecision = this.websiteAnswerRuntimeGate.evaluate({
        tenantId: input.tenantId,
        siteId: input.siteId,
        sourceId: input.sourceId || input.expectedSourceId,
        sourceType: evaluation.sourceType,
        sourceActive: evaluation.sourceActive,
        runtimeReadiness: evaluation.runtimeReadiness,
        indexStatus: evaluation.indexStatus,
        runtimeContext: input.runtimeContext ?? 'internal_admin_test',
        environment: input.environment ?? 'evaluation',
        actorRole: input.actorRole ?? 'operator',
        answerMode: input.answerMode ?? 'mock',
        answerEvaluation: evaluation,
        requestId: input.requestId || input.correlationId || null,
      });

      if (!runtimeGateDecision.allowed || !evaluation.answered || !evaluation.answerText) {
        return withObservability(input, deny({
          decisionCode: mapPilotDecisionCode(
            runtimeGateDecision.allowed
              ? evaluation.decisionCode
              : runtimeGateDecision.decisionCode,
          ),
          reason: runtimeGateDecision.allowed
            ? evaluation.reason
            : runtimeGateDecision.reason,
          sanitizedMessage: runtimeGateDecision.allowed
            ? evaluation.sanitizedMessage
            : runtimeGateDecision.sanitizedMessage,
          runtimeGateDecision,
          answerEvaluationResult: evaluation,
          warnings: [
            ...evaluation.warnings,
            ...runtimeGateDecision.warnings,
          ],
          missingEvidence: runtimeGateDecision.allowed
            ? evaluation.missingEvidence
            : runtimeGateDecision.missingEvidence,
        }));
      }

      return withObservability(input, allow({
        answerText: evaluation.answerText,
        runtimeGateDecision,
        answerEvaluationResult: evaluation,
      }));
    } catch {
      return withObservability(input, deny({
        decisionCode: 'runtime_pilot_error',
        reason: 'website_answer_runtime_pilot_error',
        sanitizedMessage:
          'Der interne Website-Answer-Runtime-Pilot konnte nicht sicher ausgefuehrt werden.',
        warnings: ['Der interne Website-Answer-Runtime-Pilot wurde ohne Side Effects abgebrochen.'],
      }));
    }
  }
}
