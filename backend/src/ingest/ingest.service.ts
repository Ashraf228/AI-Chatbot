import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { SitesService } from '../sites/sites.service';
import { chunkText } from '../utils/chunk';
import { sha256 } from '../utils/hash';
import { randomUUID } from 'crypto';
import pdfParse from 'pdf-parse';

@Injectable()
export class IngestService {
  constructor(
    private db: PrismaService,
    private embedder: EmbeddingService,
    private vector: VectorService,
    private sites: SitesService,
  ) {}

  async ingestFaq(siteId: string, title: string, items: Array<{ q: string; a: string }>) {
    if (!siteId) throw new Error('siteId missing');

    const site = await this.sites.getSite(siteId);
    if (!site?.tenant_id) throw new Error('Invalid siteId / tenant missing');
    const tenantId = site.tenant_id;

    const docId = randomUUID();
    await this.db.query(
      `INSERT INTO documents(id, tenant_id, site_id, type, title) VALUES ($1,$2,$3,$4,$5)`,
      [docId, tenantId, siteId, 'faq', title],
    );

    let inserted = 0;
    for (const it of items) {
      const content = `Frage: ${it.q}\nAntwort: ${it.a}`.trim();
      if (!content) continue;

      const embedding = await this.embedder.embed(content);

      const res = await this.vector.upsertChunk({
        id: randomUUID(),
        tenantId,
        siteId,
        documentId: docId,
        content,
        metadata: { kind: 'faq', q: it.q },
        contentHash: sha256(content),
        embedding,
      });

      if (!res.skipped) inserted++;
    }

    return { documentId: docId, inserted };
  }

  async ingestPdf(siteId: string, file: { buffer: Buffer; originalname: string }) {
    if (!siteId) throw new Error('siteId missing');
    if (!file?.buffer) throw new Error('file missing');

    const site = await this.sites.getSite(siteId);
    if (!site?.tenant_id) throw new Error('Invalid siteId / tenant missing');
    const tenantId = site.tenant_id;

    const parsed = await pdfParse(file.buffer);
    const text = (parsed.text || '').trim();
    if (!text) throw new Error('PDF has no extractable text');

    const docId = randomUUID();
    await this.db.query(
      `INSERT INTO documents(id, tenant_id, site_id, type, title) VALUES ($1,$2,$3,$4,$5)`,
      [docId, tenantId, siteId, 'pdf', file.originalname],
    );

    const chunks = chunkText(text, 1400, 250);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const embedding = await this.embedder.embed(content);

      const res = await this.vector.upsertChunk({
        id: randomUUID(),
        tenantId,
        siteId,
        documentId: docId,
        content,
        metadata: { kind: 'pdf', filename: file.originalname, chunkIndex: i },
        contentHash: sha256(content),
        embedding,
      });

      if (!res.skipped) inserted++;
    }

    return { documentId: docId, chunks: chunks.length, inserted };
  }
}