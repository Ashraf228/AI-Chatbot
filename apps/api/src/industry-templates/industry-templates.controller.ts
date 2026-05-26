import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { IndustryTemplatesService } from './industry-templates.service';
import { AdminScopeService } from '../utils/admin-scope.service';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';

@UseGuards(AdminKeyGuard)
@Controller('admin/industry-templates')
export class IndustryTemplatesController {
  constructor(
    private readonly templates: IndustryTemplatesService,
    private readonly scope: AdminScopeService,
  ) {}

  @Get()
  list() {
    return this.templates.listTemplates();
  }

  @Post(':siteId/apply')
  @RequireDashboardRoles('admin', 'operator')
  async apply(
    @Param('siteId') siteId: string,
    @Body() body: { templateKey?: string; mode?: 'fill_missing_only' | 'overwrite'; appliedBy?: string },
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });

    return this.templates.applyTemplate(siteId, {
      templateKey: String(body.templateKey || ''),
      mode: body.mode,
      appliedBy: auth.actorId || body.appliedBy,
    });
  }
}
