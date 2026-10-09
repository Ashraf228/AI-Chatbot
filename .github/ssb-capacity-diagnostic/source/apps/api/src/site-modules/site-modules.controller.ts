import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { UpdateSiteModulesDto } from './dto';
import { SiteModulesService } from './site-modules.service';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';
import { AdminScopeService } from '../utils/admin-scope.service';
import { AuditLogService } from '../audit-logs/audit-log.service';

@UseGuards(AdminKeyGuard)
@RequireDashboardRoles('admin')
@Controller('admin/site-modules')
export class SiteModulesController {
  constructor(
    private readonly siteModules: SiteModulesService,
    private readonly scope: AdminScopeService,
    private readonly auditLogs: AuditLogService,
  ) {}

  @Get('catalog')
  async catalog() {
    return this.siteModules.listCatalog();
  }

  @Get(':siteId')
  async list(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin'],
    });
    return this.siteModules.listForSite(siteId);
  }

  @Patch(':siteId')
  async update(
    @Param('siteId') siteId: string,
    @Body() dto: UpdateSiteModulesDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin'],
    });
    const result = await this.siteModules.updateForSite(siteId, dto.modules);
    await this.auditLogs.record({
      siteId,
      actorId: auth.actorId,
      actorRole: auth.role,
      action: 'update_site_modules',
      resourceType: 'site_modules',
      resourceId: siteId,
      metadata: {
        moduleKeys: dto.modules.map((module) => module.key),
        enabledModuleKeys: dto.modules.filter((module) => module.isEnabled).map((module) => module.key),
        moduleCount: dto.modules.length,
      },
    });
    return result;
  }
}
