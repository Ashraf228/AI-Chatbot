import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { PrismaService } from '../db/prisma.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { LlmService } from '../vector/llm.service';
import { RateLimitService } from '../utils/rate-limit.service';
import { ChatRoutingModule } from '../chat-routing/chat-routing.module';
import { EcommerceProductAdvisorModule } from '../modules/ecommerce-product-advisor/ecommerce-product-advisor.module';
import { SitesModule } from '../sites/sites.module';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { ChatAgentOrchestratorService } from './chat-agent-orchestrator.service';
import { LeadMailerService } from '../modules/widget/services/lead-mailer.service';
import { ReportMailerService } from '../modules/widget/services/report-mailer.service';

@Module({
  imports: [ChatRoutingModule, EcommerceProductAdvisorModule, SitesModule, SiteModulesModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatAgentOrchestratorService,
    PrismaService,
    EmbeddingService,
    VectorService,
    LlmService,
    RateLimitService,
    LeadMailerService,
    ReportMailerService,
  ],
})
export class ChatModule {}
