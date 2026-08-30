import { Injectable } from '@nestjs/common';
import { KnowledgeSourcesService } from './knowledge-sources.service';
import { VectorSearchRow, VectorService } from '../vector/vector.service';

export type WebsiteAnswerEvaluationMode = 'mock';

export type WebsiteAnswerAdapter = {
  mode: WebsiteAnswerEvaluationMode;
  label: string;
  answer(input: {
    question: string;
    contexts: string[];
    sourceId: string;
    sourceUrl: string;
    sourceTitle: string;
    sourceDomain: string;
    expectedAnswerHints: string[];
  }): Promise<{
    decision: 'answered' | 'insufficient_evidence';
    answerText: string;
    usedSourceId?: string | null;
    warnings?: string[];
  }>;
};

export type WebsiteAnswerEvaluationInput = {
  tenantId?: string | null;
  siteId?: string | null;
  sourceId?: string | null;
  expectedSourceId?: string | null;
  question?: string | null;
  expectedAnswerHints?: string[] | null;
  expectedUrl?: string | null;
  expectedTitle?: string | null;
  expectedDomain?: string | null;
  evaluationMode?: WebsiteAnswerEvaluationMode | null;
  queryEmbedding?: number[] | null;
  answerAdapter?: WebsiteAnswerAdapter | null;
  now?: string | Date | null;
};

export type WebsiteAnswerEvaluationDecisionCode =
  | 'answered'
  | 'source_not_found'
  | 'source_scope_mismatch'
  | 'tenant_mismatch'
  | 'site_mismatch'
  | 'unsupported_source_type'
  | 'source_inactive'
  | 'source_not_ready'
  | 'source_not_indexed'
  | 'question_missing'
  | 'query_embedding_missing'
  | 'adapter_missing'
  | 'mock_adapter_required'
  | 'retrieval_empty'
  | 'source_attribution_not_verified'
  | 'insufficient_evidence'
  | 'fake_source_attribution'
  | 'answer_generation_failed';

export type WebsiteAnswerEvaluationResult = {
  answered: boolean;
  decisionCode: WebsiteAnswerEvaluationDecisionCode;
  reason: string;
  sanitizedMessage: string;
  answerText: string | null;
  sourceType: string | null;
  sourceActive: boolean | null;
  runtimeReadiness: string | null;
  indexStatus: string | null;
  sourceAttributionVerified: boolean;
  retrievalVerified: boolean;
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

type ReadyWebsiteSource = {
  sourceId: string;
  tenantId: string;
  siteId: string;
  sourceType: string;
  title: string;
  sourceUrl: string;
  sourceDomain: string;
  isActive: boolean;
  runtimeReadiness: string;
  indexStatus: string;
};

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanHints(value: string[] | null | undefined) {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : [];
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function sanitizeFailureMessage(_error: unknown, fallback: string) {
  return fallback;
}

function deny(input: {
  decisionCode: WebsiteAnswerEvaluationDecisionCode;
  reason: string;
  sanitizedMessage: string;
  sourceId?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceDomain?: string | null;
  retrievalVerified?: boolean;
  sourceAttributionVerified?: boolean;
  missingEvidence?: string[];
  warnings?: string[];
}): WebsiteAnswerEvaluationResult {
  return {
    answered: false,
    decisionCode: input.decisionCode,
    reason: input.reason,
    sanitizedMessage: input.sanitizedMessage,
    answerText: null,
    sourceType: null,
    sourceActive: null,
    runtimeReadiness: null,
    indexStatus: null,
    sourceAttributionVerified: input.sourceAttributionVerified === true,
    retrievalVerified: input.retrievalVerified === true,
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
  answerText: string;
  sourceId: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceDomain: string;
  warnings?: string[];
}): WebsiteAnswerEvaluationResult {
  return {
    answered: true,
    decisionCode: 'answered',
    reason: 'website_answer_verified_with_mock_adapter',
    sanitizedMessage: 'Die Website-Antwort wurde intern mit Retrieval, Source Attribution und Mock-Answer-Adapter verifiziert.',
    answerText: input.answerText,
    sourceType: 'url',
    sourceActive: true,
    runtimeReadiness: 'ready',
    indexStatus: 'indexed',
    sourceAttributionVerified: true,
    retrievalVerified: true,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    sourceDomain: input.sourceDomain,
    missingEvidence: [],
    warnings: input.warnings ?? [],
    providerCallsUsed: false,
    liveLlmAnswerUsed: false,
    liveEmbeddingsUsed: false,
    ragUsed: false,
  };
}

function isReadySource(source: ReadyWebsiteSource) {
  return source.runtimeReadiness === 'ready' && source.indexStatus === 'indexed';
}

function buildContexts(rows: VectorSearchRow[], sourceId: string) {
  return rows
    .filter((row) => row.source_id === sourceId)
    .map((row) => asText(row.content))
    .filter(Boolean)
    .slice(0, 4);
}

@Injectable()
export class WebsiteAnswerEvaluationService {
  constructor(
    private readonly vector: VectorService,
    private readonly knowledgeSources: KnowledgeSourcesService,
  ) {}

  private resolveTargetSourceId(input: WebsiteAnswerEvaluationInput) {
    const sourceId = asText(input.sourceId);
    const expectedSourceId = asText(input.expectedSourceId);

    if (sourceId && expectedSourceId && sourceId !== expectedSourceId) {
      return {
        error: deny({
          decisionCode: 'source_scope_mismatch',
          reason: 'source_scope_mismatch',
          sanitizedMessage: 'Source Scope muss fuer die Website-Answer-Evaluation exakt sein.',
          missingEvidence: ['exact_source_scope'],
        }),
        sourceId: null,
      };
    }

    const resolved = sourceId || expectedSourceId;
    if (!resolved) {
      return {
        error: deny({
          decisionCode: 'source_not_found',
          reason: 'website_source_missing',
          sanitizedMessage: 'Die Zielquelle fuer die Website-Answer-Evaluation fehlt.',
          missingEvidence: ['source_id'],
        }),
        sourceId: null,
      };
    }

    return { error: null, sourceId: resolved };
  }

  private async loadReadyWebsiteSource(sourceId: string): Promise<ReadyWebsiteSource | null> {
    const source = await this.knowledgeSources.getById(sourceId);
    if (!source) {
      return null;
    }

    return {
      sourceId: source.id,
      tenantId: source.tenantId || '',
      siteId: source.siteId,
      sourceType: source.type,
      title: source.title || source.label || 'Website Quelle',
      sourceUrl: source.normalizedSourceUrl || source.sourceUrl || '',
      sourceDomain: source.sourceDomain || domainFromUrl(source.normalizedSourceUrl || source.sourceUrl || ''),
      isActive: source.isActive !== false,
      runtimeReadiness: source.runtimeReadiness,
      indexStatus: source.indexStatus,
    };
  }

  private evaluatePreconditions(
    source: ReadyWebsiteSource | null,
    input: WebsiteAnswerEvaluationInput,
  ): WebsiteAnswerEvaluationResult | null {
    if (!source) {
      return deny({
        decisionCode: 'source_not_found',
        reason: 'website_source_missing',
        sanitizedMessage: 'Die Zielquelle fuer die Website-Answer-Evaluation wurde nicht gefunden.',
        missingEvidence: ['source_record'],
      });
    }

    if (asText(input.tenantId) !== source.tenantId) {
      return deny({
        decisionCode: 'tenant_mismatch',
        reason: 'tenant_scope_mismatch',
        sanitizedMessage: 'Die Website-Answer-Evaluation bleibt tenant-gebunden.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['tenant_match'],
      });
    }

    if (asText(input.siteId) !== source.siteId) {
      return deny({
        decisionCode: 'site_mismatch',
        reason: 'site_scope_mismatch',
        sanitizedMessage: 'Die Website-Answer-Evaluation bleibt site-gebunden.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['site_match'],
      });
    }

    if (source.sourceType !== 'url') {
      return deny({
        decisionCode: 'unsupported_source_type',
        reason: 'website_answer_evaluation_requires_url_source',
        sanitizedMessage: 'Website-Answer-Evaluation ist nur fuer Website-Quellen freigegeben.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['url_source'],
      });
    }

    if (!source.isActive) {
      return deny({
        decisionCode: 'source_inactive',
        reason: 'website_source_inactive',
        sanitizedMessage: 'Die Website-Quelle ist nicht aktiv.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['active_source'],
      });
    }

    if (!isReadySource(source)) {
      return deny({
        decisionCode: source.indexStatus !== 'indexed' ? 'source_not_indexed' : 'source_not_ready',
        reason: source.indexStatus !== 'indexed' ? 'website_source_not_indexed' : 'website_source_not_ready',
        sanitizedMessage: 'Nur runtime-ready und indexierte Website-Quellen duerfen intern beantwortet werden.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['ready_source'],
      });
    }

    if (!asText(input.question)) {
      return deny({
        decisionCode: 'question_missing',
        reason: 'website_answer_question_missing',
        sanitizedMessage: 'Eine Testfrage ist fuer die Website-Answer-Evaluation erforderlich.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['question'],
      });
    }

    if (!Array.isArray(input.queryEmbedding) || input.queryEmbedding.length === 0) {
      return deny({
        decisionCode: 'query_embedding_missing',
        reason: 'website_answer_query_embedding_missing',
        sanitizedMessage: 'Ein explizites Mock-Query-Embedding ist erforderlich.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['query_embedding'],
      });
    }

    if (input.evaluationMode !== 'mock') {
      return deny({
        decisionCode: 'mock_adapter_required',
        reason: 'website_answer_evaluation_requires_mock_mode',
        sanitizedMessage: 'In diesem Scope ist nur mock-basierte Website-Answer-Evaluation erlaubt.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['mock_mode'],
      });
    }

    if (!input.answerAdapter) {
      return deny({
        decisionCode: 'adapter_missing',
        reason: 'website_answer_adapter_missing',
        sanitizedMessage: 'Ein expliziter Mock-Answer-Adapter ist erforderlich.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['mock_answer_adapter'],
      });
    }

    if (input.answerAdapter.mode !== 'mock') {
      return deny({
        decisionCode: 'mock_adapter_required',
        reason: 'website_answer_evaluation_requires_mock_adapter',
        sanitizedMessage: 'Live- oder providergebundene Answer-Adapter sind in diesem Scope nicht erlaubt.',
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title,
        sourceDomain: source.sourceDomain,
        missingEvidence: ['mock_answer_adapter'],
      });
    }

    return null;
  }

  async evaluateWebsiteAnswer(
    input: WebsiteAnswerEvaluationInput,
  ): Promise<WebsiteAnswerEvaluationResult> {
    const target = this.resolveTargetSourceId(input);
    if (target.error || !target.sourceId) {
      return target.error as WebsiteAnswerEvaluationResult;
    }

    const source = await this.loadReadyWebsiteSource(target.sourceId);
    const preconditionFailure = this.evaluatePreconditions(source, input);
    if (preconditionFailure) {
      return preconditionFailure;
    }

    const readySource = source as ReadyWebsiteSource;

    try {
      const rows = await this.vector.search(
        readySource.tenantId,
        readySource.siteId,
        input.queryEmbedding as number[],
        5,
      );

      if (rows.length === 0) {
        return deny({
          decisionCode: 'retrieval_empty',
          reason: 'website_answer_retrieval_empty',
          sanitizedMessage: 'Ohne Retrieval-Nachweis bleibt die Website-Antwort gesperrt.',
          sourceId: readySource.sourceId,
          sourceUrl: readySource.sourceUrl,
          sourceTitle: readySource.title,
          sourceDomain: readySource.sourceDomain,
          missingEvidence: ['retrieval_hit'],
        });
      }

      const matching = rows.find((row) => row.source_id === readySource.sourceId);
      if (!matching) {
        return deny({
          decisionCode: 'source_attribution_not_verified',
          reason: 'website_answer_source_attribution_not_verified',
          sanitizedMessage: 'Die Retrieval-Treffer belegen die erwartete Website-Quelle nicht.',
          sourceId: readySource.sourceId,
          sourceUrl: readySource.sourceUrl,
          sourceTitle: readySource.title,
          sourceDomain: readySource.sourceDomain,
          retrievalVerified: true,
          missingEvidence: ['source_attribution'],
        });
      }

      const expectedTitle = asText(input.expectedTitle) || readySource.title;
      const expectedUrl = asText(input.expectedUrl) || readySource.sourceUrl;
      const expectedDomain = asText(input.expectedDomain) || readySource.sourceDomain;
      const actualDomain = domainFromUrl(matching.source_url || readySource.sourceUrl);
      const titleMatches =
        !expectedTitle || matching.title === expectedTitle || matching.source_label === expectedTitle;
      const urlMatches = !expectedUrl || matching.source_url === expectedUrl;
      const domainMatches = !expectedDomain || actualDomain === expectedDomain.toLowerCase();

      if (!titleMatches || !urlMatches || !domainMatches) {
        return deny({
          decisionCode: 'source_attribution_not_verified',
          reason: 'website_answer_source_metadata_mismatch',
          sanitizedMessage: 'Die Source Attribution fuer die Website-Antwort ist nicht belastbar verifiziert.',
          sourceId: readySource.sourceId,
          sourceUrl: readySource.sourceUrl,
          sourceTitle: readySource.title,
          sourceDomain: readySource.sourceDomain,
          retrievalVerified: true,
          missingEvidence: ['verified_title_url_domain'],
        });
      }

      const contexts = buildContexts(rows, readySource.sourceId);
      if (contexts.length === 0) {
        return deny({
          decisionCode: 'insufficient_evidence',
          reason: 'website_answer_context_missing',
          sanitizedMessage: 'Ohne belastbaren Website-Kontext bleibt die Antwort blockiert.',
          sourceId: readySource.sourceId,
          sourceUrl: readySource.sourceUrl,
          sourceTitle: readySource.title,
          sourceDomain: readySource.sourceDomain,
          retrievalVerified: true,
          sourceAttributionVerified: true,
          missingEvidence: ['retrieved_context'],
        });
      }

      const adapterResult = await input.answerAdapter!.answer({
        question: asText(input.question),
        contexts,
        sourceId: readySource.sourceId,
        sourceUrl: readySource.sourceUrl,
        sourceTitle: readySource.title,
        sourceDomain: readySource.sourceDomain,
        expectedAnswerHints: cleanHints(input.expectedAnswerHints),
      });

      if (adapterResult.decision !== 'answered') {
        return deny({
          decisionCode: 'insufficient_evidence',
          reason: 'website_answer_insufficient_evidence',
          sanitizedMessage: 'Die Mock-Answer-Evaluation blieb ohne ausreichende Evidenz blockiert.',
          sourceId: readySource.sourceId,
          sourceUrl: readySource.sourceUrl,
          sourceTitle: readySource.title,
          sourceDomain: readySource.sourceDomain,
          retrievalVerified: true,
          sourceAttributionVerified: true,
          missingEvidence: ['answer_evidence'],
          warnings: adapterResult.warnings ?? [],
        });
      }

      if (adapterResult.usedSourceId && adapterResult.usedSourceId !== readySource.sourceId) {
        return deny({
          decisionCode: 'fake_source_attribution',
          reason: 'website_answer_fake_source_attribution',
          sanitizedMessage: 'Die Website-Answer-Evaluation hat eine ungueltige Quellzuordnung erkannt.',
          sourceId: readySource.sourceId,
          sourceUrl: readySource.sourceUrl,
          sourceTitle: readySource.title,
          sourceDomain: readySource.sourceDomain,
          retrievalVerified: true,
          sourceAttributionVerified: false,
          missingEvidence: ['trusted_source_reference'],
        });
      }

      const answerText = asText(adapterResult.answerText);
      if (!answerText) {
        return deny({
          decisionCode: 'insufficient_evidence',
          reason: 'website_answer_empty',
          sanitizedMessage: 'Die Mock-Answer-Evaluation lieferte keine belastbare Antwort.',
          sourceId: readySource.sourceId,
          sourceUrl: readySource.sourceUrl,
          sourceTitle: readySource.title,
          sourceDomain: readySource.sourceDomain,
          retrievalVerified: true,
          sourceAttributionVerified: true,
          missingEvidence: ['answer_text'],
        });
      }

      return allow({
        answerText,
        sourceId: readySource.sourceId,
        sourceUrl: readySource.sourceUrl,
        sourceTitle: readySource.title,
        sourceDomain: readySource.sourceDomain,
        warnings: adapterResult.warnings ?? [],
      });
    } catch (error) {
      return deny({
        decisionCode: 'answer_generation_failed',
        reason: 'website_answer_generation_failed',
        sanitizedMessage: sanitizeFailureMessage(
          error,
          'Die Website-Answer-Evaluation ist fehlgeschlagen.',
        ),
        sourceId: readySource.sourceId,
        sourceUrl: readySource.sourceUrl,
        sourceTitle: readySource.title,
        sourceDomain: readySource.sourceDomain,
      });
    }
  }
}
