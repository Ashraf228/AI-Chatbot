import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { SitesModule } from '../sites/sites.module';
import { WidgetModule } from '../modules/widget/widget.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IndustryTemplatesController } from './industry-templates.controller';
import { IndustryTemplateSitesController } from './industry-template-sites.controller';
import { IndustryTemplatesService } from './industry-templates.service';

@Module({
  imports: [SitesModule, SiteModulesModule, WidgetModule, AuditLogsModule],
  controllers: [IndustryTemplatesController, IndustryTemplateSitesController],
  providers: [IndustryTemplatesService, PrismaService],
  exports: [IndustryTemplatesService],
})
export class IndustryTemplatesModule {}
