import { Module } from '@nestjs/common';
import { AssistantProfilesModule } from '../assistant-profiles';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { SitesModule } from '../sites/sites.module';
import { AgentSelectorService } from './agent-selector.service';
import { ConversationContextService } from './conversation-context.service';
import { ConversationEngineCompareService } from './conversation-engine-compare.service';
import { ConversationEngineController } from './conversation-engine.controller';
import { ConversationEngineRuntimeService } from './conversation-engine-runtime.service';
import { ConversationEngineService } from './conversation-engine.service';
import { ConversationEngineTestCasesService } from './conversation-engine-test-cases.service';
import { ConversationQualityService } from './conversation-quality.service';
import { GoalDetectorService } from './goal-detector.service';
import { HandoffReadinessService } from './handoff-readiness.service';
import { IntentClassifierService } from './intent-classifier.service';
import { KnowledgePreviewRetrievalService } from './knowledge-preview-retrieval.service';
import { NextActionService } from './next-action.service';
import { ResponseDraftService } from './response-draft.service';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';

@Module({
  imports: [AssistantProfilesModule, SitesModule, SiteModulesModule],
  controllers: [ConversationEngineController],
  providers: [
    ConversationEngineService,
    ConversationEngineCompareService,
    ConversationEngineRuntimeService,
    ConversationEngineTestCasesService,
    ConversationContextService,
    IntentClassifierService,
    GoalDetectorService,
    AgentSelectorService,
    NextActionService,
    KnowledgePreviewRetrievalService,
    ResponseDraftService,
    HandoffReadinessService,
    ConversationQualityService,
    EmbeddingService,
    VectorService,
    PrismaService,
  ],
  exports: [ConversationEngineService, ConversationEngineRuntimeService],
})
export class ConversationEngineModule {}
