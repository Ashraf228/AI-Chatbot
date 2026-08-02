import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { VectorService } from '../vector/vector.service';
import { SitesModule } from '../sites/sites.module';
import { ProviderApprovalStorageLookupService } from './provider-approval-storage-lookup.service';
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
    WebsiteAnswerEvaluationService,
    WebsiteAnswerRuntimeGateService,
    WebsiteAnswerRuntimePilotService,
    WebsiteEmbeddingIngestService,
    PrismaService,
    VectorService,
  ],
  exports: [
    KnowledgeSourcesService,
    ProviderApprovalStorageLookupService,
    WebsiteAnswerEvaluationService,
    WebsiteAnswerRuntimeGateService,
    WebsiteAnswerRuntimePilotService,
    WebsiteEmbeddingIngestService,
  ],
})
export class KnowledgeSourcesModule {}
