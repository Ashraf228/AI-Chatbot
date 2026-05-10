import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AgentDecision } from '../ai/orchestration/agent-decision.types';
import { AgentOrchestratorService } from '../ai/orchestration/agent-orchestrator.service';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { logEvent } from '../utils/logger';
import { LeadMailerService } from '../modules/widget/services/lead-mailer.service';
import { ReportMailerService } from '../modules/widget/services/report-mailer.service';

type ChatHistoryEntry = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type SiteConfigRow = {
  name: string;
  config: Record<string, unknown> | null;
};

type LeadCaptureResult = {
  leadId: string;
  created: boolean;
};

type PendingLeadState = ContactDetails & {
  status?: 'pending' | 'completed';
  intent?: 'lead' | 'schedule';
  scheduleIntent?: boolean;
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
    @Optional() private readonly decisionOrchestrator?: AgentOrchestratorService,
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
    const text = normalizeText(params.message);
    const leadIntent = hasLeadIntent(text);
    const scheduleIntent = hasScheduleIntent(text);
    const askedForContact = wasContactRequested(params.history);
    const metadataState = await this.loadConversationMetadata(params.conversationId);
    const pendingLead = metadataState.pendingLead;
    const pendingActive = pendingLead?.status === 'pending';
    const contactFromMessage = extractContactDetails(params.message, pendingLead);
    const conversationState = buildConversationState({
      previous: metadataState.conversationState,
      message: params.message,
      contact: mergeContactDetails(pendingLead, contactFromMessage),
      leadIntent,
      scheduleIntent,
    });

    const leadFeatureEnabled =
      moduleContext.leadSalesEnabled ||
      siteConfig.setupGoal === 'lead_capture' ||
      siteConfig.setupGoal === 'appointments' ||
      siteConfig.leadCaptureEnabled !== false;

    if (!leadFeatureEnabled) {
      await this.saveConversationMetadata(params.conversationId, {
        conversationState,
      });
      return { action: 'normal_answer', handled: false, decision: structuredDecision };
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
        }),
      });
      return { action: 'normal_answer', handled: false, decision: structuredDecision };
    }

    if (
      !pendingActive &&
      !leadIntent &&
      !scheduleIntent &&
      !(askedForContact && hasContactSignal(contactFromMessage))
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
    const contact = ensureScheduleContactContext(
      mergeContactDetailsFromState(
        mergeContactDetails(pendingLead, contactFromMessage),
        conversationState,
      ),
      conversationState,
      effectiveScheduleIntent,
    );
    const missing = getMissingContactFields(contact);
    const cta = buildLeadCta(moduleContext.ctaLabel, moduleContext.ctaDescription, siteConfig.ctaText);
    const activeConversationState = buildConversationState({
      previous: conversationState,
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
    });

    if (missing.length > 0) {
      const nextState = buildPendingLeadState({
        previous: pendingLead,
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
        ),
        decision: structuredDecision,
        cta,
      };
    }

    const leadCapture = await this.captureLead({
      siteId: params.siteId,
      sessionId: params.sessionId,
      contact,
    });

    if (leadCapture.created) {
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: {
          ...contact,
          status: 'completed',
          intent: effectiveScheduleIntent ? 'schedule' : 'lead',
          scheduleIntent: effectiveScheduleIntent,
          startedAt: pendingLead?.startedAt || new Date().toISOString(),
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
        recipientEmail: siteConfig.leadNotificationEmail || resolveFallbackRecipient(),
      });
    } else if (pendingLead?.status === 'pending') {
      await this.saveConversationMetadata(params.conversationId, {
        pendingLead: {
          ...contact,
          status: 'completed',
          intent: effectiveScheduleIntent ? 'schedule' : 'lead',
          scheduleIntent: effectiveScheduleIntent,
          startedAt: pendingLead.startedAt || new Date().toISOString(),
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
        answer: decision.message,
        decision,
        cta: decision.requiredFields.includes('email') || decision.requiredFields.includes('phone')
          ? {
              action: 'lead_capture',
              label: 'Kontaktdaten hinterlassen',
              description: 'Wir nehmen deine Anfrage auf.',
            }
          : undefined,
      };
    }

    return null;
  }

  private async getModuleContext(siteId: string) {
    const modules = await this.siteModules.listForSite(siteId);
    const leadSales = modules.find((module) =>
      ['lead-sales', 'lead_sales'].includes(module.key),
    );
    const leadConfig = asObject(leadSales?.config);

    return {
      leadSalesEnabled: Boolean(leadSales?.isEnabled),
      primaryGoal: asString(leadConfig.primaryGoal),
      ctaLabel: asString(leadConfig.ctaLabel),
      ctaDescription: asString(leadConfig.ctaDescription),
    };
  }

  private async getSiteConfig(siteId: string) {
    const res = await this.db.query<SiteConfigRow>(
      `SELECT name, config
       FROM sites
       WHERE id = $1
       LIMIT 1`,
      [siteId],
    );
    const config = asObject(res.rows[0]?.config);
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

    return {
      siteName: res.rows[0]?.name || '',
      setupGoal: asString(config.setupGoal),
      leadCaptureEnabled: typeof config.leadCaptureEnabled === 'boolean' ? config.leadCaptureEnabled : undefined,
      leadNotificationEmail:
        asString(config.leadNotificationEmail) ||
        asString(config.notificationEmail) ||
        asString(config.contactEmail),
      ctaText: asString(config.ctaText) || asString(conversationFlow.ctaText),
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
    siteId: string;
    sessionId: string;
    contact: ContactDetails;
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
    await this.db.query(
      `INSERT INTO widget_leads(id, site_id, session_id, name, email, phone, message, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', now())`,
      [
        leadId,
        params.siteId,
        params.sessionId,
        params.contact.name || 'Unbekannt',
        params.contact.email || '',
        params.contact.phone || null,
        params.contact.concern || 'Kontaktanfrage aus dem Chat',
      ],
    );

    await this.db.query(
      `UPDATE widget_sessions
       SET lead_captured = true,
           last_seen_at = now()
       WHERE id = $1 AND site_id = $2`,
      [params.sessionId, params.siteId],
    );

    return { leadId, created: true };
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
        `Widget session: ${params.sessionId}\n${params.contact.concern || 'Terminanfrage aus dem Chat'}`,
      ],
    );

    return id;
  }

  private async loadConversationMetadata(conversationId: string): Promise<{
    pendingLead: PendingLeadState | null;
    conversationState: ConversationState | null;
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
    };
  }

  private async loadPendingLeadState(conversationId: string): Promise<PendingLeadState | null> {
    const metadata = await this.loadConversationMetadata(conversationId);
    return metadata.pendingLead;
  }

  private async saveConversationMetadata(
    conversationId: string,
    state: {
      pendingLead?: PendingLeadState;
      conversationState?: ConversationState;
    },
  ) {
    const patch: Record<string, unknown> = {};
    if (state.pendingLead) {
      patch.pendingLead = compactPendingLeadState(state.pendingLead);
    }
    if (state.conversationState) {
      const compactState = compactConversationState(state.conversationState);
      if (Object.keys(compactState).length > 0) {
        patch.conversationState = compactState;
      }
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
          message: params.contact.concern || 'Kontaktanfrage aus dem Chat',
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

function parsePendingLeadState(value: unknown): PendingLeadState | null {
  const pendingLead = asObject(value);
  if (!pendingLead.status) {
    return null;
  }

  return {
    status: pendingLead.status === 'completed' ? 'completed' : 'pending',
    intent: pendingLead.intent === 'schedule' ? 'schedule' : 'lead',
    scheduleIntent: pendingLead.scheduleIntent === true,
    name: asString(pendingLead.name) || undefined,
    email: asString(pendingLead.email) || undefined,
    phone: asString(pendingLead.phone) || undefined,
    preferredContact: parsePreferredContact(asString(pendingLead.preferredContact)),
    concern: asString(pendingLead.concern) || undefined,
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasLeadIntent(text: string) {
  return /\b(beratung|beraten|kontakt|kontaktiert|angebot|kostet|kosten|preis|preise|interesse|interessiere|rueckruf|rückruf|anrufen|rufen sie|melden|anfrage|demo|erstgespraech|erstgespräch)\b/i.test(
    text,
  );
}

function hasScheduleIntent(text: string) {
  return /\b(termin|meeting|kalender|buchen|buchung|telefonat|erstgespraech|erstgespräch|beratungsgespraech|beratungsgespräch)\b/i.test(
    text,
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

function extractContactDetails(message: string, pendingLead: PendingLeadState | null): ContactDetails {
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = message.match(/(?:\+?\d[\d\s()./-]{6,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim();
  const name = extractName(message) || inferNameFromPendingAnswer(message, pendingLead);
  const concern = extractConcern(message, pendingLead);
  const preferredContact = extractPreferredContact(message);

  return {
    name,
    email,
    phone,
    concern,
    preferredContact,
  };
}

function extractPreferredContact(message: string): ContactDetails['preferredContact'] | undefined {
  if (/\b(telefon|telefonisch|phone|handy|anruf|anrufen|rueckruf|rückruf|whatsapp)\b/i.test(message)) {
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

function inferNameFromPendingAnswer(message: string, pendingLead: PendingLeadState | null) {
  if (pendingLead?.status !== 'pending' || pendingLead.name) {
    return undefined;
  }

  const clean = cleanExtractedText(message.trim());
  if (!clean || clean.length > 60 || clean.includes('@') || /\d/.test(clean)) {
    return undefined;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) {
    return undefined;
  }

  if (words.every((word) => /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+$/.test(word))) {
    return clean;
  }

  return undefined;
}

function extractConcern(message: string, pendingLead: PendingLeadState | null) {
  const value = message.trim();
  if (!value || looksLikeContactOnly(value)) {
    return undefined;
  }

  if (pendingLead?.status === 'pending' && !pendingLead.concern && !inferNameFromPendingAnswer(value, pendingLead)) {
    return sanitizeConcern(value);
  }

  if (
    (hasLeadIntent(normalizeText(value)) || hasScheduleIntent(normalizeText(value))) &&
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
}): ConversationState {
  const text = normalizeText(params.message);
  const inferredIntent = inferConversationIntent(text, params.leadIntent, params.scheduleIntent);
  const topic = inferTopic(params.message, params.previous, params.contact, inferredIntent);
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
) {
  if (contact.concern) {
    return contact.concern;
  }

  const value = message.trim();
  if (!value || isPureContactInput(value) || hasScheduleIntent(normalizeText(value))) {
    return previous?.topic || previous?.collectedFields?.concern || null;
  }

  if (intent === 'lead' && isGenericLeadIntent(value)) {
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
    preferredContact: params.contact.preferredContact,
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

function getMissingContactFields(contact: ContactDetails) {
  const missing: string[] = [];
  if (!contact.concern) {
    missing.push('concern');
  }
  if (!contact.name) {
    missing.push('name');
  }
  if (!contact.email && !contact.phone) {
    missing.push('contact');
  }
  return missing;
}

function buildMissingFieldsQuestion(
  missing: string[],
  scheduleIntent: boolean,
  hasKnownConcern = false,
  preferredContact?: ContactDetails['preferredContact'],
) {
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
}) {
  const base = 'Danke, ich habe deine Anfrage aufgenommen.';
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

function buildLeadCta(label?: string, description?: string, ctaText?: string) {
  return {
    action: 'lead_capture' as const,
    label: label || ctaText || 'Kontaktdaten hinterlassen',
    description: description || 'Wir nehmen deine Anfrage direkt auf.',
  };
}

function resolveFallbackRecipient() {
  return (
    asString(process.env.LEAD_NOTIFICATION_EMAIL) ||
    asString(process.env.ADMIN_EMAIL) ||
    asString(process.env.REPORTS_FROM_EMAIL)
  );
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
