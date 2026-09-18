import { Module } from '@nestjs/common';
import { AssistantProfilesModule } from '../assistant-profiles';
import { PrismaService } from '../db/prisma.service';
import { KnowledgeSourcesModule } from '../knowledge-sources/knowledge-sources.module';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { SitesModule } from '../sites/sites.module';
import { AgentSelectorService } from './agent-selector.service';
import { ConversationContextService } from './conversation-context.service';
import { ConversationEngineCompareService } from './conversation-engine-compare.service';
import { ConversationEngineController } from './conversation-engine.controller';
import { ConversationEngineRuntimeService } from './conversation-engine-runtime.service';
import { ConversationEngineService } from './conversation-engine.service';
import { ConversationEngineTestCasesService } from './conversation-engine-test-cases.service';
import { CustomerWorkspaceOperatorAuthService } from './customer-workspace-operator-auth.service';
import { ConversationQualityService } from './conversation-quality.service';
import { GoalDetectorService } from './goal-detector.service';
import { HandoffReadinessService } from './handoff-readiness.service';
import { IntentClassifierService } from './intent-classifier.service';
import { KnowledgePreviewRetrievalService } from './knowledge-preview-retrieval.service';
import { NextActionService } from './next-action.service';
import { ResponseDraftService } from './response-draft.service';
import { VectorService } from '../vector/vector.service';

@Module({
  imports: [AssistantProfilesModule, SitesModule, SiteModulesModule, KnowledgeSourcesModule],
  controllers: [ConversationEngineController],
  providers: [
    ConversationEngineService,
    ConversationEngineCompareService,
    ConversationEngineRuntimeService,
    ConversationEngineTestCasesService,
    CustomerWorkspaceOperatorAuthService,
    ConversationContextService,
    IntentClassifierService,
    GoalDetectorService,
    AgentSelectorService,
    NextActionService,
    KnowledgePreviewRetrievalService,
    ResponseDraftService,
    HandoffReadinessService,
    ConversationQualityService,
    VectorService,
    PrismaService,
  ],
  exports: [ConversationEngineService, ConversationEngineRuntimeService],
})
export class ConversationEngineModule {}
