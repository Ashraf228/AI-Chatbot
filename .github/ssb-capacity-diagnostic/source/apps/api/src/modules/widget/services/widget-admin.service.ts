import { Injectable } from '@nestjs/common';
import { WidgetAdminLeadsService } from './widget-admin-leads.service';
import { WidgetAdminReportsService } from './widget-admin-reports.service';
import { WidgetAdminSiteService } from './widget-admin-site.service';

@Injectable()
export class WidgetAdminService {
  constructor(
    private readonly siteAdmin: WidgetAdminSiteService,
    private readonly leadAdmin: WidgetAdminLeadsService,
    private readonly reportsAdmin: WidgetAdminReportsService,
  ) {}

  getSite(siteId: string) {
    return this.siteAdmin.getSite(siteId);
  }

  updateBranding(
    siteId: string,
    payload: Parameters<WidgetAdminSiteService['updateBranding']>[1],
  ) {
    return this.siteAdmin.updateBranding(siteId, payload);
  }

  updateWidgetConfig(
    siteId: string,
    payload: Parameters<WidgetAdminSiteService['updateWidgetConfig']>[1],
  ) {
    return this.siteAdmin.updateWidgetConfig(siteId, payload);
  }

  listLeads(params: Parameters<WidgetAdminLeadsService['listLeads']>[0]) {
    return this.leadAdmin.listLeads(params);
  }

  updateLead(id: string, payload: Parameters<WidgetAdminLeadsService['updateLead']>[1]) {
    return this.leadAdmin.updateLead(id, payload);
  }

  exportLeads(params: Parameters<WidgetAdminLeadsService['exportLeads']>[0]) {
    return this.leadAdmin.exportLeads(params);
  }

  deleteLead(
    id: string,
    actor: Parameters<WidgetAdminLeadsService['deleteLead']>[1],
  ) {
    return this.leadAdmin.deleteLead(id, actor);
  }

  getSummary(siteId?: string) {
    return this.reportsAdmin.getSummary(siteId);
  }

  getOptimization(siteId?: string) {
    return this.reportsAdmin.getOptimization(siteId);
  }

  listReportSubscriptions(siteId?: string) {
    return this.reportsAdmin.listReportSubscriptions(siteId);
  }

  listReportRuns(siteId?: string) {
    return this.reportsAdmin.listReportRuns(siteId);
  }

  createReportSubscription(
    payload: Parameters<WidgetAdminReportsService['createReportSubscription']>[0],
  ) {
    return this.reportsAdmin.createReportSubscription(payload);
  }

  updateReportSubscription(
    id: string,
    payload: Parameters<WidgetAdminReportsService['updateReportSubscription']>[1],
  ) {
    return this.reportsAdmin.updateReportSubscription(id, payload);
  }

  deleteReportSubscription(id: string) {
    return this.reportsAdmin.deleteReportSubscription(id);
  }

  deleteReportRun(
    id: string,
    actor: Parameters<WidgetAdminReportsService['deleteReportRun']>[1],
  ) {
    return this.reportsAdmin.deleteReportRun(id, actor);
  }

  runReport(payload: Parameters<WidgetAdminReportsService['runReport']>[0]) {
    return this.reportsAdmin.runReport(payload);
  }
}
