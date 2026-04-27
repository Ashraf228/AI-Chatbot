type ConversationFlowQuestions = {
  opening?: string;
  industry?: string;
  urgency?: string;
};

type ConversationFlowInstructions = {
  clarify?: string;
  qualifiedMissingIndustry?: string;
  qualifiedMissingUrgency?: string;
  qualifiedReady?: string;
  contactReady?: string;
};

type ConversationFlowTriggers = {
  contactIntent?: string[];
  qualifiedNeed?: string[];
  industry?: string[];
  urgency?: string[];
};

export type ConversationFlowConfig = {
  questions?: ConversationFlowQuestions;
  instructions?: ConversationFlowInstructions;
  triggers?: ConversationFlowTriggers;
};

const DEFAULT_FLOW: Required<ConversationFlowConfig> = {
  questions: {
    opening: 'Geht es bei dir eher um Support, Prozesse, Marketing oder etwas anderes?',
    industry: 'Für welches Unternehmen oder welche Branche ist das gerade gedacht?',
    urgency: 'Wie dringend oder wie groß ist das Thema aktuell bei euch?',
  },
  instructions: {
    clarify:
      'Der Einstieg ist noch allgemein. Gib eine kurze Einordnung und stelle genau eine gezielte Qualifizierungsfrage.',
    qualifiedMissingIndustry:
      'Der Bedarf ist klar. Gib eine kurze Einordnung und stelle genau eine Rueckfrage zur Branche oder zum Unternehmenskontext. Fuehre danach Richtung Kontakt.',
    qualifiedMissingUrgency:
      'Der Bedarf ist klar. Gib eine kurze Einordnung und stelle genau eine Rueckfrage zu Dringlichkeit, Umfang oder Prioritaet. Fuehre danach Richtung Kontakt.',
    qualifiedReady:
      'Der Bedarf ist klar. Gib eine kurze, konkrete Einordnung und fuehre direkt in Richtung Kontakt oder Termin. Stelle keine weitere Qualifizierungsrunde mehr.',
    contactReady:
      'Der Nutzer ist kontaktbereit. Bestaetige kurz und leite direkt zur Kontaktaufnahme weiter. Wiederhole keine allgemeine Auswahlfrage.',
  },
  triggers: {
    contactIntent: [
      'kontakt',
      'anfrage',
      'angebot',
      'termin',
      'rueckruf',
      'rückruf',
      'telefonat',
      'gespraech',
      'gespräch',
      'melden',
    ],
    qualifiedNeed: [
      'support',
      'kunden support',
      'kundenservice',
      'marketing',
      'prozesse',
      'automatisierung',
      'mitarbeiter',
      'entlasten',
      'standardfragen',
      'website',
      'leads',
      'seo',
      'google ads',
      'kosten',
    ],
    industry: [
      'unternehmen',
      'firma',
      'agentur',
      'shop',
      'e-commerce',
      'arzt',
      'kanzlei',
      'restaurant',
      'hotel',
      'handwerk',
      'immobilien',
      'praxis',
      'beratung',
    ],
    urgency: ['sofort', 'dringend', 'zeitnah', 'diese woche', 'heute', 'morgen', 'schnell'],
  },
};

function normalizeString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return normalized.length > 0 ? normalized : undefined;
}

function toRegExp(values: string[]) {
  const escaped = values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
}

export function parseConversationFlow(value: unknown): ConversationFlowConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const questions = raw.questions && typeof raw.questions === 'object' && !Array.isArray(raw.questions)
    ? (raw.questions as Record<string, unknown>)
    : {};
  const instructions =
    raw.instructions && typeof raw.instructions === 'object' && !Array.isArray(raw.instructions)
      ? (raw.instructions as Record<string, unknown>)
      : {};
  const triggers = raw.triggers && typeof raw.triggers === 'object' && !Array.isArray(raw.triggers)
    ? (raw.triggers as Record<string, unknown>)
    : {};

  return {
    questions: {
      opening: normalizeString(questions.opening),
      industry: normalizeString(questions.industry),
      urgency: normalizeString(questions.urgency),
    },
    instructions: {
      clarify: normalizeString(instructions.clarify),
      qualifiedMissingIndustry: normalizeString(instructions.qualifiedMissingIndustry),
      qualifiedMissingUrgency: normalizeString(instructions.qualifiedMissingUrgency),
      qualifiedReady: normalizeString(instructions.qualifiedReady),
      contactReady: normalizeString(instructions.contactReady),
    },
    triggers: {
      contactIntent: normalizeStringArray(triggers.contactIntent),
      qualifiedNeed: normalizeStringArray(triggers.qualifiedNeed),
      industry: normalizeStringArray(triggers.industry),
      urgency: normalizeStringArray(triggers.urgency),
    },
  };
}

export function resolveConversationFlow(flow?: ConversationFlowConfig | undefined) {
  const contactIntent = flow?.triggers?.contactIntent ?? DEFAULT_FLOW.triggers.contactIntent ?? [];
  const qualifiedNeed = flow?.triggers?.qualifiedNeed ?? DEFAULT_FLOW.triggers.qualifiedNeed ?? [];
  const industry = flow?.triggers?.industry ?? DEFAULT_FLOW.triggers.industry ?? [];
  const urgency = flow?.triggers?.urgency ?? DEFAULT_FLOW.triggers.urgency ?? [];

  return {
    questions: {
      opening: flow?.questions?.opening || DEFAULT_FLOW.questions.opening,
      industry: flow?.questions?.industry || DEFAULT_FLOW.questions.industry,
      urgency: flow?.questions?.urgency || DEFAULT_FLOW.questions.urgency,
    },
    instructions: {
      clarify: flow?.instructions?.clarify || DEFAULT_FLOW.instructions.clarify,
      qualifiedMissingIndustry:
        flow?.instructions?.qualifiedMissingIndustry || DEFAULT_FLOW.instructions.qualifiedMissingIndustry,
      qualifiedMissingUrgency:
        flow?.instructions?.qualifiedMissingUrgency || DEFAULT_FLOW.instructions.qualifiedMissingUrgency,
      qualifiedReady: flow?.instructions?.qualifiedReady || DEFAULT_FLOW.instructions.qualifiedReady,
      contactReady: flow?.instructions?.contactReady || DEFAULT_FLOW.instructions.contactReady,
    },
    triggerPatterns: {
      contactIntent: toRegExp(contactIntent),
      qualifiedNeed: toRegExp(qualifiedNeed),
      industry: toRegExp(industry),
      urgency: toRegExp(urgency),
    },
  };
}
