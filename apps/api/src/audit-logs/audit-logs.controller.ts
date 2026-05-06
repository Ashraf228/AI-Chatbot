import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';

type AuditLogRow = {
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

@UseGuards(AdminKeyGuard)
@RequireDashboardRoles('admin')
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async list(
    @Query('siteId') siteId?: string,
    @Query('limit') rawLimit?: string,
  ) {
    const params: unknown[] = [];
    const where: string[] = [];

    if (siteId) {
      params.push(siteId);
      where.push(`site_id = $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(rawLimit || 100), 1), 500);
    params.push(limit);
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
       LIMIT $${params.length}`,
      params,
    );

    return res.rows.map((row) => ({
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
    }));
  }
}
