import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class VectorService {
  constructor(private db: PrismaService) {}

  // Hilfsfunktion zum Konvertieren des Embeddings in ein pgvector-kompatibles Literal
  private toPgVectorLiteral(embedding: number[]): string {
    // pgvector akzeptiert: [1,2,3] (ohne Quotes)
    return `[${embedding.map((x) => Number(x).toString()).join(',')}]`;
  }

  async upsertChunk(params: {
    id: string;
    siteId: string;
    documentId: string;
    content: string;
    metadata: any;
    contentHash: string;
    embedding: number[];
  }) {
    // Skip duplicates by content_hash per document
    const exists = await this.db.query(
      `SELECT id FROM chunks WHERE document_id=$1 AND content_hash=$2 LIMIT 1`,
      [params.documentId, params.contentHash],
    );
    if (exists.rows[0]) return { id: exists.rows[0].id, skipped: true };

    // INSERT mit ::vector Cast für das Embedding
    await this.db.query(
      `INSERT INTO chunks(id, site_id, document_id, content, metadata, content_hash, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7::vector)`,
      [
        params.id,
        params.siteId,
        params.documentId,
        params.content,
        params.metadata,
        params.contentHash,
        this.toPgVectorLiteral(params.embedding), // Konvertierung hier
      ],
    );
    return { id: params.id, skipped: false };
  }

async search(siteId: string, embedding: number[], k = 6) {
  const res = await this.db.query(
    `
    SELECT
      c.id,
      c.content,
      c.metadata,
      d.title,
      d.source_url,
      (1 - (c.embedding <=> $2::vector)) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.site_id = $1 AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $2::vector
    LIMIT $3
    `,
    [siteId, this.toPgVectorLiteral(embedding), k], // <— HIER
  );
  return res.rows;
}
}