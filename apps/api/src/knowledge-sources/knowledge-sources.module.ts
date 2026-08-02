import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { VectorService } from '../vector/vector.service';
import { SitesModule } from '../sites/sites.module';
import { ProviderApprovalStorageLookupService } from './provider-approval-storage-lookup.service';
import { WebsiteEmbeddingIngestService } from './website-embedding-ingest.service';
import { KnowledgeSourcesService } from './knowledge-sources.service';

@Module({
  imports: [SitesModule],
  providers: [
    KnowledgeSourcesService,
    ProviderApprovalStorageLookupService,
    WebsiteEmbeddingIngestService,
    PrismaService,
    VectorService,
  ],
  exports: [KnowledgeSourcesService, ProviderApprovalStorageLookupService, WebsiteEmbeddingIngestService],
})
export class KnowledgeSourcesModule {}
