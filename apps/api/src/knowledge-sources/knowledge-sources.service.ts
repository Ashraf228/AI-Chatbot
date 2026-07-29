import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';
import {
  deriveLegacySyncStatus,
  normalizeKnowledgeSourceRuntimeReadiness,
  normalizeKnowledgeSourceUrlMetadata,
  resolveKnowledgeSourceLifecycle,
  sanitizeKnowledgeSourceErrorMessage,
  type KnowledgeSourceIngestStatus,
  type KnowledgeSourceIndexStatus,
  type KnowledgeSourceRuntimeReadiness,
  type KnowledgeSourceStatus,
} from './knowledge-source-readiness';

export type KnowledgeSourceType = 'faq' | 'pdf' | 'url' | 'manual' | 'product' | 'it_support_template' | 'other';

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
  last_ingest_at?: string | null;
  error_message?: string | null;
  ingest_status?: string | null;
  index_status?: string | null;
  runtime_readiness?: string | null;
  ingest_error_code?: string | null;
  ingest_error_message_sanitized?: string | null;
  normalized_source_url?: string | null;
  source_domain?: string | null;
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
    case 'it_support_template':
      return 'it_support_template';
    default:
      return 'other';
  }
}

@Injectable()
export class KnowledgeSourcesService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
  ) {}

  private mapRow(row: KnowledgeSourceRow) {
    const config = normalizeRecord(row.config);
    const isActive =
      typeof row.is_active === 'boolean'
        ? row.is_active
        : row.sync_status !== 'disabled' && config.isActive !== false;
    const lifecycle = resolveKnowledgeSourceLifecycle({
      syncStatus: row.sync_status,
      ingestStatus: row.ingest_status,
      indexStatus: row.index_status,
      runtimeReadiness: row.runtime_readiness,
      isActive,
      lastSyncedAt: row.last_synced_at,
    });

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
      normalizedSourceUrl: row.normalized_source_url || row.source_url || '',
      sourceDomain: row.source_domain || '',
      status: lifecycle.syncStatus,
      syncStatus: lifecycle.syncStatus,
      ingestStatus: lifecycle.ingestStatus,
      indexStatus: lifecycle.indexStatus,
      runtimeReadiness: lifecycle.runtimeReadiness,
      isActive,
      lastSyncedAt: row.last_synced_at || null,
      lastIngestAt: row.last_ingest_at || null,
      errorMessage: row.error_message || '',
      ingestErrorCode: row.ingest_error_code || '',
      ingestErrorMessageSanitized: row.ingest_error_message_sanitized || '',
      isAnswerReady: isActive && normalizeKnowledgeSourceRuntimeReadiness(lifecycle.runtimeReadiness) === 'ready',
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
         last_ingest_at,
         error_message,
         ingest_status,
         index_status,
         runtime_readiness,
         ingest_error_code,
         ingest_error_message_sanitized,
         normalized_source_url,
         source_domain,
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
         last_ingest_at,
         error_message,
         ingest_status,
         index_status,
         runtime_readiness,
         ingest_error_code,
         ingest_error_message_sanitized,
         normalized_source_url,
         source_domain,
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
    ingestStatus?: KnowledgeSourceIngestStatus;
    indexStatus?: KnowledgeSourceIndexStatus;
    runtimeReadiness?: KnowledgeSourceRuntimeReadiness;
  }) {
    const id = randomUUID();
    const isActive = input.isActive !== false;
    const lifecycle = resolveKnowledgeSourceLifecycle({
      syncStatus: input.syncStatus,
      ingestStatus: input.ingestStatus,
      indexStatus: input.indexStatus,
      runtimeReadiness: input.runtimeReadiness,
      isActive,
    });
    const urlMetadata = normalizeKnowledgeSourceUrlMetadata(input.sourceUrl);
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
         ingest_status,
         index_status,
         runtime_readiness,
         ingest_error_code,
         ingest_error_message_sanitized,
         normalized_source_url,
         source_domain,
         config,
         last_synced_at,
         last_ingest_at,
         error_message,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, null, null, $13, $14, $15::jsonb, $16, $17, null, now(), now())`,
      [
        id,
        input.tenantId,
        input.siteId,
        normalizeSourceType(input.sourceType),
        input.label,
        input.description || null,
        input.sourceUrl || null,
        lifecycle.syncStatus,
        isActive,
        lifecycle.ingestStatus,
        lifecycle.indexStatus,
        lifecycle.runtimeReadiness,
        urlMetadata.normalizedSourceUrl,
        urlMetadata.sourceDomain,
        JSON.stringify(normalizeRecord(input.config)),
        lifecycle.runtimeReadiness === 'ready' ? new Date().toISOString() : null,
        lifecycle.ingestStatus !== 'created' ? new Date().toISOString() : null,
      ],
    );

    return id;
  }

  async setActive(sourceId: string, isActive: boolean) {
    const existing = await this.getById(sourceId);
    if (!existing) {
      throw new NotFoundException('Knowledge source not found');
    }

    const status: KnowledgeSourceStatus = deriveLegacySyncStatus({
      syncStatus: existing.syncStatus,
      ingestStatus: existing.ingestStatus,
      runtimeReadiness: existing.runtimeReadiness,
      isActive,
    });
    const res = await this.db.query<KnowledgeSourceRow>(
      `UPDATE knowledge_sources
       SET is_active = $2,
           sync_status = $3,
           updated_at = now()
       WHERE id = $1
       RETURNING id, tenant_id, site_id, source_type, label, description, source_url, sync_status, is_active,
                 last_synced_at, last_ingest_at, error_message, ingest_status, index_status, runtime_readiness,
                 ingest_error_code, ingest_error_message_sanitized, normalized_source_url, source_domain,
                 config, created_at, updated_at`,
      [sourceId, isActive, status],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Knowledge source not found');
    }
    return this.mapRow({ ...row, sync_status: status, is_active: isActive });
  }

  async markProcessing(sourceId: string) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'processing',
           ingest_status = 'processing',
           index_status = 'pending',
           runtime_readiness = 'not_ready',
           ingest_error_code = null,
           ingest_error_message_sanitized = null,
           error_message = null,
           last_ingest_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [sourceId],
    );
  }

  async markFetchPending(sourceId: string, metadataPatch?: Record<string, unknown>) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'pending',
           ingest_status = 'fetch_pending',
           index_status = 'not_requested',
           runtime_readiness = 'not_ready',
           ingest_error_code = null,
           ingest_error_message_sanitized = null,
           error_message = null,
           config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [sourceId, JSON.stringify(normalizeRecord(metadataPatch))],
    );
  }

  async markFetching(sourceId: string, metadataPatch?: Record<string, unknown>) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'processing',
           ingest_status = 'fetching',
           index_status = 'not_requested',
           runtime_readiness = 'not_ready',
           ingest_error_code = null,
           ingest_error_message_sanitized = null,
           error_message = null,
           last_ingest_at = now(),
           config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [sourceId, JSON.stringify(normalizeRecord(metadataPatch))],
    );
  }

  async markFetched(sourceId: string, metadataPatch?: Record<string, unknown>) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'processing',
           ingest_status = 'fetched',
           index_status = 'not_requested',
           runtime_readiness = 'not_ready',
           ingest_error_code = null,
           ingest_error_message_sanitized = null,
           error_message = null,
           last_ingest_at = now(),
           config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [sourceId, JSON.stringify(normalizeRecord(metadataPatch))],
    );
  }

  async markReady(sourceId: string, metadataPatch?: Record<string, unknown>) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'ready',
           ingest_status = 'extracted',
           index_status = 'indexed',
           runtime_readiness = 'ready',
           is_active = true,
           last_synced_at = now(),
           last_ingest_at = now(),
           ingest_error_code = null,
           ingest_error_message_sanitized = null,
           error_message = null,
           config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [sourceId, JSON.stringify(normalizeRecord(metadataPatch))],
    );
  }

  async markExtracted(sourceId: string, metadataPatch?: Record<string, unknown>) {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'processing',
           ingest_status = 'extracted',
           index_status = 'not_requested',
           runtime_readiness = 'not_ready',
           ingest_error_code = null,
           ingest_error_message_sanitized = null,
           error_message = null,
           last_ingest_at = now(),
           config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [sourceId, JSON.stringify(normalizeRecord(metadataPatch))],
    );
  }

  async markFailed(sourceId: string, message: string, errorCode = 'ingest_failed') {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'failed',
           ingest_status = 'failed',
           index_status = 'failed',
           runtime_readiness = 'failed',
           ingest_error_code = $3,
           ingest_error_message_sanitized = $4,
           error_message = $2,
           last_ingest_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [sourceId, message.slice(0, 1000), errorCode, sanitizeKnowledgeSourceErrorMessage(message)],
    );
  }

  async markBlocked(sourceId: string, message: string, errorCode = 'ingest_blocked') {
    await this.db.query(
      `UPDATE knowledge_sources
       SET sync_status = 'failed',
           ingest_status = 'blocked',
           index_status = 'blocked',
           runtime_readiness = 'blocked',
           ingest_error_code = $3,
           ingest_error_message_sanitized = $4,
           error_message = $2,
           last_ingest_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [sourceId, message.slice(0, 1000), errorCode, sanitizeKnowledgeSourceErrorMessage(message)],
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
