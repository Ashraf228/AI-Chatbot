import { Module } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { SiteModulesModule } from '../../site-modules/site-modules.module';
import { SitesModule } from '../../sites/sites.module';
import { EcommerceProductAdvisorService } from './ecommerce-product-advisor.service';

@Module({
  imports: [SiteModulesModule, IntegrationsModule, SitesModule],
  providers: [EcommerceProductAdvisorService, PrismaService],
  exports: [EcommerceProductAdvisorService],
})
export class EcommerceProductAdvisorModule {}
