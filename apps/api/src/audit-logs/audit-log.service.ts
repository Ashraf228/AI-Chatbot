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
        JSON.stringify(input.metadata || {}),
      ],
    );
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
