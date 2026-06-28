import { Module } from '@nestjs/common';
import { AssistantProfilesModule } from '../assistant-profiles';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { SitesModule } from '../sites/sites.module';
import { AgentSelectorService } from './agent-selector.service';
import { ConversationContextService } from './conversation-context.service';
import { ConversationEngineCompareService } from './conversation-engine-compare.service';
import { ConversationEngineController } from './conversation-engine.controller';
import { ConversationEngineService } from './conversation-engine.service';
import { ConversationEngineTestCasesService } from './conversation-engine-test-cases.service';
import { ConversationQualityService } from './conversation-quality.service';
import { GoalDetectorService } from './goal-detector.service';
import { HandoffReadinessService } from './handoff-readiness.service';
import { IntentClassifierService } from './intent-classifier.service';
import { NextActionService } from './next-action.service';
import { ResponseDraftService } from './response-draft.service';

@Module({
  imports: [AssistantProfilesModule, SitesModule, SiteModulesModule],
  controllers: [ConversationEngineController],
  providers: [
    ConversationEngineService,
    ConversationEngineCompareService,
    ConversationEngineTestCasesService,
    ConversationContextService,
    IntentClassifierService,
    GoalDetectorService,
    AgentSelectorService,
    NextActionService,
    ResponseDraftService,
    HandoffReadinessService,
    ConversationQualityService,
    PrismaService,
  ],
  exports: [ConversationEngineService],
})
export class ConversationEngineModule {}
