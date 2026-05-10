import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export type VectorChunkMetadata = Record<string, unknown>;

export type VectorSearchRow = {
  id: string;
  document_id: string;
  source_id: string | null;
  source_type: string | null;
  source_label: string | null;
  content: string;
  metadata: VectorChunkMetadata;
  title: string | null;
  source_url: string | null;
  score: number;
};

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
    metadata: VectorChunkMetadata;
    contentHash: string;
    embedding: number[];
  }) {
    const exists = await this.db.query<{ id: string }>(
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

  async updateChunk(params: {
    id: string;
    content: string;
    metadata: VectorChunkMetadata;
    contentHash: string;
    embedding: number[];
  }) {
    await this.db.query(
      `UPDATE chunks
       SET content = $2,
           metadata = $3,
           content_hash = $4,
           embedding = $5::vector
       WHERE id = $1`,
      [
        params.id,
        params.content,
        params.metadata,
        params.contentHash,
        this.toPgVectorLiteral(params.embedding),
      ],
    );

    return { id: params.id, updated: true };
  }

  async search(
    tenantId: string,
    siteId: string,
    embedding: number[],
    k = 6,
    minScore?: number,
  ): Promise<VectorSearchRow[]> {
    const res = await this.db.query<VectorSearchRow>(
      `
      WITH ranked AS (
        SELECT
          c.id,
          c.document_id,
          d.source_id,
          ks.source_type,
          ks.label AS source_label,
          c.content,
          c.metadata,
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
          AND COALESCE(ks.sync_status, 'ready') = 'ready'
      )
      SELECT
        id,
        document_id,
        source_id,
        source_type,
        source_label,
        content,
        metadata,
        title,
        source_url,
        score
      FROM ranked
      WHERE ($5::double precision IS NULL OR score >= $5::double precision)
      ORDER BY distance
      LIMIT $4
      `,
      [tenantId, siteId, this.toPgVectorLiteral(embedding), k, minScore ?? null],
    );

    return res.rows;
  }
}
