import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AdminScopeService } from '../utils/admin-scope.service';
import { SiteDataExportService, type DeleteSiteDataScope, type PrivacyDeleteInput } from './site-data-export.service';
import { UsageLimitService } from '../billing/usage-limit.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites')
export class SiteDataController {
  constructor(
    private readonly siteData: SiteDataExportService,
    private readonly scope: AdminScopeService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  @Get(':siteId/export')
  async exportSiteData(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.requirePrivacyExportFeature(site.tenant_id);

    return this.siteData.exportSiteData(siteId, auth);
  }

  @Get(':siteId/privacy/export')
  async exportPrivacyData(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.requirePrivacyExportFeature(site.tenant_id);

    return this.siteData.exportPrivacyData(siteId, auth);
  }

  @Post(':siteId/delete-data')
  async deleteSiteData(
    @Param('siteId') siteId: string,
    @Body() body: { scope?: DeleteSiteDataScope; confirm?: boolean },
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin'],
    });

    return this.siteData.deleteSiteData(
      siteId,
      {
        scope: body.scope || 'all',
        confirm: body.confirm,
      },
      auth,
    );
  }

  @Post(':siteId/privacy/delete-data')
  async deletePrivacyData(
    @Param('siteId') siteId: string,
    @Body() body: PrivacyDeleteInput,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin'],
    });

    return this.siteData.deletePrivacyData(siteId, body, auth);
  }

  private async requirePrivacyExportFeature(tenantId: string | null) {
    if (!tenantId || await this.usageLimits.hasFeature(tenantId, 'privacyExport')) {
      return;
    }
    throw new ForbiddenException('Privacy export is not enabled for this plan');
  }
}
