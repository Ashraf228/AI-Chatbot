import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AdminKeyGuard } from '../utils/admin.guard';

@UseGuards(AdminKeyGuard)
@Controller('admin/usage')
export class UsageController {
  constructor(private db: PrismaService) {}

  @Get()
  async list(
    @Query('tenantId') tenantId?: string,
    @Query('siteId') siteId?: string,
  ) {
    const params: any[] = [];
    const where: string[] = [];

    if (tenantId) {
      params.push(tenantId);
      where.push(`tenant_id = $${params.length}`);
    }

    if (siteId) {
      params.push(siteId);
      where.push(`site_id = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const res = await this.db.query(
      `
      SELECT
        tenant_id,
        site_id,
        day,
        request_count,
        user_message_count,
        assistant_message_count,
        created_at,
        updated_at
      FROM usage_daily
      ${whereSql}
      ORDER BY day DESC, tenant_id ASC, site_id ASC
      LIMIT 180
      `,
      params,
    );

    const costPerRequest = 0.001;

    const enriched = res.rows.map((row: any) => {
      const requests = Number(row.request_count) || 0;
      const estimatedCost = requests * costPerRequest;

      return {
        ...row,
        estimated_cost: estimatedCost,
      };
    });

    return enriched;
  }

  @Get('summary')
  async summary(
    @Query('tenantId') tenantId?: string,
    @Query('siteId') siteId?: string,
  ) {
    const params: any[] = [];
    const where: string[] = [];

    if (tenantId) {
      params.push(tenantId);
      where.push(`tenant_id = $${params.length}`);
    }

    if (siteId) {
      params.push(siteId);
      where.push(`site_id = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const res = await this.db.query(
      `
      SELECT
        COALESCE(SUM(request_count), 0) AS total_requests,
        COALESCE(SUM(user_message_count), 0) AS total_user_messages,
        COALESCE(SUM(assistant_message_count), 0) AS total_assistant_messages
      FROM usage_daily
      ${whereSql}
      `,
      params,
    );

    const data = res.rows[0];

    const totalRequests = Number(data.total_requests) || 0;
    const costPerRequest = 0.001;

    return {
      ...data,
      estimated_cost: totalRequests * costPerRequest,
    };
  }
}