import { Injectable } from '@nestjs/common';
import { AssistantProfile, AssistantProfileResolverService } from '../../assistant-profiles';
import { ConversationEngineService } from '../../conversation-engine/conversation-engine.service';
import { SiteModulesService } from '../../site-modules/site-modules.service';
import type { ChatPipelineInput, ChatPipelineHistoryEntry } from './chat-pipeline.types';
import { buildKnowledgeSystemPrompt } from './knowledge-answer-policy';

@Injectable()
export class KnowledgeConversationService {
  constructor(
    private readonly profiles: AssistantProfileResolverService,
    private readonly modules: SiteModulesService,
    private readonly engine: ConversationEngineService,
  ) {}

  async resolve(input: ChatPipelineInput): Promise<AssistantProfile | null> {
    const modules = await this.modules.listForSite(input.siteId);
    const profile = this.profiles.resolve({ siteConfig: input.siteConfig,
      moduleConfigs: Object.fromEntries(modules.map((entry) => [entry.key, entry.config || {}])) });
    // Only deliberately stored knowledge profiles select this runtime. Legacy
    // fallback profiles must not silently change existing sales/support flows.
    if (profile.legacySource !== 'assistantProfile' || !profile.conversationEngine.enabled
      || !profile.enabledTasks.includes('answer_questions') || profile.knowledgeMode === 'disabled') return null;
    return profile.profileKey === 'knowledge-assistant'
      || (profile.profileKey === 'universal-assistant' && profile.answerStyle === 'knowledge_first') ? profile : null;
  }

  plan(profile: AssistantProfile, message: string, history: ChatPipelineHistoryEntry[], hasEvidence: boolean) {
    const decision = this.engine.preview({ assistantProfile: profile, latestUserMessage: message,
      conversationHistory: history, knowledgeAvailable: hasEvidence, testMode: true });
    // The engine supplies intent and refusal decisions, never tool execution.
    return { systemPrompt: buildKnowledgeSystemPrompt(profile, decision.intent),
      blocked: decision.nextActionKey === 'block_request' };
  }
}
