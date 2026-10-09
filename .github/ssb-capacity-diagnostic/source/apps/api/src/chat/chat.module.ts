import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { ChatPipelineModule } from '../ai/chat-pipeline/chat-pipeline.module';
import { PrismaService } from '../db/prisma.service';
import { RateLimitService } from '../utils/rate-limit.service';
import { SitesModule } from '../sites/sites.module';

@Module({
  imports: [SitesModule, ChatPipelineModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    PrismaService,
    RateLimitService,
  ],
})
export class ChatModule {}
