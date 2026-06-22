import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { SitesModule } from './sites/sites.module';
import { IngestModule } from './ingest/ingest.module';
import { ChatModule } from './chat/chat.module';

import { PrismaService } from './db/prisma.service';
import { VectorService } from './vector/vector.service';
import { EmbeddingService } from './vector/embedding.service';
import { LlmService } from './vector/llm.service';
import { RateLimitService } from './utils/rate-limit.service';
import { RetentionService } from './retention/retention.service';
import { ConversationsModule } from './conversations/conversations.module';
import { UsageModule } from './usage/usage.module';
import { WidgetModule } from './modules/widget/widget.module';
import { HealthController } from './health.controller';
import { DatabaseMigrationsService } from './db/database-migrations.service';
import { TenantsModule } from './tenants/tenants.module';
import { SiteModulesModule } from './site-modules/site-modules.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AgentsModule } from './agents/agents.module';
import { ToolsModule } from './tools/tools.module';
import { LeadSalesModule } from './modules/lead-sales/lead-sales.module';
import { EcommerceProductAdvisorModule } from './modules/ecommerce-product-advisor/ecommerce-product-advisor.module';
import { PropertyTicketingModule } from './modules/property-ticketing/property-ticketing.module';
import { IndustryTemplatesModule } from './industry-templates/industry-templates.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AdminScopeModule } from './utils/admin-scope.module';
import { SiteDataModule } from './site-data/site-data.module';
import { BusinessAnalyticsModule } from './business-analytics/business-analytics.module';
import { BillingModule } from './billing/billing.module';
import { ItSupportModule } from './modules/it-support/it-support.module';
import { EvaluationModule } from './evaluation/evaluation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // ✅ neu
    SitesModule,
    IngestModule,
    ChatModule,
    WidgetModule,
    ConversationsModule,
    UsageModule,
    TenantsModule,
    SiteModulesModule,
    IntegrationsModule,
    AgentsModule,
    ToolsModule,
    LeadSalesModule,
    EcommerceProductAdvisorModule,
    PropertyTicketingModule,
    IndustryTemplatesModule,
    AuditLogsModule,
    AdminScopeModule,
    SiteDataModule,
    BusinessAnalyticsModule,
    BillingModule,
    ItSupportModule,
    EvaluationModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    DatabaseMigrationsService,
    VectorService,
    EmbeddingService,
    LlmService,
    RateLimitService,
    RetentionService, // ✅ neu
  ],
})
export class AppModule {}
