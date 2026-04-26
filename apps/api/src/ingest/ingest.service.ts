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
import { chunkText } from '../utils/chunk';
import { sha256 } from '../utils/hash';
import { randomUUID } from 'crypto';

const { PDFParse } = require('pdf-parse');

type KnowledgeDocumentRow = {
  id: string;
  type: string;
  title: string | null;
  source_url: string | null;
  created_at: string;
  chunk_count: number;
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

    const docId = randomUUID();

    try {
      await this.db.query(
        `INSERT INTO documents(id, tenant_id, site_id, type, title) VALUES ($1,$2,$3,$4,$5)`,
        [docId, tenantId, siteId, 'faq', title],
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

    return { documentId: docId, inserted };
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

    let text = '';
    let parser: InstanceType<typeof PDFParse> | null = null;
    try {
      parser = new PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
      text = (parsed.text || '').trim();
    } catch (error) {
      console.error('Failed to parse PDF', error);
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
        `INSERT INTO documents(id, tenant_id, site_id, type, title)
         VALUES ($1,$2,$3,$4,$5)`,
        [docId, tenantId, siteId, 'pdf', file.originalname],
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
        throw new InternalServerErrorException('Failed to store PDF chunk');
      }

      if (!res.skipped) inserted++;
    }

    return { documentId: docId, chunks: chunks.length, inserted };
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
         d.type,
         d.title,
         d.source_url,
         d.created_at,
         COUNT(c.id)::int AS chunk_count
       FROM documents d
       LEFT JOIN chunks c ON c.document_id = d.id
       WHERE d.site_id = $1
       GROUP BY d.id
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

    const existing = await this.db.query<{ id: string; site_id: string }>(
      `SELECT id, site_id
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

    return {
      ok: true,
      deletedId: documentId,
      siteId: row.site_id,
    };
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
