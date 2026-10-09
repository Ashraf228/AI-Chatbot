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
  availableItKnowledgeTemplateKeys?: string[];
  importedItKnowledgeTemplateKeys?: string[];
};

export type ItSupportReadinessResult = {
  status: ItSupportReadinessStatus;
  label: string;
  summary: string;
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
  const availableTemplateKeys = Array.isArray(input.availableItKnowledgeTemplateKeys)
    ? input.availableItKnowledgeTemplateKeys.filter((key) => typeof key === 'string' && Boolean(key.trim()))
    : [];
  const importedTemplateKeys = Array.isArray(input.importedItKnowledgeTemplateKeys)
    ? input.importedItKnowledgeTemplateKeys.filter((key) => typeof key === 'string' && Boolean(key.trim()))
    : [];
  const itKnowledgeTemplatesImported = importedTemplateKeys.length > 0;
  const knowledgeBasePrepared = input.hasActiveKnowledgeSources === true || itKnowledgeTemplatesImported;
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
    itKnowledgeTemplatesAvailable: availableTemplateKeys.length > 0,
    itKnowledgeTemplatesImported,
    knowledgeBasePrepared,
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
  if (!checks.ticketConfirmationRequired) warnings.push('Finale Ticket-Bestätigung ist nicht als erforderlich markiert.');

  if (!checks.escalationKeywordsConfigured) warnings.push('Eskalations-Keywords sind leer oder nicht konfiguriert.');
  if (!checks.ticketForwardingConfigured) warnings.push('Ticket-Weiterleitung ist noch nicht konfiguriert.');
  if (!checks.knowledgeBasePrepared) {
    warnings.push('Keine aktiven Wissensquellen oder importierten IT-Templates sind als vorhanden markiert.');
  }

  const status: ItSupportReadinessStatus = missing.length > 0
    ? 'not_ready'
    : warnings.length > 0
      ? 'warning'
      : 'ready';

  return {
    status,
    label: readinessLabel(status),
    summary: readinessSummary(status),
    missing,
    warnings,
    checks,
  };
}

function readinessLabel(status: ItSupportReadinessStatus) {
  switch (status) {
    case 'ready':
      return 'Produktionsbereit';
    case 'warning':
      return 'Fast bereit';
    case 'not_ready':
    default:
      return 'Nicht bereit';
  }
}

function readinessSummary(status: ItSupportReadinessStatus) {
  switch (status) {
    case 'ready':
      return 'Der IT-Support-Agent ist einsatzbereit.';
    case 'warning':
      return 'Der IT-Support-Agent ist nutzbar, aber einige Punkte sollten vor dem Go-live geprüft werden.';
    case 'not_ready':
    default:
      return 'Der IT-Support-Agent ist noch nicht vollständig eingerichtet.';
  }
}
