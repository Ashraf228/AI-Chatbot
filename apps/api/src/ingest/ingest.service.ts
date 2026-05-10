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
import { chunkText } from '../utils/chunk';
import { sha256 } from '../utils/hash';
import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

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

@Injectable()
export class IngestService {
  constructor(
    private db: PrismaService,
    private embedder: EmbeddingService,
    private vector: VectorService,
    private sites: SitesService,
    private knowledgeSources: KnowledgeSourcesService,
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

    const safeUrl = await validatePublicUrl(url);
    const sourceId = await this.knowledgeSources.createForSite({
      tenantId: site.tenant_id,
      siteId,
      sourceType: 'url',
      label: title?.trim() || safeUrl,
      sourceUrl: safeUrl,
      syncStatus: 'processing',
      config: {
        documentType: 'url',
        url: safeUrl,
        title: title?.trim() || null,
      },
    });

    try {
      const text = await fetchUrlText(safeUrl);
      const result = await this.ingestTextIntoSource({
        tenantId: site.tenant_id,
        siteId,
        sourceId,
        type: 'url',
        title: title?.trim() || safeUrl,
        sourceUrl: safeUrl,
        text,
        metadata: { kind: 'url', url: safeUrl },
      });
      await this.knowledgeSources.markReady(sourceId, { textLength: text.length });
      return result;
    } catch (error) {
      await this.knowledgeSources.markFailed(
        sourceId,
        error instanceof Error ? error.message : 'URL import failed',
      );
      throw error;
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

  async resyncSource(sourceId: string) {
    const source = await this.knowledgeSources.getById(sourceId);
    if (!source) {
      throw new BadRequestException('Invalid sourceId');
    }

    const config = source.metadata || {};
    try {
      await this.knowledgeSources.markProcessing(sourceId);

      if (source.type === 'url') {
        const url = typeof config.url === 'string' ? config.url : source.url;
        const text = await fetchUrlText(await validatePublicUrl(url));
        return this.ingestTextIntoSource({
          tenantId: source.tenantId || '',
          siteId: source.siteId,
          sourceId,
          type: 'url',
          title: source.title,
          sourceUrl: url,
          text,
          metadata: { kind: 'url', url },
        });
      }

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

      throw new BadRequestException('Re-sync for this source type requires re-upload');
    } catch (error) {
      await this.knowledgeSources.markFailed(
        sourceId,
        error instanceof Error ? error.message : 'Re-sync failed',
      );
      throw error;
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

async function validatePublicUrl(input: string) {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new BadRequestException('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Only http/https URLs are allowed');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new BadRequestException('Private or local URLs are not allowed');
  }

  const records = await lookup(parsed.hostname, { all: true }).catch(() => []);
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new BadRequestException('Private or local URLs are not allowed');
  }

  return parsed.toString();
}

function isBlockedHostname(hostname: string) {
  const value = hostname.toLowerCase();
  return value === 'localhost' || value.endsWith('.localhost') || value === '0.0.0.0';
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 0) {
    return true;
  }
  if (address === '127.0.0.1' || address === '::1') {
    return true;
  }
  if (/^10\./.test(address) || /^192\.168\./.test(address)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
    return true;
  }
  if (/^169\.254\./.test(address)) {
    return true;
  }
  if (/^fc|^fd/i.test(address)) {
    return true;
  }
  return false;
}

async function fetchUrlText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let currentUrl = url;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'SouleSmartBusinessBot/1.0',
          accept: 'text/html,text/plain;q=0.9',
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new BadGatewayException('Redirect without location');
        }
        currentUrl = await validatePublicUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new BadGatewayException(`URL returned ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
        throw new BadRequestException('URL content type is not supported');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new BadGatewayException('URL response body missing');
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      const maxBytes = 2 * 1024 * 1024;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            throw new BadRequestException('URL content too large');
          }
          chunks.push(value);
        }
      }
      const html = Buffer.concat(chunks).toString('utf8');
      const text = htmlToText(html).trim();
      if (!text) {
        throw new BadRequestException('URL has no extractable text');
      }
      return text;
    }
    throw new BadRequestException('Too many redirects');
  } finally {
    clearTimeout(timeout);
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
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
