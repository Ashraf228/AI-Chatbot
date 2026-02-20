import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { PrismaService } from '../db/prisma.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
@Module({
  controllers: [IngestController],
  providers: [IngestService, PrismaService, EmbeddingService, VectorService],
})
export class IngestModule {}