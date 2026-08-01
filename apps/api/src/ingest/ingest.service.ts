import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { SitesService } from '../sites/sites.service';
import { KnowledgeSourcesService } from '../knowledge-sources/knowledge-sources.service';
import {
  evaluateProviderEmbeddingGate,
  type ProviderEmbeddingApproval,
  type ProviderEmbeddingEnvironment,
} from '../knowledge-sources/provider-embedding-gate';
import { ProviderApprovalStorageLookupService } from '../knowledge-sources/provider-approval-storage-lookup.service';
import { chunkText } from '../utils/chunk';
import { sha256 } from '../utils/hash';
import { randomUUID } from 'crypto';
import {
  WebsiteFetchError,
  WebsitePolicyError,
  fetchWebsiteSource,
  validatePublicWebsiteUrl,
} from './website-ingest';

const { PDFParse } = require('pdf-parse');

type KnowledgeDocumentRow = {
  id: string;
  source_id: string | null;
  source_type: string | null;
  source_label: string | null;
  source_sync_status: string | null;
  type: string;
  title: string | null;
  source_url: string | null;
  created_at: string;
  chunk_count: number;
};

type SourceDocumentRow = {
  id: string;
};

type FaqChunkRow = {
  id: string;
  document_id: string;
  content: string;
  created_at: string;
};

type FaqChunkDetailRow = {
  id: string;
  site_id: string;
  metadata: Record<string, unknown> | null;
};

type WebsiteRuntimeIndexingGateResult = {
  sourceId: string;
  allowed: boolean;
  decisionCode: string;
  reason: string;
  sanitizedMessage: string;
  ingestStatus: string;
  indexStatus: string;
  runtimeReadiness: string;
  providerCallsUsed: false;
  embeddingGenerationUsed: false;
  readyTransitionAdded: false;
};

@Injectable()
export class IngestService {
  constructor(
    private db: PrismaService,
    private embedder: EmbeddingService,
    private vector: VectorService,
    private sites: SitesService,
    private knowledgeSources: KnowledgeSourcesService,
    private readonly approvalLookup?: ProviderApprovalStorageLookupService,
  ) {}

  async ingestFaq(siteId: string, title: string, items: Array<{ q: string; a: string }>) {
    if (!siteId?.trim()) {
      throw new BadRequestException('siteId missing');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('At least one FAQ item is required');
    }

    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    if (!site.tenant_id) {
      throw new BadRequestException('Selected site has no tenantId');
    }

    const tenantId = site.tenant_id;
    const sourceId = await this.knowledgeSources.createForSite({
      tenantId,
      siteId,
      sourceType: 'faq',
      label: title || 'FAQ',
      syncStatus: 'processing',
      config: {
        documentType: 'faq',
        itemCount: items.length,
        items,
      },
    });

    await this.knowledgeSources.markProcessing(sourceId);
    const docId = randomUUID();

    try {
      await this.db.query(
        `INSERT INTO documents(id, source_id, tenant_id, site_id, type, title) VALUES ($1,$2,$3,$4,$5,$6)`,
        [docId, sourceId, tenantId, siteId, 'faq', title],
      );
    } catch (error) {
      console.error('Failed to create FAQ document', error);
      throw new InternalServerErrorException('Failed to create FAQ document');
    }

    let inserted = 0;
    for (const it of items) {
      const content = `Frage: ${it.q}\nAntwort: ${it.a}`.trim();
      if (!content) continue;

      let embedding: number[];
      try {
        embedding = await this.embedder.embed(content);
      } catch (error) {
        console.error('Failed to create FAQ embedding', error);
        throw new BadGatewayException('Embedding request failed');
      }

      let res: { id: string; skipped: boolean };
      try {
        res = await this.vector.upsertChunk({
          id: randomUUID(),
          tenantId,
          siteId,
          documentId: docId,
          content,
          metadata: { kind: 'faq', q: it.q },
          contentHash: sha256(content),
          embedding,
        });
      } catch (error) {
        console.error('Failed to store FAQ chunk', error);
        throw new InternalServerErrorException('Failed to store FAQ chunk');
      }

      if (!res.skipped) inserted++;
    }

    await this.knowledgeSources.markReady(sourceId, { itemCount: items.length });
    return { sourceId, documentId: docId, inserted };
  }

  async ingestManual(siteId: string, input: {
    title: string;
    question?: string;
    content: string;
    tags?: string[];
  }) {
    const title = input.title?.trim() || 'Manuelles Wissen';
    const content = input.question
      ? `Frage: ${input.question.trim()}\nAntwort: ${input.content.trim()}`
      : input.content.trim();

    if (!content) {
      throw new BadRequestException('content required');
    }

    const site = await this.sites.getSite(siteId);
    if (!site?.tenant_id) {
      throw new BadRequestException('Invalid siteId');
    }
    const sourceId = await this.knowledgeSources.createForSite({
      tenantId: site.tenant_id,
      siteId,
      sourceType: input.question ? 'faq' : 'manual',
      label: title,
      syncStatus: 'processing',
      config: {
        documentType: input.question ? 'faq' : 'manual',
        question: input.question || null,
        content: input.content,
        tags: input.tags || [],
      },
    });

    await this.ingestTextIntoSource({
      tenantId: site.tenant_id,
      siteId,
      sourceId,
      type: input.question ? 'faq' : 'manual',
      title,
      text: content,
      metadata: {
        kind: input.question ? 'faq' : 'manual',
        q: input.question || undefined,
        tags: input.tags || [],
      },
    });

    return { sourceId, inserted: 1 };
  }

  async ingestUrl(siteId: string, url: string, title?: string) {
    const site = await this.sites.getSite(siteId);
    if (!site?.tenant_id) {
      throw new BadRequestException('Invalid siteId');
    }

    const validatedUrl = await validatePublicWebsiteUrl(url);
    const sourceId = await this.knowledgeSources.createForSite({
      tenantId: site.tenant_id,
      siteId,
      sourceType: 'url',
      label: title?.trim() || validatedUrl.normalizedUrl,
      sourceUrl: validatedUrl.normalizedUrl,
      syncStatus: 'pending',
      ingestStatus: 'fetch_pending',
      indexStatus: 'not_requested',
      runtimeReadiness: 'not_ready',
      config: {
        documentType: 'url',
        url: validatedUrl.normalizedUrl,
        title: title?.trim() || null,
        websiteIngestMode: 'single_url_only',
      },
    });

    try {
      await this.knowledgeSources.markFetchPending(sourceId, {
        requestUrl: validatedUrl.normalizedUrl,
        sourceDomain: validatedUrl.sourceDomain,
      });
      await this.knowledgeSources.markFetching(sourceId, {
        requestUrl: validatedUrl.normalizedUrl,
      });

      const fetched = await fetchWebsiteSource(validatedUrl.normalizedUrl);
      await this.knowledgeSources.markFetched(sourceId, {
        normalizedSourceUrl: fetched.finalUrl,
        sourceDomain: fetched.sourceDomain,
        fetchStatusCode: fetched.statusCode,
        fetchContentType: fetched.contentType,
        fetchRedirects: fetched.redirectCount,
        fetchBytes: fetched.responseBytes,
      });

      const result = await this.persistProviderFreeTextIntoSource({
        tenantId: site.tenant_id,
        siteId,
        sourceId,
        type: 'url',
        title: title?.trim() || fetched.normalizedUrl,
        sourceUrl: fetched.finalUrl,
        text: fetched.extractedText,
        metadata: {
          kind: 'url',
          url: fetched.finalUrl,
          normalizedSourceUrl: fetched.finalUrl,
          sourceDomain: fetched.sourceDomain,
          providerFree: true,
          websiteSingleUrlIngest: true,
        },
      });

      await this.knowledgeSources.markRuntimeIndexPending(sourceId, {
        normalizedSourceUrl: fetched.finalUrl,
        sourceDomain: fetched.sourceDomain,
        extractedChars: fetched.extractedChars,
        extractedTextLength: fetched.extractedChars,
        extractedTruncated: fetched.truncated,
        persistedChunkCount: result.chunks,
        providerFree: true,
        runtimeReady: false,
        runtimeIndexingRequired: true,
        runtimeIndexingMode: 'provider_or_embedding_gate_required',
        runtimeIndexingReason: 'website_provider_free_text_not_searchable_via_vector_path',
        websiteSingleUrlIngest: true,
      });

      const source = await this.knowledgeSources.getById(sourceId);
      return {
        sourceId,
        siteId,
        documentId: result.documentId,
        chunks: result.chunks,
        inserted: result.inserted,
        normalizedUrl: fetched.finalUrl,
        domain: fetched.sourceDomain,
        ingestStatus: source?.ingestStatus || 'extracted',
        indexStatus: source?.indexStatus || 'pending',
        runtimeReadiness: source?.runtimeReadiness || 'not_ready',
        extractedTextLength: fetched.extractedChars,
        error: source?.ingestErrorMessageSanitized || null,
      };
    } catch (error) {
      if (error instanceof WebsitePolicyError) {
        await this.knowledgeSources.markBlocked(sourceId, error.message, error.code);
        throw new BadRequestException(error.message);
      }

      const message = error instanceof WebsiteFetchError
        ? error.message
        : 'Website-Import fehlgeschlagen.';
      const code = error instanceof WebsiteFetchError
        ? error.code
        : 'website_ingest_failed';
      await this.knowledgeSources.markFailed(sourceId, message, code);

      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(message);
    }
  }

  async ingestPdf(siteId: string, file: Express.Multer.File) {
    if (!siteId?.trim()) {
      throw new BadRequestException('siteId missing');
    }
    if (!file?.buffer) {
      throw new BadRequestException('file missing or buffer missing');
    }

    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }
    if (!site.tenant_id) {
      throw new BadRequestException('Selected site has no tenantId');
    }
    const tenantId = site.tenant_id;
    const sourceId = await this.knowledgeSources.createForSite({
      tenantId,
      siteId,
      sourceType: 'pdf',
      label: file.originalname,
      syncStatus: 'processing',
      config: {
        documentType: 'pdf',
        filename: file.originalname,
      },
    });

    let text = '';
    let parser: InstanceType<typeof PDFParse> | null = null;
    try {
      parser = new PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
      text = (parsed.text || '').trim();
    } catch (error) {
      console.error('Failed to parse PDF', error);
      await this.knowledgeSources.markFailed(sourceId, 'PDF could not be parsed');
      throw new BadRequestException('PDF could not be parsed');
    } finally {
      if (parser) {
        await parser.destroy().catch(() => undefined);
      }
    }

    if (!text) {
      throw new BadRequestException('PDF has no extractable text');
    }

    const docId = randomUUID();

    try {
      await this.db.query(
        `INSERT INTO documents(id, source_id, tenant_id, site_id, type, title)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [docId, sourceId, tenantId, siteId, 'pdf', file.originalname],
      );
    } catch (error) {
      console.error('Failed to create PDF document', error);
      throw new InternalServerErrorException('Failed to create PDF document');
    }

    const chunks = chunkText(text, 1400, 250);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      let embedding: number[];
      try {
        embedding = await this.embedder.embed(content);
      } catch (error) {
        console.error('Failed to create PDF embedding', error);
        await this.knowledgeSources.markFailed(sourceId, 'Embedding request failed');
        throw new BadGatewayException('Embedding request failed');
      }

      let res: { id: string; skipped: boolean };
      try {
        res = await this.vector.upsertChunk({
          id: randomUUID(),
          tenantId,
          siteId,
          documentId: docId,
          content,
          metadata: {
            kind: 'pdf',
            filename: file.originalname,
            chunkIndex: i,
          },
          contentHash: sha256(content),
          embedding,
        });
      } catch (error) {
        console.error('Failed to store PDF chunk', error);
        await this.knowledgeSources.markFailed(sourceId, 'Failed to store PDF chunk');
        throw new InternalServerErrorException('Failed to store PDF chunk');
      }

      if (!res.skipped) inserted++;
    }

    await this.knowledgeSources.markReady(sourceId, { chunks: chunks.length });
    return { sourceId, documentId: docId, chunks: chunks.length, inserted };
  }

  private async ingestTextIntoSource(input: {
    tenantId: string;
    siteId: string;
    sourceId: string;
    type: string;
    title: string;
    text: string;
    sourceUrl?: string;
    metadata: Record<string, unknown>;
  }) {
    await this.knowledgeSources.markProcessing(input.sourceId);
    await this.db.query(`DELETE FROM documents WHERE source_id = $1`, [input.sourceId]);

    const docId = randomUUID();
    await this.db.query(
      `INSERT INTO documents(id, source_id, tenant_id, site_id, type, title, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [docId, input.sourceId, input.tenantId, input.siteId, input.type, input.title, input.sourceUrl || null],
    );

    const chunks = input.type === 'faq' ? [input.text] : chunkText(input.text, 1400, 250);
    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i].trim();
      if (!content) {
        continue;
      }
      const embedding = await this.embedder.embed(content);
      const res = await this.vector.upsertChunk({
        id: randomUUID(),
        tenantId: input.tenantId,
        siteId: input.siteId,
        documentId: docId,
        content,
        metadata: { ...input.metadata, chunkIndex: i },
        contentHash: sha256(content),
        embedding,
      });
      if (!res.skipped) {
        inserted++;
      }
    }

    await this.knowledgeSources.markReady(input.sourceId, { chunks: chunks.length });
    return { sourceId: input.sourceId, siteId: input.siteId, documentId: docId, chunks: chunks.length, inserted };
  }

  private async persistProviderFreeTextIntoSource(input: {
    tenantId: string;
    siteId: string;
    sourceId: string;
    type: string;
    title: string;
    text: string;
    sourceUrl?: string;
    metadata: Record<string, unknown>;
  }) {
    await this.db.query(`DELETE FROM documents WHERE source_id = $1`, [input.sourceId]);

    const docId = randomUUID();
    await this.db.query(
      `INSERT INTO documents(id, source_id, tenant_id, site_id, type, title, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [docId, input.sourceId, input.tenantId, input.siteId, input.type, input.title, input.sourceUrl || null],
    );

    const chunks = chunkText(input.text, 1400, 250);
    let inserted = 0;

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i].trim();
      if (!content) {
        continue;
      }

      await this.db.query(
        `INSERT INTO chunks(id, tenant_id, site_id, document_id, content, metadata, content_hash, embedding)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NULL)`,
        [
          randomUUID(),
          input.tenantId,
          input.siteId,
          docId,
          content,
          JSON.stringify({ ...input.metadata, chunkIndex: i, providerFree: true }),
          sha256(content),
        ],
      );
      inserted++;
    }

    return {
      sourceId: input.sourceId,
      siteId: input.siteId,
      documentId: docId,
      chunks: chunks.length,
      inserted,
    };
  }

  async listKnowledge(siteId: string) {
    if (!siteId?.trim()) {
      throw new BadRequestException('siteId missing');
    }

    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const docs = await this.db.query<KnowledgeDocumentRow>(
      `SELECT
         d.id,
         d.source_id,
         ks.source_type,
         ks.label AS source_label,
         ks.sync_status AS source_sync_status,
         d.type,
         d.title,
         d.source_url,
         d.created_at,
         COUNT(c.id)::int AS chunk_count
       FROM documents d
       LEFT JOIN knowledge_sources ks ON ks.id = d.source_id
       LEFT JOIN chunks c ON c.document_id = d.id
       WHERE d.site_id = $1
       GROUP BY d.id, ks.id
       ORDER BY d.created_at DESC`,
      [siteId],
    );

    const faqDocs = docs.rows.filter((row) => row.type === 'faq');
    const faqItemsByDoc = new Map<
      string,
      Array<{ id: string; question: string; answer: string }>
    >();

    if (faqDocs.length > 0) {
      const faqChunks = await this.db.query<FaqChunkRow>(
        `SELECT c.id, c.document_id, c.content, c.created_at
         FROM chunks c
         JOIN documents d ON d.id = c.document_id
         WHERE d.site_id = $1
           AND d.type = 'faq'
         ORDER BY c.created_at ASC`,
        [siteId],
      );

      for (const chunk of faqChunks.rows) {
        const parsed = parseFaqChunk(chunk.content);
        const items = faqItemsByDoc.get(chunk.document_id) || [];
        if (parsed) {
          items.push({
            id: chunk.id,
            question: parsed.question,
            answer: parsed.answer,
          });
        }
        faqItemsByDoc.set(chunk.document_id, items);
      }
    }

    return docs.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id || '',
      source: row.source_id
        ? {
            id: row.source_id,
            type: row.source_type || '',
            label: row.source_label || row.title || '',
            syncStatus: row.source_sync_status || 'ready',
          }
        : null,
      type: row.type,
      title: row.title || '',
      sourceUrl: row.source_url || '',
      createdAt: row.created_at,
      chunkCount: row.chunk_count,
      faqItems: faqItemsByDoc.get(row.id) || [],
    }));
  }

  async deleteKnowledge(documentId: string) {
    if (!documentId?.trim()) {
      throw new BadRequestException('documentId missing');
    }

    const existing = await this.db.query<{ id: string; site_id: string; source_id: string | null }>(
      `SELECT id, site_id, source_id
       FROM documents
       WHERE id = $1
       LIMIT 1`,
      [documentId],
    );

    const row = existing.rows[0];
    if (!row) {
      throw new BadRequestException('Invalid documentId');
    }

    await this.db.query(`DELETE FROM documents WHERE id = $1`, [documentId]);
    await this.knowledgeSources.deleteIfUnused(row.source_id || '');

    return {
      ok: true,
      deletedId: documentId,
      siteId: row.site_id,
    };
  }

  async deleteSource(sourceId: string) {
    if (!sourceId?.trim()) {
      throw new BadRequestException('sourceId missing');
    }
    return this.knowledgeSources.deleteSource(sourceId);
  }

  async ingestTextIntoExistingSource(input: {
    tenantId: string;
    siteId: string;
    sourceId: string;
    type: string;
    title: string;
    text: string;
    sourceUrl?: string;
    metadata: Record<string, unknown>;
  }) {
    return this.ingestTextIntoSource(input);
  }

  async getSource(sourceId: string) {
    if (!sourceId?.trim()) {
      throw new BadRequestException('sourceId missing');
    }
    const source = await this.knowledgeSources.getById(sourceId);
    if (!source) {
      throw new BadRequestException('Invalid sourceId');
    }
    return source;
  }

  async setSourceActive(sourceId: string, isActive: boolean) {
    if (!sourceId?.trim()) {
      throw new BadRequestException('sourceId missing');
    }
    return this.knowledgeSources.setActive(sourceId, isActive);
  }

  async evaluateWebsiteRuntimeIndexingGate(input: {
    sourceId: string;
    explicitApproval?: ProviderEmbeddingApproval | null;
    actorRole?: 'system' | 'admin' | 'operator' | 'viewer' | 'public';
    environment?: ProviderEmbeddingEnvironment;
    providerKey?: string | null;
    model?: string | null;
  }): Promise<WebsiteRuntimeIndexingGateResult> {
    if (!input.sourceId?.trim()) {
      throw new BadRequestException('sourceId missing');
    }

    const source = await this.knowledgeSources.getById(input.sourceId);
    if (!source) {
      throw new BadRequestException('Invalid sourceId');
    }

    const resolvedApproval =
      input.explicitApproval ||
      (this.approvalLookup
        ? await this.approvalLookup.findProviderApprovalGrant({
            tenantId: source.tenantId,
            siteId: source.siteId,
            sourceId: source.id,
            sourceType: source.type,
            usageContext: 'website_ingest_runtime_indexing',
            environment: input.environment || (process.env.NODE_ENV === 'production' ? 'production' : 'non_production'),
            providerKey: input.providerKey,
            model: input.model,
          })
        : null);

    const decision = evaluateProviderEmbeddingGate({
      tenantId: source.tenantId,
      siteId: source.siteId,
      sourceId: source.id,
      sourceType: source.type,
      usageContext: 'website_ingest_runtime_indexing',
      actorRole: input.actorRole || 'system',
      environment: input.environment || (process.env.NODE_ENV === 'production' ? 'production' : 'non_production'),
      providerKey: input.providerKey,
      model: input.model,
      explicitApproval: resolvedApproval,
    });

    if (!decision.allowed) {
      await this.knowledgeSources.markBlocked(source.id, decision.sanitizedMessage, decision.decisionCode);
      const blocked = await this.knowledgeSources.getById(source.id);
      return {
        sourceId: source.id,
        allowed: false,
        decisionCode: decision.decisionCode,
        reason: decision.reason,
        sanitizedMessage: decision.sanitizedMessage,
        ingestStatus: blocked?.ingestStatus || 'blocked',
        indexStatus: blocked?.indexStatus || 'blocked',
        runtimeReadiness: blocked?.runtimeReadiness || 'blocked',
        providerCallsUsed: false,
        embeddingGenerationUsed: false,
        readyTransitionAdded: false,
      };
    }

    return {
      sourceId: source.id,
      allowed: true,
      decisionCode: decision.decisionCode,
      reason: decision.reason,
      sanitizedMessage: decision.sanitizedMessage,
      ingestStatus: source.ingestStatus,
      indexStatus: source.indexStatus,
      runtimeReadiness: source.runtimeReadiness,
      providerCallsUsed: false,
      embeddingGenerationUsed: false,
      readyTransitionAdded: false,
    };
  }

  async resyncSource(sourceId: string) {
    const source = await this.knowledgeSources.getById(sourceId);
    if (!source) {
      throw new BadRequestException('Invalid sourceId');
    }

    const config = source.metadata || {};
    try {
      if (source.type === 'url') {
        await this.knowledgeSources.markFetching(sourceId, {
          requestUrl: typeof config.url === 'string' ? config.url : source.url,
        });
        const url = typeof config.url === 'string' ? config.url : source.url;
        const fetched = await fetchWebsiteSource(url);
        await this.knowledgeSources.markFetched(sourceId, {
          normalizedSourceUrl: fetched.finalUrl,
          sourceDomain: fetched.sourceDomain,
          fetchStatusCode: fetched.statusCode,
          fetchContentType: fetched.contentType,
          fetchRedirects: fetched.redirectCount,
          fetchBytes: fetched.responseBytes,
        });
        const result = await this.persistProviderFreeTextIntoSource({
          tenantId: source.tenantId || '',
          siteId: source.siteId,
          sourceId,
          type: 'url',
          title: source.title,
          sourceUrl: fetched.finalUrl,
          text: fetched.extractedText,
          metadata: {
            kind: 'url',
            url: fetched.finalUrl,
            normalizedSourceUrl: fetched.finalUrl,
            sourceDomain: fetched.sourceDomain,
            providerFree: true,
            websiteSingleUrlIngest: true,
          },
        });
        await this.knowledgeSources.markRuntimeIndexPending(sourceId, {
          normalizedSourceUrl: fetched.finalUrl,
          sourceDomain: fetched.sourceDomain,
          extractedChars: fetched.extractedChars,
          extractedTextLength: fetched.extractedChars,
          extractedTruncated: fetched.truncated,
          persistedChunkCount: result.chunks,
          providerFree: true,
          runtimeReady: false,
          runtimeIndexingRequired: true,
          runtimeIndexingMode: 'provider_or_embedding_gate_required',
          runtimeIndexingReason: 'website_provider_free_text_not_searchable_via_vector_path',
          websiteSingleUrlIngest: true,
        });
        return result;
      }

      await this.knowledgeSources.markProcessing(sourceId);

      if (source.type === 'faq') {
        const items = Array.isArray(config.items) ? config.items : [];
        const text = items
          .map((item) => {
            const q = typeof item?.q === 'string' ? item.q.trim() : '';
            const a = typeof item?.a === 'string' ? item.a.trim() : '';
            return q && a ? `Frage: ${q}\nAntwort: ${a}` : '';
          })
          .filter(Boolean)
          .join('\n\n');
        if (!text) {
          throw new BadRequestException('FAQ source has no stored items for re-sync');
        }
        return this.ingestTextIntoSource({
          tenantId: source.tenantId || '',
          siteId: source.siteId,
          sourceId,
          type: 'faq',
          title: source.title,
          text,
          metadata: { kind: 'faq' },
        });
      }

      if (source.type === 'manual') {
        const content = typeof config.content === 'string' ? config.content.trim() : '';
        if (!content) {
          throw new BadRequestException('Manual source has no stored content for re-sync');
        }
        return this.ingestTextIntoSource({
          tenantId: source.tenantId || '',
          siteId: source.siteId,
          sourceId,
          type: 'manual',
          title: source.title,
          text: content,
          metadata: { kind: 'manual', tags: config.tags || [] },
        });
      }

      if (source.type === 'it_support_template') {
        const content = typeof config.content === 'string' ? config.content.trim() : '';
        if (!content) {
          throw new BadRequestException('IT support template source has no stored content for re-sync');
        }
        return this.ingestTextIntoSource({
          tenantId: source.tenantId || '',
          siteId: source.siteId,
          sourceId,
          type: 'manual',
          title: source.title,
          text: content,
          metadata: {
            kind: 'it_support_template',
            templateKey: config.templateKey,
            templateVersion: config.templateVersion,
            industry: config.industry || 'it-support',
            category: config.category,
            issueType: config.issueType,
            tags: config.tags || [],
          },
        });
      }

      throw new BadRequestException('Re-sync for this source type requires re-upload');
    } catch (error) {
      if (error instanceof WebsitePolicyError) {
        await this.knowledgeSources.markBlocked(sourceId, error.message, error.code);
        throw new BadRequestException(error.message);
      }

      const message = error instanceof WebsiteFetchError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Re-sync failed';
      const code = error instanceof WebsiteFetchError ? error.code : 'ingest_failed';
      await this.knowledgeSources.markFailed(
        sourceId,
        message,
        code,
      );
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(message);
    }
  }

  async updateFaqItem(chunkId: string, question: string, answer: string) {
    if (!chunkId?.trim()) {
      throw new BadRequestException('chunkId missing');
    }

    const q = question?.trim();
    const a = answer?.trim();

    if (!q || !a) {
      throw new BadRequestException('Question and answer are required');
    }

    const current = await this.db.query<FaqChunkDetailRow>(
      `SELECT c.id, c.site_id, c.metadata
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.id = $1
         AND d.type = 'faq'
       LIMIT 1`,
      [chunkId],
    );

    const row = current.rows[0];
    if (!row) {
      throw new BadRequestException('Invalid FAQ item id');
    }

    const content = `Frage: ${q}\nAntwort: ${a}`.trim();

    let embedding: number[];
    try {
      embedding = await this.embedder.embed(content);
    } catch (error) {
      console.error('Failed to re-embed FAQ item', error);
      throw new BadGatewayException('Embedding request failed');
    }

    const metadata = {
      ...(row.metadata || {}),
      kind: 'faq',
      q,
    };

    try {
      await this.vector.updateChunk({
        id: chunkId,
        content,
        metadata,
        contentHash: sha256(content),
        embedding,
      });
    } catch (error) {
      console.error('Failed to update FAQ chunk', error);
      throw new InternalServerErrorException('Failed to update FAQ chunk');
    }

    return {
      ok: true,
      id: chunkId,
      siteId: row.site_id,
      question: q,
      answer: a,
    };
  }

  async listSources(siteId: string) {
    return this.knowledgeSources.listForSite(siteId);
  }
}

function parseFaqChunk(content: string) {
  const match = content.match(/^Frage:\s*(.+?)\nAntwort:\s*([\s\S]+)$/);
  if (!match) {
    return null;
  }

  return {
    question: match[1].trim(),
    answer: match[2].trim(),
  };
}
