import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SitesModule } from '../sites/sites.module';
import { WidgetModule } from '../modules/widget/widget.module';
import { PropertyTicketingModule } from '../modules/property-ticketing/property-ticketing.module';
import { ToolDispatcherService } from './tool-dispatcher.service';
import { ToolExecutorService } from './tool-executor.service';
import { ToolAuditService } from './tool-audit.service';
import { ToolRegistryService } from './tool-registry.service';
import { WebhookJobsService } from './webhook-jobs.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [SitesModule, IntegrationsModule, WidgetModule, PropertyTicketingModule, BillingModule],
  providers: [
    ToolDispatcherService,
    ToolExecutorService,
    ToolAuditService,
    ToolRegistryService,
    WebhookJobsService,
    PrismaService,
    EmbeddingService,
    VectorService,
  ],
  exports: [ToolDispatcherService, ToolExecutorService, ToolAuditService, ToolRegistryService, WebhookJobsService],
})
export class ToolsModule {}
