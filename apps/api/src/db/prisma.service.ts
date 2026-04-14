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
        tenant_id TEXT,
        name TEXT NOT NULL,
        allowed_domains TEXT[] NOT NULL DEFAULT '{}',
        public_key TEXT,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
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
        tenant_id TEXT,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        content_hash TEXT NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS widget_sessions (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        visitor_id TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        source_url TEXT,
        user_agent TEXT,
        lead_captured BOOLEAN NOT NULL DEFAULT false
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS widget_events (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        page_url TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS widget_leads (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS report_subscriptions (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        recipient_email TEXT NOT NULL,
        frequency TEXT NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS report_runs (
        id TEXT PRIMARY KEY,
        site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
        frequency TEXT NOT NULL,
        trigger_source TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL DEFAULT 'queued',
        recipient_email TEXT,
        report_subject TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        success BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS usage_daily (
        tenant_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        day DATE NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        user_message_count INTEGER NOT NULL DEFAULT 0,
        assistant_message_count INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, site_id, day)
      );
    `);

    await this.query(`
      ALTER TABLE sites
      ADD COLUMN IF NOT EXISTS tenant_id TEXT,
      ADD COLUMN IF NOT EXISTS public_key TEXT,
      ADD COLUMN IF NOT EXISTS allowed_domains TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);

    await this.query(`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS tenant_id TEXT,
      ADD COLUMN IF NOT EXISTS source_url TEXT;
    `);

    await this.query(`
      ALTER TABLE chunks
      ADD COLUMN IF NOT EXISTS tenant_id TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS embedding vector(1536);
    `);

    await this.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS tenant_id TEXT,
      ADD COLUMN IF NOT EXISTS site_id TEXT,
      ADD COLUMN IF NOT EXISTS session_id TEXT,
      ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT now();
    `);

    await this.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    `);

    await this.query(`CREATE INDEX IF NOT EXISTS chunks_site_idx ON chunks(site_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS chunks_tenant_idx ON chunks(tenant_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS chunks_doc_idx ON chunks(document_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS documents_site_idx ON documents(site_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS conversations_site_idx ON conversations(site_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS conversations_tenant_idx ON conversations(tenant_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS conversations_last_active_idx ON conversations(last_active_at DESC);`);
    await this.query(`CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);`);
    await this.query(`CREATE UNIQUE INDEX IF NOT EXISTS widget_sessions_site_visitor_idx ON widget_sessions(site_id, visitor_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS widget_events_site_created_idx ON widget_events(site_id, created_at DESC);`);
    await this.query(`CREATE INDEX IF NOT EXISTS widget_leads_site_created_idx ON widget_leads(site_id, created_at DESC);`);
    await this.query(`CREATE INDEX IF NOT EXISTS report_subscriptions_site_idx ON report_subscriptions(site_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS report_runs_site_created_idx ON report_runs(site_id, created_at DESC);`);
    await this.query(`CREATE INDEX IF NOT EXISTS usage_events_tenant_site_idx ON usage_events(tenant_id, site_id, created_at DESC);`);
    await this.query(`CREATE UNIQUE INDEX IF NOT EXISTS conversations_session_key ON conversations(tenant_id, site_id, session_id);`);

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
