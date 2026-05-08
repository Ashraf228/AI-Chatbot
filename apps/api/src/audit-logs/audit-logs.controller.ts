import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AdminScopeService } from '../utils/admin-scope.service';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';

@UseGuards(AdminKeyGuard)
@Controller('admin')
export class AuditLogsController {
  constructor(
    private readonly auditLogs: AuditLogService,
    private readonly scope: AdminScopeService,
  ) {}

  @Get('audit-logs')
  @RequireDashboardRoles('admin')
  async list(
    @Query('siteId') siteId?: string,
    @Query('limit') rawLimit?: string,
  ) {
    return this.auditLogs.list({
      siteId,
      limit: Number(rawLimit || 100),
    });
  }

  @Get('sites/:siteId/audit-logs')
  async listForSite(
    @Param('siteId') siteId: string,
    @Query('limit') rawLimit: string | undefined,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });

    return this.auditLogs.list({
      siteId,
      limit: Number(rawLimit || 100),
    });
  }
}
