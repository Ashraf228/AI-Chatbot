import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SitesModule } from './sites/sites.module';
import { IngestModule } from './ingest/ingest.module';
import { ChatModule } from './chat/chat.module';
import { PrismaService } from './db/prisma.service';
import { VectorService } from './vector/vector.service';
import { EmbeddingService } from './vector/embedding.service';
import { LlmService } from './vector/llm.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SitesModule,
    IngestModule,
    ChatModule,
  ],
  providers: [PrismaService, VectorService, EmbeddingService, LlmService],
})
export class AppModule {}