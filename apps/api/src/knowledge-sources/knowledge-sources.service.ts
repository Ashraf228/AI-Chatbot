import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';

type KnowledgeSourceRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  source_type: string;
  label: string;
  source_url: string | null;
  sync_status: string;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function normalizeRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

@Injectable()
export class KnowledgeSourcesService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
  ) {}

  async listForSite(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const res = await this.db.query<KnowledgeSourceRow>(
      `SELECT
         id,
         tenant_id,
         site_id,
         source_type,
         label,
         source_url,
         sync_status,
         config,
         created_at,
         updated_at
       FROM knowledge_sources
       WHERE site_id = $1
       ORDER BY created_at DESC`,
      [siteId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      sourceType: row.source_type,
      label: row.label,
      sourceUrl: row.source_url || '',
      syncStatus: row.sync_status,
      config: normalizeRecord(row.config),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createForSite(input: {
    tenantId: string;
    siteId: string;
    sourceType: string;
    label: string;
    sourceUrl?: string | null;
    config?: Record<string, unknown>;
    syncStatus?: 'ready' | 'pending' | 'failed';
  }) {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO knowledge_sources(
         id,
         tenant_id,
         site_id,
         source_type,
         label,
         source_url,
         sync_status,
         config,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now(), now())`,
      [
        id,
        input.tenantId,
        input.siteId,
        input.sourceType,
        input.label,
        input.sourceUrl || null,
        input.syncStatus || 'ready',
        JSON.stringify(normalizeRecord(input.config)),
      ],
    );

    return id;
  }

  async deleteIfUnused(sourceId: string) {
    if (!sourceId?.trim()) {
      return;
    }

    const inUse = await this.db.query<{ id: string }>(
      `SELECT id
       FROM documents
       WHERE source_id = $1
       LIMIT 1`,
      [sourceId],
    );

    if (inUse.rows[0]) {
      return;
    }

    await this.db.query(`DELETE FROM knowledge_sources WHERE id = $1`, [sourceId]);
  }
}
