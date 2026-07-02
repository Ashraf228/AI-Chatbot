type ConversationFlowQuestions = {
  opening?: string;
  context?: string;
  industry?: string;
  urgency?: string;
};

type ConversationFlowInstructions = {
  clarify?: string;
  qualifiedMissingContext?: string;
  qualifiedMissingIndustry?: string;
  qualifiedMissingUrgency?: string;
  qualifiedReady?: string;
  contactReady?: string;
};

type ConversationFlowTriggers = {
  contactIntent?: string[];
  qualifiedNeed?: string[];
  context?: string[];
  industry?: string[];
  urgency?: string[];
};

export const CONVERSATION_FLOW_SIGNALS = [
  'contactIntent',
  'qualifiedNeed',
  'context',
  'industry',
  'urgency',
  'affirmedContactCta',
] as const;

export type ConversationFlowSignal = (typeof CONVERSATION_FLOW_SIGNALS)[number];

export type ConversationFlowState = {
  id?: string;
  label?: string;
  instruction?: string;
  preferredQuestion?: string;
  requires?: ConversationFlowSignal[];
  requiresAny?: ConversationFlowSignal[];
  forbids?: ConversationFlowSignal[];
  matchAny?: string[];
};

export type ConversationFlowConfig = {
  questions?: ConversationFlowQuestions;
  instructions?: ConversationFlowInstructions;
  triggers?: ConversationFlowTriggers;
  states?: ConversationFlowState[];
};

const DEFAULT_FLOW: Required<Omit<ConversationFlowConfig, 'states'>> = {
  questions: {
    opening: 'Worum geht es genau, und was möchtest du erreichen?',
    context: 'Für welchen Kontext oder welches Ziel soll ich das einordnen?',
    industry: 'Für welchen Kontext oder welches Ziel soll ich das einordnen?',
    urgency: 'Welche Priorität oder welchen zeitlichen Rahmen hat das Thema?',
  },
  instructions: {
    clarify:
      'Der Einstieg ist noch allgemein. Gib eine kurze Einordnung und stelle genau eine gezielte Qualifizierungsfrage.',
    qualifiedMissingContext:
      'Der Bedarf ist klar. Gib eine kurze Einordnung und stelle genau eine Rueckfrage zum Kontext oder Ziel. Fuehre danach Richtung Kontakt.',
    qualifiedMissingIndustry:
      'Der Bedarf ist klar. Gib eine kurze Einordnung und stelle genau eine Rueckfrage zum Kontext oder Ziel. Fuehre danach Richtung Kontakt.',
    qualifiedMissingUrgency:
      'Der Bedarf ist klar. Gib eine kurze Einordnung und stelle genau eine Rueckfrage zu Prioritaet, Umfang oder Zeitrahmen. Fuehre danach Richtung Kontakt.',
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
    context: [
      'unternehmen',
      'firma',
      'team',
      'website',
      'shop',
      'produkt',
      'support',
      'vertrieb',
      'beratung',
      'prozess',
      'prozesse',
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

type ResolvedConversationState = {
  id: string;
  label: string;
  instruction: string;
  preferredQuestion?: string;
  requires: ConversationFlowSignal[];
  requiresAny: ConversationFlowSignal[];
  forbids: ConversationFlowSignal[];
  matchPattern?: RegExp;
};

function normalizeString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveString(value: string | undefined, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
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

function normalizeSignalArray(value: unknown) {
  const normalized = normalizeStringArray(value);
  if (!normalized) {
    return undefined;
  }

  const allowedSignals = new Set<string>(CONVERSATION_FLOW_SIGNALS);
  const signals = normalized.filter((entry): entry is ConversationFlowSignal => allowedSignals.has(entry));
  return signals.length > 0 ? signals : undefined;
}

function toRegExp(values: string[]) {
  const escaped = values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
}

function toOptionalRegExp(values?: string[]) {
  if (!values || values.length === 0) {
    return undefined;
  }

  return toRegExp(values);
}

function createDefaultStates(
  questions: Required<ConversationFlowQuestions>,
  instructions: Required<ConversationFlowInstructions>,
): ResolvedConversationState[] {
  return [
    {
      id: 'contact-ready',
      label: 'Kontaktbereit',
      instruction: instructions.contactReady,
      requires: [],
      requiresAny: ['contactIntent', 'affirmedContactCta'],
      forbids: [],
    },
    {
      id: 'qualified-missing-context',
      label: 'Bedarf klar, Kontext fehlt',
      instruction: instructions.qualifiedMissingContext,
      preferredQuestion: questions.context,
      requires: ['qualifiedNeed'],
      requiresAny: [],
      forbids: ['context', 'industry'],
    },
    {
      id: 'qualified-missing-industry',
      label: 'Bedarf klar, Kontext fehlt',
      instruction: instructions.qualifiedMissingIndustry,
      preferredQuestion: questions.context || questions.industry,
      requires: ['qualifiedNeed'],
      requiresAny: [],
      forbids: ['context', 'industry'],
    },
    {
      id: 'qualified-missing-urgency',
      label: 'Bedarf klar, Dringlichkeit fehlt',
      instruction: instructions.qualifiedMissingUrgency,
      preferredQuestion: questions.urgency,
      requires: ['qualifiedNeed'],
      requiresAny: ['context', 'industry'],
      forbids: ['urgency'],
    },
    {
      id: 'qualified-ready',
      label: 'Genug Infos da',
      instruction: instructions.qualifiedReady,
      requires: ['qualifiedNeed', 'urgency'],
      requiresAny: ['context', 'industry'],
      forbids: [],
    },
    {
      id: 'clarify',
      label: 'Einstieg / Klärung',
      instruction: instructions.clarify,
      preferredQuestion: questions.opening,
      requires: [],
      requiresAny: [],
      forbids: [],
    },
  ];
}

function normalizeState(state: Record<string, unknown>, index: number): ConversationFlowState | undefined {
  const normalized: ConversationFlowState = {
    id: normalizeString(state.id) || `state-${index + 1}`,
    label: normalizeString(state.label),
    instruction: normalizeString(state.instruction),
    preferredQuestion: normalizeString(state.preferredQuestion),
    requires: normalizeSignalArray(state.requires),
    requiresAny: normalizeSignalArray(state.requiresAny),
    forbids: normalizeSignalArray(state.forbids),
    matchAny: normalizeStringArray(state.matchAny),
  };

  const hasMeaningfulContent = Boolean(
    normalized.label ||
      normalized.instruction ||
      normalized.preferredQuestion ||
      normalized.requires?.length ||
      normalized.requiresAny?.length ||
      normalized.forbids?.length ||
      normalized.matchAny?.length,
  );

  return hasMeaningfulContent ? normalized : undefined;
}

export function parseConversationFlow(value: unknown): ConversationFlowConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const questions =
    raw.questions && typeof raw.questions === 'object' && !Array.isArray(raw.questions)
      ? (raw.questions as Record<string, unknown>)
      : {};
  const instructions =
    raw.instructions && typeof raw.instructions === 'object' && !Array.isArray(raw.instructions)
      ? (raw.instructions as Record<string, unknown>)
      : {};
  const triggers =
    raw.triggers && typeof raw.triggers === 'object' && !Array.isArray(raw.triggers)
      ? (raw.triggers as Record<string, unknown>)
      : {};
  const states = Array.isArray(raw.states) ? raw.states : [];

  return {
    questions: {
      opening: normalizeString(questions.opening),
      context: normalizeString(questions.context),
      industry: normalizeString(questions.industry),
      urgency: normalizeString(questions.urgency),
    },
    instructions: {
      clarify: normalizeString(instructions.clarify),
      qualifiedMissingContext: normalizeString(instructions.qualifiedMissingContext),
      qualifiedMissingIndustry: normalizeString(instructions.qualifiedMissingIndustry),
      qualifiedMissingUrgency: normalizeString(instructions.qualifiedMissingUrgency),
      qualifiedReady: normalizeString(instructions.qualifiedReady),
      contactReady: normalizeString(instructions.contactReady),
    },
    triggers: {
      contactIntent: normalizeStringArray(triggers.contactIntent),
      qualifiedNeed: normalizeStringArray(triggers.qualifiedNeed),
      context: normalizeStringArray(triggers.context),
      industry: normalizeStringArray(triggers.industry),
      urgency: normalizeStringArray(triggers.urgency),
    },
    states:
      states.length > 0
        ? states
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
            .map(normalizeState)
            .filter((state): state is ConversationFlowState => Boolean(state))
        : undefined,
  };
}

export function resolveConversationFlow(flow?: ConversationFlowConfig | undefined) {
  const questions: Required<ConversationFlowQuestions> = {
    opening: resolveString(flow?.questions?.opening, DEFAULT_FLOW.questions.opening as string),
    context: resolveString(flow?.questions?.context, DEFAULT_FLOW.questions.context as string),
    industry: resolveString(flow?.questions?.industry, DEFAULT_FLOW.questions.industry as string),
    urgency: resolveString(flow?.questions?.urgency, DEFAULT_FLOW.questions.urgency as string),
  };
  const instructions: Required<ConversationFlowInstructions> = {
    clarify: resolveString(flow?.instructions?.clarify, DEFAULT_FLOW.instructions.clarify as string),
    qualifiedMissingContext:
      resolveString(
        flow?.instructions?.qualifiedMissingContext,
        DEFAULT_FLOW.instructions.qualifiedMissingContext as string,
      ),
    qualifiedMissingIndustry:
      resolveString(
        flow?.instructions?.qualifiedMissingIndustry,
        DEFAULT_FLOW.instructions.qualifiedMissingIndustry as string,
      ),
    qualifiedMissingUrgency:
      resolveString(
        flow?.instructions?.qualifiedMissingUrgency,
        DEFAULT_FLOW.instructions.qualifiedMissingUrgency as string,
      ),
    qualifiedReady: resolveString(
      flow?.instructions?.qualifiedReady,
      DEFAULT_FLOW.instructions.qualifiedReady as string,
    ),
    contactReady: resolveString(
      flow?.instructions?.contactReady,
      DEFAULT_FLOW.instructions.contactReady as string,
    ),
  };
  const contactIntent = flow?.triggers?.contactIntent ?? DEFAULT_FLOW.triggers.contactIntent ?? [];
  const qualifiedNeed = flow?.triggers?.qualifiedNeed ?? DEFAULT_FLOW.triggers.qualifiedNeed ?? [];
  const context = flow?.triggers?.context ?? DEFAULT_FLOW.triggers.context ?? [];
  const industry = flow?.triggers?.industry ?? DEFAULT_FLOW.triggers.industry ?? [];
  const urgency = flow?.triggers?.urgency ?? DEFAULT_FLOW.triggers.urgency ?? [];

  const states =
    flow?.states && flow.states.length > 0
      ? flow.states.map((state, index) => ({
          id: state.id || `state-${index + 1}`,
          label: state.label || `Schritt ${index + 1}`,
          instruction: state.instruction || DEFAULT_FLOW.instructions.clarify,
          preferredQuestion: state.preferredQuestion,
          requires: state.requires || [],
          requiresAny: state.requiresAny || [],
          forbids: state.forbids || [],
          matchPattern: toOptionalRegExp(state.matchAny),
        }))
      : createDefaultStates(questions, instructions);

  return {
    questions,
    instructions,
    triggerPatterns: {
      contactIntent: toRegExp(contactIntent),
      qualifiedNeed: toRegExp(qualifiedNeed),
      context: toRegExp(context),
      industry: toRegExp(industry),
      urgency: toRegExp(urgency),
    },
    states,
  };
}
