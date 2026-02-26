import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class VectorService {
  constructor(private db: PrismaService) {}

  private toPgVectorLiteral(embedding: number[]): string {
    return `[${embedding.map((x) => Number(x).toString()).join(',')}]`;
  }

  async upsertChunk(params: {
    id: string;
    tenantId: string;
    siteId: string;
    documentId: string;
    content: string;
    metadata: any;
    contentHash: string;
    embedding: number[];
  }) {
    const exists = await this.db.query(
      `SELECT id FROM chunks WHERE tenant_id=$1 AND document_id=$2 AND content_hash=$3 LIMIT 1`,
      [params.tenantId, params.documentId, params.contentHash],
    );
    if (exists.rows[0]) return { id: exists.rows[0].id, skipped: true };

    await this.db.query(
      `INSERT INTO chunks(id, tenant_id, site_id, document_id, content, metadata, content_hash, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector)`,
      [
        params.id,
        params.tenantId,
        params.siteId,
        params.documentId,
        params.content,
        params.metadata,
        params.contentHash,
        this.toPgVectorLiteral(params.embedding),
      ],
    );

    return { id: params.id, skipped: false };
  }

  async search(tenantId: string, siteId: string, embedding: number[], k = 6) {
    const res = await this.db.query(
      `
      SELECT
        c.id,
        c.content,
        c.metadata,
        d.title,
        d.source_url,
        (1 - (c.embedding <=> $3::vector)) AS score
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.tenant_id = $1
        AND c.site_id = $2
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $3::vector
      LIMIT $4
      `,
      [tenantId, siteId, this.toPgVectorLiteral(embedding), k],
    );

    return res.rows;
  }
}