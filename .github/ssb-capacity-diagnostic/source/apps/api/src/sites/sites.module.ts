import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { SiteStatusService } from './site-status.service';
import { SiteAgentActivityService } from './site-agent-activity.service';
import { PrismaService } from '../db/prisma.service';
import { TenantsModule } from '../tenants/tenants.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [TenantsModule, AuditLogsModule, BillingModule],
  controllers: [SitesController],
  providers: [SitesService, SiteStatusService, SiteAgentActivityService, PrismaService],
  exports: [SitesService, SiteStatusService],
})
export class SitesModule {}
