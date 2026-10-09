import {
  DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  LocalServiceIntakeFlowConfig,
} from '../site-modules/module-configs';
import {
  AgentConfig,
  AssistantDeliveryChannels,
  AssistantHandoffRules,
  AssistantProfile,
  AssistantProfileKey,
  AssistantRequiredField,
  ConversationEngineConfig,
} from './assistant-profile.types';

const DEFAULT_ENGINE: ConversationEngineConfig = {
  enabled: true,
  autoDetectIntent: true,
  autoSelectAgent: true,
  askOnlyOneQuestionAtATime: true,
  maxQuestionsBeforeSummary: 5,
  summarizeBeforeHandoff: true,
  handoffWhenUncertain: false,
};

const DEFAULT_HANDOFF_RULES: AssistantHandoffRules = {
  enabled: false,
  requireAllFields: true,
  summarizeBeforeHandoff: true,
  handoffWhenUncertain: false,
};

const DEFAULT_DELIVERY_CHANNELS: AssistantDeliveryChannels = {
  email: { enabled: false },
  webhook: { enabled: false },
};

function field(key: string, label: string, question?: string): AssistantRequiredField {
  return {
    key,
    label,
    required: true,
    question,
  };
}

function agent(input: {
  key: string;
  label: string;
  purpose: string;
  allowedActions: string[];
  requiredFields?: AssistantRequiredField[];
  escalationRules?: string[];
  integrations?: string[];
}): AgentConfig {
  return {
    key: input.key,
    label: input.label,
    purpose: input.purpose,
    enabled: true,
    triggerMode: 'intent',
    allowedActions: input.allowedActions,
    requiredFields: input.requiredFields || [],
    escalationRules: input.escalationRules || [],
    knowledgeScope: 'site',
    integrations: input.integrations || [],
  };
}

function baseProfile(profileKey: AssistantProfileKey, overrides: Partial<AssistantProfile>): AssistantProfile {
  return {
    profileKey,
    profileVersion: 1,
    assistantName: 'Assistent',
    role: 'Digitaler Assistent',
    businessDescription: 'Unterstützt Website-Besucher mit Informationen und strukturierten nächsten Schritten.',
    targetUsers: ['website_visitors'],
    tone: 'professional',
    answerStyle: 'structured',
    knowledgeMode: 'flexible',
    enabledTasks: ['answer_questions'],
    enabledAgents: ['knowledge-agent'],
    requiredFields: [],
    handoffRules: DEFAULT_HANDOFF_RULES,
    deliveryChannels: DEFAULT_DELIVERY_CHANNELS,
    conversationEngine: DEFAULT_ENGINE,
    agents: [
      agent({
        key: 'knowledge-agent',
        label: 'Wissens-Assistent',
        purpose: 'Beantwortet Fragen aus der freigegebenen Wissensbasis.',
        allowedActions: ['query_knowledge'],
      }),
    ],
    legacySource: 'default',
    ...overrides,
  };
}

function localServiceRequiredFields(flow: LocalServiceIntakeFlowConfig) {
  const labels: Record<string, string> = {
    problem: 'Problem oder Anliegen',
    urgency: 'Dringlichkeit',
    fullAddress: 'vollständige Einsatzadresse',
    fullName: 'Vor- und Nachname',
    phone: 'Telefonnummer',
  };

  return flow.questionOrder.map((key) =>
    field(key, labels[key] || key, flow.questionTexts[key] || flow.questionTexts[key === 'fullAddress' ? 'location' : key]),
  );
}

const localServiceFields = localServiceRequiredFields(DEFAULT_LOCAL_SERVICE_INTAKE_FLOW);

const STANDARD_PROFILES: Record<AssistantProfileKey, AssistantProfile> = {
  'universal-assistant': baseProfile('universal-assistant', {
    assistantName: 'Universal-Assistent',
    role: 'Allgemeiner digitaler Assistent',
    answerStyle: 'structured',
    enabledTasks: [
      'answer_questions',
      'collect_context',
      'triage_support',
      'prepare_handoff',
      'recommend_products',
      'schedule_appointments',
    ],
    enabledAgents: [
      'knowledge-agent',
      'support-agent',
      'sales-agent',
      'appointment-agent',
      'product-advisor-agent',
      'handoff-agent',
    ],
    agents: [
      agent({
        key: 'knowledge-agent',
        label: 'Wissens-Assistent',
        purpose: 'Beantwortet Fragen aus der freigegebenen Wissensbasis.',
        allowedActions: ['query_knowledge'],
      }),
      agent({
        key: 'support-agent',
        label: 'Support-Agent',
        purpose: 'Grenzt Supportfälle ein und schlägt nächste Lösungsschritte vor.',
        allowedActions: ['query_knowledge', 'prepare_ticket', 'handoff'],
      }),
      agent({
        key: 'sales-agent',
        label: 'Sales-/Kontakt-Agent',
        purpose: 'Ordnet Preis-, Angebots- und Kontaktanfragen ein.',
        allowedActions: ['query_knowledge', 'prepare_contact'],
      }),
      agent({
        key: 'appointment-agent',
        label: 'Termin-Agent',
        purpose: 'Bereitet Terminwünsche oder Terminübergaben vor.',
        allowedActions: ['prepare_contact', 'schedule_contact'],
      }),
      agent({
        key: 'product-advisor-agent',
        label: 'Produktberater-Agent',
        purpose: 'Unterstützt bei Produkt-, Varianten- und Lösungsauswahl.',
        allowedActions: ['query_knowledge', 'recommend_product'],
      }),
      agent({
        key: 'handoff-agent',
        label: 'Übergabe-Agent',
        purpose: 'Bereitet menschliche Übergaben und Eskalationen vor.',
        allowedActions: ['prepare_handoff'],
        escalationRules: ['complaint', 'urgent_callback', 'uncertain_answer'],
      }),
    ],
  }),
  'knowledge-assistant': baseProfile('knowledge-assistant', {
    assistantName: 'Wissens-Assistent',
    role: 'Quellenbasierter Antwort-Assistent',
    answerStyle: 'knowledge_first',
    knowledgeMode: 'strict',
    enabledTasks: ['answer_questions', 'cite_sources'],
  }),
  'support-assistant': baseProfile('support-assistant', {
    assistantName: 'Support-Assistent',
    role: 'First-Level-Support-Assistent',
    answerStyle: 'guided',
    enabledTasks: ['answer_questions', 'triage_support', 'prepare_handoff'],
    enabledAgents: ['support-agent', 'knowledge-agent'],
    handoffRules: {
      ...DEFAULT_HANDOFF_RULES,
      enabled: true,
      handoffWhenUncertain: true,
      instructions: 'Bei unklaren oder kritischen Fällen an einen Menschen übergeben.',
    },
    agents: [
      agent({
        key: 'support-agent',
        label: 'Support-Agent',
        purpose: 'Grenzt Supportfälle ein und bereitet eine Übergabe vor.',
        allowedActions: ['query_knowledge', 'create_ticket', 'handoff'],
        escalationRules: ['security_incident', 'data_loss', 'account_takeover', 'critical_outage'],
      }),
    ],
  }),
  'sales-assistant': baseProfile('sales-assistant', {
    assistantName: 'Sales-Assistent',
    role: 'Lead-Qualifizierungs-Assistent',
    answerStyle: 'guided',
    enabledTasks: ['qualify_lead', 'capture_contact', 'prepare_handoff'],
    enabledAgents: ['lead-sales-agent', 'knowledge-agent'],
    handoffRules: {
      ...DEFAULT_HANDOFF_RULES,
      enabled: true,
      instructions: 'Nach qualifiziertem Bedarf strukturiert Kontaktdaten erfassen.',
    },
    agents: [
      agent({
        key: 'lead-sales-agent',
        label: 'Lead- & Sales-Agent',
        purpose: 'Qualifiziert Interesse und bereitet Kontaktaufnahme vor.',
        allowedActions: ['query_knowledge', 'capture_lead', 'schedule_contact'],
      }),
    ],
  }),
  'local-service-first-contact': baseProfile('local-service-first-contact', {
    assistantName: 'Handwerker-Erstkontakt',
    role: 'Geführter Erstkontakt für lokale Dienstleister',
    businessDescription:
      'Erfasst Anliegen, Dringlichkeit, vollständige Einsatzadresse, Vor- und Nachname sowie Telefonnummer.',
    targetUsers: ['website_visitors', 'local_service_customers'],
    tone: 'formal',
    answerStyle: 'guided',
    knowledgeMode: 'flexible',
    enabledTasks: ['local_service_intake', 'capture_lead', 'answer_questions', 'prepare_handoff'],
    enabledAgents: ['lead-sales-agent', 'knowledge-agent'],
    requiredFields: localServiceFields,
    handoffRules: {
      enabled: true,
      requireAllFields: true,
      summarizeBeforeHandoff: true,
      handoffWhenUncertain: false,
      instructions: 'Lead erst nach allen Pflichtfeldern speichern und abschließen.',
    },
    deliveryChannels: {
      email: { enabled: false },
      webhook: { enabled: false },
    },
    agents: [
      agent({
        key: 'lead-sales-agent',
        label: 'Lead- & Erstkontakt-Agent',
        purpose: 'Führt lokale Service-Anfragen durch den Pflichtfeld-Intake.',
        allowedActions: ['query_knowledge', 'capture_lead'],
        requiredFields: localServiceFields,
        integrations: ['email'],
      }),
    ],
  }),
};

export function cloneAssistantProfile(profile: AssistantProfile): AssistantProfile {
  return JSON.parse(JSON.stringify(profile)) as AssistantProfile;
}

export function getAssistantProfile(profileKey: AssistantProfileKey | string) {
  const profile = STANDARD_PROFILES[profileKey as AssistantProfileKey];
  return profile ? cloneAssistantProfile(profile) : null;
}

export function listAssistantProfiles() {
  return Object.values(STANDARD_PROFILES).map(cloneAssistantProfile);
}
