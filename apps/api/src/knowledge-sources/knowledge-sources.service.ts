import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';

export type KnowledgeSourceType = 'faq' | 'pdf' | 'url' | 'manual' | 'product' | 'other';
export type KnowledgeSourceStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'disabled';

type KnowledgeSourceRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  source_type: string;
  label: string;
  description?: string | null;
  source_url: string | null;
  sync_status: string;
  is_active?: boolean | null;
  last_synced_at?: string | null;
  error_message?: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function normalizeRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeSourceType(value: string): KnowledgeSourceType {
  switch (value) {
    case 'faq':
    case 'faq_manual':
      return 'faq';
    case 'pdf':
    case 'pdf_upload':
      return 'pdf';
    case 'url':
    case 'website_url':
      return 'url';
    case 'manual':
      return 'manual';
    case 'product':
      return 'product';
    default:
      return 'other';
  }
}

function normalizeStatus(value: string): KnowledgeSourceStatus {
  if (['pending', 'processing', 'ready', 'failed', 'disabled'].includes(value)) {
    return value as KnowledgeSourceStatus;
  }
  return 'ready';
}

@Injectable()
export class KnowledgeSourcesService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
  ) {}

  private mapRow(row: KnowledgeSourceRow) {
    const config = normalizeRecord(row.config);
    const status = normalizeStatus(row.sync_status);
    const isActive =
      typeof row.is_active === 'boolean'
        ? row.is_active
        : status !== 'disabled' && config.isActive !== false;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      type: normalizeSourceType(row.source_type),
      sourceType: row.source_type,
      title: row.label,
      label: row.label,
      description: row.description || '',
      url: row.source_url || '',
      sourceUrl: row.source_url || '',
      status,
      syncStatus: status,
      isActive,
      lastSyncedAt: row.last_synced_at || null,
      errorMessage: row.error_message || '',
      metadata: config,
      config,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

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
         description,
         source_url,
         sync_status,
         is_active,
         last_synced_at,
         error_message,
         config,
         created_at,
         updated_at
       FROM knowledge_sources
       WHERE site_id = $1
       ORDER BY created_at DESC`,
      [siteId],
    );

    return res.rows.map((row) => this.mapRow(row));
  }

  async getById(sourceId: string) {
    const res = await this.db.query<KnowledgeSourceRow>(
      `SELECT
         id,
         tenant_id,
         site_id,
         source_type,
         label,
         description,
         source_url,
         sync_status,
         is_active,
         last_synced_at,
         error_message,
         config,
         created_at,
         updated_at
       FROM knowledge_sources
       WHERE id = $1
       LIMIT 1`,
      [sourceId],
    );
    const row = res.rows[0];
    return row ? this.mapRow(row) : null;
  }

  async createForSite(input: {
    tenantId: string;
    siteId: string;
    sourceType: string;
    label: string;
    description?: string | null;
    sourceUrl?: string | null;
    config?: Record<string, unknown>;
    syncStatus?: KnowledgeSourceStatus;
    isActive?: boolean;
  }) {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO knowledge_sources(
         id,
         tenant_id,
         site_id,
         source_type,
         label,
         description,
         source_url,
         sync_status,
         is_active,
         config,
         last_synced_at,
         error_message,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, null, now(), now())`,
      [
        id,
        input.tenantId,
        input.siteId,
        normalizeSourceType(input.sourceType),
        input.label,
        input.description || null,
        input.sourceUrl || null,
        input.syncStatus || 'ready',
        input.isActive !== false,
        JSON.stringify(normalizeRecord(input.config)),
        input.syncStatus === 'ready' ? new Date().toISOString() : null,
      ],
    );

    return id;
  }

  async setActive(sourceId: string, isActive: boolean) {
    const status: KnowledgeSourceStatus = isActive ? 'ready' : 'disabled';
    const res = await this.db.query<KnowledgeSourceRow>(
      `UPDATE knowledge_sources
       SET is_active = $2,
           sync_status = CASE WHEN $2 = false THEN 'disabled' ELSE CASE WHEN sync_status = 'disabled' THEN 'ready' ELSE sync_status END END,
           updated_at = now()
       WHERE id = $1
       RETURNING id, tenant_id, site_id, source_type, label, description, source_url, sync_status, is_active,
                 last_synced_at, error_message, config, created_at, updated_at`,
      [sourceId, isActive],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Knowledge source not found');
    }
    return this.mapRow({ ...row, sync_status: status });
  }

  async markProcessing(sourceId: string) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'processing',
           error_message = null,
           updated_at = now()
       WHERE id = $1`,
      [sourceId],
    );
  }

  async markReady(sourceId: string, metadataPatch?: Record<string, unknown>) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'ready',
           is_active = true,
           last_synced_at = now(),
           error_message = null,
           config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [sourceId, JSON.stringify(normalizeRecord(metadataPatch))],
    );
  }

  async markFailed(sourceId: string, message: string) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'failed',
           error_message = $2,
           updated_at = now()
       WHERE id = $1`,
      [sourceId, message.slice(0, 1000)],
    );
  }

  async deleteSource(sourceId: string) {
    const source = await this.getById(sourceId);
    if (!source) {
      throw new NotFoundException('Knowledge source not found');
    }

    await this.db.query(
      `DELETE FROM documents
       WHERE source_id = $1`,
      [sourceId],
    );
    await this.db.query(
      `DELETE FROM knowledge_sources
       WHERE id = $1`,
      [sourceId],
    );

    return {
      ok: true,
      deletedId: sourceId,
      siteId: source.siteId,
    };
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
