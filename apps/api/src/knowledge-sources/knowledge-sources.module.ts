import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { SitesModule } from '../sites/sites.module';
import { ProviderApprovalStorageLookupService } from './provider-approval-storage-lookup.service';
import { ProviderApprovalAuditWriter } from './provider-approval-audit-writer.service';
import { RuntimeQueryEmbeddingService } from './runtime-query-embedding.service';
import { SiteRuntimeGrantWriteService } from './site-runtime-grant-write.service';
import { WebsiteAnswerEvaluationService } from './website-answer-evaluation.service';
import { WebsiteAnswerRuntimeGateService } from './website-answer-runtime-gate.service';
import { WebsiteAnswerRuntimePilotService } from './website-answer-runtime-pilot.service';
import { WebsiteEmbeddingIngestService } from './website-embedding-ingest.service';
import { KnowledgeSourcesService } from './knowledge-sources.service';

@Module({
  imports: [SitesModule],
  providers: [
    KnowledgeSourcesService,
    ProviderApprovalStorageLookupService,
    ProviderApprovalAuditWriter,
    RuntimeQueryEmbeddingService,
    SiteRuntimeGrantWriteService,
    WebsiteAnswerEvaluationService,
    WebsiteAnswerRuntimeGateService,
    WebsiteAnswerRuntimePilotService,
    WebsiteEmbeddingIngestService,
    PrismaService,
    EmbeddingService,
    VectorService,
  ],
  exports: [
    KnowledgeSourcesService,
    ProviderApprovalStorageLookupService,
    RuntimeQueryEmbeddingService,
    WebsiteAnswerEvaluationService,
    WebsiteAnswerRuntimeGateService,
    WebsiteAnswerRuntimePilotService,
    WebsiteEmbeddingIngestService,
  ],
})
export class KnowledgeSourcesModule {}
