import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SitesModule } from '../sites/sites.module';
import { RateLimitService } from '../utils/rate-limit.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationSecretsService } from './integration-secrets.service';
import { IntegrationEventDispatcherService } from './integration-event-dispatcher.service';
import { IntegrationsService } from './integrations.service';
import { SiteIntegrationsController } from './site-integrations.controller';
import { ShopifyCatalogService } from './shopify/shopify-catalog.service';
import { BillingModule } from '../billing/billing.module';
import { TicketWebhookConfigService } from './ticket-webhook-config.service';

@Module({
  imports: [SitesModule, AuditLogsModule, BillingModule],
  controllers: [IntegrationsController, SiteIntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationSecretsService,
    IntegrationEventDispatcherService,
    TicketWebhookConfigService,
    ShopifyCatalogService,
    RateLimitService,
    PrismaService,
  ],
  exports: [
    IntegrationsService,
    IntegrationSecretsService,
    IntegrationEventDispatcherService,
    TicketWebhookConfigService,
    ShopifyCatalogService,
  ],
})
export class IntegrationsModule {}
