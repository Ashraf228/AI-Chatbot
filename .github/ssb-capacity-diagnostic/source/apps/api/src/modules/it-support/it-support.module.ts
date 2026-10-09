import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { BillingModule } from '../../billing/billing.module';
import { PrismaService } from '../../db/prisma.service';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { KnowledgeSourcesModule } from '../../knowledge-sources/knowledge-sources.module';
import { SitesModule } from '../../sites/sites.module';
import { CustomerKnowledgePoweruserAuthService } from './customer-knowledge-poweruser-auth.service';
import { CustomerKnowledgeController } from './customer-knowledge.controller';
import { ItKnowledgeTemplateImportService } from './it-knowledge-template-import.service';
import { ItSupportReadinessController } from './it-support-readiness.controller';
import { ItSupportReadinessService } from './it-support-readiness.service';
import { ItSupportTicketsController } from './it-support-tickets.controller';
import { ItSupportTicketsService } from './it-support-tickets.service';

@Module({
  imports: [SitesModule, IntegrationsModule, KnowledgeSourcesModule, AuditLogsModule, BillingModule],
  controllers: [CustomerKnowledgeController, ItSupportReadinessController, ItSupportTicketsController],
  providers: [
    CustomerKnowledgePoweruserAuthService,
    ItKnowledgeTemplateImportService,
    ItSupportReadinessService,
    ItSupportTicketsService,
    PrismaService,
  ],
  exports: [ItSupportReadinessService, ItSupportTicketsService],
})
export class ItSupportModule {}
