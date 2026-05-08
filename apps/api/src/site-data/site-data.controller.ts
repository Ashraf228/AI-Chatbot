import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AdminScopeService } from '../utils/admin-scope.service';
import { SiteDataExportService, type DeleteSiteDataScope } from './site-data-export.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites')
export class SiteDataController {
  constructor(
    private readonly siteData: SiteDataExportService,
    private readonly scope: AdminScopeService,
  ) {}

  @Get(':siteId/export')
  async exportSiteData(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });

    return this.siteData.exportSiteData(siteId, auth);
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
}
