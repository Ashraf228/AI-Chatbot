import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';

type UsageDailyRow = {
  tenant_id: string;
  site_id: string;
  day: string;
  request_count: number;
  user_message_count: number;
  assistant_message_count: number;
  created_at: string;
  updated_at: string;
};

type UsageSummaryRow = {
  total_requests: number;
  total_user_messages: number;
  total_assistant_messages: number;
};

@UseGuards(AdminKeyGuard)
@RequireDashboardRoles('admin')
@Controller('admin/usage')
export class UsageController {
  constructor(private db: PrismaService) {}

  @Get()
  async list(
    @Query('tenantId') tenantId?: string,
    @Query('siteId') siteId?: string,
  ) {
    const params: string[] = [];
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

    const res = await this.db.query<UsageDailyRow>(
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

    const measurements = await this.measurements(whereSql, params, true);
    const byDay = new Map(measurements.map((row) => [JSON.stringify([row.tenant_id, row.site_id, dayKey(row.day)]), row.llm_usage]));
    const costPerRequest = 0.001;

    const enriched = res.rows.map((row) => {
      const requests = Number(row.request_count) || 0;
      const estimatedCost = requests * costPerRequest;

      return {
        ...row,
        llm_usage: byDay.get(JSON.stringify([row.tenant_id, row.site_id, dayKey(row.day)])) || emptyMeasurement(),
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
    const params: string[] = [];
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

    const res = await this.db.query<UsageSummaryRow>(
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
    const measurements = await this.measurements(whereSql, params, false);

    const totalRequests = Number(data.total_requests) || 0;
    const costPerRequest = 0.001;

    return {
      ...data,
      llm_usage: measurements[0]?.llm_usage || emptyMeasurement(),
      estimated_cost: totalRequests * costPerRequest,
    };
  }

  private async measurements(whereSql: string, params: string[], daily: boolean) {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${daily ? 'tenant_id, site_id, created_at::date AS day,' : ''}
        COUNT(*) FILTER (WHERE usage_status = 'confirmed') AS confirmed_calls,
        COUNT(*) FILTER (WHERE usage_status IN ('missing', 'incomplete')) AS unmeasured_calls,
        COUNT(*) FILTER (WHERE usage_status = 'legacy') AS legacy_events,
        SUM(input_tokens) FILTER (WHERE usage_status = 'confirmed') AS input_tokens,
        SUM(output_tokens) FILTER (WHERE usage_status = 'confirmed') AS output_tokens,
        SUM(total_tokens) FILTER (WHERE usage_status = 'confirmed') AS total_tokens
       FROM usage_events ${whereSql}
       ${daily ? 'GROUP BY tenant_id, site_id, created_at::date' : ''}`,
      params,
    );
    return rows.rows.map((row) => ({
      tenant_id: row.tenant_id, site_id: row.site_id, day: row.day,
      llm_usage: {
        confirmed_calls: Number(row.confirmed_calls),
        unmeasured_calls: Number(row.unmeasured_calls),
        legacy_events: Number(row.legacy_events),
        input_tokens: row.input_tokens == null ? null : Number(row.input_tokens),
        output_tokens: row.output_tokens == null ? null : Number(row.output_tokens),
        total_tokens: row.total_tokens == null ? null : Number(row.total_tokens),
      },
    }));
  }

}


function emptyMeasurement() {
  return { confirmed_calls: 0, unmeasured_calls: 0, legacy_events: 0, input_tokens: null, output_tokens: null, total_tokens: null };
}

function dayKey(value: unknown) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
