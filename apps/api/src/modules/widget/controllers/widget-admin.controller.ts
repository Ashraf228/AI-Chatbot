import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../../../utils/admin.guard';
import { RequireDashboardRoles } from '../../../utils/dashboard-rbac';
import { WidgetAdminService } from '../services/widget-admin.service';
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
  constructor(private readonly widgetAdminService: WidgetAdminService) {}

  @Get('sites/:siteId')
  async getSite(@Param('siteId') siteId: string) {
    return this.widgetAdminService.getSite(siteId);
  }

  @Patch('branding/:siteId')
  async updateBranding(@Param('siteId') siteId: string, @Body() body: UpdateBrandingDto) {
    return this.widgetAdminService.updateBranding(siteId, body);
  }

  @Patch('config/:siteId')
  async updateConfig(@Param('siteId') siteId: string, @Body() body: UpdateWidgetConfigDto) {
    if (body.goLiveAt) {
      throw new BadRequestException(
        'Live-Schaltung läuft über /admin/sites/:siteId/go-live, damit alle Pflichtbedingungen serverseitig geprüft werden.',
      );
    }

    return this.widgetAdminService.updateWidgetConfig(siteId, body);
  }

  @Get('leads')
  async listLeads(@Query() query: ListLeadsQueryDto) {
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
  ) {
    return this.widgetAdminService.exportLeads({
      ...query,
      actorId,
      actorRole,
    });
  }

  @Patch('leads/:id')
  async updateLead(@Param('id') id: string, @Body() body: UpdateLeadDto) {
    return this.widgetAdminService.updateLead(id, body);
  }

  @Delete('leads/:id')
  @RequireDashboardRoles('admin')
  async deleteLead(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
  ) {
    return this.widgetAdminService.deleteLead(id, { actorId, actorRole });
  }

  @Get('events/summary')
  async getSummary(@Query() query: ListSiteScopedQueryDto) {
    return this.widgetAdminService.getSummary(query.siteId);
  }

  @Get('optimization')
  async getOptimization(@Query() query: ListSiteScopedQueryDto) {
    return this.widgetAdminService.getOptimization(query.siteId);
  }

  @Get('report-subscriptions')
  async listReportSubscriptions(@Query() query: ListSiteScopedQueryDto) {
    return this.widgetAdminService.listReportSubscriptions(query.siteId);
  }

  @Get('reports/history')
  async listReportRuns(@Query() query: ListSiteScopedQueryDto) {
    return this.widgetAdminService.listReportRuns(query.siteId);
  }

  @Delete('reports/history/:id')
  @RequireDashboardRoles('admin')
  async deleteReportRun(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
  ) {
    return this.widgetAdminService.deleteReportRun(id, { actorId, actorRole });
  }

  @Post('report-subscriptions')
  async createReportSubscription(@Body() body: CreateReportSubscriptionDto) {
    return this.widgetAdminService.createReportSubscription(body);
  }

  @Patch('report-subscriptions/:id')
  async updateReportSubscription(
    @Param('id') id: string,
    @Body() body: UpdateReportSubscriptionDto,
  ) {
    return this.widgetAdminService.updateReportSubscription(id, body);
  }

  @Delete('report-subscriptions/:id')
  async deleteReportSubscription(@Param('id') id: string) {
    return this.widgetAdminService.deleteReportSubscription(id);
  }

  @Post('reports/run')
  async runReport(@Body() body: RunReportDto) {
    return this.widgetAdminService.runReport(body);
  }
}
