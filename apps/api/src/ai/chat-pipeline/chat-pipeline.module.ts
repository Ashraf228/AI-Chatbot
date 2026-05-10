import { Module } from '@nestjs/common';

import { ChatAgentOrchestratorService } from '../../chat/chat-agent-orchestrator.service';
import { ChatRoutingModule } from '../../chat-routing/chat-routing.module';
import { PrismaService } from '../../db/prisma.service';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { EcommerceProductAdvisorModule } from '../../modules/ecommerce-product-advisor/ecommerce-product-advisor.module';
import { LeadMailerService } from '../../modules/widget/services/lead-mailer.service';
import { ReportMailerService } from '../../modules/widget/services/report-mailer.service';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { SitesModule } from '../../sites/sites.module';
import { SiteModulesModule } from '../../site-modules/site-modules.module';
import { ToolAuditService } from '../../tools/tool-audit.service';
import { ToolExecutorService } from '../../tools/tool-executor.service';
import { ToolRegistryService } from '../../tools/tool-registry.service';
import { WebhookJobsService } from '../../tools/webhook-jobs.service';
import { EmbeddingService } from '../../vector/embedding.service';
import { LlmService } from '../../vector/llm.service';
import { VectorService } from '../../vector/vector.service';
import { ChatPipelineService } from './chat-pipeline.service';
import { ConversationStateService } from './conversation-state.service';
import { ResponseComposerService } from './response-composer.service';
import { BillingModule } from '../../billing/billing.module';

@Module({
  imports: [
    ChatRoutingModule,
    EcommerceProductAdvisorModule,
    SiteModulesModule,
    OrchestrationModule,
    SitesModule,
    IntegrationsModule,
    BillingModule,
  ],
  providers: [
    ChatPipelineService,
    ConversationStateService,
    ResponseComposerService,
    ChatAgentOrchestratorService,
    PrismaService,
    EmbeddingService,
    VectorService,
    LlmService,
    LeadMailerService,
    ReportMailerService,
    ToolExecutorService,
    ToolAuditService,
    ToolRegistryService,
    WebhookJobsService,
  ],
  exports: [ChatPipelineService],
})
export class ChatPipelineModule {}
