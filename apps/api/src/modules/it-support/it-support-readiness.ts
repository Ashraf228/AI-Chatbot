import { IT_SUPPORT_ALLOWED_REQUIRED_TICKET_FIELDS } from '../../site-modules/module-configs';

export type ItSupportReadinessStatus = 'ready' | 'warning' | 'not_ready';

export type ItSupportReadinessInput = {
  itSupportEnabled: boolean;
  knowledgeFaqEnabled: boolean;
  requiredTicketFields?: string[];
  ticketConfirmationRequired?: boolean;
  escalationKeywords?: string[];
  hasTicketWebhook?: boolean;
  hasActiveKnowledgeSources?: boolean;
};

export type ItSupportReadinessResult = {
  status: ItSupportReadinessStatus;
  missing: string[];
  warnings: string[];
  checks: Record<string, boolean>;
};

const REQUIRED_BASE_FIELDS = ['description', 'affectedSystem', 'impact', 'reporterEmail'];

export function evaluateItSupportReadiness(input: ItSupportReadinessInput): ItSupportReadinessResult {
  const requiredTicketFields = Array.isArray(input.requiredTicketFields)
    ? input.requiredTicketFields
    : [];
  const requiredFields = new Set(requiredTicketFields);
  const allowedFields = new Set<string>(IT_SUPPORT_ALLOWED_REQUIRED_TICKET_FIELDS);
  const requiredTicketFieldsValid = requiredTicketFields.length > 0 &&
    requiredTicketFields.every((field) => allowedFields.has(field));
  const requiredTicketFieldsComplete = REQUIRED_BASE_FIELDS.every((field) => requiredFields.has(field));
  const ticketForwardingConfigured = input.hasTicketWebhook === true;
  const checks = {
    itSupportEnabled: input.itSupportEnabled === true,
    knowledgeFaqEnabled: input.knowledgeFaqEnabled === true,
    requiredTicketFieldsValid,
    requiredTicketFieldsComplete,
    ticketConfirmationRequired: input.ticketConfirmationRequired === true,
    escalationKeywordsConfigured: Array.isArray(input.escalationKeywords) && input.escalationKeywords.length > 0,
    ticketForwardingConfigured,
    ticketWebhookConfigured: ticketForwardingConfigured,
    activeKnowledgeSourcesAvailable: input.hasActiveKnowledgeSources === true,
  };

  const missing: string[] = [];
  const warnings: string[] = [];

  if (!checks.itSupportEnabled) missing.push('it-support Modul ist nicht aktiv.');
  if (!checks.knowledgeFaqEnabled) missing.push('knowledge-faq Modul ist nicht aktiv.');
  if (!checks.requiredTicketFieldsValid) {
    missing.push('requiredTicketFields enthält ungültige oder leere Felder.');
  }
  if (!checks.requiredTicketFieldsComplete) {
    missing.push('requiredTicketFields enthält nicht alle Basisfelder: description, affectedSystem, impact, reporterEmail.');
  }
  if (!checks.ticketConfirmationRequired) missing.push('Finale Ticket-Bestätigung ist nicht als erforderlich markiert.');

  if (!checks.escalationKeywordsConfigured) warnings.push('Eskalations-Keywords sind leer oder nicht konfiguriert.');
  if (!checks.ticketForwardingConfigured) warnings.push('Keine Ticket-Weiterleitung für ticket.created ist als vorhanden markiert.');
  if (!checks.activeKnowledgeSourcesAvailable) warnings.push('Keine aktiven Wissensquellen sind als vorhanden markiert.');

  const status: ItSupportReadinessStatus = missing.length > 0
    ? 'not_ready'
    : warnings.length > 0
      ? 'warning'
      : 'ready';

  return {
    status,
    missing,
    warnings,
    checks,
  };
}
