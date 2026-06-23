import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { ChatAgentOrchestratorService } from '../../chat/chat-agent-orchestrator.service';
import { ChatRoutingService } from '../../chat-routing/chat-routing.service';
import { PrismaService } from '../../db/prisma.service';
import { EcommerceProductAdvisorService } from '../../modules/ecommerce-product-advisor/ecommerce-product-advisor.service';
import { buildItSupportAnswerGuide } from '../../modules/it-support/it-support-flow';
import { estimateOpenAICost } from '../../usage/costs';
import { ToolExecutorService } from '../../tools/tool-executor.service';
import { ToolExecutionResult } from '../../tools/tool-result.types';
import { logEvent } from '../../utils/logger';
import { sanitizeInput, sanitizeOutput } from '../../utils/security';
import { EmbeddingService } from '../../vector/embedding.service';
import { LlmService } from '../../vector/llm.service';
import { VectorService } from '../../vector/vector.service';
import { ChatPipelineEvent } from './chat-pipeline-events';
import {
  ChatPipelineAdvisorContext,
  ChatPipelineInput,
  ChatPipelineResult,
  ChatPipelineUsage,
} from './chat-pipeline.types';
import { ConversationStateService } from './conversation-state.service';
import { ResponseComposerService } from './response-composer.service';
import { UsageLimitService } from '../../billing/usage-limit.service';

@Injectable()
export class ChatPipelineService {
  constructor(
    private readonly db: PrismaService,
    private readonly embedder: EmbeddingService,
    private readonly vector: VectorService,
    private readonly llm: LlmService,
    private readonly routing: ChatRoutingService,
    private readonly ecommerceProductAdvisor: EcommerceProductAdvisorService,
    private readonly chatAgentOrchestrator: ChatAgentOrchestratorService,
    private readonly conversationState: ConversationStateService,
    private readonly responseComposer: ResponseComposerService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  async process(input: ChatPipelineInput): Promise<ChatPipelineResult> {
    const normalized = this.normalizeInput(input);
    await this.usageLimits.assertWithinLimit(normalized.tenantId, 'monthlyMessages');
    const conversation = await this.prepareConversation(normalized);
    const agentResult = await this.tryAgent(normalized, conversation);

    if (agentResult) {
      return agentResult;
    }

    const routed = await this.prepareRoutedAnswer(normalized, conversation.id);
    if (routed.advisorFallbackAnswer) {
      return this.persistAndReturnRuleBasedAnswer({
        input: normalized,
        conversation,
        answer: routed.advisorFallbackAnswer,
        route: routed.routeDecision.route,
        sources: routed.sources,
        model: 'rule-based-advisor-no-data',
      });
    }

    if (routed.strictFallbackAnswer) {
      return this.persistAndReturnRuleBasedAnswer({
        input: normalized,
        conversation,
        answer: routed.strictFallbackAnswer,
        route: routed.routeDecision.route,
        sources: routed.sources,
        model: 'rule-based-knowledge-strict',
      });
    }

    const llmRes = routed.shouldClarifyAdvisor
      ? {
          text: routed.advisorContext.clarificationQuestion || '',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          model: 'rule-based-advisor',
          latencyMs: 0,
        }
      : await this.llm.answer(routed.systemPrompt, routed.userPrompt);

    const safeAnswer = sanitizeOutput(llmRes.text);
    const estimatedCost = estimateOpenAICost({
      model: llmRes.model,
      inputTokens: llmRes.usage.inputTokens,
      outputTokens: llmRes.usage.outputTokens,
    });

    await this.persistSuccessfulAssistantResponse({
      tenantId: normalized.tenantId,
      siteId: normalized.siteId,
      conversationId: conversation.id,
      sessionId: conversation.sessionId,
      answer: safeAnswer,
      usage: {
        model: llmRes.model,
        inputTokens: llmRes.usage.inputTokens,
        outputTokens: llmRes.usage.outputTokens,
        totalTokens: llmRes.usage.totalTokens,
        estimatedCost,
        latencyMs: llmRes.latencyMs,
        success: true,
      },
    });

    const parts = this.responseComposer.buildParts({
      answer: safeAnswer,
      route: routed.routeDecision.route,
      sources: routed.sources,
      products: routed.advisorContext.products,
      collections: routed.advisorContext.collections,
      cta: routed.shouldClarifyAdvisor ? undefined : routed.routeDecision.cta,
    });

    logEvent('chat_success', {
      siteId: normalized.siteId,
      tenantId: normalized.tenantId,
      conversationId: conversation.id,
      retrievalTime: routed.retrievalTime,
      llmTime: llmRes.latencyMs,
      totalTime: routed.retrievalTime + llmRes.latencyMs,
      sourcesCount: routed.sources.length,
      answerLength: safeAnswer.length,
    });

    return {
      answer: safeAnswer,
      parts,
      sources: routed.sources,
      sessionId: conversation.sessionId,
      conversationId: conversation.id,
      route: routed.routeDecision.route,
    };
  }

  async stream(
    input: ChatPipelineInput,
    emit: (event: ChatPipelineEvent) => Promise<void> | void,
  ): Promise<void> {
    const normalized = this.normalizeInput(input);
    await this.usageLimits.assertWithinLimit(normalized.tenantId, 'monthlyMessages');
    const conversation = await this.prepareConversation(normalized);
    await emit({
      type: 'message_start',
      sessionId: conversation.sessionId,
      conversationId: conversation.id,
    });

    const agentResult = await this.tryAgent(normalized, conversation);
    if (agentResult) {
      if (agentResult.decision?.suggestedTools.length) {
        for (const toolResult of agentResult.toolResults || []) {
          await emit({
            type: 'tool_event',
            label: toolResult.toolName,
            status: toolResult.status === 'failed'
              ? 'error'
              : toolResult.status === 'missing_fields' || toolResult.status === 'skipped'
                ? 'warning'
                : toolResult.status === 'queued'
                  ? 'pending'
                  : 'success',
            metadata: {
              message: toolResult.message,
              missingFields: toolResult.missingFields || [],
              auditId: toolResult.auditId || null,
            },
          });
        }
        if ((agentResult.toolResults || []).length === 0) {
          await emit({
          type: 'tool_event',
          label: agentResult.decision.type,
          status: 'pending',
          metadata: {
            suggestedTools: agentResult.decision.suggestedTools,
            nextAction: agentResult.decision.nextAction,
          },
          });
        }
      }
      if (agentResult.decision?.type === 'capture_lead' || agentResult.decision?.type === 'schedule_contact') {
        await emit({
          type: 'lead_event',
          label: agentResult.decision.type,
        });
      }
      await emit({ type: 'token', delta: agentResult.answer });
      await emit({
        type: 'message_end',
        answer: agentResult.answer,
        sessionId: agentResult.sessionId,
        conversationId: agentResult.conversationId,
        parts: agentResult.parts,
        sources: agentResult.sources,
        toolResults: agentResult.toolResults,
      });
      return;
    }

    const routed = await this.prepareRoutedAnswer(normalized, conversation.id);
    if (routed.advisorFallbackAnswer) {
      const result = await this.persistAndReturnRuleBasedAnswer({
        input: normalized,
        conversation,
        answer: routed.advisorFallbackAnswer,
        route: routed.routeDecision.route,
        sources: routed.sources,
        model: 'rule-based-advisor-no-data',
      });
      await emit({ type: 'token', delta: result.answer });
      await emit({
        type: 'message_end',
        answer: result.answer,
        sessionId: result.sessionId,
        conversationId: result.conversationId,
        parts: result.parts,
        sources: result.sources,
      });
      return;
    }

    if (routed.strictFallbackAnswer) {
      const result = await this.persistAndReturnRuleBasedAnswer({
        input: normalized,
        conversation,
        answer: routed.strictFallbackAnswer,
        route: routed.routeDecision.route,
        sources: routed.sources,
        model: 'rule-based-knowledge-strict',
      });
      await emit({ type: 'token', delta: result.answer });
      await emit({
        type: 'message_end',
        answer: result.answer,
        sessionId: result.sessionId,
        conversationId: result.conversationId,
        parts: result.parts,
        sources: result.sources,
      });
      return;
    }

    let safeAnswer = '';
    let llmRes = {
      text: '',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'rule-based-advisor',
      latencyMs: 0,
    };

    if (routed.shouldClarifyAdvisor) {
      safeAnswer = sanitizeOutput(routed.advisorContext.clarificationQuestion || '');
      await emit({ type: 'token', delta: safeAnswer });
    } else {
      let fullAnswer = '';
      llmRes = await this.llm.streamAnswer(routed.systemPrompt, routed.userPrompt, async (chunk) => {
        const safeChunk = sanitizeOutput(chunk);
        fullAnswer += safeChunk;
        await emit({ type: 'token', delta: safeChunk });
      });
      safeAnswer = sanitizeOutput(fullAnswer || llmRes.text);
    }

    await this.persistSuccessfulAssistantResponse({
      tenantId: normalized.tenantId,
      siteId: normalized.siteId,
      conversationId: conversation.id,
      sessionId: conversation.sessionId,
      answer: safeAnswer,
      usage: {
        model: llmRes.model,
        inputTokens: llmRes.usage.inputTokens,
        outputTokens: llmRes.usage.outputTokens,
        totalTokens: llmRes.usage.totalTokens,
        estimatedCost: estimateOpenAICost({
          model: llmRes.model,
          inputTokens: llmRes.usage.inputTokens,
          outputTokens: llmRes.usage.outputTokens,
        }),
        latencyMs: llmRes.latencyMs,
        success: true,
      },
    });

    const parts = this.responseComposer.buildParts({
      answer: safeAnswer,
      route: routed.routeDecision.route,
      sources: routed.sources,
      products: routed.advisorContext.products,
      collections: routed.advisorContext.collections,
      cta: routed.shouldClarifyAdvisor ? undefined : routed.routeDecision.cta,
    });

    await emit({ type: 'sources', sources: routed.sources });
    await emit({
      type: 'message_end',
      answer: safeAnswer,
      sessionId: conversation.sessionId,
      conversationId: conversation.id,
      parts,
      sources: routed.sources,
    });
  }

  private normalizeInput(input: ChatPipelineInput): Required<ChatPipelineInput> {
    return {
      ...input,
      message: sanitizeInput(input.message),
      sessionId: input.sessionId?.trim() || randomUUID(),
      siteConfig: input.siteConfig || {},
      systemPrompt: input.systemPrompt || null,
      conversationFlow:
        input.conversationFlow ??
        (input.siteConfig && typeof input.siteConfig === 'object'
          ? input.siteConfig.conversationFlow
          : undefined),
      sourceUrl: input.sourceUrl || null,
      evaluationMode: input.evaluationMode === true,
    };
  }

  private async prepareConversation(input: Required<ChatPipelineInput>) {
    const conversation = await this.conversationState.ensureConversation({
      tenantId: input.tenantId,
      siteId: input.siteId,
      sessionId: input.sessionId,
    });

    if (input.source === 'widget') {
      await this.conversationState.touchWidgetSession({
        siteId: input.siteId,
        sessionId: conversation.sessionId,
        sourceUrl: input.sourceUrl,
      });
    }

    await this.conversationState.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: input.message,
      redact: true,
    });

    return conversation;
  }

  private async tryAgent(
    input: Required<ChatPipelineInput>,
    conversation: { id: string; sessionId: string },
  ): Promise<ChatPipelineResult | null> {
    const history = await this.conversationState.loadHistory(conversation.id);
    const agentDecision = await this.chatAgentOrchestrator.decide({
      tenantId: input.tenantId,
      siteId: input.siteId,
      conversationId: conversation.id,
      sessionId: conversation.sessionId,
      message: input.message,
      history,
    });

    if (!agentDecision.handled || !agentDecision.answer) {
      return null;
    }

    const safeAnswer = sanitizeOutput(agentDecision.answer);
    const toolResults = await this.executeDecisionTools(agentDecision, input, conversation);
    await this.persistSuccessfulAssistantResponse({
      tenantId: input.tenantId,
      siteId: input.siteId,
      conversationId: conversation.id,
      sessionId: conversation.sessionId,
      answer: safeAnswer,
      usage: {
        model: 'rule-based-agent-orchestrator',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        latencyMs: 0,
        success: true,
      },
      leadCaptured: Boolean(agentDecision.leadId),
      source: input.source,
    });

    const parts = this.responseComposer.buildParts({
      answer: safeAnswer,
      route: 'agent',
      sources: [],
      cta: agentDecision.cta,
    });

    logEvent('chat_agent_orchestrator_handled', {
      siteId: input.siteId,
      tenantId: input.tenantId,
      conversationId: conversation.id,
      action: agentDecision.action,
      leadId: agentDecision.leadId || null,
      contactRequestId: agentDecision.contactRequestId || null,
      decisionType: agentDecision.decision?.type || null,
      decisionConfidence: agentDecision.decision?.confidence ?? null,
      suggestedTools: agentDecision.decision?.suggestedTools || [],
      toolResults: toolResults.map((result) => ({
        toolName: result.toolName,
        status: result.status,
        auditId: result.auditId || null,
      })),
    });

    return {
      answer: safeAnswer,
      parts,
      sources: [],
      sessionId: conversation.sessionId,
      conversationId: conversation.id,
      route: 'agent',
      decision: agentDecision.decision,
      toolResults,
    };
  }

  private async executeDecisionTools(
    agentDecision: Awaited<ReturnType<ChatAgentOrchestratorService['decide']>>,
    input: Required<ChatPipelineInput>,
    conversation: { id: string; sessionId: string },
  ): Promise<ToolExecutionResult[]> {
    const decision = agentDecision.decision;
    if (!decision?.suggestedTools.length) {
      return [];
    }

    const results: ToolExecutionResult[] = [];
    for (const toolName of decision.suggestedTools) {
      if (!this.shouldExecuteTool(toolName, decision.requiredFields)) {
        continue;
      }

      const result = await this.toolExecutor.executeTool(
        toolName,
        this.buildToolInput(toolName, decision, input.message),
        {
          tenantId: input.tenantId,
          siteId: input.siteId,
          conversationId: conversation.id,
          source: input.source,
          decisionId:
            typeof decision.metadata.agentRunId === 'string' ? decision.metadata.agentRunId : undefined,
          visitorId: input.sessionId,
        },
      );
      results.push(result);
    }

    return results;
  }

  private shouldExecuteTool(toolName: string, requiredFields: string[]) {
    if (['query_knowledge', 'recommend_service', 'handoff'].includes(toolName)) {
      return true;
    }
    if (requiredFields.length > 0) {
      return false;
    }
    return ['capture_lead', 'schedule_contact', 'create_ticket', 'push_webhook'].includes(toolName);
  }

  private buildToolInput(
    toolName: string,
    decision: NonNullable<Awaited<ReturnType<ChatAgentOrchestratorService['decide']>>['decision']>,
    message: string,
  ) {
    const fields = decision.collectedFields || {};
    switch (toolName) {
      case 'capture_lead':
        return {
          name: fields.name,
          email: fields.email,
          phone: fields.phone,
          company: fields.company,
          need: fields.concern || fields.companyNeed || message,
          urgency: fields.urgency,
          source: 'chat_decision',
        };
      case 'schedule_contact':
        return {
          name: fields.name,
          email: fields.email,
          phone: fields.phone,
          preferredChannel: fields.preferredContact,
          topic: fields.concern || fields.companyNeed || message,
        };
      case 'create_ticket':
        return {
          subject: fields.concern ? String(fields.concern).slice(0, 120) : 'Support-Fall aus dem Chat',
          description: fields.concern || fields.companyNeed || message,
          priority: fields.urgency === 'high' ? 'high' : 'normal',
          customerEmail: fields.email,
        };
      case 'push_webhook':
        return {
          eventType: decision.type,
          payload: {
            decisionType: decision.type,
            confidence: decision.confidence,
            nextAction: decision.nextAction,
          },
        };
      case 'query_knowledge':
        return {
          query: fields.concern || fields.companyNeed || message,
          limit: 4,
        };
      case 'recommend_service':
        return {
          intent: fields.concern || fields.companyNeed || message,
          industry: fields.industry,
          urgency: fields.urgency,
        };
      case 'handoff':
        return {
          reason: decision.reason || fields.concern || message,
          priority: fields.urgency === 'high' ? 'high' : 'normal',
        };
      default:
        return {};
    }
  }

  private async prepareRoutedAnswer(input: Required<ChatPipelineInput>, conversationId: string) {
    const history = await this.conversationState.loadHistory(conversationId);
    const routeDecision = await this.routing.resolveForSite({
      siteId: input.siteId,
      message: input.message,
      history,
    });
    const routingGuide = this.responseComposer.buildRoutingGuide(routeDecision);
    const conversationGuide = this.responseComposer.buildConversationGuide(
      history,
      input.conversationFlow,
    );

    logEvent('chat_route_resolved', {
      siteId: input.siteId,
      tenantId: input.tenantId,
      conversationId,
      route: routeDecision.route,
      reason: routeDecision.reason,
      agentKey: routeDecision.agentKey || null,
      moduleKey: routeDecision.moduleKey || null,
    });

    const retrievalStart = Date.now();
    const qEmbedding = await this.embedder.embed(input.message);
    const hits = await this.vector.search(input.tenantId, input.siteId, qEmbedding, 6, undefined, {
      demoOnly: input.evaluationMode === true,
    });
    const retrievalTime = Date.now() - retrievalStart;

    logEvent('retrieval_result', {
      conversationId,
      tenantId: input.tenantId,
      siteId: input.siteId,
      hits: hits.length,
      retrievalTime,
    });

    const advisorContext =
      routeDecision.route === 'advisor'
        ? await this.ecommerceProductAdvisor.buildRecommendationContextForSite({
            siteId: input.siteId,
            query: input.message,
            limit: 3,
            history,
          })
        : this.emptyAdvisorContext(input.message);
    const shouldClarifyAdvisor =
      routeDecision.route === 'advisor' && Boolean(advisorContext.clarificationQuestion);
    const knowledgeMode = this.getKnowledgeMode(input.siteConfig);

    const context = this.responseComposer.buildContext(hits);
    const catalogContext = this.responseComposer.buildCatalogContext(advisorContext);
    const itSupportKnowledgeGuide = routeDecision.moduleKey === 'it-support'
      ? buildItSupportAnswerGuide({ knowledgeAvailable: hits.length > 0 })
      : '';
    const userPrompt = this.responseComposer.buildUserPrompt({
      history,
      message: input.message,
      context,
      catalogContext,
      advisorStateGuide: advisorContext.stateGuide,
    });
    const systemPrompt = this.responseComposer.buildSystemPrompt({
      siteConfig: input.siteConfig,
      systemPrompt: input.systemPrompt,
      guides: [routingGuide, itSupportKnowledgeGuide, conversationGuide],
    });

    return {
      history,
      routeDecision,
      advisorContext,
      shouldClarifyAdvisor,
      retrievalTime,
      userPrompt,
      systemPrompt,
      sources: this.responseComposer.buildSources(hits),
      strictFallbackAnswer:
        knowledgeMode === 'strict' && hits.length === 0
          ? input.evaluationMode === true
            ? 'Diese Frage kann ich auf Grundlage der freigegebenen Demonstrationsinhalte nicht zuverlaessig beantworten.'
            : 'Dazu habe ich gerade keine passende Information im Unternehmenswissen gefunden. Bitte hinterlasse kurz deine Anfrage, dann kann ein Mensch das pruefen.'
          : undefined,
      advisorFallbackAnswer:
        routeDecision.route === 'advisor' &&
        hits.length === 0 &&
        advisorContext.products.length === 0 &&
        advisorContext.collections.length === 0
          ? 'Dazu habe ich aktuell keine verifizierten Produktdaten gefunden. Bitte beschreibe kurz, wonach du suchst, oder hinterlasse eine Anfrage, damit ein Mitarbeiter das pruefen kann.'
          : undefined,
    };
  }

  private getKnowledgeMode(siteConfig?: Record<string, unknown> | null) {
    const value = typeof siteConfig?.knowledgeMode === 'string' ? siteConfig.knowledgeMode : '';
    if (value === 'strict' || value === 'grounded' || value === 'flexible') {
      return value;
    }
    return 'flexible';
  }

  private async persistAndReturnRuleBasedAnswer(params: {
    input: Required<ChatPipelineInput>;
    conversation: { id: string; sessionId: string };
    answer: string;
    route: string;
    sources: ChatPipelineResult['sources'];
    model: string;
  }): Promise<ChatPipelineResult> {
    const safeAnswer = sanitizeOutput(params.answer);
    await this.persistSuccessfulAssistantResponse({
      tenantId: params.input.tenantId,
      siteId: params.input.siteId,
      conversationId: params.conversation.id,
      sessionId: params.conversation.sessionId,
      answer: safeAnswer,
      usage: {
        model: params.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        latencyMs: 0,
        success: true,
      },
      source: params.input.source,
    });

    return {
      answer: safeAnswer,
      parts: this.responseComposer.buildParts({
        answer: safeAnswer,
        route: params.route,
        sources: params.sources,
      }),
      sources: params.sources,
      sessionId: params.conversation.sessionId,
      conversationId: params.conversation.id,
      route: params.route as ChatPipelineResult['route'],
    };
  }

  private emptyAdvisorContext(message: string): ChatPipelineAdvisorContext {
    return {
      products: [],
      collections: [],
      clarificationQuestion: undefined,
      effectiveQuery: message,
      state: 'ready_to_recommend',
      stateGuide: '',
    };
  }

  private async persistSuccessfulAssistantResponse(params: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    sessionId: string;
    answer: string;
    usage: ChatPipelineUsage;
    source?: ChatPipelineInput['source'];
    leadCaptured?: boolean;
  }) {
    await this.insertUsageEvent({
      tenantId: params.tenantId,
      siteId: params.siteId,
      conversationId: params.conversationId,
      sessionId: params.sessionId,
      ...params.usage,
    });

    await this.upsertDailyUsage({
      tenantId: params.tenantId,
      siteId: params.siteId,
      requestCount: 1,
      userMessageCount: 1,
      assistantMessageCount: 1,
      inputTokens: params.usage.inputTokens,
      outputTokens: params.usage.outputTokens,
      totalTokens: params.usage.totalTokens,
      estimatedCost: params.usage.estimatedCost,
      successCount: 1,
      errorCount: 0,
      latencyMs: params.usage.latencyMs,
    });

    await this.conversationState.appendMessage({
      conversationId: params.conversationId,
      role: 'assistant',
      content: params.answer,
    });
    await this.conversationState.touchConversation(params.conversationId);

    if (params.source === 'widget') {
      await this.conversationState.touchWidgetSession({
        siteId: params.siteId,
        sessionId: params.sessionId,
        leadCaptured: Boolean(params.leadCaptured),
      });
    }
  }

  private async insertUsageEvent(params: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    sessionId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    success: boolean;
  }) {
    await this.db.query(
      `INSERT INTO usage_events (
        id, tenant_id, site_id, conversation_id, session_id,
        model, input_tokens, output_tokens, total_tokens,
        estimated_cost, latency_ms, success, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, now()
      )`,
      [
        randomUUID(),
        params.tenantId,
        params.siteId,
        params.conversationId,
        params.sessionId,
        params.model,
        params.inputTokens,
        params.outputTokens,
        params.totalTokens,
        params.estimatedCost,
        params.latencyMs,
        params.success,
      ],
    );
  }

  private async upsertDailyUsage(params: {
    tenantId: string;
    siteId: string;
    requestCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    successCount: number;
    errorCount: number;
    latencyMs: number;
  }) {
    await this.db.query(
      `INSERT INTO usage_daily (
        tenant_id, site_id, day,
        request_count, user_message_count, assistant_message_count,
        input_tokens, output_tokens, total_tokens,
        estimated_cost, success_count, error_count, latency_ms,
        created_at, updated_at
      ) VALUES (
        $1, $2, CURRENT_DATE,
        $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        now(), now()
      )
      ON CONFLICT (tenant_id, site_id, day)
      DO UPDATE SET
        request_count           = usage_daily.request_count           + EXCLUDED.request_count,
        user_message_count      = usage_daily.user_message_count      + EXCLUDED.user_message_count,
        assistant_message_count = usage_daily.assistant_message_count + EXCLUDED.assistant_message_count,
        input_tokens            = usage_daily.input_tokens            + EXCLUDED.input_tokens,
        output_tokens           = usage_daily.output_tokens           + EXCLUDED.output_tokens,
        total_tokens            = usage_daily.total_tokens            + EXCLUDED.total_tokens,
        estimated_cost          = usage_daily.estimated_cost          + EXCLUDED.estimated_cost,
        success_count           = usage_daily.success_count           + EXCLUDED.success_count,
        error_count             = usage_daily.error_count             + EXCLUDED.error_count,
        latency_ms              = usage_daily.latency_ms              + EXCLUDED.latency_ms,
        updated_at              = now()`,
      [
        params.tenantId,
        params.siteId,
        params.requestCount,
        params.userMessageCount,
        params.assistantMessageCount,
        params.inputTokens,
        params.outputTokens,
        params.totalTokens,
        params.estimatedCost,
        params.successCount,
        params.errorCount,
        params.latencyMs,
      ],
    );
  }
}
