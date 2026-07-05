import type { ContactDetails } from './contact-collection.helpers';
import {
  getNotificationNoopReason,
  hasUsableEmailTarget,
  sanitizeNotificationPayloadForAudit,
} from './notification-safety.guard';

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

export type DeliveryPayloadBuildResult<T> =
  | {
      status: 'ready';
      payload: T;
      auditPayload: Record<string, unknown>;
    }
  | {
      status: 'noop';
      reasonCode: string;
      auditPayload: Record<string, unknown>;
    };

export function summarizeDeliveryConcern(contact: ContactDetails, fallback: string, structured = false) {
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
  if (!hasUsableEmailTarget({ enabled: true, recipientEmail: params.recipientEmail })) {
    return null;
  }

  return {
    recipientEmail: params.recipientEmail as string,
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
      message: summarizeDeliveryConcern(params.contact, 'Kontaktanfrage aus dem Chat', Boolean(params.localServiceFlow)),
    },
  };
}

export function buildLeadDeliveryPayload(params: {
  recipientEmail?: string;
  siteId: string;
  siteName: string;
  submittedAt: string;
  scheduleIntent: boolean;
  dashboardUrl?: string;
  contact: ContactDetails;
  localServiceFlow?: boolean;
}): DeliveryPayloadBuildResult<LeadNotificationPayload> {
  const noopReason = getNotificationNoopReason({
    type: 'email',
    config: { enabled: true, recipientEmail: params.recipientEmail },
  });
  if (noopReason) {
    return {
      status: 'noop',
      reasonCode: noopReason,
      auditPayload: buildDeliveryAuditPayload({
        type: 'lead_email',
        siteId: params.siteId,
        reasonCode: noopReason,
      }),
    };
  }

  const payload = buildLeadNotificationPayload(params);
  if (!payload) {
    return {
      status: 'noop',
      reasonCode: 'missing_email_target',
      auditPayload: buildDeliveryAuditPayload({
        type: 'lead_email',
        siteId: params.siteId,
        reasonCode: 'missing_email_target',
      }),
    };
  }

  return {
    status: 'ready',
    payload,
    auditPayload: buildDeliveryAuditPayload(payload),
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

export function buildEmailJobPayload(params: Parameters<typeof buildLeadEmailJobPayload>[0]) {
  return buildLeadEmailJobPayload(params);
}

export function buildDeliveryAuditPayload(input: unknown): Record<string, unknown> {
  const sanitized = sanitizeNotificationPayloadForAudit(input);
  return isRecord(sanitized) ? sanitized : {};
}

export function buildSafeDeliveryPayloadForLog(input: unknown): Record<string, unknown> {
  return buildDeliveryAuditPayload(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
