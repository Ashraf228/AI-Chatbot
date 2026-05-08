import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';

export type AuditActor = {
  actorId?: string | null;
  actorRole?: string | null;
};

export type AuditLogInput = AuditActor & {
  siteId?: string | null;
  tenantId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditLogRow = {
  id: string;
  site_id: string | null;
  tenant_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const SENSITIVE_KEY_PATTERN = /(secret|token|password|passwort|api[_-]?key|apikey|oauth|authorization|private[_-]?key)/i;

function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadata(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeMetadata(entry),
    ]),
  );
}

function mapAuditLogRow(row: AuditLogRow) {
  return {
    id: row.id,
    siteId: row.site_id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

@Injectable()
export class AuditLogService {
  constructor(private readonly db: PrismaService) {}

  async record(input: AuditLogInput) {
    const tenantId = input.tenantId || (await this.resolveTenantId(input.siteId));

    await this.db.query(
      `INSERT INTO audit_logs(
         id, site_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
      [
        randomUUID(),
        input.siteId || null,
        tenantId,
        input.actorId || 'dashboard',
        input.actorRole || 'operator',
        input.action,
        input.resourceType,
        input.resourceId || null,
        JSON.stringify(sanitizeMetadata(input.metadata || {})),
      ],
    );
  }

  async list(params: { siteId?: string; limit?: number } = {}) {
    const values: unknown[] = [];
    const where: string[] = [];

    if (params.siteId) {
      values.push(params.siteId);
      where.push(`site_id = $${values.length}`);
    }

    const limit = Math.min(Math.max(Number(params.limit || 100), 1), 500);
    values.push(limit);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const res = await this.db.query<AuditLogRow>(
      `SELECT
         id,
         site_id,
         tenant_id,
         actor_id,
         actor_role,
         action,
         resource_type,
         resource_id,
         metadata,
         created_at
       FROM audit_logs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${values.length}`,
      values,
    );

    return res.rows.map(mapAuditLogRow);
  }

  private async resolveTenantId(siteId?: string | null) {
    if (!siteId) {
      return null;
    }

    const site = await this.db.query<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM sites WHERE id = $1 LIMIT 1`,
      [siteId],
    );

    return site.rows[0]?.tenant_id || null;
  }
}
