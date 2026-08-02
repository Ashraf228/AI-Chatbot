import { Injectable } from '@nestjs/common';
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
};

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

function deny(input: {
  decisionCode: WebsiteAnswerRuntimePilotDecisionCode;
  reason: string;
  sanitizedMessage: string;
  runtimeGateDecision?: WebsiteAnswerRuntimeGateResult | null;
  answerEvaluationResult?: WebsiteAnswerEvaluationResult | null;
  warnings?: string[];
  missingEvidence?: string[];
}): WebsiteAnswerRuntimePilotResult {
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
}): WebsiteAnswerRuntimePilotResult {
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
        return deny({
          decisionCode: mapPilotDecisionCode(evaluation.decisionCode),
          reason: evaluation.reason,
          sanitizedMessage: evaluation.sanitizedMessage,
          answerEvaluationResult: evaluation,
          warnings: [...evaluation.warnings],
          missingEvidence: evaluation.missingEvidence,
        });
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
        return deny({
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
        });
      }

      return allow({
        answerText: evaluation.answerText,
        runtimeGateDecision,
        answerEvaluationResult: evaluation,
      });
    } catch {
      return deny({
        decisionCode: 'runtime_pilot_error',
        reason: 'website_answer_runtime_pilot_error',
        sanitizedMessage:
          'Der interne Website-Answer-Runtime-Pilot konnte nicht sicher ausgefuehrt werden.',
        warnings: ['Der interne Website-Answer-Runtime-Pilot wurde ohne Side Effects abgebrochen.'],
      });
    }
  }
}
