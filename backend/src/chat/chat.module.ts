import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaService } from '../db/prisma.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { LlmService } from '../vector/llm.service';
import { SitesService } from '../sites/sites.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, PrismaService, EmbeddingService, VectorService, LlmService, SitesService],
})
export class ChatModule {}