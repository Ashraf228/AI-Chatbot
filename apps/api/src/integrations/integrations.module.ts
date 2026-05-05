import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SitesModule } from '../sites/sites.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationSecretsService } from './integration-secrets.service';
import { IntegrationsService } from './integrations.service';
import { ShopifyCatalogService } from './shopify/shopify-catalog.service';

@Module({
  imports: [SitesModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationSecretsService, ShopifyCatalogService, PrismaService],
  exports: [IntegrationsService, IntegrationSecretsService, ShopifyCatalogService],
})
export class IntegrationsModule {}
