import { Injectable } from '@nestjs/common';
import type { WebsiteAnswerEvaluationResult } from './website-answer-evaluation.service';

export type WebsiteAnswerRuntimeContext =
  | 'internal_admin_test'
  | 'public_widget'
  | 'production_live'
  | 'unknown';

export type WebsiteAnswerRuntimeMode = 'mock' | 'provider_live';

export type WebsiteAnswerRuntimeGateInput = {
  tenantId?: string | null;
  siteId?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  sourceActive?: boolean | null;
  runtimeReadiness?: string | null;
  indexStatus?: string | null;
  runtimeContext?: WebsiteAnswerRuntimeContext | null;
  environment?: string | null;
  actorRole?: string | null;
  answerMode?: WebsiteAnswerRuntimeMode | null;
  answerEvaluation?: WebsiteAnswerEvaluationResult | null;
  now?: string | Date | null;
  requestId?: string | null;
};

export type WebsiteAnswerRuntimeGateDecisionCode =
  | 'allowed_internal_mock_runtime'
  | 'answer_evaluation_missing'
  | 'retrieval_not_verified'
  | 'source_attribution_not_verified'
  | 'insufficient_evidence'
  | 'source_not_ready'
  | 'source_not_indexed'
  | 'source_inactive'
  | 'unsupported_source_type'
  | 'source_scope_mismatch'
  | 'tenant_mismatch'
  | 'site_mismatch'
  | 'public_widget_context_blocked'
  | 'production_live_answer_context_blocked'
  | 'unknown_context_blocked'
  | 'mock_mode_required'
  | 'live_provider_mode_blocked'
  | 'fake_source_attribution'
  | 'runtime_gate_error';

export type WebsiteAnswerRuntimeGateResult = {
  allowed: boolean;
  decisionCode: WebsiteAnswerRuntimeGateDecisionCode;
  reason: string;
  sanitizedMessage: string;
  runtimeMode: 'blocked' | 'internal_mock_only';
  requiresHumanReview: boolean;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDomain: string | null;
  missingEvidence: string[];
  warnings: string[];
  providerCallsUsed: false;
  liveLlmAnswerUsed: false;
  liveEmbeddingsUsed: false;
  ragUsed: false;
};

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function deny(input: {
  decisionCode: WebsiteAnswerRuntimeGateDecisionCode;
  reason: string;
  sanitizedMessage: string;
  requiresHumanReview?: boolean;
  sourceId?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceDomain?: string | null;
  missingEvidence?: string[];
  warnings?: string[];
}): WebsiteAnswerRuntimeGateResult {
  return {
    allowed: false,
    decisionCode: input.decisionCode,
    reason: input.reason,
    sanitizedMessage: input.sanitizedMessage,
    runtimeMode: 'blocked',
    requiresHumanReview: input.requiresHumanReview !== false,
    sourceId: null,
    sourceUrl: null,
    sourceTitle: null,
    sourceDomain: null,
    missingEvidence: input.missingEvidence ?? [],
    warnings: input.warnings ?? [],
    providerCallsUsed: false,
    liveLlmAnswerUsed: false,
    liveEmbeddingsUsed: false,
    ragUsed: false,
  };
}

function allow(input: {
  sourceId?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceDomain?: string | null;
}): WebsiteAnswerRuntimeGateResult {
  return {
    allowed: true,
    decisionCode: 'allowed_internal_mock_runtime',
    reason: 'website_answer_runtime_gate_internal_mock_allowed',
    sanitizedMessage:
      'Die Website-Antwort ist nur im internen Mock-Runtime-Testpfad freigegeben.',
    runtimeMode: 'internal_mock_only',
    requiresHumanReview: false,
    sourceId: input.sourceId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    sourceTitle: input.sourceTitle ?? null,
    sourceDomain: input.sourceDomain ?? null,
    missingEvidence: [],
    warnings: [],
    providerCallsUsed: false,
    liveLlmAnswerUsed: false,
    liveEmbeddingsUsed: false,
    ragUsed: false,
  };
}

function mapEvaluationDenial(
  evaluation: WebsiteAnswerEvaluationResult,
): WebsiteAnswerRuntimeGateResult {
  const base = {
    sourceId: evaluation.sourceId,
    sourceUrl: evaluation.sourceUrl,
    sourceTitle: evaluation.sourceTitle,
    sourceDomain: evaluation.sourceDomain,
    warnings: evaluation.warnings,
  };

  switch (evaluation.decisionCode) {
    case 'fake_source_attribution':
      return deny({
        ...base,
        decisionCode: 'fake_source_attribution',
        reason: 'website_answer_runtime_fake_source_attribution_blocked',
        sanitizedMessage:
          'Die Runtime-Freigabe bleibt blockiert, weil die Quellzuordnung ungueltig ist.',
        missingEvidence: ['trusted_source_reference'],
      });
    case 'source_not_ready':
      return deny({
        ...base,
        decisionCode: 'source_not_ready',
        reason: 'website_answer_runtime_source_not_ready',
        sanitizedMessage:
          'Nur runtime-ready Website-Quellen duerfen im internen Runtime-Pfad verwendet werden.',
        missingEvidence: ['ready_source'],
      });
    case 'source_not_indexed':
      return deny({
        ...base,
        decisionCode: 'source_not_indexed',
        reason: 'website_answer_runtime_source_not_indexed',
        sanitizedMessage:
          'Nur indexierte Website-Quellen duerfen im internen Runtime-Pfad verwendet werden.',
        missingEvidence: ['indexed_source'],
      });
    case 'source_scope_mismatch':
      return deny({
        ...base,
        decisionCode: 'source_scope_mismatch',
        reason: 'website_answer_runtime_source_scope_mismatch',
        sanitizedMessage: 'Die Runtime-Freigabe bleibt streng an die erwartete Quelle gebunden.',
        missingEvidence: ['exact_source_scope'],
      });
    case 'tenant_mismatch':
      return deny({
        ...base,
        decisionCode: 'tenant_mismatch',
        reason: 'website_answer_runtime_tenant_scope_mismatch',
        sanitizedMessage: 'Die Runtime-Freigabe bleibt tenant-gebunden.',
        missingEvidence: ['tenant_match'],
      });
    case 'site_mismatch':
      return deny({
        ...base,
        decisionCode: 'site_mismatch',
        reason: 'website_answer_runtime_site_scope_mismatch',
        sanitizedMessage: 'Die Runtime-Freigabe bleibt site-gebunden.',
        missingEvidence: ['site_match'],
      });
    case 'source_attribution_not_verified':
      return deny({
        ...base,
        decisionCode: 'source_attribution_not_verified',
        reason: 'website_answer_runtime_source_attribution_not_verified',
        sanitizedMessage:
          'Die Runtime-Freigabe bleibt blockiert, solange die Source Attribution nicht verifiziert ist.',
        missingEvidence: ['source_attribution'],
      });
    case 'retrieval_empty':
    case 'insufficient_evidence':
    case 'answer_generation_failed':
      return deny({
        ...base,
        decisionCode: 'insufficient_evidence',
        reason: 'website_answer_runtime_insufficient_evidence',
        sanitizedMessage:
          'Die Runtime-Freigabe bleibt blockiert, solange keine belastbare Antwort-Evidenz vorliegt.',
        missingEvidence: evaluation.missingEvidence.length
          ? evaluation.missingEvidence
          : ['answer_evidence'],
      });
    default:
      return deny({
        ...base,
        decisionCode: 'answer_evaluation_missing',
        reason: 'website_answer_runtime_answer_evaluation_not_allowed',
        sanitizedMessage:
          'Die Runtime-Freigabe bleibt blockiert, weil die interne Answer-Evaluation nicht erfolgreich war.',
        missingEvidence: ['successful_answer_evaluation'],
      });
  }
}

@Injectable()
export class WebsiteAnswerRuntimeGateService {
  evaluate(
    input: WebsiteAnswerRuntimeGateInput,
  ): WebsiteAnswerRuntimeGateResult {
    const tenantId = asText(input.tenantId);
    const siteId = asText(input.siteId);
    const sourceId = asText(input.sourceId);
    const sourceType = asText(input.sourceType);
    const runtimeContext = input.runtimeContext ?? 'unknown';
    const environment = asText(input.environment).toLowerCase();
    const actorRole = asText(input.actorRole).toLowerCase();
    const answerMode = input.answerMode ?? null;
    const evaluation = input.answerEvaluation ?? null;

    if (runtimeContext === 'public_widget') {
      return deny({
        decisionCode: 'public_widget_context_blocked',
        reason: 'website_answer_runtime_public_widget_blocked',
        sanitizedMessage:
          'Website-Antworten bleiben im Public Widget weiterhin blockiert.',
        missingEvidence: ['internal_runtime_context'],
      });
    }

    if (
      runtimeContext === 'production_live' ||
      environment === 'production' ||
      environment === 'live'
    ) {
      return deny({
        decisionCode: 'production_live_answer_context_blocked',
        reason: 'website_answer_runtime_production_context_blocked',
        sanitizedMessage:
          'Website-Antworten bleiben fuer Production- oder Live-Kontexte blockiert.',
        missingEvidence: ['non_production_context'],
      });
    }

    if (runtimeContext !== 'internal_admin_test') {
      return deny({
        decisionCode: 'unknown_context_blocked',
        reason: 'website_answer_runtime_unknown_context_blocked',
        sanitizedMessage:
          'Website-Antworten sind nur im internen Admin-Testkontext freigegeben.',
        missingEvidence: ['known_internal_context'],
      });
    }

    if (actorRole && !['admin', 'operator'].includes(actorRole)) {
      return deny({
        decisionCode: 'unknown_context_blocked',
        reason: 'website_answer_runtime_actor_role_blocked',
        sanitizedMessage:
          'Website-Antworten bleiben auf Admin- oder Operator-Testpfade begrenzt.',
        missingEvidence: ['allowed_actor_role'],
      });
    }

    if (sourceType !== 'url') {
      return deny({
        decisionCode: 'unsupported_source_type',
        reason: 'website_answer_runtime_requires_url_source',
        sanitizedMessage:
          'Der Runtime-Gate-Pfad ist nur fuer Website-/URL-Quellen freigegeben.',
        sourceId: sourceId || evaluation?.sourceId || null,
        sourceUrl: evaluation?.sourceUrl || null,
        sourceTitle: evaluation?.sourceTitle || null,
        sourceDomain: evaluation?.sourceDomain || null,
        missingEvidence: ['url_source'],
      });
    }

    if (input.sourceActive === false) {
      return deny({
        decisionCode: 'source_inactive',
        reason: 'website_answer_runtime_source_inactive',
        sanitizedMessage: 'Die Website-Quelle ist nicht aktiv.',
        sourceId: sourceId || evaluation?.sourceId || null,
        sourceUrl: evaluation?.sourceUrl || null,
        sourceTitle: evaluation?.sourceTitle || null,
        sourceDomain: evaluation?.sourceDomain || null,
        missingEvidence: ['active_source'],
      });
    }

    if (asText(input.runtimeReadiness) !== 'ready') {
      return deny({
        decisionCode: 'source_not_ready',
        reason: 'website_answer_runtime_source_not_ready',
        sanitizedMessage:
          'Nur runtime-ready Website-Quellen duerfen intern im Runtime-Gate passieren.',
        sourceId: sourceId || evaluation?.sourceId || null,
        sourceUrl: evaluation?.sourceUrl || null,
        sourceTitle: evaluation?.sourceTitle || null,
        sourceDomain: evaluation?.sourceDomain || null,
        missingEvidence: ['ready_source'],
      });
    }

    if (asText(input.indexStatus) !== 'indexed') {
      return deny({
        decisionCode: 'source_not_indexed',
        reason: 'website_answer_runtime_source_not_indexed',
        sanitizedMessage:
          'Nur indexierte Website-Quellen duerfen intern im Runtime-Gate passieren.',
        sourceId: sourceId || evaluation?.sourceId || null,
        sourceUrl: evaluation?.sourceUrl || null,
        sourceTitle: evaluation?.sourceTitle || null,
        sourceDomain: evaluation?.sourceDomain || null,
        missingEvidence: ['indexed_source'],
      });
    }

    if (answerMode !== 'mock') {
      return deny({
        decisionCode: answerMode === 'provider_live'
          ? 'live_provider_mode_blocked'
          : 'mock_mode_required',
        reason: 'website_answer_runtime_requires_mock_mode',
        sanitizedMessage:
          'Der Runtime-Gate-Pfad erlaubt ausschliesslich mock-basierte interne Antwortpfade.',
        sourceId: sourceId || evaluation?.sourceId || null,
        sourceUrl: evaluation?.sourceUrl || null,
        sourceTitle: evaluation?.sourceTitle || null,
        sourceDomain: evaluation?.sourceDomain || null,
        missingEvidence: ['mock_runtime_mode'],
      });
    }

    if (!evaluation) {
      return deny({
        decisionCode: 'answer_evaluation_missing',
        reason: 'website_answer_runtime_answer_evaluation_missing',
        sanitizedMessage:
          'Eine erfolgreiche Website-Answer-Evaluation ist Pflicht vor jedem Runtime-Antwortpfad.',
        sourceId: sourceId || null,
        missingEvidence: ['answer_evaluation'],
      });
    }

    if (!tenantId || !siteId) {
      return deny({
        decisionCode: !tenantId ? 'tenant_mismatch' : 'site_mismatch',
        reason: !tenantId
          ? 'website_answer_runtime_tenant_missing'
          : 'website_answer_runtime_site_missing',
        sanitizedMessage:
          'Die Runtime-Freigabe bleibt streng an Tenant- und Site-Kontext gebunden.',
        sourceId: evaluation.sourceId,
        sourceUrl: evaluation.sourceUrl,
        sourceTitle: evaluation.sourceTitle,
        sourceDomain: evaluation.sourceDomain,
        missingEvidence: !tenantId ? ['tenant_match'] : ['site_match'],
      });
    }

    if (!evaluation.answered) {
      return mapEvaluationDenial(evaluation);
    }

    if (evaluation.retrievalVerified !== true) {
      return deny({
        decisionCode: 'retrieval_not_verified',
        reason: 'website_answer_runtime_retrieval_not_verified',
        sanitizedMessage:
          'Ohne verifiziertes Retrieval bleibt die Runtime-Freigabe blockiert.',
        sourceId: evaluation.sourceId,
        sourceUrl: evaluation.sourceUrl,
        sourceTitle: evaluation.sourceTitle,
        sourceDomain: evaluation.sourceDomain,
        missingEvidence: ['retrieval_verification'],
      });
    }

    if (evaluation.sourceAttributionVerified !== true) {
      return deny({
        decisionCode: 'source_attribution_not_verified',
        reason: 'website_answer_runtime_source_attribution_not_verified',
        sanitizedMessage:
          'Ohne verifizierte Source Attribution bleibt die Runtime-Freigabe blockiert.',
        sourceId: evaluation.sourceId,
        sourceUrl: evaluation.sourceUrl,
        sourceTitle: evaluation.sourceTitle,
        sourceDomain: evaluation.sourceDomain,
        missingEvidence: ['source_attribution_verification'],
      });
    }

    if (sourceId && evaluation.sourceId && sourceId !== evaluation.sourceId) {
      return deny({
        decisionCode: 'source_scope_mismatch',
        reason: 'website_answer_runtime_source_scope_mismatch',
        sanitizedMessage:
          'Die Runtime-Freigabe bleibt streng an die evaluierte Website-Quelle gebunden.',
        sourceId: evaluation.sourceId,
        sourceUrl: evaluation.sourceUrl,
        sourceTitle: evaluation.sourceTitle,
        sourceDomain: evaluation.sourceDomain,
        missingEvidence: ['exact_source_scope'],
      });
    }

    return allow({
      sourceId: evaluation.sourceId,
      sourceUrl: evaluation.sourceUrl,
      sourceTitle: evaluation.sourceTitle,
      sourceDomain: evaluation.sourceDomain,
    });
  }
}
