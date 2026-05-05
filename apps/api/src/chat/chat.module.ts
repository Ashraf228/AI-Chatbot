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

@Module({
  imports: [ChatRoutingModule, EcommerceProductAdvisorModule, SitesModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    PrismaService,
    EmbeddingService,
    VectorService,
    LlmService,
    RateLimitService,
  ],
})
export class ChatModule {}
