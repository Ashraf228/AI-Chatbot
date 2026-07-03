import {
  buildCreateTicketInputFromPendingTicket,
  buildItSupportCancelledAnswer,
  buildItSupportResolvedAnswer,
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
  mergePendingTicket,
  parsePendingTicketState,
  shouldStartNewItSupportContext,
} from '../modules/it-support/it-support-flow';
import type {
  PendingTicketForwardingStatus,
  PendingTicketState,
} from '../modules/it-support/it-support-flow';
import type { ConversationState } from './contact-collection.helpers';

export {
  buildCreateTicketInputFromPendingTicket,
  buildItSupportCancelledAnswer,
  buildItSupportResolvedAnswer,
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
  mergePendingTicket,
  parsePendingTicketState,
  shouldStartNewItSupportContext,
};
export type {
  PendingTicketForwardingStatus,
  PendingTicketState,
} from '../modules/it-support/it-support-flow';

export type AgentTicketPayload = Record<string, unknown>;
export type TicketAuditPayload = {
  action: string;
  metadata: Record<string, unknown>;
};
export type TicketNotificationPayload = Record<string, unknown>;

export type TicketSideEffectCommand =
  | { type: 'insert_agent_ticket'; payload: AgentTicketPayload }
  | { type: 'update_metadata'; patch: Record<string, unknown> }
  | { type: 'record_ticket_audit'; payload: TicketAuditPayload }
  | { type: 'queue_ticket_notification'; payload: TicketNotificationPayload };

export function isActivePendingTicket(ticket: PendingTicketState | null): ticket is PendingTicketState {
  return Boolean(
    ticket &&
      !['created', 'cancelled', 'resolved'].includes(ticket.status),
  );
}

export function parseTicketForwardingStatus(value: string): PendingTicketForwardingStatus {
  if (['queued', 'not_configured', 'failed', 'unknown'].includes(value)) {
    return value as PendingTicketForwardingStatus;
  }
  return 'unknown';
}

export function mapTicketMissingFieldToAssistantAsk(field: string): PendingTicketState['lastAssistantAsk'] {
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

export function buildTicketConversationState(
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

export function buildTicketMetadataPatch(params: {
  previousConversationState: ConversationState | null;
  pendingTicket: PendingTicketState;
  stage: ConversationState['stage'];
  goal?: ConversationState['goal'];
}): {
  pendingLead: null;
  pendingTicket: PendingTicketState;
  conversationState: ConversationState;
} {
  return {
    pendingLead: null,
    pendingTicket: params.pendingTicket,
    conversationState: buildTicketConversationState(
      params.previousConversationState,
      params.pendingTicket,
      params.stage,
      params.goal,
    ),
  };
}

export function buildCompletedTicketMetadataPatch(params: {
  previousConversationState: ConversationState | null;
  pendingTicket: PendingTicketState;
}): {
  pendingLead: null;
  pendingTicket: PendingTicketState;
  conversationState: ConversationState;
} {
  return buildTicketMetadataPatch({
    previousConversationState: params.previousConversationState,
    pendingTicket: params.pendingTicket,
    stage: 'completed',
  });
}

export function buildAgentTicketPayload(params: {
  ticket: PendingTicketState;
  conversationId?: string;
  tenantId?: string;
  siteId?: string;
}): AgentTicketPayload {
  return buildCreateTicketInputFromPendingTicket(params.ticket, {
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    siteId: params.siteId,
  });
}

export function isTicketCaptureComplete(
  ticket: PendingTicketState,
  requiredFields?: string[],
): boolean {
  return getMissingItTicketFields(ticket, requiredFields).length === 0;
}

export function shouldAskForTicketField(
  ticket: PendingTicketState,
  requiredFields?: string[],
): boolean {
  return !isTicketCaptureComplete(ticket, requiredFields);
}

export function shouldCreateTicket(ticket: PendingTicketState): boolean {
  return ticket.status === 'ready_to_create' && !ticket.createdTicketId;
}

export function buildTicketSideEffectCommands(params: {
  ticket: PendingTicketState;
  requiredFields?: string[];
  payload?: AgentTicketPayload;
  metadataPatch?: Record<string, unknown>;
  auditPayload?: TicketAuditPayload;
  notificationPayload?: TicketNotificationPayload;
}): TicketSideEffectCommand[] {
  const commands: TicketSideEffectCommand[] = [];
  if (params.metadataPatch) {
    commands.push({ type: 'update_metadata', patch: params.metadataPatch });
  }
  if (params.auditPayload) {
    commands.push({ type: 'record_ticket_audit', payload: params.auditPayload });
  }
  if (params.notificationPayload) {
    commands.push({ type: 'queue_ticket_notification', payload: params.notificationPayload });
  }
  if (shouldCreateTicket(params.ticket) && isTicketCaptureComplete(params.ticket, params.requiredFields)) {
    commands.push({
      type: 'insert_agent_ticket',
      payload: params.payload || buildAgentTicketPayload({ ticket: params.ticket }),
    });
  }
  return commands;
}

export function buildCreatedItTicketAnswer(
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

export function withItSecurityWarning(answer: string) {
  const warning = [
    'Das klingt nach einem kritischen IT- oder Sicherheitsvorfall.',
    'Bitte öffnen Sie keine weiteren Links oder Anhänge, geben Sie keine Passwörter, MFA-Codes oder vertraulichen Daten ein und nutzen Sie das betroffene Gerät bei Malware-Verdacht möglichst nicht weiter.',
  ].join(' ');
  return `${warning}\n\n${answer}`;
}
