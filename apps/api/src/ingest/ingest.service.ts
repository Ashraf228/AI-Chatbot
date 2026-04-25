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
}
