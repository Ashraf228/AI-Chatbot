import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../../utils/admin.guard';
import { AdminScopeService } from '../../utils/admin-scope.service';
import { ItSupportReadinessService } from './it-support-readiness.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites/:siteId/it-support/readiness')
export class ItSupportReadinessController {
  constructor(
    private readonly scope: AdminScopeService,
    private readonly readiness: ItSupportReadinessService,
  ) {}

  @Get()
  async getReadiness(
    @Param('siteId') siteId: string,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.readiness.getReadiness(siteId);
  }
}
