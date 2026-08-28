import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { VectorService } from '../vector/vector.service';
import { KnowledgeSourcesService } from './knowledge-sources.service';
import { ProviderApprovalStorageLookupService } from './provider-approval-storage-lookup.service';
import {
  evaluateProviderEmbeddingGate,
  type ProviderEmbeddingActorRole,
  type ProviderEmbeddingDecisionCode,
  type ProviderEmbeddingEnvironment,
  type ProviderEmbeddingUsageContext,
} from './provider-embedding-gate';

type WebsiteChunkRow = {
  chunk_id: string;
  document_id: string;
  title: string | null;
  source_url: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  content_hash: string;
  embedding_vector: string | null;
};

type VerificationRow = {
  id: string;
  document_id: string;
  source_id: string | null;
  source_type: string | null;
  source_label: string | null;
  title: string | null;
  source_url: string | null;
  score: number;
};

export type WebsiteEmbeddingAdapterMode = 'mock';

export type WebsiteEmbeddingAdapter = {
  mode: WebsiteEmbeddingAdapterMode;
  label: string;
  embeddingDimension: number;
  embedText(
    text: string,
    context: {
      sourceId: string;
      tenantId: string;
      siteId: string;
      chunkId?: string;
      chunkIndex?: number;
      chunkCount?: number;
      usageContext: ProviderEmbeddingUsageContext;
      environment: ProviderEmbeddingEnvironment;
      providerKey: string;
      model: string;
      phase: 'index' | 'verification';
    },
  ): Promise<number[]>;
};

export type WebsiteEmbeddingIngestInput = {
  sourceId?: string | null;
  actorRole?: ProviderEmbeddingActorRole | null;
  environment?: ProviderEmbeddingEnvironment | null;
  providerKey?: string | null;
  model?: string | null;
  adapter?: WebsiteEmbeddingAdapter | null;
};

export type WebsiteEmbeddingIngestDecisionCode =
  | 'allowed'
  | 'source_not_found'
  | 'unsupported_source_type'
  | 'source_inactive'
  | 'source_not_extracted'
  | 'source_already_ready'
  | 'source_not_indexable'
  | 'source_chunks_missing'
  | 'adapter_missing'
  | 'mock_adapter_required'
  | 'unsafe_mock_adapter'
  | 'embedding_dimension_invalid'
  | 'embedding_failed'
  | 'retrieval_not_verified'
  | ProviderEmbeddingDecisionCode;

export type WebsiteEmbeddingIngestResult = {
  allowed: boolean;
  decisionCode: WebsiteEmbeddingIngestDecisionCode;
  reason: string;
  sanitizedMessage: string;
  chunksCreated: number;
  embeddingsCreated: number;
  retrievalVerified: boolean;
  sourceAttributionVerified: boolean;
  runtimeReadinessChanged: boolean;
  indexStatusChanged: boolean;
  providerCallsUsed: false;
  embeddingGenerationUsed: boolean;
  readyTransitionAdded: boolean;
};

type LoadedWebsiteSource = {
  sourceId: string;
  tenantId: string;
  siteId: string;
  sourceType: string;
  title: string;
  sourceUrl: string;
  sourceDomain: string;
  ingestStatus: string;
  indexStatus: string;
  runtimeReadiness: string;
  isActive: boolean;
  chunks: Array<{
    id: string;
    documentId: string;
    content: string;
    metadata: Record<string, unknown>;
    contentHash: string;
    embeddingVector: string | null;
  }>;
};

type UpdatedChunkSnapshot = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  contentHash: string;
  embeddingVector: string | null;
};

const SAFE_WEBSITE_EMBEDDING_MOCK_ADAPTERS = new WeakSet<WebsiteEmbeddingAdapter>();
const DEFAULT_MOCK_EMBEDDING_DIMENSION = 6;

function buildDeterministicMockEmbedding(text: string, dimension: number) {
  const chars = Array.from(text)
    .slice(0, dimension)
    .map((char) => char.charCodeAt(0) / 255);

  while (chars.length < dimension) {
    chars.push(0);
  }

  return chars;
}

export function createSafeWebsiteEmbeddingMockAdapter(input?: {
  label?: string;
  embeddingDimension?: number;
}): WebsiteEmbeddingAdapter {
  const embeddingDimension = Number.isInteger(input?.embeddingDimension)
    && (input?.embeddingDimension || 0) > 0
    ? Number(input?.embeddingDimension)
    : DEFAULT_MOCK_EMBEDDING_DIMENSION;

  const adapter: WebsiteEmbeddingAdapter = Object.freeze({
    mode: 'mock',
    label: hasText(input?.label) ? input!.label.trim() : 'website-embedding-safe-mock',
    embeddingDimension,
    async embedText(text: string) {
      return buildDeterministicMockEmbedding(text, embeddingDimension);
    },
  });

  SAFE_WEBSITE_EMBEDDING_MOCK_ADAPTERS.add(adapter);
  return adapter;
}

function deny(
  decisionCode: WebsiteEmbeddingIngestDecisionCode,
  reason: string,
  sanitizedMessage: string,
): WebsiteEmbeddingIngestResult {
  return {
    allowed: false,
    decisionCode,
    reason,
    sanitizedMessage,
    chunksCreated: 0,
    embeddingsCreated: 0,
    retrievalVerified: false,
    sourceAttributionVerified: false,
    runtimeReadinessChanged: false,
    indexStatusChanged: false,
    providerCallsUsed: false,
    embeddingGenerationUsed: false,
    readyTransitionAdded: false,
  };
}

function allow(input: {
  embeddingsCreated: number;
  retrievalVerified: boolean;
  sourceAttributionVerified: boolean;
}): WebsiteEmbeddingIngestResult {
  return {
    allowed: true,
    decisionCode: 'allowed',
    reason: 'website_embedding_ingest_verified_with_mock_embeddings',
    sanitizedMessage: 'Der Website-Embedding-Ingest wurde mit Mock-Embeddings, Storage-Lookup, Policy-Revalidation und Retrieval-Pruefung verifiziert.',
    chunksCreated: 0,
    embeddingsCreated: input.embeddingsCreated,
    retrievalVerified: input.retrievalVerified,
    sourceAttributionVerified: input.sourceAttributionVerified,
    runtimeReadinessChanged: true,
    indexStatusChanged: true,
    providerCallsUsed: false,
    embeddingGenerationUsed: input.embeddingsCreated > 0,
    readyTransitionAdded: true,
  };
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
}

function toPgVectorLiteral(embedding: number[]) {
  return `[${embedding.map((value) => Number(value).toString()).join(',')}]`;
}

function sanitizeFailureMessage(_error: unknown, fallback: string) {
  return fallback;
}

function isSafeWebsiteEmbeddingMockAdapter(adapter: WebsiteEmbeddingAdapter) {
  return SAFE_WEBSITE_EMBEDDING_MOCK_ADAPTERS.has(adapter);
}

function buildVerificationQueryText(source: LoadedWebsiteSource) {
  const firstChunk = source.chunks[0]?.content || '';
  return [source.title, source.sourceDomain, firstChunk.slice(0, 500)]
    .filter((value) => hasText(value))
    .join('\n');
}

@Injectable()
export class WebsiteEmbeddingIngestService {
  constructor(
    private readonly db: PrismaService,
    private readonly vector: VectorService,
    private readonly knowledgeSources: KnowledgeSourcesService,
    private readonly approvalLookup: ProviderApprovalStorageLookupService,
  ) {}

  private async loadWebsiteSource(sourceId: string): Promise<LoadedWebsiteSource | null> {
    const source = await this.knowledgeSources.getById(sourceId);
    if (!source) {
      return null;
    }

    const rows = await this.db.query<WebsiteChunkRow>(
      `SELECT
         c.id AS chunk_id,
         c.document_id,
         d.title,
         COALESCE(ks.source_url, d.source_url) AS source_url,
         c.content,
         c.metadata,
         c.content_hash,
         CASE WHEN c.embedding IS NULL THEN NULL ELSE c.embedding::text END AS embedding_vector
       FROM documents d
       JOIN chunks c ON c.document_id = d.id
       JOIN knowledge_sources ks ON ks.id = d.source_id
       WHERE d.source_id = $1
       ORDER BY c.created_at ASC`,
      [sourceId],
    );

    return {
      sourceId: source.id,
      tenantId: source.tenantId || '',
      siteId: source.siteId,
      sourceType: source.type,
      title: source.title || rows.rows[0]?.title || 'Website',
      sourceUrl: source.normalizedSourceUrl || source.sourceUrl || rows.rows[0]?.source_url || '',
      sourceDomain: source.sourceDomain || '',
      ingestStatus: source.ingestStatus,
      indexStatus: source.indexStatus,
      runtimeReadiness: source.runtimeReadiness,
      isActive: source.isActive !== false,
      chunks: rows.rows
        .map((row) => ({
          id: row.chunk_id,
          documentId: row.document_id,
          content: row.content,
          metadata: sanitizeMetadata(row.metadata),
          contentHash: row.content_hash,
          embeddingVector: row.embedding_vector,
        }))
        .filter((row) => hasText(row.content)),
    };
  }

  private async restoreUpdatedChunks(chunks: UpdatedChunkSnapshot[]) {
    for (let index = chunks.length - 1; index >= 0; index -= 1) {
      const chunk = chunks[index];
      await this.db.query(
        `UPDATE chunks
         SET content = $2,
             metadata = $3,
             content_hash = $4,
             embedding = $5::vector
         WHERE id = $1`,
        [
          chunk.id,
          chunk.content,
          sanitizeMetadata(chunk.metadata),
          chunk.contentHash,
          chunk.embeddingVector,
        ],
      );
    }
  }

  private evaluatePreconditions(
    source: LoadedWebsiteSource | null,
    input: WebsiteEmbeddingIngestInput,
  ): WebsiteEmbeddingIngestResult | null {
    if (!source) {
      return deny('source_not_found', 'website_source_missing', 'Die Website-Quelle wurde nicht gefunden.');
    }

    if (source.sourceType !== 'url') {
      return deny(
        'unsupported_source_type',
        'website_embedding_ingest_requires_url_source',
        'Website-Embedding-Ingest ist nur fuer Website-Quellen freigegeben.',
      );
    }

    if (!source.isActive) {
      return deny('source_inactive', 'website_source_inactive', 'Die Website-Quelle ist nicht aktiv.');
    }

    if (!hasText(source.tenantId) || !hasText(source.siteId)) {
      return deny('not_granted', 'tenant_or_site_missing', 'Tenant und Site muessen fuer Website-Embedding-Ingest gesetzt sein.');
    }

    if (source.runtimeReadiness === 'ready') {
      return deny('source_already_ready', 'website_source_already_ready', 'Die Website-Quelle ist bereits answer-ready.');
    }

    if (source.ingestStatus !== 'extracted') {
      return deny(
        'source_not_extracted',
        'website_source_not_extracted',
        'Website-Embedding-Ingest ist erst nach erfolgreicher Extraktion erlaubt.',
      );
    }

    if (!['pending', 'not_requested', 'blocked', 'failed'].includes(source.indexStatus)) {
      return deny(
        'source_not_indexable',
        'website_source_not_in_indexable_state',
        'Website-Embedding-Ingest ist nur fuer nicht indexierte Website-Quellen erlaubt.',
      );
    }

    if (!source.chunks.length) {
      return deny(
        'source_chunks_missing',
        'website_source_chunks_missing',
        'Ohne extrahierte Website-Chunks bleibt der Embedding-Ingest gesperrt.',
      );
    }

    if (!input.adapter) {
      return deny('adapter_missing', 'website_embedding_adapter_missing', 'Ein expliziter Embedding-Adapter ist erforderlich.');
    }

    if (input.adapter.mode !== 'mock') {
      return deny(
        'mock_adapter_required',
        'website_embedding_ingest_requires_mock_adapter',
        'In diesem Scope sind nur Mock-Embeddings ohne externe Provider-Aufrufe erlaubt.',
      );
    }

    if (!isSafeWebsiteEmbeddingMockAdapter(input.adapter)) {
      return deny(
        'unsafe_mock_adapter',
        'website_embedding_ingest_requires_internal_safe_mock_adapter',
        'Der Website-Embedding-Ingest akzeptiert nur intern freigegebene Safe-Mock-Adapter.',
      );
    }

    if (!hasText(input.providerKey) || !hasText(input.model)) {
      return deny(
        'not_granted',
        'provider_or_model_missing',
        'Provider und Modell muessen fuer den Website-Embedding-Ingest explizit gesetzt sein.',
      );
    }

    return null;
  }

  private async evaluateGate(
    source: LoadedWebsiteSource,
    input: WebsiteEmbeddingIngestInput,
  ) {
    const policy = await this.approvalLookup.findProviderApprovalGrant({
      tenantId: source.tenantId,
      siteId: source.siteId,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      usageContext: 'website_ingest_runtime_indexing',
      environment: input.environment || 'non_production',
      providerKey: input.providerKey,
      model: input.model,
    });

    return evaluateProviderEmbeddingGate({
      tenantId: source.tenantId,
      siteId: source.siteId,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      usageContext: 'website_ingest_runtime_indexing',
      actorRole: input.actorRole || 'system',
      environment: input.environment || 'non_production',
      providerKey: input.providerKey,
      model: input.model,
      explicitApproval: policy,
    });
  }

  private async verifyRetrieval(
    source: LoadedWebsiteSource,
    input: WebsiteEmbeddingIngestInput,
  ) {
    const queryText = buildVerificationQueryText(source);
    if (!hasText(queryText)) {
      return { retrievalVerified: false, sourceAttributionVerified: false };
    }

    const embedding = await input.adapter!.embedText(queryText, {
      sourceId: source.sourceId,
      tenantId: source.tenantId,
      siteId: source.siteId,
      usageContext: 'website_ingest_runtime_indexing',
      environment: input.environment || 'non_production',
      providerKey: input.providerKey!.trim(),
      model: input.model!.trim(),
      phase: 'verification',
    });

    const rows = await this.db.query<VerificationRow>(
      `
      WITH ranked AS (
        SELECT
          c.id,
          c.document_id,
          d.source_id,
          ks.source_type,
          ks.label AS source_label,
          d.title,
          COALESCE(ks.source_url, d.source_url) AS source_url,
          (1 - (c.embedding <=> $3::vector)) AS score,
          c.embedding <=> $3::vector AS distance
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        LEFT JOIN knowledge_sources ks ON ks.id = d.source_id
        WHERE c.tenant_id = $1
          AND c.site_id = $2
          AND c.embedding IS NOT NULL
          AND COALESCE(ks.is_active, true) = true
      )
      SELECT
        id,
        document_id,
        source_id,
        source_type,
        source_label,
        title,
        source_url,
        score
      FROM ranked
      ORDER BY distance
      LIMIT 5
      `,
      [source.tenantId, source.siteId, toPgVectorLiteral(embedding)],
    );

    const matching = rows.rows.find((row) => row.source_id === source.sourceId);
    if (!matching) {
      return { retrievalVerified: false, sourceAttributionVerified: false };
    }

    const expectedTitle = source.title.trim();
    const expectedUrl = source.sourceUrl.trim();
    const titleMatches = !expectedTitle || matching.title === expectedTitle || matching.source_label === expectedTitle;
    const urlMatches = !expectedUrl || matching.source_url === expectedUrl;

    return {
      retrievalVerified: true,
      sourceAttributionVerified: titleMatches && urlMatches,
    };
  }

  async runWebsiteEmbeddingIngest(
    input: WebsiteEmbeddingIngestInput,
  ): Promise<WebsiteEmbeddingIngestResult> {
    const sourceId = (input.sourceId || '').trim();
    if (!sourceId) {
      return deny('source_not_found', 'website_source_missing', 'Die Website-Quelle wurde nicht gefunden.');
    }

    const source = await this.loadWebsiteSource(sourceId);
    const preconditionFailure = this.evaluatePreconditions(source, input);
    if (preconditionFailure) {
      if (source && preconditionFailure.decisionCode === 'unsafe_mock_adapter') {
        await this.knowledgeSources.markBlocked(
          source.sourceId,
          preconditionFailure.sanitizedMessage,
          preconditionFailure.decisionCode,
        );
        return {
          ...preconditionFailure,
          indexStatusChanged: true,
        };
      }
      return preconditionFailure;
    }

    const loaded = source as LoadedWebsiteSource;
    let embeddingsCreated = 0;
    const updatedChunks: UpdatedChunkSnapshot[] = [];

    try {
      for (let index = 0; index < loaded.chunks.length; index += 1) {
        const gateDecision = await this.evaluateGate(loaded, input);
        if (!gateDecision.allowed) {
          await this.restoreUpdatedChunks(updatedChunks);
          await this.knowledgeSources.markBlocked(loaded.sourceId, gateDecision.sanitizedMessage, gateDecision.decisionCode);
          return {
            ...deny(gateDecision.decisionCode, gateDecision.reason, gateDecision.sanitizedMessage),
            indexStatusChanged: true,
          };
        }

        const chunk = loaded.chunks[index];
        const embedding = await input.adapter!.embedText(chunk.content, {
          sourceId: loaded.sourceId,
          tenantId: loaded.tenantId,
          siteId: loaded.siteId,
          chunkId: chunk.id,
          chunkIndex: index,
          chunkCount: loaded.chunks.length,
          usageContext: 'website_ingest_runtime_indexing',
          environment: input.environment || 'non_production',
          providerKey: input.providerKey!.trim(),
          model: input.model!.trim(),
          phase: 'index',
        });

        if (!Array.isArray(embedding) || embedding.length !== input.adapter!.embeddingDimension) {
          await this.restoreUpdatedChunks(updatedChunks);
          await this.knowledgeSources.markFailed(
            loaded.sourceId,
            'Der Mock-Embedding-Adapter lieferte keine gueltige Embedding-Dimension.',
            'website_embedding_dimension_invalid',
          );
          return {
            ...deny(
              'embedding_dimension_invalid',
              'website_embedding_dimension_invalid',
              'Der Mock-Embedding-Adapter lieferte keine gueltige Embedding-Dimension.',
            ),
            indexStatusChanged: true,
            embeddingGenerationUsed: embeddingsCreated > 0,
          };
        }

        updatedChunks.push({
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          contentHash: chunk.contentHash,
          embeddingVector: chunk.embeddingVector,
        });
        await this.vector.updateChunk({
          id: chunk.id,
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            providerFree: false,
            websiteEmbeddingIndexed: true,
            websiteEmbeddingAdapterMode: input.adapter!.mode,
            websiteEmbeddingProviderKey: input.providerKey,
            websiteEmbeddingModel: input.model,
            websiteEmbeddingSynthetic: true,
            chunkIndex: index,
          },
          contentHash: chunk.contentHash,
          embedding,
        });
        embeddingsCreated += 1;
      }

      const verification = await this.verifyRetrieval(loaded, input);
      if (!verification.retrievalVerified || !verification.sourceAttributionVerified) {
        await this.restoreUpdatedChunks(updatedChunks);
        await this.knowledgeSources.markFailed(
          loaded.sourceId,
          'Die Website-Embedding-Verifikation blieb ohne belastbaren Retrieval-/Attribution-Nachweis.',
          'website_embedding_retrieval_not_verified',
        );
        return {
          ...deny(
            'retrieval_not_verified',
            'website_embedding_retrieval_not_verified',
            'Die Website-Embedding-Verifikation blieb ohne belastbaren Retrieval-/Attribution-Nachweis.',
          ),
          embeddingsCreated,
          indexStatusChanged: true,
          embeddingGenerationUsed: embeddingsCreated > 0,
        };
      }

      await this.knowledgeSources.markReady(loaded.sourceId, {
        websiteEmbeddingIndexed: true,
        websiteEmbeddingSynthetic: true,
        websiteEmbeddingAdapterMode: input.adapter!.mode,
        websiteEmbeddingProviderKey: input.providerKey,
        websiteEmbeddingModel: input.model,
        websiteEmbeddingChunksIndexed: embeddingsCreated,
        websiteEmbeddingRetrievalVerified: true,
        websiteEmbeddingSourceAttributionVerified: true,
      });

      return allow({
        embeddingsCreated,
        retrievalVerified: true,
        sourceAttributionVerified: true,
      });
    } catch (error) {
      await this.restoreUpdatedChunks(updatedChunks);
      await this.knowledgeSources.markFailed(
        loaded.sourceId,
        sanitizeFailureMessage(error, 'Der Website-Embedding-Ingest ist fehlgeschlagen.'),
        'website_embedding_ingest_failed',
      );
      return {
        ...deny(
          'embedding_failed',
          'website_embedding_ingest_failed',
          'Der Website-Embedding-Ingest ist fehlgeschlagen.',
        ),
        embeddingsCreated,
        indexStatusChanged: true,
        embeddingGenerationUsed: embeddingsCreated > 0,
      };
    }
  }
}
