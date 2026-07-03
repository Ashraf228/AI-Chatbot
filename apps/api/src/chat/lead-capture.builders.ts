import type { ContactDetails, ConversationState, PendingLeadState } from './contact-collection.helpers';

export type WidgetLeadPayload = {
  siteId: string;
  sessionId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
};

export type ContactRequestPayload = {
  tenantId: string;
  siteId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  preferredChannel: 'email' | 'phone';
  note: string;
};

export type LeadNotificationPayload = {
  recipientEmail: string;
  siteId: string;
  siteName: string;
  submittedAt: string;
  source: 'Widget Chat';
  scheduleIntent: boolean;
  dashboardUrl?: string;
  lead: {
    name: string;
    email: string;
    phone: string | null;
    message: string;
  };
};

export type EmailJobPayload = {
  recipientEmail: string;
  subject: string;
  html: string | null;
  text: string | null;
  metadata: {
    tenantId: string;
    siteId: string;
    sessionId: string;
    leadId: string;
    leadEmail: string | null;
    scheduleIntent: boolean;
  };
};

export type LeadAuditPayload = {
  action:
    | 'lead_pending_started'
    | 'lead_pending_updated'
    | 'lead_captured'
    | 'conversation_state_updated'
    | 'schedule_intent_detected';
  metadata: Record<string, unknown>;
};

export type LeadSideEffectCommand =
  | { type: 'insert_widget_lead'; payload: WidgetLeadPayload }
  | { type: 'create_contact_request'; payload: ContactRequestPayload }
  | { type: 'queue_email_job'; payload: EmailJobPayload }
  | { type: 'queue_webhook_job'; payload: Record<string, unknown> }
  | { type: 'record_lead_audit'; payload: LeadAuditPayload }
  | { type: 'update_metadata'; patch: Record<string, unknown> };

export function summarizeLeadConcern(contact: ContactDetails, fallback: string, structured = false) {
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

export function buildWidgetLeadPayload(params: {
  siteId: string;
  sessionId: string;
  contact: ContactDetails;
  localServiceFlow?: boolean;
  fallbackMessage?: string;
}): WidgetLeadPayload {
  return {
    siteId: params.siteId,
    sessionId: params.sessionId,
    name: params.contact.name || 'Unbekannt',
    email: params.contact.email || '',
    phone: params.contact.phone || null,
    message: summarizeLeadConcern(
      params.contact,
      params.fallbackMessage || 'Kontaktanfrage aus dem Chat',
      Boolean(params.localServiceFlow),
    ),
  };
}

export function buildContactRequestPayload(params: {
  tenantId: string;
  siteId: string;
  sessionId: string;
  contact: ContactDetails;
}): ContactRequestPayload | null {
  if (!params.contact.email && !params.contact.phone) {
    return null;
  }

  return {
    tenantId: params.tenantId,
    siteId: params.siteId,
    name: params.contact.name || null,
    email: params.contact.email || null,
    phone: params.contact.phone || null,
    preferredChannel: params.contact.email ? 'email' : 'phone',
    note: `Widget session: ${params.sessionId}\n${summarizeLeadConcern(
      params.contact,
      'Terminanfrage aus dem Chat',
    )}`,
  };
}

export function buildCompletedLeadMetadataPatch(params: {
  contact: ContactDetails;
  leadId: string;
  scheduleIntent: boolean;
  startedAt?: string;
  completedAt: string;
  conversationState?: ConversationState;
}): { pendingLead: PendingLeadState; conversationState?: ConversationState } {
  return {
    pendingLead: {
      ...params.contact,
      status: 'completed',
      intent: params.scheduleIntent ? 'schedule' : 'lead',
      scheduleIntent: params.scheduleIntent,
      startedAt: params.startedAt || params.completedAt,
      updatedAt: params.completedAt,
      completedAt: params.completedAt,
      completedLeadId: params.leadId,
    },
    ...(params.conversationState ? { conversationState: params.conversationState } : {}),
  };
}

export function buildLeadAuditPayload(params: {
  leadId: string;
  scheduleIntent: boolean;
  contact: ContactDetails;
}): LeadAuditPayload {
  return {
    action: 'lead_captured',
    metadata: {
      leadId: params.leadId,
      scheduleIntent: params.scheduleIntent,
      hasEmail: Boolean(params.contact.email),
      hasPhone: Boolean(params.contact.phone),
    },
  };
}

export function buildLeadNotificationPayload(params: {
  recipientEmail?: string;
  siteId: string;
  siteName: string;
  submittedAt: string;
  scheduleIntent: boolean;
  dashboardUrl?: string;
  contact: ContactDetails;
  localServiceFlow?: boolean;
}): LeadNotificationPayload | null {
  if (!params.recipientEmail) {
    return null;
  }

  return {
    recipientEmail: params.recipientEmail,
    siteId: params.siteId,
    siteName: params.siteName || params.siteId,
    submittedAt: params.submittedAt,
    source: 'Widget Chat',
    scheduleIntent: params.scheduleIntent,
    dashboardUrl: params.dashboardUrl,
    lead: {
      name: params.contact.name || 'Unbekannt',
      email: params.contact.email || '',
      phone: params.contact.phone || null,
      message: summarizeLeadConcern(params.contact, 'Kontaktanfrage aus dem Chat', Boolean(params.localServiceFlow)),
    },
  };
}

export function buildLeadEmailJobPayload(params: {
  mail: {
    to: string;
    subject: string;
    html?: string | null;
    text?: string | null;
  };
  tenantId: string;
  siteId: string;
  sessionId: string;
  leadId: string;
  contact: ContactDetails;
  scheduleIntent: boolean;
}): EmailJobPayload {
  return {
    recipientEmail: params.mail.to,
    subject: params.mail.subject,
    html: params.mail.html || null,
    text: params.mail.text || null,
    metadata: {
      tenantId: params.tenantId,
      siteId: params.siteId,
      sessionId: params.sessionId,
      leadId: params.leadId,
      leadEmail: params.contact.email || null,
      scheduleIntent: params.scheduleIntent,
    },
  };
}

export function shouldCreateContactRequest(params: {
  scheduleIntent: boolean;
  primaryGoal?: string;
  setupGoal?: string;
}) {
  return params.scheduleIntent || params.primaryGoal === 'appointment' || params.setupGoal === 'appointments';
}

export function shouldQueueLeadNotification(params: { recipientEmail?: string }) {
  return Boolean(params.recipientEmail);
}

export function shouldCreateLead(contact: ContactDetails) {
  return Boolean((contact.email || contact.phone) && (contact.name || contact.concern) && contact.concern);
}

export function isLeadCaptureComplete(params: { leadId?: string; contact: ContactDetails }) {
  return Boolean(params.leadId && shouldCreateLead(params.contact));
}

export function buildLeadSideEffectCommands(params: {
  contact: ContactDetails;
  siteId: string;
  sessionId: string;
  tenantId: string;
  leadId?: string;
  scheduleIntent: boolean;
  localServiceFlow?: boolean;
  recipientEmail?: string;
  siteName?: string;
  dashboardUrl?: string;
  completedAt?: string;
  createContactRequest?: boolean;
  mail?: {
    to: string;
    subject: string;
    html?: string | null;
    text?: string | null;
  };
}): LeadSideEffectCommand[] {
  const commands: LeadSideEffectCommand[] = [];
  if (!shouldCreateLead(params.contact)) {
    return commands;
  }

  commands.push({
    type: 'insert_widget_lead',
    payload: buildWidgetLeadPayload({
      siteId: params.siteId,
      sessionId: params.sessionId,
      contact: params.contact,
      localServiceFlow: params.localServiceFlow,
    }),
  });

  if (params.createContactRequest) {
    const requestPayload = buildContactRequestPayload(params);
    if (requestPayload) {
      commands.push({ type: 'create_contact_request', payload: requestPayload });
    }
  }

  if (params.leadId) {
    commands.push({
      type: 'record_lead_audit',
      payload: buildLeadAuditPayload({
        leadId: params.leadId,
        scheduleIntent: params.scheduleIntent,
        contact: params.contact,
      }),
    });

    commands.push({
      type: 'update_metadata',
      patch: buildCompletedLeadMetadataPatch({
        contact: params.contact,
        leadId: params.leadId,
        scheduleIntent: params.scheduleIntent,
        completedAt: params.completedAt || new Date().toISOString(),
      }),
    });
  }

  if (params.mail && shouldQueueLeadNotification({ recipientEmail: params.recipientEmail })) {
    commands.push({
      type: 'queue_email_job',
      payload: buildLeadEmailJobPayload({
        mail: params.mail,
        tenantId: params.tenantId,
        siteId: params.siteId,
        sessionId: params.sessionId,
        leadId: params.leadId || '',
        contact: params.contact,
        scheduleIntent: params.scheduleIntent,
      }),
    });
  }

  return commands;
}
