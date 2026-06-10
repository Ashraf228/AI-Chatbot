import { Module } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { SitesModule } from '../../sites/sites.module';
import { ItSupportReadinessController } from './it-support-readiness.controller';
import { ItSupportReadinessService } from './it-support-readiness.service';
import { ItSupportTicketsController } from './it-support-tickets.controller';
import { ItSupportTicketsService } from './it-support-tickets.service';

@Module({
  imports: [SitesModule, IntegrationsModule],
  controllers: [ItSupportReadinessController, ItSupportTicketsController],
  providers: [ItSupportReadinessService, ItSupportTicketsService, PrismaService],
  exports: [ItSupportReadinessService, ItSupportTicketsService],
})
export class ItSupportModule {}
