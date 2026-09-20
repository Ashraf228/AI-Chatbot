import { BadGatewayException, BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../db/prisma.service';
import { KnowledgeSourcesService } from '../knowledge-sources/knowledge-sources.service';
import { VectorService } from '../vector/vector.service';
import { chunkText } from '../utils/chunk';
import { sha256 } from '../utils/hash';
import { IngestionEmbeddingService, INGESTION_FAILURE } from './ingestion-embedding.service';
import { crawlWebsite } from './website-crawl';

// These two initial operations are read-only. Bound the caller's wait without
// pretending to cancel an in-flight SQL query: observe late failures/results,
// but never let them resume indexing after the caller has stopped waiting.
function waitForInitialRead<T>(signal: AbortSignal, read: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void Promise.resolve().then(() => {
      signal.throwIfAborted();
      return read();
    }).then((value) => {
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) reject(signal.reason);
      else resolve(value);
    }, (error) => {
      signal.removeEventListener('abort', onAbort);
      reject(error);
    });
  });
}

@Injectable()
export class WebsiteKnowledgeIndexService {
  constructor(private readonly db: PrismaService, private readonly knowledge: KnowledgeSourcesService,
    private readonly embeddings: IngestionEmbeddingService, private readonly vector: VectorService) {}

  async index(sourceId: string, options: { maxPages?: number; signal?: AbortSignal } = {}) {
    // One abort budget starts before any source/snapshot read and is shared
    // with crawling and embedding. Do not restart it between phases.
    const deadline = new AbortController();
    const timeout = setTimeout(() => deadline.abort(new DOMException('Website indexing timed out', 'TimeoutError')), 45_000);
    timeout.unref();
    const signal = options.signal ? AbortSignal.any([options.signal, deadline.signal]) : deadline.signal;
    try {
      const source = await waitForInitialRead(signal, () => this.knowledge.getById(sourceId));
      if (!source?.tenantId || source.type !== 'url' || !source.isActive || !source.url) {
        throw new BadRequestException('Eine aktive Website-Quelle ist erforderlich.');
      }
      const tenantId = source.tenantId;
      const scope = [sourceId, source.siteId, tenantId];
      const snapshot = await waitForInitialRead(signal, () => this.db.query<{ revision: string }>(
        `SELECT ks.updated_at::text AS revision FROM knowledge_sources ks
         JOIN sites s ON s.id = ks.site_id AND s.tenant_id = ks.tenant_id
         WHERE ks.id = $1 AND ks.site_id = $2 AND ks.tenant_id = $3 AND ks.source_type = 'url'
           AND ks.is_active = true AND ks.source_url = $4`, [...scope, source.url]));
      if (snapshot.rows.length !== 1) throw new ConflictException('Die Website-Quelle hat sich geändert. Bitte neu laden.');
      const revision = snapshot.rows[0].revision;
      signal.throwIfAborted();
      const crawl = await crawlWebsite(source.url, { maxPages: options.maxPages, signal });
      if (!crawl.complete) {
        throw new BadRequestException('Website-Suche erreicht ein Umfangslimit. Bitte den Seitenumfang begrenzen oder das Seitenlimit erhöhen. Bestehendes Wissen bleibt erhalten.');
      }
      const config = this.embeddings.resolveConfig();
      const prepared: Array<{ url: string; title: string; content: string; embedding: number[]; index: number }> = [];
      const chunks = crawl.pages.flatMap((page) => chunkText(page.extractedText, 1400, 250).map((content, index) => ({
        url: page.finalUrl, title: page.pageTitle || source.title, content, index,
      })));
      if (!chunks.length || chunks.length > 100) throw new BadRequestException('Website-Umfang überschreitet das Indexierungslimit.');
      for (const chunk of chunks) {
        signal.throwIfAborted();
        const embedding = await this.embeddings.embed(chunk.content, {
          tenantId, siteId: source.siteId, sourceId, purpose: 'website_ingest_runtime_indexing',
        }, { signal });
        if (embedding.length !== 1536 || !embedding.every(Number.isFinite)) throw new Error('Invalid vector');
        prepared.push({ ...chunk, embedding });
      }
      signal.throwIfAborted();
      return await this.db.transaction(async (tx) => {
        await tx.query("SET LOCAL lock_timeout = '3s'");
        await tx.query("SET LOCAL statement_timeout = '10s'");
        const locked = await tx.query<{ id: string }>(
          `SELECT id FROM knowledge_sources WHERE id = $1 AND site_id = $2 AND tenant_id = $3
           AND updated_at = $4::timestamptz AND source_type = 'url' AND is_active = true FOR UPDATE`, [...scope, revision]);
        if (locked.rows.length !== 1) throw new ConflictException('Die Website-Quelle wurde zwischenzeitlich geändert. Bestehendes Wissen bleibt erhalten.');
        signal.throwIfAborted();
        await tx.query('DELETE FROM documents WHERE source_id = $1 AND site_id = $2 AND tenant_id = $3', scope);
        const documents = new Map<string, string>();
        let inserted = 0;
        for (const chunk of prepared) {
          signal.throwIfAborted();
          if (!documents.has(chunk.url)) {
            const id = randomUUID(); documents.set(chunk.url, id);
            await tx.query(`INSERT INTO documents(id, source_id, tenant_id, site_id, type, title, source_url)
              VALUES ($1,$2,$3,$4,'url',$5,$6)`, [id, sourceId, source.tenantId, source.siteId, chunk.title, chunk.url]);
          }
          const result = await this.vector.upsertChunk({ id: randomUUID(), tenantId, siteId: source.siteId,
            documentId: documents.get(chunk.url)!, content: chunk.content, contentHash: sha256(chunk.content), embedding: chunk.embedding,
            metadata: { kind: 'url', pageUrl: chunk.url, pageTitle: chunk.title, chunkIndex: chunk.index,
              providerFree: false, embeddingProvider: config.providerKey, embeddingModel: config.model },
          }, tx);
          if (!result.skipped) inserted++;
        }
        await this.knowledge.markReady(sourceId, { websiteCrawl: { maxPages: crawl.maxPages, pages: crawl.pages.length,
          complete: crawl.complete, excluded: crawl.excluded, indexedAt: new Date().toISOString() },
          providerFree: false, runtimeIndexingRequired: false, persistedChunkCount: inserted,
          websiteEmbeddingProviderKey: config.providerKey, websiteEmbeddingModel: config.model }, tx);
        signal.throwIfAborted();
        return { sourceId, siteId: source.siteId, pages: crawl.pages.length, chunks: inserted,
          complete: crawl.complete, excluded: crawl.excluded, runtimeReadiness: 'ready' };
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      // No status downgrade or destructive cleanup: a failed refresh keeps the
      // previous ready snapshot, including its source/document associations.
      throw new BadGatewayException(INGESTION_FAILURE);
    } finally {
      clearTimeout(timeout);
    }
  }
}
