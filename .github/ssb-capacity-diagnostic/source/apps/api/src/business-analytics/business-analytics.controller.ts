import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { BusinessAnalyticsService } from './business-analytics.service';
import { SitesService } from '../sites/sites.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AdminScopeService } from '../utils/admin-scope.service';

@UseGuards(AdminKeyGuard)
@Controller('admin')
export class BusinessAnalyticsController {
  constructor(
    private readonly analytics: BusinessAnalyticsService,
    private readonly sites: SitesService,
    private readonly scope: AdminScopeService,
  ) {}

  @Get('dashboard/summary')
  async dashboardSummary(@Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    const sites = this.scope.filterSitesForAuth(auth, await this.sites.listSites());
    return this.analytics.buildDashboardSummary(sites.map((site) => site.id));
  }

  @Get('sites/:siteId/analytics/summary')
  async siteSummary(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.analytics.buildSiteSummary(siteId);
  }
}
