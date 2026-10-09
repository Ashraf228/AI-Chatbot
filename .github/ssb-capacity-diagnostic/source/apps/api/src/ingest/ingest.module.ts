import { IngestionEmbeddingService } from './ingestion-embedding.service';
import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { PrismaService } from '../db/prisma.service';
import { VectorService } from '../vector/vector.service';
import { KnowledgeSourcesModule } from '../knowledge-sources/knowledge-sources.module';
import { SitesModule } from '../sites/sites.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RateLimitService } from '../utils/rate-limit.service';
import { BillingModule } from '../billing/billing.module';
import { WebsiteKnowledgeIndexService } from './website-knowledge-index.service';

@Module({
  imports: [KnowledgeSourcesModule, SitesModule, AuditLogsModule, BillingModule],
  controllers: [IngestController],
  providers: [
    IngestService,
    IngestionEmbeddingService,
    WebsiteKnowledgeIndexService,
    PrismaService,
    VectorService,
    RateLimitService,
  ],
})
export class IngestModule {}
