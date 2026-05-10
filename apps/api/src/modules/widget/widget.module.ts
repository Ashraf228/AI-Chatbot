import { Module } from '@nestjs/common';

import { WidgetConfigController } from './controllers/widget-config.controller';
import { WidgetSessionController } from './controllers/widget-session.controller';
import { WidgetChatController } from './controllers/widget-chat.controller';
import { WidgetLeadsController } from './controllers/widget-leads.controller';
import { WidgetEventsController } from './controllers/widget-events.controller';
import { WidgetAdminController } from './controllers/widget-admin.controller';

import { WidgetConfigService } from './services/widget-config.service';
import { WidgetSessionService } from './services/widget-session.service';
import { WidgetChatService } from './services/widget-chat.service';
import { WidgetLeadsService } from './services/widget-leads.service';
import { WidgetAnalyticsService } from './services/widget-analytics.service';
import { WidgetSecurityService } from './services/widget-security.service';
import { WidgetAdminService } from './services/widget-admin.service';
import { WidgetAdminLeadsService } from './services/widget-admin-leads.service';
import { WidgetAdminReportsService } from './services/widget-admin-reports.service';
import { WidgetAdminSiteService } from './services/widget-admin-site.service';
import { EmailJobsService } from './services/email-jobs.service';
import { ReportMailerService } from './services/report-mailer.service';
import { LeadMailerService } from './services/lead-mailer.service';

import { ChatPipelineModule } from '../../ai/chat-pipeline/chat-pipeline.module';
import { WidgetOriginGuard } from './guards/widget-origin.guard';
import { WidgetRateLimitGuard } from './guards/widget-rate-limit.guard';
import { WidgetSiteGuard } from './guards/widget-site.guard';
import { PrismaService } from '../../db/prisma.service';
import { RateLimitService } from '../../utils/rate-limit.service';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { BillingModule } from '../../billing/billing.module';

@Module({
  imports: [
    ChatPipelineModule,
    AuditLogsModule,
    BillingModule,
  ],
  controllers: [
    WidgetConfigController,
    WidgetSessionController,
    WidgetChatController,
    WidgetLeadsController,
    WidgetEventsController,
    WidgetAdminController,
  ],
  providers: [
    WidgetConfigService,
    WidgetSessionService,
    WidgetChatService,
    WidgetLeadsService,
    WidgetAnalyticsService,
    WidgetSecurityService,
    WidgetAdminService,
    WidgetAdminSiteService,
    WidgetAdminLeadsService,
    WidgetAdminReportsService,
    EmailJobsService,
    ReportMailerService,
    LeadMailerService,
    WidgetOriginGuard,
    WidgetRateLimitGuard,
    WidgetSiteGuard,
    PrismaService,
    RateLimitService,
  ],
  exports: [
    WidgetConfigService,
    WidgetSessionService,
    WidgetChatService,
    WidgetLeadsService,
    WidgetAnalyticsService,
    WidgetSecurityService,
    WidgetAdminSiteService,
    EmailJobsService,
    ReportMailerService,
    LeadMailerService,
  ],
})
export class WidgetModule {}
