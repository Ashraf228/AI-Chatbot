import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../../../utils/admin.guard';
import { WidgetAdminService } from '../services/widget-admin.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/widget')
export class WidgetAdminController {
  constructor(private readonly widgetAdminService: WidgetAdminService) {}

  @Get('sites/:siteId')
  async getSite(@Param('siteId') siteId: string) {
    return this.widgetAdminService.getSite(siteId);
  }

  @Patch('branding/:siteId')
  async updateBranding(@Param('siteId') siteId: string, @Body() body: any) {
    return this.widgetAdminService.updateBranding(siteId, body || {});
  }

  @Patch('config/:siteId')
  async updateConfig(@Param('siteId') siteId: string, @Body() body: any) {
    return this.widgetAdminService.updateWidgetConfig(siteId, body || {});
  }

  @Get('leads')
  async listLeads(@Query('siteId') siteId?: string, @Query('status') status?: string) {
    return this.widgetAdminService.listLeads({ siteId, status });
  }

  @Patch('leads/:id')
  async updateLead(@Param('id') id: string, @Body() body: any) {
    return this.widgetAdminService.updateLead(id, body || {});
  }

  @Get('events/summary')
  async getSummary(@Query('siteId') siteId?: string) {
    return this.widgetAdminService.getSummary(siteId);
  }

  @Get('optimization')
  async getOptimization(@Query('siteId') siteId?: string) {
    return this.widgetAdminService.getOptimization(siteId);
  }

  @Get('report-subscriptions')
  async listReportSubscriptions(@Query('siteId') siteId?: string) {
    return this.widgetAdminService.listReportSubscriptions(siteId);
  }

  @Get('reports/history')
  async listReportRuns(@Query('siteId') siteId?: string) {
    return this.widgetAdminService.listReportRuns(siteId);
  }

  @Post('report-subscriptions')
  async createReportSubscription(@Body() body: any) {
    return this.widgetAdminService.createReportSubscription(body || {});
  }

  @Patch('report-subscriptions/:id')
  async updateReportSubscription(@Param('id') id: string, @Body() body: any) {
    return this.widgetAdminService.updateReportSubscription(id, body || {});
  }

  @Delete('report-subscriptions/:id')
  async deleteReportSubscription(@Param('id') id: string) {
    return this.widgetAdminService.deleteReportSubscription(id);
  }

  @Post('reports/run')
  async runReport(@Body() body: any) {
    return this.widgetAdminService.runReport(body || {});
  }
}
