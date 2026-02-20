import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL missing');
    this.pool = new Pool({ connectionString });
  }

  async onModuleInit() {
    await this.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    await this.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        allowed_domains TEXT[] NOT NULL DEFAULT '{}',
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT,
        source_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // embedding dimension must match the embedding model; text-embedding-3-small = 1536
    await this.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        content_hash TEXT NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`CREATE INDEX IF NOT EXISTS chunks_site_idx ON chunks(site_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS chunks_doc_idx ON chunks(document_id);`);

    // Vector index (approx). Requires embeddings present.
    await this.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chunks_embedding_idx') THEN
          CREATE INDEX chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        END IF;
      END$$;
    `);
  }

  async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> {
    return this.pool.query(sql, params);
  }
}