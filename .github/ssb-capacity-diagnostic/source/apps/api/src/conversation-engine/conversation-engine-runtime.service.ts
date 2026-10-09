import { Injectable } from '@nestjs/common';
import { WebsiteAnswerRuntimeGateService } from '../knowledge-sources/website-answer-runtime-gate.service';
import { WebsiteAnswerRuntimePilotService } from '../knowledge-sources/website-answer-runtime-pilot.service';
import { AssistantProfile } from '../assistant-profiles';
import { ConversationEngineService } from './conversation-engine.service';
import { ResponseDraftService } from './response-draft.service';
import {
  ConversationEngineRuntimePilotInput,
  ConversationEngineRuntimePilotResult,
  ConversationEngineRuntimeState,
  ConversationHistoryEntry,
  EngineKnowledgeRetrievalResult,
  EngineKnowledgeSnippet,
} from './conversation-engine.types';

type RuntimeKnowledgeInput = {
  latestUserMessage: string;
  assistantProfile: AssistantProfile;
  syntheticKnowledgeSnippets?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeKnowledgeSnippets(input: RuntimeKnowledgeInput): EngineKnowledgeRetrievalResult {
  if (!Array.isArray(input.syntheticKnowledgeSnippets)) {
    return {
      enabled: false,
      attempted: false,
      status: 'disabled',
      snippets: [],
      warnings: [],
      reasons: ['Keine synthetischen Wissens-Snippets übergeben; Pilot bleibt rein in-memory ohne Retrieval-Aufruf.'],
    };
  }

  const snippets = input.syntheticKnowledgeSnippets
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry, index): EngineKnowledgeSnippet | null => {
      const excerpt = asString(entry.excerpt || entry.text || entry.content).slice(0, 320);
      if (!excerpt) {
        return null;
      }
      const title = asString(entry.title) || `Synthetisches Snippet ${index + 1}`;
      const scope = asString(entry.scope) || 'synthetic-demo';
      const sourceType = asString(entry.sourceType) || 'synthetic';
      return {
        id: asString(entry.id) || `synthetic-snippet-${index + 1}`,
        sourceId: asString(entry.sourceId) || null,
        documentId: asString(entry.documentId) || `synthetic-doc-${index + 1}`,
        chunkId: asString(entry.chunkId) || `synthetic-chunk-${index + 1}`,
        title: title.slice(0, 120),
        sourceType: sourceType.slice(0, 64),
        score: typeof entry.score === 'number' && Number.isFinite(entry.score)
          ? Math.max(0, Math.min(1, entry.score))
          : 0.5,
        excerpt,
        url: undefined,
        scope: scope.slice(0, 64),
        agentKeys: Array.isArray(entry.agentKeys)
          ? entry.agentKeys.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).slice(0, 8)
          : undefined,
        metadata: {
          synthetic: true,
          providedByRequest: true,
        },
      };
    })
    .filter((entry): entry is EngineKnowledgeSnippet => Boolean(entry))
    .slice(0, 5);

  return {
    enabled: true,
    attempted: true,
    status: snippets.length > 0 ? 'available' : 'empty',
    snippets,
    warnings: snippets.length > 0 ? [] : ['Synthetische Wissens-Snippets waren leer oder unbrauchbar.'],
    reasons: snippets.length > 0
      ? ['Nur synthetische, im Request übergebene Wissens-Snippets wurden verwendet.']
      : ['Es wurden keine verwertbaren synthetischen Wissens-Snippets gefunden.'],
  };
}

function buildRuntimeState(result: EngineKnowledgeRetrievalResult, nextActionKey: string | null, shouldHandoff: boolean, shouldAskQuestion: boolean): ConversationEngineRuntimeState {
  return {
    selectedAgentKey: null,
    nextActionKey,
    shouldHandoff,
    shouldAskQuestion,
    handoffOfferSimulated: nextActionKey === 'offer_handoff',
    ticketFieldRequestSimulated: nextActionKey === 'collect_ticket_fields',
    sourcesUsed: result.snippets.length,
    sourceRequired: result.enabled,
  };
}

@Injectable()
export class ConversationEngineRuntimeService {
  constructor(
    private readonly engine: ConversationEngineService,
    private readonly responseDrafts: ResponseDraftService,
    private readonly websiteAnswerRuntimeGate?: WebsiteAnswerRuntimeGateService,
    private readonly websiteAnswerRuntimePilot?: WebsiteAnswerRuntimePilotService,
  ) {}

  async preview(input: ConversationEngineRuntimePilotInput): Promise<ConversationEngineRuntimePilotResult> {
    const history = Array.isArray(input.conversationHistory) ? input.conversationHistory : [];
    const knowledgeRetrieval = sanitizeKnowledgeSnippets({
      latestUserMessage: input.latestUserMessage,
      assistantProfile: input.assistantProfile,
      syntheticKnowledgeSnippets: input.syntheticKnowledgeSnippets,
    });
    const decision = this.engine.preview({
      assistantProfile: input.assistantProfile,
      latestUserMessage: input.latestUserMessage,
      conversationHistory: history,
      existingConversationState: asRecord(input.existingConversationState),
      knowledgeAvailable: knowledgeRetrieval.snippets.length > 0,
      testMode: true,
    });
    const engineResponsePreview = this.responseDrafts.preview({
      assistantProfile: input.assistantProfile,
      decision,
      latestUserMessage: input.latestUserMessage,
      history,
      knowledgeAvailable: knowledgeRetrieval.snippets.length > 0,
      knowledgeRetrievalResult: knowledgeRetrieval,
      testMode: true,
    });
    const websiteAnswerRuntimeGate = this.websiteAnswerRuntimeGate && input.websiteAnswerRuntimeGateInput
      ? this.websiteAnswerRuntimeGate.evaluate({
          runtimeContext: 'internal_admin_test',
          environment: 'preview',
          actorRole: 'operator',
          ...input.websiteAnswerRuntimeGateInput,
        })
      : null;
    const websiteAnswerRuntimePilot = this.websiteAnswerRuntimePilot && input.websiteAnswerRuntimePilotInput
      ? await this.websiteAnswerRuntimePilot.evaluatePilot({
          runtimeContext: 'internal_admin_test',
          environment: 'evaluation',
          actorRole: 'operator',
          answerMode: 'mock',
          ...input.websiteAnswerRuntimePilotInput,
        })
      : null;
    const runtimeState = buildRuntimeState(
      knowledgeRetrieval,
      decision.nextActionKey || null,
      decision.shouldHandoff,
      decision.shouldAskQuestion,
    );
    runtimeState.selectedAgentKey = decision.selectedAgentKey;

    const blockedByWebsiteRuntimeGate = websiteAnswerRuntimeGate && !websiteAnswerRuntimeGate.allowed;
    const finalResponsePreview =
      blockedByWebsiteRuntimeGate || websiteAnswerRuntimePilot
        ? null
        : engineResponsePreview;

    return {
      enabled: true,
      activationBoundary: {
        mode: 'admin_test_only',
        publicWidgetActivation: false,
        productionActivation: false,
        deployRequired: false,
      },
      sideEffects: {
        planned: false,
        ticketDelivery: false,
        emailDelivery: false,
        webhookDelivery: false,
        providerCalls: false,
        dbAccessForNewLogic: false,
        sql: false,
        queryRunner: false,
      },
      knowledgeRetrieval,
      websiteAnswerRuntimeGate,
      websiteAnswerRuntimePilot,
      runtimeState,
      conversationEnginePreview: decision,
      engineResponsePreview: finalResponsePreview,
      warnings: [
        ...(finalResponsePreview?.warnings || []),
        ...(knowledgeRetrieval.warnings || []),
        ...(blockedByWebsiteRuntimeGate ? [websiteAnswerRuntimeGate.sanitizedMessage] : []),
        ...(websiteAnswerRuntimePilot ? [websiteAnswerRuntimePilot.sanitizedMessage] : []),
      ],
      reasons: [
        'Conversation Engine Runtime Pilot ist nur im Admin-Testpfad aktiv.',
        'Neue Runtime-Logik nutzt keine DB-, SQL-, Query-Runner- oder Provider-Aufrufe.',
        ...(finalResponsePreview?.reasons || []),
        ...(knowledgeRetrieval.reasons || []),
        ...(blockedByWebsiteRuntimeGate ? [websiteAnswerRuntimeGate.reason] : []),
        ...(websiteAnswerRuntimePilot ? [websiteAnswerRuntimePilot.reason] : []),
      ],
    };
  }
}
