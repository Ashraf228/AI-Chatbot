import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { PrismaService } from '../db/prisma.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { KnowledgeSourcesModule } from '../knowledge-sources/knowledge-sources.module';
import { SitesModule } from '../sites/sites.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [KnowledgeSourcesModule, SitesModule, AuditLogsModule],
  controllers: [IngestController],
  providers: [
    IngestService,
    PrismaService,
    EmbeddingService,
    VectorService,
  ],
})
export class IngestModule {}
