import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SitesModule } from '../sites/sites.module';
import { WidgetModule } from '../modules/widget/widget.module';
import { PropertyTicketingModule } from '../modules/property-ticketing/property-ticketing.module';
import { ToolDispatcherService } from './tool-dispatcher.service';
import { WebhookJobsService } from './webhook-jobs.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';

@Module({
  imports: [SitesModule, IntegrationsModule, WidgetModule, PropertyTicketingModule],
  providers: [ToolDispatcherService, WebhookJobsService, PrismaService, EmbeddingService, VectorService],
  exports: [ToolDispatcherService, WebhookJobsService],
})
export class ToolsModule {}
