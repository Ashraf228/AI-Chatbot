import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AgentDecision } from '../ai/orchestration/agent-decision.types';
import { AgentOrchestratorService } from '../ai/orchestration/agent-orchestrator.service';
import { PrismaService } from '../db/prisma.service';
import { UsageLimitService } from '../billing/usage-limit.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { logEvent } from '../utils/logger';
import { LeadMailerService } from '../modules/widget/services/lead-mailer.service';
import { ReportMailerService } from '../modules/widget/services/report-mailer.service';
import { ToolExecutorService } from '../tools/tool-executor.service';
import {
  DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  normalizeItSupportModuleConfig,
  normalizeLocalServiceIntakeFlowConfig,
} from '../site-modules/module-configs';
import type { ItSupportModuleConfig, LocalServiceIntakeFlowConfig } from '../site-modules/module-configs';
import {
  buildItSupportCancelledAnswer,
  buildItSupportResolvedAnswer,
  buildCreateTicketInputFromPendingTicket,
  buildItTicketMissingFieldQuestion,
  buildItTicketOfferAnswer,
  buildItTicketReadyToCreateAnswer,
  compactPendingTicketState,
  extractItTicketFields,
  getMissingItTicketFields,
  hasCriticalItIncident,
  hasExplicitTicketRequest,
  hasItSupportHandoffRequest,
  hasItSupportSignal,
  hasSecurityIncident,
  hasSolutionFailedReply,
  hasSolutionWorkedReply,
  hasTicketCollectionAbort,
  hasTicketConfirmationNo,
  hasTicketConfirmationYes,
  shouldStartNewItSupportContext,
  mergePendingTicket,
  parsePendingTicketState,
} from '../modules/it-support/it-support-flow';
import type { PendingTicketForwardingStatus, PendingTicketState } from '../modules/it-support/it-support-flow';

type ChatHistoryEntry = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type SiteConfigRow = {
  name: string;
  site_key?: string | null;
  domain?: string | null;
  config: Record<string, unknown> | null;
};

type LeadCaptureResult = {
  leadId: string;
  created: boolean;
};

type PendingLeadState = ContactDetails & {
  status?: 'pending' | 'completed' | 'paused';
  intent?: 'lead' | 'schedule';
  scheduleIntent?: boolean;
  leadPromptCount?: number;
  lastLeadPromptAt?: string;
  leadCapturePaused?: boolean;
  pausedAt?: string;
  pauseReason?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  completedLeadId?: string;
};

type ConversationState = {
  intent?: 'lead' | 'support' | 'sales' | 'appointment' | 'product_advice' | 'ticket' | null;
  stage?: 'discovery' | 'qualification' | 'contact_collection' | 'scheduling' | 'completed';
  topic?: string | null;
  urgency?: string | null;
  goal?: 'capture_lead' | 'schedule_call' | 'answer_question' | 'create_ticket' | 'recommend_product' | null;
  collectedFields?: ContactDetails & {
    company?: string;
  };
  missingFields?: string[];
  nextExpectedField?: string | null;
  lastUserIntent?: string | null;
  updatedAt?: string;
};

type ConversationMetadataRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type OrchestratorAction =
  | 'normal_answer'
  | 'ask_for_contact'
  | 'capture_lead'
  | 'suggest_schedule'
  | 'handoff_to_contact';

type ContactDetails = {
  name?: string;
  email?: string;
  phone?: string;
  concern?: string;
  location?: string;
  urgency?: string;
  preferredContact?: 'email' | 'phone';
};

export type ChatAgentDecision = {
  action: OrchestratorAction;
  handled: boolean;
  answer?: string;
  decision?: AgentDecision;
  leadId?: string;
  contactRequestId?: string;
  cta?: {
    action: 'lead_capture';
    label: string;
    description?: string;
  };
};

@Injectable()
export class ChatAgentOrchestratorService {
  constructor(
    private readonly db: PrismaService,
    private readonly siteModules: SiteModulesService,
    private readonly leadMailer: LeadMailerService,
    private readonly reportMailer: ReportMailerService,
    private readonly usageLimits: UsageLimitService,
    @Optional() private readonly decisionOrchestrator?: AgentOrchestratorService,
    @Optional() private readonly toolExecutor?: ToolExecutorService,
  ) {}

  async decide(params: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    sessionId: string;
    message: string;
    history: ChatHistoryEntry[];
  }): Promise<ChatAgentDecision> {
    const structuredDecision = await this.createStructuredDecision(params);
    const moduleContext = await this.getModuleContext(params.siteId);
    const siteConfig = await this.getSiteConfig(params.siteId);
    let intakeFlow = moduleContext.intakeFlow || siteConfig.intakeFlow;
    const text = normalizeText(params.message);
    let leadIntent = hasLeadIntent(text, intakeFlow);
    let scheduleIntent = hasScheduleIntent(text, intakeFlow);
    const askedForContact = wasContactRequested(params.history);
    const metadataState = await this.loadConversationMetadata(params.conversationId);
    const pendingLead = metadataState.pendingLead;
    const pendingTicket = metadataState.pendingTicket;
    const activePendingLead = pendingLead?.status === 'pending' ? pendingLead : null;
    const currentConversationState = pendingLead?.status === 'completed' ? null : metadataState.conversationState;
    const pendingActive = activePendingLead?.status === 'pending';
    let contactFromMessage = extractContactDetails(params.message, activePendingLead, intakeFlow);
    const greetingIntent = hasGreetingIntent(text);
    const recoveryIntent = hasRecoveryIntent(text);
    const refusalIntent = hasRefusalIntent(text);
    let localServiceFlow = isLocalServiceFlow({
      text,
      siteName: siteConfig.siteSignalText || siteConfig.siteName,
      pendingLead,
      contact: contactFromMessage,
      conversationState: currentConversationState,
      intakeFlow,
    });
    if (!intakeFlow && localServiceFlow) {
      intakeFlow = DEFAULT_LOCAL_SERVICE_INTAKE_FLOW;
      leadIntent = hasLeadIntent(text, intakeFlow);
      scheduleIntent = hasScheduleIntent(text, intakeFlow);
      contactFromMessage = extractContactDetails(params.message, activePendingLead, intakeFlow);
      localServiceFlow = isLocalServiceFlow({
        text,
        siteName: siteConfig.siteSignalText || siteConfig.siteName,
        pendingLead,
        contact: contactFromMessage,
        conversationState: currentConversationState,
        intakeFlow,
      });
    }
    const conversationState = buildConversationState({
      previous: currentConversationState,
      message: params.message,
      contact: mergeContactDetails(activePendingLead, contactFromMessage),
      leadIntent,
      scheduleIntent,
      intakeFlow,
    });

    if (hasSensitiveDataInput(text)) {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState,
      });
      return {
        action: 'normal_answer',
        handled: true,
        answer: buildSensitiveDataAnswer(),
        decision: structuredDecision,
      };
    }

    const itSupportDecision = await this.handleItSupportFlow({
      params,
      text,
      pendingTicket,
      conversationState,
      moduleContext,
      structuredDecision,
    });
    if (itSupportDecision) {
      return itSupportDecision;
    }

    if (localServiceFlow && hasCompletedLeadAcknowledgementIntent(text) && pendingLead?.status === 'completed') {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState: buildConversationState({
          previous: null,
          message: params.message,
          contact: {},
          leadIntent: false,
          scheduleIntent: false,
          stage: 'completed',
          intakeFlow,
        }),
      });
      return {
        action: 'normal_answer',
        handled: true,
        answer: buildCompletedLeadAcknowledgementAnswer(),
        decision: structuredDecision,
      };
    }

    if (localServiceFlow && hasLocalServiceStopIntent(text)) {
      if (pendingActive || askedForContact) {
        await this.saveConversationMetadata(params.conversationId, {
          pendingLead: buildPausedLeadState({
            previous: activePendingLead,
            contact: mergeContactDetails(activePendingLead, contactFromMessage),
            reason: 'stop',
          }),
          conversationState: buildConversationState({
            previous: conversationState,
            message: params.message,
            contact: mergeContactDetails(activePendingLead, contactFromMessage),
            leadIntent: false,
            scheduleIntent: false,
            stage: 'discovery',
            intakeFlow,
          }),
        });
      } else {
        await this.saveConversationMetadata(params.conversationId, {
          conversationState,
        });
      }

      return {
        action: 'normal_answer',
        handled: true,
        answer: buildLocalServiceStopAnswer(),
        decision: structuredDecision,
      };
    }

    const leadFeatureEnabled =
      moduleContext.leadSalesEnabled ||
      siteConfig.setupGoal === 'lead_capture' ||
      siteConfig.setupGoal === 'appointments' ||
      siteConfig.leadCaptureEnabled !== false;

    if (
      (isLocalServicePricingQuestion(text, intakeFlow) || (localServiceFlow && isServicePricingOrBillingQuestion(text, intakeFlow))) &&
      !pendingActive &&
      !scheduleIntent &&
      !hasContactSignal(contactFromMessage)
    ) {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState,
      });
      return {
        action: 'normal_answer',
        handled: true,
        answer: buildLocalServicePricingAnswer(intakeFlow),
        decision: structuredDecision,
      };
    }

    if ((pendingActive || askedForContact) && shouldPauseLeadCapture(text, contactFromMessage)) {
      const pausedState = buildPausedLeadState({
        previous: activePendingLead,
        contact: mergeContactDetails(activePendingLead, contactFromMessage),
        reason: recoveryIntent ? 'recovery' : refusalIntent ? 'refusal' : greetingIntent ? 'greeting' : 'unclear',
      });
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: pausedState,
        conversationState: buildConversationState({
          previous: conversationState,
          message: params.message,
          contact: pausedState,
          leadIntent: false,
          scheduleIntent: false,
          stage: 'discovery',
          intakeFlow,
        }),
      });

      return {
        action: 'normal_answer',
        handled: true,
        answer: recoveryIntent || refusalIntent
          ? buildRecoveryAnswer(localServiceFlow)
          : buildGreetingAnswer(localServiceFlow),
        decision: structuredDecision,
      };
    }

    if (!leadFeatureEnabled) {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState,
      });
      return { action: 'normal_answer', handled: false, decision: structuredDecision };
    }

    if (!pendingActive && greetingIntent && !leadIntent && !scheduleIntent && !hasContactSignal(contactFromMessage)) {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState,
      });
      return {
        action: 'normal_answer',
        handled: true,
        answer: buildGreetingAnswer(localServiceFlow),
        decision: structuredDecision,
      };
    }

    if (
      shouldRestartCompletedLocalServiceIntake({
        pendingLead,
        localServiceFlow,
        leadIntent,
        scheduleIntent,
        contact: contactFromMessage,
        text,
        intakeFlow,
      })
    ) {
      const restartedConversationState = buildConversationState({
        previous: null,
        message: params.message,
        contact: contactFromMessage,
        leadIntent,
        scheduleIntent,
        stage: 'qualification',
        intakeFlow,
      });
      const restartedContact = mergeContactDetailsFromState(contactFromMessage, restartedConversationState);
      const restartedMissing = getMissingContactFields(restartedContact, true, intakeFlow);
      const restartedLeadState = buildPendingLeadState({
        previous: null,
        contact: restartedContact,
        scheduleIntent,
        startedByIntent: scheduleIntent ? 'schedule' : 'lead',
      });

      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: restartedLeadState,
        conversationState: restartedConversationState,
      });
      await this.recordLeadAudit({
        tenantId: params.tenantId,
        siteId: params.siteId,
        action: 'lead_pending_started',
        metadata: {
          missingFields: restartedMissing,
          restartedAfterCompletedLead: true,
          hasName: Boolean(restartedLeadState.name),
          hasEmail: Boolean(restartedLeadState.email),
          hasPhone: Boolean(restartedLeadState.phone),
          hasMessage: Boolean(restartedLeadState.concern),
        },
      });

      return {
        action: 'ask_for_contact',
        handled: true,
        answer: buildMissingFieldsQuestion(
          restartedMissing,
          scheduleIntent,
          Boolean(restartedContact.concern),
          restartedContact.preferredContact,
          true,
          intakeFlow,
          Boolean(restartedContact.urgency),
          restartedContact,
          params.message,
        ),
        decision: structuredDecision,
        cta: buildLeadCta(
          moduleContext.ctaLabel,
          moduleContext.ctaDescription,
          siteConfig.ctaText,
          true,
        ),
      };
    }

    if (
      !pendingActive &&
      pendingLead?.status === 'completed' &&
      !leadIntent &&
      !scheduleIntent
    ) {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState: buildConversationState({
          previous: conversationState,
          message: params.message,
          contact: pendingLead,
          leadIntent,
          scheduleIntent,
          stage: 'completed',
          intakeFlow,
        }),
      });
      return { action: 'normal_answer', handled: false, decision: structuredDecision };
    }

    if (
      !pendingActive &&
      !leadIntent &&
      !scheduleIntent &&
      !(askedForContact && hasContactSignal(contactFromMessage)) &&
      !shouldStartLocalServiceIntakeFromContext(localServiceFlow, contactFromMessage)
    ) {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState,
      });
      const nonLeadDecision = this.mapNonLeadStructuredDecision(structuredDecision);
      if (nonLeadDecision) {
        return nonLeadDecision;
      }

      return { action: 'normal_answer', handled: false, decision: structuredDecision };
    }

    const effectiveScheduleIntent =
      Boolean(
        scheduleIntent ||
          pendingLead?.scheduleIntent ||
          pendingLead?.intent === 'schedule' ||
          conversationState.intent === 'appointment' ||
          conversationState.goal === 'schedule_call',
      );
    const freshLocalServiceIntake = shouldStartFreshLocalServiceIntake({
      pendingActive,
      localServiceFlow,
      text,
      contact: contactFromMessage,
      scheduleIntent: effectiveScheduleIntent,
      intakeFlow,
    });
    const intakeConversationState = freshLocalServiceIntake
      ? buildConversationState({
          previous: null,
          message: params.message,
          contact: contactFromMessage,
          leadIntent,
          scheduleIntent: effectiveScheduleIntent,
          intakeFlow,
        })
      : conversationState;
    const contact = ensureScheduleContactContext(
      mergeContactDetailsFromState(
        mergeContactDetails(activePendingLead, contactFromMessage),
        intakeConversationState,
      ),
      intakeConversationState,
      effectiveScheduleIntent,
    );
    const missing = getMissingContactFields(contact, localServiceFlow, intakeFlow);
    const cta = buildLeadCta(
      moduleContext.ctaLabel,
      moduleContext.ctaDescription,
      siteConfig.ctaText,
      localServiceFlow,
    );
    const leadPromptCount = activePendingLead?.leadPromptCount || 0;
    const shouldAskForContactDetails = canAskForLeadDetails({
      missing,
      contact,
      pendingActive,
      leadIntent,
      scheduleIntent: effectiveScheduleIntent,
      contactFromMessage,
      leadPromptCount,
      text,
      localServiceFlow,
      intakeFlow,
    });
    const activeConversationState = buildConversationState({
      previous: intakeConversationState,
      message: params.message,
      contact,
      leadIntent,
      scheduleIntent: effectiveScheduleIntent,
      stage: missing.length > 0
        ? effectiveScheduleIntent && contact.concern
          ? 'contact_collection'
          : 'qualification'
        : effectiveScheduleIntent
          ? 'scheduling'
          : 'completed',
      intakeFlow,
    });

    if (localServiceFlow && pendingActive && isServicePricingOrBillingQuestion(text, intakeFlow)) {
      const nextState = buildPendingLeadState({
        previous: activePendingLead,
        contact,
        scheduleIntent: effectiveScheduleIntent,
        startedByIntent: scheduleIntent ? 'schedule' : 'lead',
      });
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: nextState,
        conversationState: activeConversationState,
      });

      const nextQuestion = missing.length > 0
        ? buildMissingFieldsQuestion(
            missing,
            effectiveScheduleIntent,
            Boolean(contact.concern),
            contact.preferredContact,
            true,
            intakeFlow,
            Boolean(contact.urgency),
            contact,
            params.message,
          )
        : '';

      return {
        action: 'normal_answer',
        handled: true,
        answer: [buildLocalServicePricingAnswer(intakeFlow), nextQuestion].filter(Boolean).join('\n\n'),
        decision: structuredDecision,
        cta,
      };
    }

    if (missing.length > 0) {
      if (
        !pendingActive &&
        !effectiveScheduleIntent &&
        shouldQualifyBeforeContact(text, contact) &&
        missing.includes('name') &&
        missing.includes('contact')
      ) {
        await this.saveConversationMetadata(params.conversationId, {
          conversationState: {
            ...activeConversationState,
            stage: 'qualification',
            nextExpectedField: 'topic',
          },
        });

        return {
          action: 'normal_answer',
          handled: true,
          answer: buildBusinessNeedQualificationAnswer(),
          decision: structuredDecision,
        };
      }

      if (!shouldAskForContactDetails) {
        const pausedState = buildPausedLeadState({
          previous: activePendingLead,
          contact,
          reason: leadPromptCount >= 1 ? 'prompt_limit' : 'weak_intent',
        });
        await this.saveConversationMetadata(params.conversationId, {
          pendingLead: pausedState,
          conversationState: buildConversationState({
            previous: activeConversationState,
            message: params.message,
            contact,
            leadIntent: false,
            scheduleIntent: false,
            stage: 'discovery',
            intakeFlow,
          }),
        });

        return {
          action: 'normal_answer',
          handled: true,
          answer: buildConsultingResetAnswer(localServiceFlow),
          decision: structuredDecision,
        };
      }

      const nextState = buildPendingLeadState({
        previous: activePendingLead,
        contact,
        scheduleIntent: effectiveScheduleIntent,
        startedByIntent: scheduleIntent ? 'schedule' : 'lead',
      });
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: nextState,
        conversationState: activeConversationState,
      });
      await this.recordLeadAudit({
        tenantId: params.tenantId,
        siteId: params.siteId,
        action: pendingActive ? 'lead_pending_updated' : 'lead_pending_started',
        metadata: {
          missingFields: missing,
          scheduleIntent: effectiveScheduleIntent,
          hasName: Boolean(nextState.name),
          hasEmail: Boolean(nextState.email),
          hasPhone: Boolean(nextState.phone),
          hasMessage: Boolean(nextState.concern),
        },
      });
      if (effectiveScheduleIntent) {
        await this.recordLeadAudit({
          tenantId: params.tenantId,
          siteId: params.siteId,
          action: 'schedule_intent_detected',
          metadata: {
            hasConcern: Boolean(nextState.concern),
            missingFields: missing,
          },
        });
      }

      return {
        action: 'ask_for_contact',
        handled: true,
        answer: buildMissingFieldsQuestion(
          missing,
          effectiveScheduleIntent,
          Boolean(contact.concern),
          contact.preferredContact,
          localServiceFlow,
          intakeFlow,
          Boolean(contact.urgency),
          contact,
          params.message,
        ),
        decision: structuredDecision,
        cta,
      };
    }

    if (localServiceFlow) {
      const hardMissing = getMissingContactFields(contact, true, intakeFlow);
      if (hardMissing.length > 0) {
        const guardedState = buildPendingLeadState({
          previous: activePendingLead,
          contact,
          scheduleIntent: effectiveScheduleIntent,
          startedByIntent: scheduleIntent ? 'schedule' : 'lead',
        });
        await this.saveConversationMetadata(params.conversationId, {
          pendingLead: guardedState,
          conversationState: buildConversationState({
            previous: intakeConversationState,
            message: params.message,
            contact,
            leadIntent,
            scheduleIntent: effectiveScheduleIntent,
            stage: 'qualification',
            intakeFlow,
          }),
        });
        await this.recordLeadAudit({
          tenantId: params.tenantId,
          siteId: params.siteId,
          action: pendingActive ? 'lead_pending_updated' : 'lead_pending_started',
          metadata: {
            missingFields: hardMissing,
            guardedBeforeCapture: true,
            hasName: Boolean(guardedState.name),
            hasPhone: Boolean(guardedState.phone),
            hasMessage: Boolean(guardedState.concern),
          },
        });

        return {
          action: 'ask_for_contact',
          handled: true,
          answer: buildMissingFieldsQuestion(
            hardMissing,
            effectiveScheduleIntent,
            Boolean(contact.concern),
            contact.preferredContact,
            true,
            intakeFlow,
            Boolean(contact.urgency),
            contact,
            params.message,
          ),
          decision: structuredDecision,
          cta,
        };
      }
    }

    if (!hasLeadCaptureQuality(contact)) {
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: buildPausedLeadState({
          previous: activePendingLead,
          contact,
          reason: 'weak_lead_quality',
        }),
        conversationState: activeConversationState,
      });
      return {
        action: 'normal_answer',
        handled: true,
        answer: buildConsultingResetAnswer(localServiceFlow),
        decision: structuredDecision,
      };
    }

    let leadCapture: LeadCaptureResult;
    try {
      leadCapture = await this.captureLead({
        tenantId: params.tenantId,
        siteId: params.siteId,
        sessionId: params.sessionId,
        contact,
        localServiceFlow,
      });
    } catch (error) {
      const limitError = extractLimitExceeded(error);
      if (!limitError) {
        throw error;
      }

      logEvent('lead_capture_limit_exceeded', {
        tenantId: params.tenantId,
        siteId: params.siteId,
        source: 'chat_agent_orchestrator',
      });

      return {
        action: 'normal_answer',
        handled: true,
        answer: limitError.message,
        decision: structuredDecision,
      };
    }

    if (leadCapture.created) {
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: {
          ...contact,
          status: 'completed',
          intent: effectiveScheduleIntent ? 'schedule' : 'lead',
          scheduleIntent: effectiveScheduleIntent,
          startedAt: activePendingLead?.startedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          completedLeadId: leadCapture.leadId,
        },
        conversationState: buildConversationState({
          previous: activeConversationState,
          message: params.message,
          contact,
          leadIntent,
          scheduleIntent: effectiveScheduleIntent,
          stage: 'completed',
          intakeFlow,
        }),
      });
      await this.recordLeadAudit({
        tenantId: params.tenantId,
        siteId: params.siteId,
        action: 'lead_captured',
        metadata: {
          leadId: leadCapture.leadId,
          scheduleIntent: effectiveScheduleIntent,
          hasEmail: Boolean(contact.email),
          hasPhone: Boolean(contact.phone),
        },
      });

      await this.queueInternalLeadNotification({
        tenantId: params.tenantId,
        siteId: params.siteId,
        siteName: siteConfig.siteName,
        sessionId: params.sessionId,
        leadId: leadCapture.leadId,
        contact,
        scheduleIntent: effectiveScheduleIntent,
        recipientEmail: siteConfig.leadNotificationEmail,
        localServiceFlow,
      });
    } else if (activePendingLead?.status === 'pending') {
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: {
          ...contact,
          status: 'completed',
          intent: effectiveScheduleIntent ? 'schedule' : 'lead',
          scheduleIntent: effectiveScheduleIntent,
          startedAt: activePendingLead.startedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          completedLeadId: leadCapture.leadId,
        },
        conversationState: buildConversationState({
          previous: activeConversationState,
          message: params.message,
          contact,
          leadIntent,
          scheduleIntent: effectiveScheduleIntent,
          stage: 'completed',
          intakeFlow,
        }),
      });
    }

    const scheduleUrl = siteConfig.scheduleUrl || siteConfig.contactUrl;
    let contactRequestId: string | undefined;
    if (
      effectiveScheduleIntent ||
      moduleContext.primaryGoal === 'appointment' ||
      siteConfig.setupGoal === 'appointments'
    ) {
      contactRequestId = await this.createContactRequest({
        tenantId: params.tenantId,
        siteId: params.siteId,
        contact,
        sessionId: params.sessionId,
      });
    }

    return {
      action: scheduleUrl ? 'suggest_schedule' : contactRequestId ? 'handoff_to_contact' : 'capture_lead',
      handled: true,
      answer: buildCapturedLeadAnswer({
        scheduleUrl,
        ctaText: siteConfig.ctaText,
        scheduleIntent: effectiveScheduleIntent,
        localServiceFlow,
      }),
      decision: structuredDecision,
      leadId: leadCapture.leadId,
      contactRequestId,
      cta,
    };
  }

  private async createStructuredDecision(params: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    sessionId: string;
    message: string;
    history: ChatHistoryEntry[];
  }) {
    if (!this.decisionOrchestrator) {
      return undefined;
    }

    try {
      return await this.decisionOrchestrator.decide(params);
    } catch (error) {
      logEvent('chat_structured_decision_failed', {
        siteId: params.siteId,
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        error: error instanceof Error ? error.message : 'Unknown decision error',
      });
      return undefined;
    }
  }

  private mapNonLeadStructuredDecision(decision: AgentDecision | undefined): ChatAgentDecision | null {
    if (!decision || decision.type === 'answer' || decision.confidence < 0.7) {
      return null;
    }

    if (
      decision.type === 'ask_followup' ||
      decision.type === 'handoff' ||
      decision.type === 'create_ticket' ||
      decision.type === 'recommend_service' ||
      decision.type === 'trigger_tool'
    ) {
      return {
        action: decision.type === 'handoff' ? 'handoff_to_contact' : 'normal_answer',
        handled: true,
        answer: sanitizeAssistantAnswer(decision.message),
        decision,
        cta: decision.requiredFields.includes('email') || decision.requiredFields.includes('phone')
          ? {
              action: 'lead_capture',
              label: 'Kontaktdaten hinterlassen',
              description: 'Wir nehmen die Anfrage auf.',
            }
          : undefined,
      };
    }

    return null;
  }

  private async handleItSupportFlow(input: {
    params: {
      tenantId: string;
      siteId: string;
      conversationId: string;
      sessionId: string;
      message: string;
      history: ChatHistoryEntry[];
    };
    text: string;
    pendingTicket: PendingTicketState | null;
    conversationState: ConversationState | null;
    moduleContext: {
      itSupportEnabled: boolean;
      itSupportConfig: ItSupportModuleConfig;
    };
    structuredDecision: AgentDecision | undefined;
  }): Promise<ChatAgentDecision | null> {
    if (!input.moduleContext.itSupportEnabled) {
      return null;
    }

    const config = input.moduleContext.itSupportConfig;
    const startsNewContext = shouldStartNewItSupportContext({
      text: input.text,
      pendingTicket: input.pendingTicket,
    });
    const activeTicket = startsNewContext
      ? null
      : isActivePendingTicket(input.pendingTicket)
        ? input.pendingTicket
        : null;
    const critical = hasCriticalItIncident(input.text, config.escalationKeywords);
    const securityIncident = hasSecurityIncident(input.text);
    const supportSignal = hasItSupportSignal(input.text);
    const explicitTicketRequest = hasExplicitTicketRequest(input.text);
    const handoffRequest = hasItSupportHandoffRequest(input.text);
    const hasItTicketContext = Boolean(activeTicket) || supportSignal || critical || securityIncident;
    const directTicketRequest = (explicitTicketRequest || handoffRequest) && hasItTicketContext;

    if (
      input.pendingTicket?.status === 'created' &&
      input.pendingTicket.createdTicketId &&
      !startsNewContext &&
      hasTicketConfirmationYes(input.text)
    ) {
      return {
        action: 'normal_answer',
        handled: true,
        answer: `Das Support-Ticket wurde bereits erstellt.\n\nTicket: ${input.pendingTicket.createdTicketId}`,
        decision: input.structuredDecision,
      };
    }

    if (!activeTicket && !supportSignal && !critical && !securityIncident && !directTicketRequest) {
      return null;
    }

    if (activeTicket?.status === 'solution_offered') {
      if (hasSolutionWorkedReply(input.text, activeTicket)) {
        const resolvedTicket = mergePendingTicket(activeTicket, {
          status: 'resolved',
          completedAt: new Date().toISOString(),
          nextExpectedField: undefined,
          missingFields: [],
        });
        await this.saveConversationMetadata(input.params.conversationId, {
          pendingLead: null,
          pendingTicket: resolvedTicket,
          conversationState: buildTicketConversationState(input.conversationState, resolvedTicket, 'completed'),
        });
        return {
          action: 'normal_answer',
          handled: true,
          answer: buildItSupportResolvedAnswer(),
          decision: input.structuredDecision,
        };
      }

      if (directTicketRequest) {
        const result = await this.collectItSupportTicketFields({
          ...input,
          pendingTicket: activeTicket,
          patch: {
            ...extractItTicketFields(input.params.message, activeTicket),
            status: 'collecting',
            ticketConsent: true,
          },
        });
        if (securityIncident || critical) {
          return {
            ...result,
            answer: withItSecurityWarning(result.answer || ''),
          };
        }
        return result;
      }

      if (hasSolutionFailedReply(input.text, activeTicket)) {
        const offeredTicket = mergePendingTicket(activeTicket, {
          ...extractItTicketFields(input.params.message, activeTicket),
          status: 'ticket_offered',
          lastAssistantAsk: 'ticket_confirmation',
          nextExpectedField: 'ticketConsent',
        });
        await this.saveConversationMetadata(input.params.conversationId, {
          pendingLead: null,
          pendingTicket: offeredTicket,
          conversationState: buildTicketConversationState(input.conversationState, offeredTicket, 'qualification'),
        });
        return {
          action: 'normal_answer',
          handled: true,
          answer: buildItTicketOfferAnswer(offeredTicket),
          decision: input.structuredDecision,
        };
      }
    }

    if (activeTicket?.status === 'ticket_offered') {
      if (hasTicketConfirmationNo(input.text)) {
        const cancelledTicket = mergePendingTicket(activeTicket, {
          status: 'cancelled',
          ticketConsent: false,
          completedAt: new Date().toISOString(),
          missingFields: [],
        });
        await this.saveConversationMetadata(input.params.conversationId, {
          pendingLead: null,
          pendingTicket: cancelledTicket,
          conversationState: buildTicketConversationState(input.conversationState, cancelledTicket, 'completed'),
        });
        return {
          action: 'normal_answer',
          handled: true,
          answer: buildItSupportCancelledAnswer(),
          decision: input.structuredDecision,
        };
      }

      if (hasTicketConfirmationYes(input.text, activeTicket)) {
        return this.collectItSupportTicketFields({
          ...input,
          pendingTicket: activeTicket,
          patch: {
            ...extractItTicketFields(input.params.message, activeTicket),
            status: 'collecting',
            ticketConsent: true,
          },
        });
      }

      return {
        action: 'normal_answer',
        handled: true,
        answer: buildItTicketOfferAnswer(activeTicket),
        decision: input.structuredDecision,
      };
    }

    if (activeTicket?.status === 'collecting') {
      if (hasTicketCollectionAbort(input.text)) {
        const cancelledTicket = mergePendingTicket(activeTicket, {
          status: 'cancelled',
          ticketConsent: false,
          completedAt: new Date().toISOString(),
          missingFields: [],
          nextExpectedField: undefined,
        });
        await this.saveConversationMetadata(input.params.conversationId, {
          pendingLead: null,
          pendingTicket: cancelledTicket,
          conversationState: buildTicketConversationState(input.conversationState, cancelledTicket, 'completed'),
        });
        return {
          action: 'normal_answer',
          handled: true,
          answer: 'Alles klar, ich breche die Ticketerfassung ab.',
          decision: input.structuredDecision,
        };
      }

      return this.collectItSupportTicketFields({
        ...input,
        pendingTicket: activeTicket,
        patch: {
          ...extractItTicketFields(input.params.message, activeTicket),
          status: 'collecting',
          ticketConsent: true,
        },
      });
    }

    if (activeTicket?.status === 'ready_to_create') {
      if (hasTicketConfirmationNo(input.text)) {
        const cancelledTicket = mergePendingTicket(activeTicket, {
          status: 'cancelled',
          ticketConsent: false,
          completedAt: new Date().toISOString(),
          missingFields: [],
          nextExpectedField: undefined,
        });
        await this.saveConversationMetadata(input.params.conversationId, {
          pendingLead: null,
          pendingTicket: cancelledTicket,
          conversationState: buildTicketConversationState(input.conversationState, cancelledTicket, 'completed'),
        });
        return {
          action: 'normal_answer',
          handled: true,
          answer: buildItSupportCancelledAnswer(),
          decision: input.structuredDecision,
        };
      }

      if (hasTicketConfirmationYes(input.text, activeTicket) || directTicketRequest) {
        if (activeTicket.createdTicketId) {
          return {
            action: 'normal_answer',
            handled: true,
            answer: `Das Support-Ticket wurde bereits erstellt.\n\nTicket: ${activeTicket.createdTicketId}`,
            decision: input.structuredDecision,
          };
        }

        if (!this.toolExecutor) {
          return {
            action: 'normal_answer',
            handled: true,
            answer:
              'Ich konnte das Ticket gerade nicht erstellen. Bitte versuche es erneut oder kontaktiere den Support direkt.',
            decision: input.structuredDecision,
          };
        }

        try {
          const result = await this.toolExecutor.executeTool(
            'create_ticket',
            buildCreateTicketInputFromPendingTicket(activeTicket, {
              conversationId: input.params.conversationId,
              tenantId: input.params.tenantId,
              siteId: input.params.siteId,
            }),
            {
              tenantId: input.params.tenantId,
              siteId: input.params.siteId,
              conversationId: input.params.conversationId,
              source: 'widget',
              agentKey: 'it-support-agent',
              moduleKey: 'it-support',
            },
          );

          const ticketId = asString(asObject(result.data).ticketId);
          const forwardingStatus = parseTicketForwardingStatus(asString(asObject(result.data).forwardingStatus));
          if (result.status !== 'success' || !ticketId) {
            return {
              action: 'normal_answer',
              handled: true,
              answer:
                'Ich konnte das Ticket gerade nicht erstellen. Bitte versuche es erneut oder kontaktiere den Support direkt.',
              decision: input.structuredDecision,
            };
          }

          const createdTicket = mergePendingTicket(activeTicket, {
            status: 'created',
            createdTicketId: ticketId,
            forwardingStatus,
            completedAt: new Date().toISOString(),
            missingFields: [],
            nextExpectedField: undefined,
          });
          await this.saveConversationMetadata(input.params.conversationId, {
            pendingLead: null,
            pendingTicket: createdTicket,
            conversationState: buildTicketConversationState(input.conversationState, createdTicket, 'completed'),
          });

          return {
            action: 'normal_answer',
            handled: true,
            answer: buildCreatedItTicketAnswer(createdTicket, forwardingStatus),
            decision: input.structuredDecision,
          };
        } catch {
          return {
            action: 'normal_answer',
            handled: true,
            answer:
              'Ich konnte das Ticket gerade nicht erstellen. Bitte versuche es erneut oder kontaktiere den Support direkt.',
            decision: input.structuredDecision,
          };
        }
      }

      return {
        action: 'normal_answer',
        handled: true,
        answer:
          `${buildItTicketReadyToCreateAnswer(activeTicket)}\n\nBitte antworte mit Ja oder Nein.`,
        decision: input.structuredDecision,
      };
    }

    const extracted = extractItTicketFields(input.params.message, activeTicket);
    const baseDirectTicketPatch = {
      ...extracted,
      status: 'collecting' as const,
      ticketConsent: true,
      issueType: securityIncident
        ? 'security'
        : extracted.issueType || (handoffRequest ? 'generic_it' : undefined),
      urgency: securityIncident
        ? 'critical' as const
        : critical
          ? 'urgent' as const
          : extracted.urgency,
      priority: securityIncident
        ? 'critical' as const
        : critical
          ? 'urgent' as const
          : extracted.urgency,
      impact: extracted.impact || (/\b(komplett down|alles down|firma steht|unternehmen|alle)\b/i.test(input.text) ? 'company_wide' as const : undefined),
    };

    if (directTicketRequest) {
      const result = await this.collectItSupportTicketFields({
        ...input,
        pendingTicket: activeTicket || { status: 'collecting' },
        patch: baseDirectTicketPatch,
      });
      if (securityIncident || critical) {
        return {
          ...result,
          answer: withItSecurityWarning(result.answer || ''),
        };
      }
      return result;
    }

    const priorityPatch = critical || securityIncident
      ? {
          status: 'ticket_offered' as const,
          issueType: securityIncident ? 'security' : extracted.issueType,
          urgency: securityIncident ? 'critical' as const : 'urgent' as const,
          priority: securityIncident ? 'critical' as const : 'urgent' as const,
          impact: extracted.impact || (/\b(komplett down|alles down|firma steht|unternehmen|alle)\b/i.test(input.text) ? 'company_wide' as const : undefined),
          lastAssistantAsk: 'ticket_confirmation' as const,
          nextExpectedField: 'ticketConsent',
        }
      : explicitTicketRequest
        ? {
            status: 'ticket_offered' as const,
            lastAssistantAsk: 'ticket_confirmation' as const,
            nextExpectedField: 'ticketConsent',
          }
        : null;

    if (priorityPatch) {
      const ticket = mergePendingTicket(activeTicket, {
        ...extracted,
        ...priorityPatch,
      });
      await this.saveConversationMetadata(input.params.conversationId, {
        pendingLead: null,
        pendingTicket: ticket,
        conversationState: buildTicketConversationState(input.conversationState, ticket, 'qualification'),
      });
      return {
        action: 'normal_answer',
        handled: true,
        answer: buildItTicketOfferAnswer(ticket),
        decision: input.structuredDecision,
      };
    }

    const ticket = mergePendingTicket(activeTicket, {
      ...extracted,
      status: 'solution_offered',
      solutionAttemptCount: (activeTicket?.solutionAttemptCount || 0) + 1,
      lastAssistantAsk: 'solution_check',
      nextExpectedField: 'solution_check',
    });
    await this.saveConversationMetadata(input.params.conversationId, {
      pendingLead: null,
      pendingTicket: ticket,
      conversationState: buildTicketConversationState(input.conversationState, ticket, 'discovery', 'answer_question'),
    });

    return {
      action: 'normal_answer',
      handled: false,
      decision: input.structuredDecision,
    };
  }

  private async collectItSupportTicketFields(input: {
    params: {
      conversationId: string;
      message: string;
    };
    pendingTicket: PendingTicketState;
    conversationState: ConversationState | null;
    moduleContext: {
      itSupportConfig: ItSupportModuleConfig;
    };
    structuredDecision: AgentDecision | undefined;
    patch: Partial<PendingTicketState>;
  }): Promise<ChatAgentDecision> {
    const collectingTicket = mergePendingTicket(input.pendingTicket, input.patch);
    const missingFields = getMissingItTicketFields(
      collectingTicket,
      input.moduleContext.itSupportConfig.requiredTicketFields,
    );

    if (missingFields.length > 0) {
      const ticketWithMissing = mergePendingTicket(collectingTicket, {
        status: 'collecting',
        missingFields,
        nextExpectedField: missingFields[0],
        lastAssistantAsk: mapTicketMissingFieldToAssistantAsk(missingFields[0]),
      });
      await this.saveConversationMetadata(input.params.conversationId, {
        pendingLead: null,
        pendingTicket: ticketWithMissing,
        conversationState: buildTicketConversationState(input.conversationState, ticketWithMissing, 'contact_collection'),
      });
      return {
        action: 'normal_answer',
        handled: true,
        answer: buildItTicketMissingFieldQuestion(missingFields, ticketWithMissing),
        decision: input.structuredDecision,
      };
    }

    const readyTicket = mergePendingTicket(collectingTicket, {
      status: 'ready_to_create',
      missingFields: [],
      lastAssistantAsk: 'ticket_final_confirmation',
      nextExpectedField: 'finalTicketConfirmation',
    });
    await this.saveConversationMetadata(input.params.conversationId, {
      pendingLead: null,
      pendingTicket: readyTicket,
      conversationState: buildTicketConversationState(input.conversationState, readyTicket, 'contact_collection'),
    });
    return {
      action: 'normal_answer',
      handled: true,
      answer: buildItTicketReadyToCreateAnswer(readyTicket),
      decision: input.structuredDecision,
    };
  }

  private async getModuleContext(siteId: string) {
    const modules = await this.siteModules.listForSite(siteId);
    const leadSales = modules.find((module) =>
      ['lead-sales', 'lead_sales'].includes(module.key),
    );
    const leadConfig = asObject(leadSales?.config);
    const rawIntakeFlow = asObject(leadConfig.intakeFlow);
    const itSupport = modules.find((module) =>
      ['it-support', 'it_support'].includes(module.key),
    );
    const itSupportConfig = normalizeItSupportModuleConfig(asObject(itSupport?.config));

    return {
      leadSalesEnabled: Boolean(leadSales?.isEnabled),
      primaryGoal: asString(leadConfig.primaryGoal),
      ctaLabel: asString(leadConfig.ctaLabel),
      ctaDescription: asString(leadConfig.ctaDescription),
      intakeFlow: isExplicitLocalServiceIntakeFlow(rawIntakeFlow)
        ? normalizeLocalServiceIntakeFlowConfig(leadConfig.intakeFlow)
        : undefined,
      itSupportEnabled: Boolean(itSupport?.isEnabled),
      itSupportConfig,
    };
  }

  private async getSiteConfig(siteId: string) {
    const res = await this.db.query<SiteConfigRow>(
      `SELECT
         name,
         site_key,
         COALESCE(config->>'domain', allowed_domains[1], '') AS domain,
         config
       FROM sites
       WHERE id = $1
       LIMIT 1`,
      [siteId],
    );
    const config = asObject(res.rows[0]?.config);
    const siteName = res.rows[0]?.name || '';
    const siteSignalText = [
      siteName,
      asString(res.rows[0]?.site_key || ''),
      asString(res.rows[0]?.domain || ''),
      asString(config.companyName),
      asString(config.domain),
    ].filter(Boolean).join(' ');
    const conversationFlow = asObject(config.conversationFlow);
    const scheduleUrl = findFirstUrl(config, [
      'scheduleUrl',
      'bookingUrl',
      'calendarUrl',
      'appointmentUrl',
      'calendlyUrl',
      'terminUrl',
    ]);
    const contactUrl = findFirstUrl(config, ['contactUrl', 'ctaUrl', 'contactFormUrl', 'kontaktUrl']);

    const industry = asString(config.industry) || asString(config.industryTemplate);
    const hasConversationFlow = Object.keys(conversationFlow).length > 0;
    const isLocalService = isExplicitLocalServiceSiteConfig(config);
    const hasLocalServiceConversationFlow = isExplicitLocalServiceIntakeFlow(conversationFlow);

    return {
      siteName,
      siteSignalText,
      setupGoal: asString(config.setupGoal),
      leadCaptureEnabled: typeof config.leadCaptureEnabled === 'boolean' ? config.leadCaptureEnabled : undefined,
      leadNotificationEmail:
        asString(config.leadNotificationEmail) ||
        asString(config.notificationEmail) ||
        asString(config.contactEmail),
      ctaText: asString(config.ctaText) || asString(conversationFlow.ctaText),
      intakeFlow: hasConversationFlow && hasLocalServiceConversationFlow
        ? normalizeLocalServiceIntakeFlowConfig(conversationFlow)
        : isLocalService
          ? DEFAULT_LOCAL_SERVICE_INTAKE_FLOW
          : undefined,
      scheduleUrl: scheduleUrl || findFirstUrl(conversationFlow, [
        'scheduleUrl',
        'bookingUrl',
        'calendarUrl',
        'appointmentUrl',
        'calendlyUrl',
        'terminUrl',
      ]),
      contactUrl: contactUrl || findFirstUrl(conversationFlow, ['contactUrl', 'ctaUrl', 'contactFormUrl']),
    };
  }

  private async captureLead(params: {
    tenantId: string | null | undefined;
    siteId: string;
    sessionId: string;
    contact: ContactDetails;
    localServiceFlow: boolean;
  }): Promise<LeadCaptureResult> {
    const existing = await this.db.query<{ id: string }>(
      `SELECT id
       FROM widget_leads
       WHERE site_id = $1
         AND session_id = $2
         AND (
           ($3 <> '' AND email = $3)
           OR ($4 <> '' AND phone = $4)
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [params.siteId, params.sessionId, params.contact.email || '', params.contact.phone || ''],
    );

    const existingId = existing.rows[0]?.id;
    if (existingId) {
      return { leadId: existingId, created: false };
    }

    const leadId = randomUUID();
    return this.usageLimits.withMonthlyLeadLimit(params.tenantId, async (db, assertLimit) => {
      const duplicate = await db.query<{ id: string }>(
        `SELECT id
         FROM widget_leads
         WHERE site_id = $1
           AND session_id = $2
           AND (
             ($3 <> '' AND email = $3)
             OR ($4 <> '' AND phone = $4)
           )
         ORDER BY created_at DESC
         LIMIT 1`,
        [params.siteId, params.sessionId, params.contact.email || '', params.contact.phone || ''],
      );

      const duplicateId = duplicate.rows[0]?.id;
      if (duplicateId) {
        return { leadId: duplicateId, created: false };
      }

      await assertLimit();
      await db.query(
        `INSERT INTO widget_leads(id, site_id, session_id, name, email, phone, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', now())`,
        [
          leadId,
          params.siteId,
          params.sessionId,
          params.contact.name || 'Unbekannt',
          params.contact.email || '',
          params.contact.phone || null,
          summarizeLeadConcern(params.contact, 'Kontaktanfrage aus dem Chat', params.localServiceFlow),
        ],
      );

      await db.query(
        `UPDATE widget_sessions
         SET lead_captured = true,
             last_seen_at = now()
         WHERE id = $1 AND site_id = $2`,
        [params.sessionId, params.siteId],
      );

      return { leadId, created: true };
    });
  }

  private async createContactRequest(params: {
    tenantId: string;
    siteId: string;
    sessionId: string;
    contact: ContactDetails;
  }) {
    if (!params.contact.email && !params.contact.phone) {
      return undefined;
    }

    const existing = await this.db.query<{ id: string }>(
      `SELECT id
       FROM agent_contact_requests
       WHERE site_id = $1
         AND (
           ($2 <> '' AND email = $2)
           OR ($3 <> '' AND phone = $3)
         )
         AND created_at > now() - interval '1 hour'
       ORDER BY created_at DESC
       LIMIT 1`,
      [params.siteId, params.contact.email || '', params.contact.phone || ''],
    );

    const existingId = existing.rows[0]?.id;
    if (existingId) {
      return existingId;
    }

    const id = randomUUID();
    await this.db.query(
      `INSERT INTO agent_contact_requests(
         id, tenant_id, site_id, agent_run_id, name, email, phone, preferred_channel, note, status, created_at
       ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, 'new', now())`,
      [
        id,
        params.tenantId,
        params.siteId,
        params.contact.name || null,
        params.contact.email || null,
        params.contact.phone || null,
        params.contact.email ? 'email' : 'phone',
        `Widget session: ${params.sessionId}\n${summarizeLeadConcern(params.contact, 'Terminanfrage aus dem Chat')}`,
      ],
    );

    return id;
  }

  private async loadConversationMetadata(conversationId: string): Promise<{
    pendingLead: PendingLeadState | null;
    conversationState: ConversationState | null;
    pendingTicket: PendingTicketState | null;
  }> {
    const res = await this.db.query<ConversationMetadataRow>(
      `SELECT id, metadata
       FROM conversations
       WHERE id = $1
       LIMIT 1`,
      [conversationId],
    );
    const metadata = asObject(res.rows[0]?.metadata);
    return {
      pendingLead: parsePendingLeadState(metadata.pendingLead),
      conversationState: parseConversationState(metadata.conversationState),
      pendingTicket: parsePendingTicketState(metadata.pendingTicket),
    };
  }

  private async loadPendingLeadState(conversationId: string): Promise<PendingLeadState | null> {
    const metadata = await this.loadConversationMetadata(conversationId);
    return metadata.pendingLead;
  }

  private async saveConversationMetadata(
    conversationId: string,
    state: {
      pendingLead?: PendingLeadState | null;
      conversationState?: ConversationState;
      pendingTicket?: PendingTicketState | null;
    },
  ) {
    const patch: Record<string, unknown> = {};
    if (state.pendingLead !== undefined) {
      patch.pendingLead = state.pendingLead ? compactPendingLeadState(state.pendingLead) : null;
    }
    if (state.conversationState) {
      const compactState = compactConversationState(state.conversationState);
      if (Object.keys(compactState).length > 0) {
        patch.conversationState = compactState;
      }
    }
    if (state.pendingTicket !== undefined) {
      patch.pendingTicket = state.pendingTicket ? compactPendingTicketState(state.pendingTicket) : null;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    await this.db.query(
      `UPDATE conversations
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           last_active_at = now()
       WHERE id = $1`,
      [conversationId, JSON.stringify(patch)],
    );
  }

  private async savePendingLeadState(conversationId: string, state: PendingLeadState) {
    await this.saveConversationMetadata(conversationId, { pendingLead: state });
  }

  private async recordLeadAudit(params: {
    tenantId: string;
    siteId: string;
    action:
      | 'lead_pending_started'
      | 'lead_pending_updated'
      | 'lead_captured'
      | 'conversation_state_updated'
      | 'schedule_intent_detected';
    metadata: Record<string, unknown>;
  }) {
    await this.db.query(
      `INSERT INTO audit_logs(
         id, tenant_id, site_id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
       ) VALUES ($1, $2, $3, 'agent-orchestrator', 'system', $4, 'lead', null, $5::jsonb, now())`,
      [
        randomUUID(),
        params.tenantId,
        params.siteId,
        params.action,
        JSON.stringify(params.metadata),
      ],
    );
  }

  private async queueInternalLeadNotification(params: {
    tenantId: string;
    siteId: string;
    siteName: string;
    sessionId: string;
    leadId: string;
    contact: ContactDetails;
    scheduleIntent: boolean;
    recipientEmail?: string;
    localServiceFlow: boolean;
  }) {
    if (!params.recipientEmail) {
      logEvent('lead_notification_skipped', {
        siteId: params.siteId,
        leadId: params.leadId,
        reason: 'recipient_missing',
      });
      return;
    }

    if (!this.reportMailer.isConfigured()) {
      logEvent('lead_notification_skipped', {
        siteId: params.siteId,
        leadId: params.leadId,
        recipientEmail: params.recipientEmail,
        reason: 'smtp_not_configured',
      });
      return;
    }

    try {
      const mailPayload = this.leadMailer.buildLeadNotification({
        recipientEmail: params.recipientEmail,
        siteId: params.siteId,
        siteName: params.siteName || params.siteId,
        submittedAt: new Date().toISOString(),
        source: 'Widget Chat',
        scheduleIntent: params.scheduleIntent,
        dashboardUrl: buildDashboardUrl(params.siteId),
        lead: {
          name: params.contact.name || 'Unbekannt',
          email: params.contact.email || '',
          phone: params.contact.phone || null,
          message: summarizeLeadConcern(params.contact, 'Kontaktanfrage aus dem Chat', params.localServiceFlow),
        },
      });

      const jobId = randomUUID();
      await this.db.query(
        `INSERT INTO email_jobs(
           id, kind, status, recipient_email, subject, html, text, metadata, retry_count, max_attempts,
           available_at, locked_at, sent_at, last_error, created_at, updated_at
         )
         VALUES (
           $1, 'lead_notification', 'queued', $2, $3, $4, $5, $6::jsonb, 0, 5,
           now(), null, null, null, now(), now()
         )`,
        [
          jobId,
          mailPayload.to,
          mailPayload.subject,
          mailPayload.html || null,
          mailPayload.text || null,
          JSON.stringify({
            tenantId: params.tenantId,
            siteId: params.siteId,
            sessionId: params.sessionId,
            leadId: params.leadId,
            leadEmail: params.contact.email || null,
            scheduleIntent: params.scheduleIntent,
          }),
        ],
      );

      logEvent('lead_notification_queued', {
        siteId: params.siteId,
        leadId: params.leadId,
        jobId,
        recipientEmail: params.recipientEmail,
      });
    } catch (error) {
      logEvent('lead_notification_failed', {
        siteId: params.siteId,
        leadId: params.leadId,
        recipientEmail: params.recipientEmail,
        error: error instanceof Error ? error.message : 'Unknown mail queue error',
      });
    }
  }
}

function isActivePendingTicket(ticket: PendingTicketState | null): ticket is PendingTicketState {
  return Boolean(
    ticket &&
      !['created', 'cancelled', 'resolved'].includes(ticket.status),
  );
}

function parseTicketForwardingStatus(value: string): PendingTicketForwardingStatus {
  if (['queued', 'not_configured', 'failed', 'unknown'].includes(value)) {
    return value as PendingTicketForwardingStatus;
  }
  return 'unknown';
}

function mapTicketMissingFieldToAssistantAsk(field: string): PendingTicketState['lastAssistantAsk'] {
  if (field === 'reporterEmail' || field === 'reporterPhone' || field === 'reporterName') {
    return 'reporter_contact';
  }
  if (field === 'impact') {
    return 'impact';
  }
  if (field === 'affectedSystem') {
    return 'affected_system';
  }
  if (field === 'errorMessage') {
    return 'error_message';
  }
  return 'description';
}

function buildTicketConversationState(
  previous: ConversationState | null,
  ticket: PendingTicketState,
  stage: ConversationState['stage'],
  goal: ConversationState['goal'] = 'create_ticket',
): ConversationState {
  return {
    intent: 'ticket',
    stage,
    topic: ticket.summary || ticket.description || previous?.topic || null,
    urgency: ticket.urgency || previous?.urgency || null,
    goal,
    collectedFields: {
      ...previous?.collectedFields,
      concern: ticket.summary || ticket.description || previous?.collectedFields?.concern,
      email: ticket.reporterEmail || previous?.collectedFields?.email,
      phone: ticket.reporterPhone || previous?.collectedFields?.phone,
      name: ticket.reporterName || previous?.collectedFields?.name,
    },
    missingFields: ticket.missingFields || [],
    nextExpectedField: ticket.nextExpectedField || null,
    lastUserIntent: 'ticket',
    updatedAt: new Date().toISOString(),
  };
}

function buildCreatedItTicketAnswer(
  ticket: PendingTicketState,
  forwardingStatus: PendingTicketForwardingStatus = ticket.forwardingStatus || 'unknown',
) {
  const headline = forwardingStatus === 'queued'
    ? 'Danke, ich habe das Support-Ticket erstellt und zur Weiterleitung an den IT-Support eingereiht.'
    : forwardingStatus === 'not_configured'
      ? 'Danke, ich habe das Support-Ticket erstellt. Die automatische Weiterleitung ist für diese Website noch nicht eingerichtet.'
      : forwardingStatus === 'failed'
        ? 'Danke, ich habe das Support-Ticket erstellt. Die automatische Weiterleitung konnte gerade nicht bestätigt werden.'
        : 'Danke, ich habe das Support-Ticket erstellt.';

  return [
    headline,
    '',
    `Ticket: ${ticket.createdTicketId || 'erstellt'}`,
    '',
    'Zusammenfassung:',
    `- Problem: ${ticket.description || ticket.summary || 'nicht angegeben'}`,
    `- Betroffenes System: ${ticket.affectedSystem || 'nicht angegeben'}`,
    `- Auswirkung: ${ticket.impact || 'nicht angegeben'}`,
    `- Kontakt: ${ticket.reporterEmail || ticket.reporterPhone || ticket.reporterName || 'nicht angegeben'}`,
    `- Priorität: ${ticket.priority || 'normal'}`,
    '',
    'Bitte gib hier weiterhin keine Passwörter, MFA-Codes oder vertraulichen Daten ein.',
  ].join('\n');
}

function withItSecurityWarning(answer: string) {
  const warning = [
    'Das klingt nach einem kritischen IT- oder Sicherheitsvorfall.',
    'Bitte öffnen Sie keine weiteren Links oder Anhänge, geben Sie keine Passwörter, MFA-Codes oder vertraulichen Daten ein und nutzen Sie das betroffene Gerät bei Malware-Verdacht möglichst nicht weiter.',
  ].join(' ');
  return `${warning}\n\n${answer}`;
}

function parsePendingLeadState(value: unknown): PendingLeadState | null {
  const pendingLead = asObject(value);
  if (!pendingLead.status) {
    return null;
  }

  return {
    status: pendingLead.status === 'completed'
      ? 'completed'
      : pendingLead.status === 'paused'
        ? 'paused'
        : 'pending',
    intent: pendingLead.intent === 'schedule' ? 'schedule' : 'lead',
    scheduleIntent: pendingLead.scheduleIntent === true,
    name: asString(pendingLead.name) || undefined,
    email: asString(pendingLead.email) || undefined,
    phone: asString(pendingLead.phone) || undefined,
    preferredContact: parsePreferredContact(asString(pendingLead.preferredContact)),
    concern: asString(pendingLead.concern) || undefined,
    location: asString(pendingLead.location) || undefined,
    urgency: asString(pendingLead.urgency) || undefined,
    leadPromptCount: Number.isFinite(Number(pendingLead.leadPromptCount))
      ? Number(pendingLead.leadPromptCount)
      : undefined,
    lastLeadPromptAt: asString(pendingLead.lastLeadPromptAt) || undefined,
    leadCapturePaused: pendingLead.leadCapturePaused === true,
    pausedAt: asString(pendingLead.pausedAt) || undefined,
    pauseReason: asString(pendingLead.pauseReason) || undefined,
    startedAt: asString(pendingLead.startedAt) || undefined,
    updatedAt: asString(pendingLead.updatedAt) || undefined,
    completedAt: asString(pendingLead.completedAt) || undefined,
    completedLeadId: asString(pendingLead.completedLeadId) || undefined,
  };
}

function parseConversationState(value: unknown): ConversationState | null {
  const state = asObject(value);
  if (!Object.keys(state).length) {
    return null;
  }

  const collectedFields = asObject(state.collectedFields);
  return {
    intent: parseConversationIntent(asString(state.intent)),
    stage: parseConversationStage(asString(state.stage)),
    topic: asString(state.topic) || null,
    urgency: asString(state.urgency) || null,
    goal: parseConversationGoal(asString(state.goal)),
    collectedFields: {
      name: asString(collectedFields.name) || undefined,
      email: asString(collectedFields.email) || undefined,
      phone: asString(collectedFields.phone) || undefined,
      preferredContact: parsePreferredContact(asString(collectedFields.preferredContact)),
      concern: asString(collectedFields.concern) || undefined,
      location: asString(collectedFields.location) || undefined,
      urgency: asString(collectedFields.urgency) || undefined,
      company: asString(collectedFields.company) || undefined,
    },
    missingFields: Array.isArray(state.missingFields)
      ? state.missingFields.map((entry) => asString(entry)).filter(Boolean)
      : [],
    nextExpectedField: asString(state.nextExpectedField) || null,
    lastUserIntent: asString(state.lastUserIntent) || null,
    updatedAt: asString(state.updatedAt) || undefined,
  };
}

function parseConversationIntent(value: string): ConversationState['intent'] {
  if (['lead', 'support', 'sales', 'appointment', 'product_advice', 'ticket'].includes(value)) {
    return value as ConversationState['intent'];
  }
  return null;
}

function parseConversationStage(value: string): ConversationState['stage'] | undefined {
  if (['discovery', 'qualification', 'contact_collection', 'scheduling', 'completed'].includes(value)) {
    return value as ConversationState['stage'];
  }
  return undefined;
}

function parseConversationGoal(value: string): ConversationState['goal'] {
  if (['capture_lead', 'schedule_call', 'answer_question', 'create_ticket', 'recommend_product'].includes(value)) {
    return value as ConversationState['goal'];
  }
  return null;
}

function parsePreferredContact(value: string): ContactDetails['preferredContact'] | undefined {
  if (value === 'email' || value === 'phone') {
    return value;
  }
  return undefined;
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFKC').trim();
}

function normalizeKeyword(value: string) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text: string, keywords: string[] = []) {
  const normalized = normalizeKeyword(text);
  return keywords.some((keyword) => {
    const candidate = normalizeKeyword(keyword);
    if (!candidate) {
      return false;
    }

    return candidate.includes(' ')
      ? normalized.includes(candidate)
      : new RegExp(`\\b${escapeRegExp(candidate)}\\b`, 'i').test(normalized);
  });
}

function getLocalServiceKeywords(intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (!intakeFlow) {
    return [];
  }

  return [
    'notfall',
    'akut',
    'soforthilfe',
    ...intakeFlow.genericLocalServiceKeywords,
    ...intakeFlow.problemKeywords,
    ...intakeFlow.callbackKeywords,
  ];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function extractLimitExceeded(error: unknown): { message: string } | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const response = 'response' in error ? (error as { response?: unknown }).response : null;
  const responseObject = asObject(response);
  if (responseObject.code !== 'limit_exceeded') {
    return null;
  }

  return { message: asString(responseObject.message) || 'Plan-Limit erreicht.' };
}

function hasLeadIntent(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(beratung|beraten|kontakt|kontaktiert|angebot|kostet|kosten|preis|preise|interesse|interessiere|rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rufen sie|melden|anfrage|demo|erstgespraech|erstgespräch|lösung|loesung|brauche|benötige|benoetige)\b/i.test(
      text,
    ) ||
    matchesKeyword(text, getLocalServiceKeywords(intakeFlow))
  );
}

function hasScheduleIntent(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(termin|meeting|kalender|buchen|buchung|telefonat|rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rufen sie|erstgespraech|erstgespräch|beratungsgespraech|beratungsgespräch)\b/i.test(
      text,
    ) ||
    matchesKeyword(text, intakeFlow?.callbackKeywords || [])
  );
}

function wasContactRequested(history: ChatHistoryEntry[]) {
  const lastAssistant = [...history].reverse().find((entry) => entry.role === 'assistant');
  if (!lastAssistant) {
    return false;
  }

  return /\b(e-mail|email|telefon|handy|nummer|erreichen|kontakt|name|heißt|heisst)\b/i.test(
    lastAssistant.content,
  );
}

function hasContactSignal(contact: ContactDetails) {
  return Boolean(contact.name || contact.email || contact.phone);
}

function hasGreetingIntent(text: string) {
  const normalized = text.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return false;
  }

  return /^(h+a+l+o+|hsallo|hi+|hey+|guten tag|servus|moin|moinsen|tach|hello)$/i.test(normalized);
}

function hasRecoveryIntent(text: string) {
  return /\b(was soll das|warum fragst du|warum|hä|hae|ich verstehe nicht|verstehe ich nicht|du wiederholst dich|wiederholst dich|nerv nicht|nervt|komisch|quatsch|unsinn)\b/i.test(
    text,
  );
}

function hasRefusalIntent(text: string) {
  return /\b(nein|nope|kein interesse|keine interesse|stop|stopp|lass das|nicht kontaktieren|keine daten|will ich nicht|möchte ich nicht|moechte ich nicht)\b/i.test(
    text,
  );
}

function hasCompletedLeadAcknowledgementIntent(text: string) {
  const normalized = text
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(ok|okay|danke|danke ihnen|vielen dank|passt|alles gut|hast mir schon geholfen|sie haben mir schon geholfen)$/i.test(normalized);
}

function hasLocalServiceStopIntent(text: string) {
  const normalized = text
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(nerv nicht|nerven sie nicht|egal|lass gut|lassen sie gut sein|nein|stop|stopp|weder noch|nix|nichts)$/i.test(normalized);
}

function hasSensitiveDataInput(text: string) {
  return /\b((passwort|kennwort)\s*(ist|lautet|:)|(?:mfa|2fa|tan|pin)(?:\s*code)?\s*(ist|lautet|:)|api[-_\s]?key\s*(ist|lautet|:)?|token\s*(ist|lautet|:)?|secret\s*(ist|lautet|:)?|kreditkarte|kartennummer|cvv|cvc|iban|ausweisnummer|personalausweis|reisepass|zahlungsdaten)\b/i.test(text);
}

function hasBusinessNeedSignal(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(ki|künstliche intelligenz|kuenstliche intelligenz|automatisierung|support|kundenservice|kundengewinnung|website|webseite|software|unternehmen|firma|projekt|prozess|prozesse|angebot|beratung|lösung|loesung|preis|kosten|termin|rückruf|rueckruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|demo)\b/i.test(
      text,
    ) ||
    matchesKeyword(text, getLocalServiceKeywords(intakeFlow))
  );
}

function isLocalServicePricingQuestion(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (!intakeFlow) {
    return false;
  }

  return (
    isServicePricingOrBillingQuestion(text, intakeFlow) &&
    matchesKeyword(text, [
      ...intakeFlow.problemKeywords,
      ...intakeFlow.genericLocalServiceKeywords,
    ])
  );
}

function isServicePricingOrBillingQuestion(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(kostet|kosten|preis|preise|abrechnung|abrechnen|rechnen|wieviel)\b|wie viel/i.test(
      text,
    ) ||
    matchesKeyword(text, intakeFlow?.pricingKeywords || [])
  );
}

function isLocalServiceFlow(params: {
  text: string;
  siteName?: string;
  pendingLead: PendingLeadState | null;
  contact: ContactDetails;
  conversationState: ConversationState | null;
  intakeFlow?: LocalServiceIntakeFlowConfig;
}) {
  const configuredLocalContext = Boolean(params.intakeFlow);
  return Boolean(
    configuredLocalContext ||
      (configuredLocalContext &&
        (params.pendingLead?.location ||
          params.pendingLead?.urgency ||
          params.contact.location ||
          params.contact.urgency ||
          params.conversationState?.collectedFields?.location ||
          params.conversationState?.collectedFields?.urgency)) ||
      (configuredLocalContext && hasLocalServiceSignal(params.text, params.intakeFlow)),
  );
}

function shouldStartLocalServiceIntakeFromContext(localServiceFlow: boolean, contact: ContactDetails) {
  return Boolean(localServiceFlow && (contact.location || contact.urgency));
}

function shouldStartFreshLocalServiceIntake(params: {
  pendingActive: boolean;
  localServiceFlow: boolean;
  text: string;
  contact: ContactDetails;
  scheduleIntent: boolean;
  intakeFlow?: LocalServiceIntakeFlowConfig;
}) {
  if (!params.localServiceFlow || params.pendingActive) {
    return false;
  }

  if (isServicePricingOrBillingQuestion(params.text, params.intakeFlow)) {
    return false;
  }

  return Boolean(
    params.contact.concern ||
      params.contact.location ||
      params.contact.urgency ||
      params.contact.preferredContact ||
      params.scheduleIntent ||
      hasLocalServiceSignal(params.text, params.intakeFlow) ||
      hasCallbackOnlyIntent(params.text, params.intakeFlow),
  );
}

function shouldRestartCompletedLocalServiceIntake(params: {
  pendingLead: PendingLeadState | null;
  localServiceFlow: boolean;
  leadIntent: boolean;
  scheduleIntent: boolean;
  contact: ContactDetails;
  text: string;
  intakeFlow?: LocalServiceIntakeFlowConfig;
}) {
  if (params.pendingLead?.status !== 'completed' || !params.localServiceFlow) {
    return false;
  }

  if (isServicePricingOrBillingQuestion(params.text, params.intakeFlow)) {
    return false;
  }

  return Boolean(
    params.leadIntent ||
      params.scheduleIntent ||
      params.contact.concern ||
      params.contact.location ||
      params.contact.urgency ||
      hasLocalServiceSignal(params.text, params.intakeFlow),
  );
}

function isLocalServiceIndustry(value: string) {
  return ['local-service-first-contact', 'local-services', 'local_service', 'local-service', 'local_services'].includes(value);
}

function isLocalServiceKey(value: unknown) {
  return isLocalServiceIndustry(asString(value).toLowerCase().replace(/_/g, '-'));
}

function isExplicitLocalServiceSiteConfig(config: Record<string, unknown>) {
  const assistantProfile = asObject(config.assistantProfile);
  return Boolean(
    asString(config.botType).toLowerCase() === 'handwerker-first-contact' ||
      isLocalServiceKey(config.industry) ||
      isLocalServiceKey(config.industryTemplate) ||
      isLocalServiceKey(config.templateId) ||
      isLocalServiceKey(config.profileKey) ||
      isLocalServiceKey(assistantProfile.profileKey)
  );
}

function isExplicitLocalServiceIntakeFlow(flow: Record<string, unknown>) {
  if (Object.keys(flow).length === 0) {
    return false;
  }

  if (
    isLocalServiceKey(flow.templateKey) ||
    isLocalServiceKey(flow.templateId) ||
    isLocalServiceKey(flow.profileKey)
  ) {
    return true;
  }

  const questionTexts = asObject(flow.questionTexts);
  const requiredFields = asStringArray(flow.requiredFields);
  const questionOrder = asStringArray(flow.questionOrder);
  const hasAddressQuestion = Boolean(asString(questionTexts.fullAddress) || asString(questionTexts.location));
  const hasLocalField =
    requiredFields.includes('fullAddress') ||
    requiredFields.includes('location') ||
    requiredFields.includes('urgency') ||
    requiredFields.includes('problem');
  const hasLocalOrder =
    questionOrder.includes('fullAddress') ||
    questionOrder.includes('location') ||
    questionOrder.includes('urgency') ||
    questionOrder.includes('problem');

  return Boolean(hasAddressQuestion && hasLocalField && hasLocalOrder);
}

function hasLocalServiceSiteSignal(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return Boolean(
    /\b(dienstleister|service|notdienst|handwerker|rohrreinigung|rohr|abfluss|kanal|sanitär|sanitaer|elektriker)\b/i.test(value) ||
      matchesKeyword(value, getLocalServiceKeywords(intakeFlow)),
  );
}

function hasLocalServiceSignal(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(notfall|notdienst|akut|dringend|soforthilfe|toilette|wc|klo|abfluss|rohr|rohrreinigung|kanal|keller|rückstau|rueckstau|verstopft)\b/i.test(text) ||
    matchesKeyword(text, getLocalServiceKeywords(intakeFlow))
  );
}

function isUnclearInput(text: string) {
  const compact = text.replace(/[^\p{L}\p{N}]+/gu, '').trim();
  if (!compact) {
    return true;
  }
  if (compact.length < 4 && !/\b(ki|ja|ok)\b/i.test(compact)) {
    return true;
  }
  return /^[a-z]{4,10}$/i.test(compact) && !hasBusinessNeedSignal(text) && !hasGreetingIntent(text);
}

function shouldPauseLeadCapture(text: string, contact: ContactDetails) {
  if (hasRecoveryIntent(text) || hasRefusalIntent(text) || hasGreetingIntent(text)) {
    return true;
  }

  if (hasContactSignal(contact) || contact.concern || contact.location || contact.urgency || contact.preferredContact) {
    return false;
  }

  return isUnclearInput(text);
}

function extractPhoneNumber(message: string) {
  const candidate = message.match(/(?:\+?\d[\d\s()./-]{4,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim();
  if (!candidate) {
    return undefined;
  }
  return isValidPhoneNumber(candidate) ? candidate : undefined;
}

function extractContactDetails(
  message: string,
  pendingLead: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
): ContactDetails {
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const location = extractServiceLocation(message, pendingLead, intakeFlow);
  const addressIsStillMissing = pendingLead?.status === 'pending' && !pendingLead.location;
  const messageIsAddressOnly = Boolean(intakeFlow && (location || (addressIsStillMissing && hasPartialServiceAddress(message))));
  const phone = extractPhoneNumber(message);
  const name = messageIsAddressOnly
    ? undefined
    : extractName(message) || inferNameFromPendingAnswer(message, pendingLead, intakeFlow);
  const urgency = extractServiceUrgency(message, intakeFlow);
  const concern = extractConcern(message, pendingLead, intakeFlow);
  const preferredContact = extractPreferredContact(message);

  return {
    name,
    email,
    phone,
    concern,
    location,
    urgency,
    preferredContact,
  };
}

function extractServiceLocation(
  message: string,
  pendingLead?: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  const value = message.trim();
  const fullAddress = extractFullServiceAddress(value);
  if (fullAddress) {
    return fullAddress;
  }

  if (
    pendingLead?.status === 'pending' &&
    Boolean(intakeFlow) &&
    pendingLead.concern &&
    !pendingLead.location &&
    !extractServiceUrgency(value, intakeFlow) &&
    !hasLocalServiceSignal(value, intakeFlow) &&
    !hasCallbackOnlyIntent(value, intakeFlow) &&
    !value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) &&
    !extractPhoneNumber(value)
  ) {
    return undefined;
  }

  return undefined;
}

function extractFullServiceAddress(value: string) {
  const clean = value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/[;:!?]+$/g, '')
    .trim();
  if (!clean || !hasCompleteServiceAddress(clean)) {
    return undefined;
  }
  return clean;
}

function hasCompleteServiceAddress(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  const hasZip = /\b\d{5}\b/.test(normalized);
  const hasHouseNumber = /\b\d{1,5}\s?[a-zA-Z]?\b/.test(normalized);
  const hasStreetWord =
    /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]*(?:straße|strasse|str\.|weg|gasse|allee|ring|platz|damm|ufer|chaussee|pfad|steig|berg|tal|markt)\b|[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+\s+(?:Straße|Strasse|Weg|Gasse|Allee|Ring|Platz|Damm|Ufer|Chaussee|Pfad|Steig|Berg|Tal|Markt)\b)/i.test(
      normalized,
    );
  const afterZip = normalized.match(/\b\d{5}\b\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2})/)?.[1];
  const beforeZip = normalized.match(/([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2})\s+\b\d{5}\b/)?.[1];
  const city = afterZip || beforeZip;

  return Boolean(hasZip && hasHouseNumber && hasStreetWord && city);
}

function hasPartialServiceAddress(value: string) {
  return Boolean(
    /\b\d{5}\b/.test(value) ||
      /\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]*(?:straße|strasse|str\.|weg|gasse|allee|ring|platz|damm|ufer|chaussee|pfad|steig|berg|tal|markt)\b\s+\d{1,5}\s?[a-zA-Z]?\b/i.test(value) ||
      /\b(?:in|aus|bei|wohne in|bin in)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+/i.test(value) ||
      /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2}$/.test(value.trim()),
  );
}

function extractServiceUrgency(message: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (
    /\b(notdienst|notfall|sofort|akut|dringend|eilig|heute|heute noch|wasser steht|läuft über|laeuft ueber)\b/i.test(message) ||
    matchesKeyword(message, (intakeFlow?.genericLocalServiceKeywords || []).filter((keyword) =>
      /notdienst|dringend|heute/i.test(keyword),
    ))
  ) {
    return 'akut';
  }

  if (/\b(planbar|nicht dringend|morgen|termin|terminwunsch|später|spaeter|allgemeine anfrage|nur eine frage)\b/i.test(message)) {
    return 'planbar';
  }

  if (/\b(normal|bald|zeitnah)\b/i.test(message)) {
    return 'normal';
  }

  return undefined;
}

function extractPreferredContact(message: string): ContactDetails['preferredContact'] | undefined {
  if (/\b(telefon|telefonisch|phone|handy|anruf|anrufen|rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|whatsapp)\b/i.test(message)) {
    return 'phone';
  }

  if (/\b(e-mail|email|mail|per mail)\b/i.test(message)) {
    return 'email';
  }

  return undefined;
}

function extractName(text: string) {
  const patterns = [
    /\bmein name ist\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
    /\bich hei(?:ß|ss)e\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
    /\bname\s*:\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) {
      return cleanExtractedText(match);
    }
  }

  return undefined;
}

function inferNameFromPendingAnswer(
  message: string,
  pendingLead: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  if (pendingLead?.status !== 'pending' || hasFullName(pendingLead.name)) {
    return undefined;
  }

  const addressIsStillMissing = !pendingLead.location;
  if (intakeFlow && (extractFullServiceAddress(message) || (addressIsStillMissing && hasPartialServiceAddress(message)))) {
    return undefined;
  }

  if (
    (!pendingLead.location &&
      (extractServiceLocation(message, pendingLead, intakeFlow) || (Boolean(intakeFlow) && hasPartialServiceAddress(message)))) ||
    (!pendingLead.urgency && extractServiceUrgency(message, intakeFlow))
  ) {
    return undefined;
  }

  const clean = cleanExtractedText(message.trim());
  if (!clean || clean.length > 60 || clean.includes('@') || /\d/.test(clean) || hasLocalServiceSignal(clean, intakeFlow)) {
    return undefined;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) {
    return undefined;
  }

  const acceptsNameToken = Boolean(intakeFlow) ? isNameToken : isStrictNameToken;
  if (words.every(acceptsNameToken)) {
    return clean;
  }

  return undefined;
}

function extractConcern(
  message: string,
  pendingLead: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  const value = message.trim();
  if (!value) {
    return undefined;
  }

  if (
    intakeFlow &&
    matchesKeyword(value, intakeFlow.problemKeywords) &&
    !isGenericUrgencyQuestion(value, intakeFlow)
  ) {
    return sanitizeConcern(value);
  }

  if (looksLikeContactOnly(value)) {
    return undefined;
  }

  const normalized = normalizeText(value);
  if (isGenericUrgencyQuestion(value, intakeFlow)) {
    return undefined;
  }

  if (hasScheduleIntent(normalized, intakeFlow) && (isGenericScheduleIntent(value) || hasCallbackOnlyIntent(value, intakeFlow))) {
    return undefined;
  }

  if (
    intakeFlow &&
    matchesKeyword(value, intakeFlow.genericLocalServiceKeywords) &&
    !matchesKeyword(value, intakeFlow.problemKeywords) &&
    !matchesKeyword(value, intakeFlow.pricingKeywords)
  ) {
    return undefined;
  }

  if (isGenericLocalServiceIntent(value, intakeFlow)) {
    return undefined;
  }

  if (pendingLead?.status === 'pending' && pendingLead.concern) {
    if (
      !pendingLead.location &&
      (extractServiceLocation(value, pendingLead, intakeFlow) || (Boolean(intakeFlow) && hasPartialServiceAddress(value)))
    ) {
      return undefined;
    }
    if (!pendingLead.urgency && extractServiceUrgency(value, intakeFlow)) {
      return undefined;
    }
  }

  if (pendingLead?.status === 'pending' && !pendingLead.concern && !inferNameFromPendingAnswer(value, pendingLead, intakeFlow)) {
    return sanitizeConcern(value);
  }

  if (
    (hasLeadIntent(normalized, intakeFlow) || hasScheduleIntent(normalized, intakeFlow)) &&
    !isGenericLeadIntent(value)
  ) {
    return sanitizeConcern(value);
  }

  return undefined;
}

function sanitizeConcern(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '')
    .replace(/\bmein name ist\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3}/gi, '')
    .replace(/\bich hei(?:ß|ss)e\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3}/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/[,;:\s]+$/g, '')
    .trim();
}

function isGenericLeadIntent(value: string) {
  const withoutIntentWords = normalizeText(value)
    .replace(
      /\b(ich|wir|brauche|brauchen|möchte|moechte|will|wollen|gern|gerne|bitte|beratung|beraten|kontakt|kontaktiert|angebot|kostet|kosten|preis|preise|interesse|interessiere|rueckruf|rückruf|anrufen|termin|meeting|demo|erstgespraech|erstgespräch|haben|machen|kann|man|einen|eine|ein)\b/g,
      '',
    )
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return withoutIntentWords.length < 8;
}

function isGenericScheduleIntent(value: string) {
  const withoutIntentWords = normalizeText(value)
    .replace(
      /\b(ich|wir|moechte|möchte|will|wollen|gern|gerne|bitte|können|koennen|sie|mich|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rueckruf|rückruf|kontakt|telefon|telefonisch|werden)\b/g,
      '',
    )
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return withoutIntentWords.length < 8;
}

function isGenericUrgencyQuestion(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  const compact = normalizeText(value)
    .replace(/\b(ist|das|ein|eine|es|bei|mir|schon|wirklich|akuter|akute)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return (
    /^(notfall|dringend|akut)$/.test(compact) ||
    (Boolean(intakeFlow) &&
      /\b(notfall|dringend|akut)\b/i.test(value) &&
      !matchesKeyword(value, intakeFlow?.problemKeywords || []))
  );
}

function hasCallbackOnlyIntent(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rufen sie mich|telefonisch)\b/i.test(
      value,
    ) && !hasLocalServiceSignal(value, intakeFlow)
  );
}

function isGenericLocalServiceIntent(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  const location = extractServiceLocation(value);
  const withoutIntentWords = normalizeText(value)
    .replace(location ? normalizeText(location) : '', '')
    .replace(
      /\b(ich|wir|brauche|brauchen|benoetige|benötige|bitte|notdienst|notfall|soforthilfe|schnelle hilfe|akut|dringend|sofort|in|aus|bei|wohne|bin)\b/g,
      '',
    )
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return hasLocalServiceSignal(value, intakeFlow) && withoutIntentWords.length < 8;
}

function looksLikeContactOnly(value: string) {
  const withoutEmail = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '');
  const withoutPhone = withoutEmail.replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '');
  return withoutPhone.trim().length < 16;
}

function isPureContactInput(value: string) {
  return Boolean(
    value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) ||
      value.match(/(?:\+?\d[\d\s()./-]{6,}\d)/) ||
      extractName(value),
  );
}

function cleanExtractedText(value: string) {
  return value
    .replace(/\b(e-mail|email|telefon|handy|nummer|und|meine|mein)\b.*$/i, '')
    .replace(/[,.].*$/, '')
    .trim();
}

function mergeContactDetails(
  pendingLead: PendingLeadState | null,
  current: ContactDetails,
): ContactDetails {
  return {
    name: current.name || pendingLead?.name,
    email: current.email || pendingLead?.email,
    phone: current.phone || pendingLead?.phone,
    concern: current.concern || pendingLead?.concern,
    location: current.location || pendingLead?.location,
    urgency: current.urgency || pendingLead?.urgency,
    preferredContact: current.preferredContact || pendingLead?.preferredContact,
  };
}

function mergeContactDetailsFromState(contact: ContactDetails, state: ConversationState | null): ContactDetails {
  const collected = state?.collectedFields || {};
  return {
    name: contact.name || collected.name,
    email: contact.email || collected.email,
    phone: contact.phone || collected.phone,
    concern: contact.concern || collected.concern || state?.topic || undefined,
    location: contact.location || collected.location,
    urgency: contact.urgency || collected.urgency || state?.urgency || undefined,
    preferredContact: contact.preferredContact || collected.preferredContact,
  };
}

function ensureScheduleContactContext(
  contact: ContactDetails,
  state: ConversationState | null,
  scheduleIntent: boolean,
): ContactDetails {
  if (!scheduleIntent || contact.concern) {
    return contact;
  }

  const contextConcern = state?.collectedFields?.concern || state?.topic || undefined;
  return contextConcern ? { ...contact, concern: contextConcern } : contact;
}

function buildConversationState(params: {
  previous: ConversationState | null;
  message: string;
  contact: ContactDetails;
  leadIntent: boolean;
  scheduleIntent: boolean;
  stage?: ConversationState['stage'];
  intakeFlow?: LocalServiceIntakeFlowConfig;
}): ConversationState {
  const text = normalizeText(params.message);
  const inferredIntent = inferConversationIntent(text, params.leadIntent, params.scheduleIntent);
  const topic = inferTopic(params.message, params.previous, params.contact, inferredIntent, params.intakeFlow);
  const urgency = inferUrgency(text) || params.previous?.urgency || null;
  const currentContact = removeEmptyContactFields(params.contact);
  const hasContext = Boolean(
    params.previous ||
      inferredIntent ||
      topic ||
      urgency ||
      Object.keys(currentContact).length > 0,
  );
  const collectedFields = {
    ...params.previous?.collectedFields,
    ...currentContact,
    concern: params.contact.concern || topic || params.previous?.collectedFields?.concern || undefined,
  };
  const normalizedContact: ContactDetails = {
    name: collectedFields.name,
    email: collectedFields.email,
    phone: collectedFields.phone,
    concern: collectedFields.concern,
    location: collectedFields.location,
    urgency: collectedFields.urgency,
  };
  const missingFields = hasContext ? getMissingContactFields(normalizedContact) : [];
  const goal = params.scheduleIntent
    ? 'schedule_call'
    : params.leadIntent
      ? 'capture_lead'
      : params.previous?.goal || (topic ? 'answer_question' : null);

  return {
    intent: inferredIntent || params.previous?.intent || null,
    stage:
      params.stage ||
      params.previous?.stage ||
      (params.scheduleIntent ? 'contact_collection' : topic ? 'discovery' : undefined),
    topic,
    urgency,
    goal,
    collectedFields,
    missingFields,
    nextExpectedField: missingFields[0] || null,
    lastUserIntent: inferredIntent || params.previous?.lastUserIntent || null,
    updatedAt: new Date().toISOString(),
  };
}

function inferConversationIntent(
  text: string,
  leadIntent: boolean,
  scheduleIntent: boolean,
): ConversationState['intent'] {
  if (scheduleIntent) {
    return 'appointment';
  }
  if (/\b(support|kundenservice|kundensupport|hilfe|fragen|faq)\b/i.test(text)) {
    return 'support';
  }
  if (/\b(ticket|schaden|schadensmeldung|reparatur|defekt)\b/i.test(text)) {
    return 'ticket';
  }
  if (/\b(produkt|shop|kaufen|empfehlung|sortiment)\b/i.test(text)) {
    return 'product_advice';
  }
  if (leadIntent || /\b(kundengewinnung|sales|verkauf|angebot|beratung)\b/i.test(text)) {
    return 'lead';
  }
  return null;
}

function inferTopic(
  message: string,
  previous: ConversationState | null,
  contact: ContactDetails,
  intent: ConversationState['intent'],
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  if (contact.concern) {
    return contact.concern;
  }

  const value = message.trim();
  if (!value || isPureContactInput(value) || hasScheduleIntent(normalizeText(value), intakeFlow)) {
    return previous?.topic || previous?.collectedFields?.concern || null;
  }

  if (isGenericUrgencyQuestion(value, intakeFlow)) {
    return previous?.topic || previous?.collectedFields?.concern || null;
  }

  if (intent === 'lead' && (isGenericLeadIntent(value) || isGenericLocalServiceIntent(value, intakeFlow))) {
    return previous?.topic || previous?.collectedFields?.concern || null;
  }

  if (/\b(support|kundensupport|kundenservice)\b/i.test(value)) {
    return mergeTopic(previous?.topic, 'Support');
  }

  if (/\b(ki|künstliche intelligenz|kuenstliche intelligenz|automatisierung|prozesse|kundengewinnung)\b/i.test(value)) {
    return sanitizeConcern(value);
  }

  return previous?.topic || previous?.collectedFields?.concern || (intent ? sanitizeConcern(value) : null);
}

function mergeTopic(previous: string | null | undefined, next: string) {
  if (!previous) {
    return next;
  }
  if (normalizeText(previous).includes(normalizeText(next))) {
    return previous;
  }
  return `${previous} / ${next}`;
}

function inferUrgency(text: string) {
  if (/(sehr groß|sehr gross|dringend|akut|sofort|\bhoch\b|wichtig|eilig)/i.test(text)) {
    return 'high';
  }
  if (/\b(mittel|normal|bald)\b/i.test(text)) {
    return 'medium';
  }
  if (/\b(niedrig|nicht dringend|später|spaeter)\b/i.test(text)) {
    return 'low';
  }
  return null;
}

function removeEmptyContactFields(contact: ContactDetails): ContactDetails {
  return Object.fromEntries(
    Object.entries(contact).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function buildPendingLeadState(params: {
  previous: PendingLeadState | null;
  contact: ContactDetails;
  scheduleIntent: boolean;
  startedByIntent: 'lead' | 'schedule';
}): PendingLeadState {
  const now = new Date().toISOString();
  return {
    status: 'pending',
    intent: params.scheduleIntent ? 'schedule' : params.previous?.intent || params.startedByIntent,
    scheduleIntent: params.scheduleIntent,
    name: params.contact.name,
    email: params.contact.email,
    phone: params.contact.phone,
    concern: params.contact.concern,
    location: params.contact.location,
    urgency: params.contact.urgency,
    preferredContact: params.contact.preferredContact,
    leadPromptCount: (params.previous?.leadPromptCount || 0) + 1,
    lastLeadPromptAt: now,
    leadCapturePaused: false,
    startedAt: params.previous?.startedAt || now,
    updatedAt: now,
  };
}

function buildPausedLeadState(params: {
  previous: PendingLeadState | null;
  contact: ContactDetails;
  reason: string;
}): PendingLeadState {
  const now = new Date().toISOString();
  return {
    ...params.contact,
    status: 'paused',
    intent: params.previous?.intent || 'lead',
    scheduleIntent: Boolean(params.previous?.scheduleIntent),
    leadPromptCount: params.previous?.leadPromptCount || 0,
    lastLeadPromptAt: params.previous?.lastLeadPromptAt,
    leadCapturePaused: true,
    pauseReason: params.reason,
    pausedAt: now,
    startedAt: params.previous?.startedAt || now,
    updatedAt: now,
  };
}

function compactPendingLeadState(state: PendingLeadState) {
  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function compactConversationState(state: ConversationState) {
  const collectedFields = Object.fromEntries(
    Object.entries(state.collectedFields || {}).filter(([, value]) => value !== undefined && value !== ''),
  );
  const hasSemanticState = Boolean(
    state.intent ||
      state.stage ||
      state.topic ||
      state.urgency ||
      state.goal ||
      Object.keys(collectedFields).length > 0 ||
      state.lastUserIntent,
  );
  if (!hasSemanticState) {
    return {};
  }

  return Object.fromEntries(
    Object.entries({
      ...state,
      collectedFields,
    }).filter(([, value]) => {
      if (value === undefined || value === null || value === '') {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === 'object') {
        return Object.keys(value).length > 0;
      }
      return true;
    }),
  );
}

function isValidPhoneNumber(value: string | undefined) {
  if (!value) {
    return false;
  }
  const compact = value.trim();
  if (!/^(\+|0)/.test(compact)) {
    return false;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 18;
}

function hasFullName(value: string | undefined) {
  if (!value) {
    return false;
  }
  const words = cleanExtractedText(value)
    .split(/\s+/)
    .filter(isNameToken);
  return words.length >= 2;
}

function isNameToken(value: string) {
  return /^[\p{L}][\p{L}'-]{1,}$/u.test(value);
}

function isStrictNameToken(value: string) {
  return /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+$/.test(value);
}

function getMissingContactFields(
  contact: ContactDetails,
  localServiceFlow = false,
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  const missing: string[] = [];
  if (!contact.concern) {
    missing.push('concern');
  }

  if (localServiceFlow) {
    const missingByField: Record<string, boolean> = {
      problem: !contact.concern,
      concern: !contact.concern,
      location: !hasCompleteServiceAddress(contact.location),
      fullAddress: !hasCompleteServiceAddress(contact.location),
      address: !hasCompleteServiceAddress(contact.location),
      urgency: !contact.urgency,
      phone: !isValidPhoneNumber(contact.phone),
      contact: !isValidPhoneNumber(contact.phone),
      name: !hasFullName(contact.name),
      fullName: !hasFullName(contact.name),
    };
    const order = ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'];
    return order
      .filter((field) => missingByField[field])
      .map((field) =>
        field === 'problem' || field === 'concern'
          ? 'concern'
          : field === 'phone'
            ? 'contact'
            : field === 'fullAddress' || field === 'address'
              ? 'location'
              : field === 'fullName'
                ? 'name'
                : field,
      )
      .filter((field, index, fields) => fields.indexOf(field) === index);
  }

  if (!contact.name) {
    missing.push('name');
  }
  if (!contact.email && !contact.phone) {
    missing.push('contact');
  }
  return missing;
}

function canAskForLeadDetails(params: {
  missing: string[];
  contact: ContactDetails;
  pendingActive: boolean;
  leadIntent: boolean;
  scheduleIntent: boolean;
  contactFromMessage: ContactDetails;
  leadPromptCount: number;
  text: string;
  localServiceFlow: boolean;
  intakeFlow?: LocalServiceIntakeFlowConfig;
}) {
  if (params.missing.length === 0) {
    return true;
  }

  if (hasRecoveryIntent(params.text) || hasRefusalIntent(params.text) || hasGreetingIntent(params.text)) {
    return false;
  }

  if (params.localServiceFlow && params.pendingActive) {
    return true;
  }

  if (
    params.leadPromptCount >= 1 &&
    !hasLeadProgressSignal(params.contactFromMessage, params.text, params.intakeFlow) &&
    !params.contactFromMessage.preferredContact &&
    !hasBusinessNeedSignal(params.text, params.intakeFlow)
  ) {
    return false;
  }

  if (params.pendingActive && hasLeadProgressSignal(params.contactFromMessage, params.text, params.intakeFlow)) {
    return true;
  }

  if (params.scheduleIntent) {
    return Boolean(
      params.contact.concern ||
        params.contact.preferredContact ||
        hasBusinessNeedSignal(params.text, params.intakeFlow) ||
        (params.localServiceFlow && hasLocalServiceSiteSignal(params.text, params.intakeFlow)),
    );
  }

  if (params.localServiceFlow && (params.contact.location || params.contact.urgency || params.contact.name || params.contact.phone)) {
    return true;
  }

  if (params.leadIntent) {
    return hasBusinessNeedSignal(params.text, params.intakeFlow) || Boolean(params.contact.concern);
  }

  return false;
}

function hasLeadProgressSignal(contact: ContactDetails, text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return Boolean(
    hasContactSignal(contact) ||
      contact.concern ||
      contact.location ||
      contact.urgency ||
      contact.name ||
      contact.preferredContact ||
      hasBusinessNeedSignal(text, intakeFlow),
  );
}

function hasLeadCaptureQuality(contact: ContactDetails) {
  return Boolean(
    (contact.email || contact.phone) &&
      (contact.name || contact.concern) &&
      contact.concern,
  );
}

function summarizeLeadConcern(contact: ContactDetails, fallback: string, structured = false) {
  if (!structured) {
    return contact.concern || fallback;
  }

  const parts = [
    contact.concern ? `Problem / Anliegen: ${contact.concern}` : '',
    contact.urgency ? `Dringlichkeit: ${contact.urgency}` : '',
    contact.location ? `Einsatzadresse: ${contact.location}` : '',
    contact.name ? `Name: ${contact.name}` : '',
    contact.phone ? `Telefon: ${contact.phone}` : '',
    contact.concern
      ? `Zusammenfassung: Der Besucher meldet: ${contact.concern}. Ein Rückruf ist erforderlich.`
      : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('\n') : fallback;
}

function shouldQualifyBeforeContact(text: string, contact: ContactDetails) {
  return Boolean(
    contact.concern &&
      /\b(ki|künstliche intelligenz|kuenstliche intelligenz|automatisierung|unternehmen|firma|software|lösung|loesung)\b/i.test(
        text,
      ) &&
      !/\b(angebot|preis|kosten|termin|rückruf|rueckruf|kontakt|demo)\b/i.test(text),
  );
}

function buildLocalServiceMissingNotice(missing: string[]) {
  const current = missing[0];
  const labels = [
    current === 'concern'
      ? 'Problem oder Anliegen'
      : current === 'urgency'
        ? 'Dringlichkeit'
        : current === 'location'
          ? 'vollständige Einsatzadresse'
          : current === 'name'
            ? 'Vor- und Nachname'
            : current === 'contact'
              ? 'Telefonnummer'
              : current,
  ].filter(Boolean);

  if (labels.length === 0) {
    return '';
  }

  return `Für die Anfrage ${labels.length === 1 ? 'fehlt' : 'fehlen'} noch: ${formatGermanList(labels)}.`;
}

function formatGermanList(values: string[]) {
  if (values.length <= 1) {
    return values[0] || '';
  }

  if (values.length === 2) {
    return `${values[0]} und ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')} und ${values[values.length - 1]}`;
}

function buildLocalServiceAddressQuestion(
  lastMessage: string | undefined,
  missingNotice: string,
  configuredQuestion?: string,
) {
  const text = (lastMessage || '').trim();
  const fallback = configuredQuestion ||
    'Bitte nennen Sie uns die vollständige Einsatzadresse mit Straße, Hausnummer, PLZ und Ort.';

  if (/\b\d{5}\b/.test(text) && !hasCompleteServiceAddress(text)) {
    return 'Die PLZ allein reicht noch nicht. Bitte nennen Sie noch Straße, Hausnummer und Ort der Einsatzadresse.';
  }

  if (hasPartialServiceAddress(text) && !hasCompleteServiceAddress(text)) {
    return 'Die Einsatzadresse ist noch unvollständig. Bitte nennen Sie Straße, Hausnummer, PLZ und Ort.';
  }

  return [missingNotice, fallback].filter(Boolean).join(' ');
}

function buildLocalServiceNameQuestion(
  lastMessage: string | undefined,
  contact: ContactDetails | undefined,
  missingNotice: string,
  configuredQuestion?: string,
) {
  const text = cleanExtractedText((lastMessage || '').trim());
  const words = text.split(/\s+/).filter(isNameToken);
  const fallback = configuredQuestion || 'Bitte nennen Sie uns noch Ihren Vor- und Nachnamen.';

  if (!hasFullName(contact?.name) && words.length === 1) {
    return [missingNotice, 'Ein einzelner Name reicht noch nicht. Bitte nennen Sie uns Ihren Vor- und Nachnamen.']
      .filter(Boolean)
      .join(' ');
  }

  return [missingNotice, fallback].filter(Boolean).join(' ');
}

function buildLocalServicePhoneQuestion(
  lastMessage: string | undefined,
  missingNotice: string,
  configuredQuestion?: string,
) {
  const text = (lastMessage || '').trim();
  const hasDigits = /\d/.test(text);
  const fallback = configuredQuestion || 'Unter welcher Telefonnummer können wir Sie für den Rückruf erreichen?';

  if (hasDigits && !extractPhoneNumber(text)) {
    return 'Die Telefonnummer wirkt unvollständig oder ist keine gültige Rückrufnummer. Unter welcher Telefonnummer kann der Notdienst Sie zurückrufen?';
  }

  return [missingNotice, fallback].filter(Boolean).join(' ');
}

function buildMissingFieldsQuestion(
  missing: string[],
  scheduleIntent: boolean,
  hasKnownConcern = false,
  preferredContact?: ContactDetails['preferredContact'],
  localServiceFlow = false,
  intakeFlow?: LocalServiceIntakeFlowConfig,
  hasKnownUrgency = false,
  contact?: ContactDetails,
  lastMessage?: string,
) {
  const questionTexts = intakeFlow?.questionTexts || {};
  if (localServiceFlow) {
    const missingNotice = buildLocalServiceMissingNotice(missing);
    if (missing[0] === 'concern') {
      const question = scheduleIntent
        ? hasKnownUrgency
          ? questionTexts.problem || 'Was genau ist betroffen?'
          : questionTexts.callback || 'Gerne. Geht es um einen akuten Notfall oder um eine allgemeine Anfrage?'
        : questionTexts.problem || 'Was genau ist betroffen?';
      return [missingNotice, question].filter(Boolean).join(' ');
    }
    if (missing[0] === 'location') {
      return buildLocalServiceAddressQuestion(
        lastMessage,
        missingNotice,
        questionTexts.fullAddress || questionTexts.location,
      );
    }
    if (missing[0] === 'urgency') {
      const question = questionTexts.urgency || 'Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?';
      return [missingNotice, question].filter(Boolean).join(' ');
    }
    if (missing[0] === 'name' || missing.includes('name')) {
      return buildLocalServiceNameQuestion(lastMessage, contact, missingNotice, questionTexts.fullName || questionTexts.name);
    }
    if (missing[0] === 'contact' || missing.includes('contact')) {
      if (preferredContact === 'email') {
        return [missingNotice, 'Über welche E-Mail-Adresse können wir Sie erreichen?'].filter(Boolean).join(' ');
      }
      return buildLocalServicePhoneQuestion(lastMessage, missingNotice, questionTexts.phone);
    }
  }

  if (missing.includes('contact') && preferredContact === 'phone') {
    return 'Gerne. Wie lautet deine Telefonnummer?';
  }

  if (missing.includes('contact') && preferredContact === 'email') {
    return 'Gerne. Wie lautet deine E-Mail-Adresse?';
  }

  if (scheduleIntent && hasKnownConcern && missing.includes('name') && missing.includes('contact')) {
    return 'Perfekt. Wie können wir dich am besten erreichen - per E-Mail oder Telefon?';
  }

  if (missing[0] === 'concern') {
    return 'Klar. Worum geht es genau?';
  }

  if (missing.includes('name') && missing.includes('contact')) {
    return scheduleIntent
      ? 'Perfekt. Wie können wir dich am besten erreichen - per E-Mail oder Telefon?'
      : 'Klar, gerne. Wie heißt du und wie kann man dich am besten erreichen - per E-Mail oder Telefon?';
  }

  if (missing.includes('name')) {
    return 'Klar. Wie heißt du?';
  }

  if (missing.includes('contact')) {
    return 'Klar, gerne. Wie kann man dich am besten erreichen - per E-Mail oder Telefon?';
  }

  return 'Gerne. Worum geht es grob, damit wir die Anfrage richtig einordnen können?';
}

function buildCapturedLeadAnswer(params: {
  scheduleUrl?: string;
  ctaText?: string;
  scheduleIntent: boolean;
  localServiceFlow?: boolean;
}) {
  const base = params.localServiceFlow
    ? 'Danke, Ihre Daten wurden aufgenommen.'
    : 'Danke, ich habe deine Anfrage aufgenommen.';

  if (params.localServiceFlow) {
    return `${base} Sie werden schnellstmöglich kontaktiert.`;
  }

  if (params.scheduleUrl) {
    return `${base} Hier kannst du direkt einen passenden Termin buchen: ${params.scheduleUrl}`;
  }

  if (params.scheduleIntent) {
    return `${base} Wir melden uns zur Terminabstimmung bei dir.`;
  }

  if (params.ctaText) {
    return `${base} Nächster Schritt: ${params.ctaText}`;
  }

  return `${base} Wir melden uns schnellstmöglich bei dir.`;
}

function buildLocalServicePricingAnswer(intakeFlow?: LocalServiceIntakeFlowConfig) {
  const template =
    intakeFlow?.pricingAnswerTemplate ||
    'Die Kosten hängen vom Aufwand und den konkreten Rahmenbedingungen ab. Eine genaue Einschätzung ist nach kurzer Problembeschreibung möglich.';
  return template;
}

function buildGreetingAnswer(localServiceFlow = false) {
  if (localServiceFlow) {
    return 'Guten Tag, wie kann ich Ihnen behilflich sein?';
  }

  return 'Hi, ich helfe dir bei Fragen zu Websites, KI-Automatisierung, Support-Systemen oder individuellen Softwarelösungen. Wobei kann ich dich unterstützen?';
}

function buildSensitiveDataAnswer() {
  return 'Bitte geben Sie hier keine Passwörter, MFA-Codes, Zahlungsdaten oder Ausweisdaten ein. Beschreiben Sie nur das Problem ohne solche Daten; falls nötig, übernimmt ein Mitarbeiter.';
}

function buildRecoveryAnswer(localServiceFlow = false) {
  if (localServiceFlow) {
    return 'Entschuldigung, ich habe zu früh nach Kontaktdaten gefragt. Ich frage nicht weiter danach. Wenn Sie möchten, kann ich Ihnen weiterhin Fragen zu Kosten, Einsatz, Rückruf oder Notdienst beantworten.';
  }

  return 'Du hast recht, ich frage gerade zu früh nach Kontaktdaten. Ich kann dir auch erst einmal normal weiterhelfen. Geht es bei dir eher um Website, KI-Automatisierung, Support oder Beratung?';
}

function buildLocalServiceStopAnswer() {
  return 'Verstanden. Ich breche die Aufnahme der Anfrage hier ab. Falls Sie doch Hilfe benötigen, können Sie jederzeit kurz Ihr Problem schildern.';
}

function buildCompletedLeadAcknowledgementAnswer() {
  return 'Gern. Ihre Anfrage wurde aufgenommen. Falls Sie noch etwas ergänzen möchten, schreiben Sie es einfach dazu.';
}

function buildConsultingResetAnswer(localServiceFlow = false) {
  if (localServiceFlow) {
    return 'Kein Problem. Ich kann Ihnen Fragen zum Einsatz, zu Kosten, Rückruf oder Notdienst beantworten. Worum geht es bei Ihrer Anfrage?';
  }

  return 'Kein Problem. Ich kann dir Fragen zu Websites, KI-Automatisierung, Support-Automatisierung oder individuellen Softwarelösungen beantworten. Worum geht es bei dir konkret?';
}

function buildBusinessNeedQualificationAnswer() {
  return 'Das kann in mehreren Bereichen sinnvoll sein: Support, Kundengewinnung oder interne Prozesse. Wo hast du aktuell den größten Aufwand?';
}

function buildLeadCta(
  label?: string,
  description?: string,
  ctaText?: string,
  localServiceFlow = false,
) {
  return {
    action: 'lead_capture' as const,
    label: label || ctaText || 'Kontaktdaten hinterlassen',
    description: description || (localServiceFlow
      ? 'Wir nehmen Ihre Anfrage direkt auf.'
      : 'Wir nehmen deine Anfrage direkt auf.'),
  };
}

function sanitizeAssistantAnswer(value: string | undefined) {
  const answer = asString(value);
  if (!answer || /^\s*(\[DATEN BEREINIGT\]|\[TESTDATEN BEREINIGT\]|\[REDACTED\]|null|undefined)\s*$/i.test(answer)) {
    return 'Ich kann Ihnen dazu kurz weiterhelfen. Bitte schildern Sie Ihr Anliegen ohne sensible Daten.';
  }
  return answer
    .replace(/\[DATEN BEREINIGT\]/gi, '')
    .replace(/\[TESTDATEN BEREINIGT\]/gi, '')
    .replace(/\[REDACTED\]/gi, '')
    .trim() || 'Ich kann Ihnen dazu kurz weiterhelfen. Bitte schildern Sie Ihr Anliegen ohne sensible Daten.';
}

function buildDashboardUrl(siteId: string) {
  const appUrl = asString(process.env.APP_URL);
  if (!appUrl) {
    return undefined;
  }

  return `${appUrl.replace(/\/+$/, '')}/sites/${encodeURIComponent(siteId)}/leads`;
}

function findFirstUrl(config: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(config[key]);
    if (isHttpUrl(value)) {
      return value;
    }
  }

  for (const value of Object.values(config)) {
    if (typeof value === 'string' && isHttpUrl(value)) {
      const lower = value.toLowerCase();
      if (lower.includes('calendly') || lower.includes('termin') || lower.includes('booking')) {
        return value.trim();
      }
    }
  }

  return undefined;
}

function isHttpUrl(value: string) {
  return /^https?:\/\/[^\s]+$/i.test(value.trim());
}
