import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

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
};

export type ChatAgentDecision = {
  action: OrchestratorAction;
  handled: boolean;
  answer?: string;
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
  ) {}

  async decide(params: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    sessionId: string;
    message: string;
    history: ChatHistoryEntry[];
  }): Promise<ChatAgentDecision> {
    const moduleContext = await this.getModuleContext(params.siteId);
    const siteConfig = await this.getSiteConfig(params.siteId);
    const text = normalizeText(params.message);
    const leadIntent = hasLeadIntent(text);
    const scheduleIntent = hasScheduleIntent(text);
    const askedForContact = wasContactRequested(params.history);
    const pendingLead = await this.loadPendingLeadState(params.conversationId);
    const pendingActive = pendingLead?.status === 'pending';
    const contactFromMessage = extractContactDetails(params.message, pendingLead);

    const leadFeatureEnabled =
      moduleContext.leadSalesEnabled ||
      siteConfig.setupGoal === 'lead_capture' ||
      siteConfig.setupGoal === 'appointments' ||
      siteConfig.leadCaptureEnabled !== false;

    if (!leadFeatureEnabled) {
      return { action: 'normal_answer', handled: false };
    }

    if (
      !pendingActive &&
      pendingLead?.status === 'completed' &&
      !leadIntent &&
      !scheduleIntent
    ) {
      return { action: 'normal_answer', handled: false };
    }

    if (
      !pendingActive &&
      !leadIntent &&
      !scheduleIntent &&
      !(askedForContact && hasContactSignal(contactFromMessage))
    ) {
      return { action: 'normal_answer', handled: false };
    }

    const contact = mergeContactDetails(pendingLead, contactFromMessage);
    const effectiveScheduleIntent =
      Boolean(scheduleIntent || pendingLead?.scheduleIntent || pendingLead?.intent === 'schedule');
    const missing = getMissingContactFields(contact);
    const cta = buildLeadCta(moduleContext.ctaLabel, moduleContext.ctaDescription, siteConfig.ctaText);

    if (missing.length > 0) {
      const nextState = buildPendingLeadState({
        previous: pendingLead,
        contact,
        scheduleIntent: effectiveScheduleIntent,
        startedByIntent: scheduleIntent ? 'schedule' : 'lead',
      });
      await this.savePendingLeadState(params.conversationId, nextState);
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

      return {
        action: 'ask_for_contact',
        handled: true,
        answer: buildMissingFieldsQuestion(missing, effectiveScheduleIntent),
        cta,
      };
    }

    const leadCapture = await this.captureLead({
      siteId: params.siteId,
      sessionId: params.sessionId,
      contact,
    });

    if (leadCapture.created) {
      await this.savePendingLeadState(params.conversationId, {
        ...contact,
        status: 'completed',
        intent: effectiveScheduleIntent ? 'schedule' : 'lead',
        scheduleIntent: effectiveScheduleIntent,
        startedAt: pendingLead?.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        completedLeadId: leadCapture.leadId,
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
      await this.savePendingLeadState(params.conversationId, {
        ...contact,
        status: 'completed',
        intent: effectiveScheduleIntent ? 'schedule' : 'lead',
        scheduleIntent: effectiveScheduleIntent,
        startedAt: pendingLead.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        completedLeadId: leadCapture.leadId,
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
      leadId: leadCapture.leadId,
      contactRequestId,
      cta,
    };
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

  private async loadPendingLeadState(conversationId: string): Promise<PendingLeadState | null> {
    const res = await this.db.query<ConversationMetadataRow>(
      `SELECT id, metadata
       FROM conversations
       WHERE id = $1
       LIMIT 1`,
      [conversationId],
    );
    const metadata = asObject(res.rows[0]?.metadata);
    const pendingLead = asObject(metadata.pendingLead);
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
      concern: asString(pendingLead.concern) || undefined,
      startedAt: asString(pendingLead.startedAt) || undefined,
      updatedAt: asString(pendingLead.updatedAt) || undefined,
      completedAt: asString(pendingLead.completedAt) || undefined,
      completedLeadId: asString(pendingLead.completedLeadId) || undefined,
    };
  }

  private async savePendingLeadState(conversationId: string, state: PendingLeadState) {
    await this.db.query(
      `UPDATE conversations
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{pendingLead}',
         $2::jsonb,
         true
       ),
       last_active_at = now()
       WHERE id = $1`,
      [conversationId, JSON.stringify(compactPendingLeadState(state))],
    );
  }

  private async recordLeadAudit(params: {
    tenantId: string;
    siteId: string;
    action: 'lead_pending_started' | 'lead_pending_updated' | 'lead_captured';
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

  return {
    name,
    email,
    phone,
    concern,
  };
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
  };
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
    startedAt: params.previous?.startedAt || now,
    updatedAt: now,
  };
}

function compactPendingLeadState(state: PendingLeadState) {
  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => value !== undefined && value !== ''),
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

function buildMissingFieldsQuestion(missing: string[], scheduleIntent: boolean) {
  if (missing[0] === 'concern') {
    return 'Klar. Worum geht es genau?';
  }

  if (missing.includes('name') && missing.includes('contact')) {
    return scheduleIntent
      ? 'Gerne. Wie heißt du und wie kann man dich für den Termin am besten erreichen - per E-Mail oder Telefon?'
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
