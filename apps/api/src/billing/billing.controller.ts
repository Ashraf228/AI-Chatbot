import { BadRequestException, Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AdminScopeService, DashboardAuthContext } from '../utils/admin-scope.service';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { UsageLimitService } from './usage-limit.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/billing')
export class BillingController {
  constructor(
    private readonly scope: AdminScopeService,
    private readonly plans: PlanService,
    private readonly subscriptions: SubscriptionService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  @Get('plan')
  async currentPlan(@Req() req: { dashboardAuth?: unknown }, @Query('tenantId') tenantId?: string) {
    const targetTenantId = await this.resolveTenant(this.scope.getAuth(req), tenantId);
    const context = await this.subscriptions.getCurrentPlan(targetTenantId);
    return {
      ...context,
      availablePlans: await this.plans.listPlans(),
    };
  }

  @Get('usage')
  async usage(@Req() req: { dashboardAuth?: unknown }, @Query('tenantId') tenantId?: string) {
    const targetTenantId = await this.resolveTenant(this.scope.getAuth(req), tenantId);
    return this.usageLimits.getUsageSummary(targetTenantId);
  }

  @Get('limits')
  async limits(@Req() req: { dashboardAuth?: unknown }, @Query('tenantId') tenantId?: string) {
    const targetTenantId = await this.resolveTenant(this.scope.getAuth(req), tenantId);
    return this.usageLimits.getLimitOverview(targetTenantId);
  }

  @Patch('plan')
  async setPlan(
    @Body() body: { tenantId?: string; planCode?: string },
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const auth = this.scope.getAuth(req);
    this.scope.assertRole(auth, ['admin']);
    const tenantId = body.tenantId?.trim();
    const planCode = body.planCode?.trim();
    if (!tenantId || !planCode) {
      throw new BadRequestException('tenantId and planCode required');
    }
    return this.subscriptions.setPlanForTenant(tenantId, planCode);
  }

  private async resolveTenant(auth: DashboardAuthContext, requestedTenantId?: string) {
    const tenantId = requestedTenantId?.trim() || auth.tenantId || 't_default';
    await this.scope.assertTenantAccess(auth, tenantId);
    return tenantId;
  }
}

@UseGuards(AdminKeyGuard)
@Controller('admin/sites/:siteId/usage')
export class SiteUsageController {
  constructor(
    private readonly scope: AdminScopeService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  @Get()
  async siteUsage(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer', 'viewer'],
    });
    return this.usageLimits.getSiteUsage(siteId);
  }
}
