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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // ✅ neu
    SitesModule,
    IngestModule,
    ChatModule,
    ConversationsModule,
  ],
  providers: [
    PrismaService,
    VectorService,
    EmbeddingService,
    LlmService,
    RateLimitService,
    RetentionService, // ✅ neu
  ],
})
export class AppModule {}