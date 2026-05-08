import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { IndustryTemplatesService } from './industry-templates.service';
import { AdminScopeService } from '../utils/admin-scope.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites')
export class IndustryTemplateSitesController {
  constructor(
    private readonly templates: IndustryTemplatesService,
    private readonly scope: AdminScopeService,
  ) {}

  @Post(':siteId/apply-template')
  async applyTemplate(
    @Param('siteId') siteId: string,
    @Body()
    body: {
      templateId?: string;
      templateKey?: string;
      mode?: 'fill_missing_only' | 'overwrite';
      appliedBy?: string;
      actorRole?: string;
    },
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    this.scope.assertRole(auth, ['admin', 'operator']);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.templates.applyTemplate(siteId, {
      templateKey: String(body.templateId || body.templateKey || ''),
      mode: body.mode,
      appliedBy: auth.actorId || body.appliedBy,
      actorRole: auth.role || body.actorRole,
    });
  }
}
