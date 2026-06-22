import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../../../utils/admin.guard';
import { RequireDashboardRoles } from '../../../utils/dashboard-rbac';
import { WidgetAdminService } from '../services/widget-admin.service';
import { AuditLogService } from '../../../audit-logs/audit-log.service';
import { AdminScopeService } from '../../../utils/admin-scope.service';
import {
  CreateReportSubscriptionDto,
  ListLeadsQueryDto,
  ListSiteScopedQueryDto,
  RunReportDto,
  UpdateBrandingDto,
  UpdateLeadDto,
  UpdateReportSubscriptionDto,
  UpdateWidgetConfigDto,
} from '../dto/admin-widget.dto';

@UseGuards(AdminKeyGuard)
@Controller('admin/widget')
export class WidgetAdminController {
  constructor(
    private readonly widgetAdminService: WidgetAdminService,
    private readonly auditLogs: AuditLogService,
    private readonly scope: AdminScopeService,
  ) {}

  @Get('sites/:siteId')
  async getSite(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.widgetAdminService.getSite(siteId);
  }

  @Patch('branding/:siteId')
  async updateBranding(
    @Param('siteId') siteId: string,
    @Body() body: UpdateBrandingDto,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    const result = await this.widgetAdminService.updateBranding(siteId, body);
    await this.auditLogs.record({
      siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'update_branding',
      resourceType: 'site_branding',
      resourceId: siteId,
      metadata: {
        changedFields: Object.keys(body),
      },
    });
    return result;
  }

  @Patch('config/:siteId')
  async updateConfig(
    @Param('siteId') siteId: string,
    @Body() body: UpdateWidgetConfigDto,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    if (body.goLiveAt) {
      throw new BadRequestException(
        'Live-Schaltung läuft über /admin/sites/:siteId/go-live, damit alle Pflichtbedingungen serverseitig geprüft werden.',
      );
    }

    const result = await this.widgetAdminService.updateWidgetConfig(siteId, body);
    const behaviorFields = [
      'systemPrompt',
      'industry',
      'setupGoal',
      'tone',
      'ctaText',
      'suggestedQuestionsByPath',
      'conversationFlow',
      'topTestQuestions',
    ].filter((field) => Object.prototype.hasOwnProperty.call(body, field));

    await this.auditLogs.record({
      siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'update_widget_config',
      resourceType: 'site_config',
      resourceId: siteId,
      metadata: {
        changedFields: Object.keys(body),
        behaviorFields,
      },
    });
    if (behaviorFields.length > 0) {
      await this.auditLogs.record({
        siteId,
        actorId: req.dashboardAuth?.actorId,
        actorRole: req.dashboardAuth?.role,
        action: 'update_behavior',
        resourceType: 'site_config',
        resourceId: siteId,
        metadata: {
          changedFields: behaviorFields,
        },
      });
    }

    return result;
  }

  @Get('leads')
  async listLeads(@Query() query: ListLeadsQueryDto, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    if (query.siteId) {
      await this.scope.assertSiteAccess(auth, query.siteId, {
        allowedRoles: ['admin', 'operator', 'customer'],
      });
    } else {
      this.scope.assertRole(auth, ['admin']);
    }
    return this.widgetAdminService.listLeads(query);
  }

  @Get('leads/export')
  @RequireDashboardRoles('admin')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="anfragen.csv"')
  async exportLeads(
    @Query() query: ListLeadsQueryDto,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
    @Req() req?: { dashboardAuth?: unknown },
  ) {
    if (query.siteId) {
      await this.scope.assertSiteAccess(this.scope.getAuth(req), query.siteId, {
        allowedRoles: ['admin'],
      });
    }
    return this.widgetAdminService.exportLeads({
      ...query,
      actorId,
      actorRole,
    });
  }

  @Patch('leads/:id')
  async updateLead(
    @Param('id') id: string,
    @Body() body: UpdateLeadDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertLeadAccess(this.scope.getAuth(req), id, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.widgetAdminService.updateLead(id, body);
  }

  @Delete('leads/:id')
  @RequireDashboardRoles('admin')
  async deleteLead(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
    @Req() req?: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertLeadAccess(this.scope.getAuth(req), id, {
      allowedRoles: ['admin'],
    });
    return this.widgetAdminService.deleteLead(id, { actorId, actorRole });
  }

  @Get('events/summary')
  async getSummary(@Query() query: ListSiteScopedQueryDto, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    if (query.siteId) {
      await this.scope.assertSiteAccess(auth, query.siteId, {
        allowedRoles: ['admin', 'operator', 'customer'],
      });
    } else {
      this.scope.assertRole(auth, ['admin']);
    }
    return this.widgetAdminService.getSummary(query.siteId);
  }

  @Get('optimization')
  async getOptimization(@Query() query: ListSiteScopedQueryDto, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    if (query.siteId) {
      await this.scope.assertSiteAccess(auth, query.siteId, {
        allowedRoles: ['admin', 'operator', 'customer'],
      });
    } else {
      this.scope.assertRole(auth, ['admin']);
    }
    return this.widgetAdminService.getOptimization(query.siteId);
  }

  @Get('report-subscriptions')
  async listReportSubscriptions(@Query() query: ListSiteScopedQueryDto, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    if (query.siteId) {
      await this.scope.assertSiteAccess(auth, query.siteId, {
        allowedRoles: ['admin', 'operator', 'customer'],
      });
    } else {
      this.scope.assertRole(auth, ['admin']);
    }
    return this.widgetAdminService.listReportSubscriptions(query.siteId);
  }

  @Get('reports/history')
  async listReportRuns(@Query() query: ListSiteScopedQueryDto, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    if (query.siteId) {
      await this.scope.assertSiteAccess(auth, query.siteId, {
        allowedRoles: ['admin', 'operator', 'customer'],
      });
    } else {
      this.scope.assertRole(auth, ['admin']);
    }
    return this.widgetAdminService.listReportRuns(query.siteId);
  }

  @Delete('reports/history/:id')
  @RequireDashboardRoles('admin')
  async deleteReportRun(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
    @Req() req?: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertReportRunAccess(this.scope.getAuth(req), id, {
      allowedRoles: ['admin'],
    });
    return this.widgetAdminService.deleteReportRun(id, { actorId, actorRole });
  }

  @Post('report-subscriptions')
  async createReportSubscription(
    @Body() body: CreateReportSubscriptionDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), body.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.widgetAdminService.createReportSubscription(body);
  }

  @Patch('report-subscriptions/:id')
  async updateReportSubscription(
    @Param('id') id: string,
    @Body() body: UpdateReportSubscriptionDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertReportSubscriptionAccess(this.scope.getAuth(req), id, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.widgetAdminService.updateReportSubscription(id, body);
  }

  @Delete('report-subscriptions/:id')
  async deleteReportSubscription(@Param('id') id: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertReportSubscriptionAccess(this.scope.getAuth(req), id, {
      allowedRoles: ['admin', 'operator'],
    });
    return this.widgetAdminService.deleteReportSubscription(id);
  }

  @Post('reports/run')
  async runReport(@Body() body: RunReportDto, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    this.scope.assertRole(auth, ['admin', 'operator']);
    if (body.siteId) {
      await this.scope.assertSiteAccess(auth, body.siteId, {
        allowedRoles: ['admin', 'operator'],
      });
    } else {
      this.scope.assertRole(auth, ['admin']);
    }
    return this.widgetAdminService.runReport(body);
  }
}
