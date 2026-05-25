export type LeadSalesModuleConfig = {
  primaryGoal: 'lead_capture' | 'appointment';
  ctaLabel: string;
  ctaDescription: string;
  qualificationFocus: string;
  handoffInstruction: string;
  intakeFlow?: LocalServiceIntakeFlowConfig;
};

export type LocalServiceIntakeFlowConfig = {
  templateKey?: string;
  subIndustry?: string;
  requiredFields: string[];
  questionOrder: string[];
  genericLocalServiceKeywords: string[];
  preferredVocabulary: string[];
  forbiddenGenericTerms: string[];
  problemKeywords: string[];
  pricingKeywords: string[];
  callbackKeywords: string[];
  questionTexts: Record<string, string>;
  pricingAnswerTemplate: string;
};

export type EcommerceProductAdvisorModuleConfig = {
  catalogMode: 'knowledge_only' | 'shopify_catalog';
  recommendationStyle: 'consultative' | 'direct';
  ctaLabel: string;
  ctaDescription: string;
  productLinkInstruction: string;
  fallbackInstruction: string;
};

export type PropertyTicketingModuleConfig = {
  intakeMode: 'email_handoff' | 'ticket_system';
  urgencyStyle: 'structured' | 'brief';
  ctaLabel: string;
  ctaDescription: string;
  incidentInstruction: string;
  handoffInstruction: string;
};

export const DEFAULT_LEAD_SALES_MODULE_CONFIG: LeadSalesModuleConfig = {
  primaryGoal: 'lead_capture',
  ctaLabel: 'Kontaktdaten hinterlassen',
  ctaDescription: 'Wir melden uns schnellstmoeglich mit den naechsten Schritten.',
  qualificationFocus:
    'Verstehe Bedarf, Einsatzbereich und Dringlichkeit in wenigen Rueckfragen.',
  handoffInstruction:
    'Fuehre sichtbar Richtung Kontakt, Termin oder strukturierte Datenerfassung, sobald der Bedarf klar ist.',
};

export const DEFAULT_LOCAL_SERVICE_INTAKE_FLOW: LocalServiceIntakeFlowConfig = {
  templateKey: 'local-services',
  subIndustry: 'drain_cleaning',
  requiredFields: ['problem', 'location', 'urgency', 'phone', 'name'],
  questionOrder: ['problem', 'location', 'urgency', 'phone', 'name'],
  genericLocalServiceKeywords: [
    'notdienst',
    'einsatz',
    'einsatzort',
    'rückruf',
    'rueckruf',
    'kosten',
    'preis',
    'dringend',
    'heute',
    'morgen',
    'termin',
  ],
  preferredVocabulary: ['Einsatz', 'Problem', 'Einsatzort', 'Dringlichkeit', 'Rückruf', 'Notdienst'],
  forbiddenGenericTerms: ['Projekt', 'Support-Anfrage', 'Business-Prozess', 'Automatisierung', 'Beratungsgespräch'],
  problemKeywords: [
    'toilette',
    'wc',
    'abfluss',
    'rohrreinigung',
    'kanalreinigung',
    'rohr',
    'rückstau',
    'rueckstau',
    'keller',
    'kanal',
    'rohrbruch',
    'verstopft',
    'wasser läuft nicht ab',
    'wasser laeuft nicht ab',
    'überflutet',
    'ueberflutet',
  ],
  pricingKeywords: [
    'laufende meter',
    'laufenden metern',
    'meter',
    'abrechnung',
    'abrechnen',
    'kosten',
    'preis',
    'rohrreinigung kostet',
  ],
  callbackKeywords: ['rückruf', 'rueckruf', 'zurückrufen', 'zurueckrufen', 'anrufen', 'kontaktiert werden'],
  questionTexts: {
    problem: 'Was genau ist betroffen - Toilette, Abfluss, Keller oder Kanal?',
    location: 'In welchem Ort oder welcher PLZ befindet sich der Einsatzort?',
    urgency: 'Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?',
    phone: 'Unter welcher Telefonnummer kann der Notdienst Sie zurückrufen?',
    name: 'Auf welchen Namen dürfen wir die Anfrage aufnehmen?',
    callback: 'Gerne. Geht es um einen akuten Notfall oder um eine allgemeine Anfrage?',
  },
  pricingAnswerTemplate:
    'Die Kosten hängen vom Aufwand, der Verstopfung und den benötigten laufenden Metern ab. Eine genaue Einschätzung ist nach kurzer Problembeschreibung möglich.',
};

export const DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG: EcommerceProductAdvisorModuleConfig =
  {
    catalogMode: 'knowledge_only',
    recommendationStyle: 'consultative',
    ctaLabel: 'Produktberatung anfragen',
    ctaDescription: 'Wir helfen bei Auswahl, Sortiment oder der passenden naechsten Empfehlung.',
    productLinkInstruction:
      'Verweise auf konkrete Produkte, Kategorien oder Kollektionen, sobald verifizierbare Links oder Daten verfuegbar sind.',
    fallbackInstruction:
      'Wenn konkrete Produktdaten fehlen, bleibe transparent, stelle eine kurze Rueckfrage und fuehre bei Bedarf in eine persoenliche Beratung.',
  };

export const DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG: PropertyTicketingModuleConfig = {
  intakeMode: 'email_handoff',
  urgencyStyle: 'structured',
  ctaLabel: 'Supportfall aufnehmen',
  ctaDescription: 'Wir erfassen den Fall und leiten ihn an das zustaendige Team weiter.',
  incidentInstruction:
    'Klaere betroffenes System oder Geraet, Fehlerbild, Zeitpunkt, Dringlichkeit und Auswirkungen in einer klaren Reihenfolge.',
  handoffInstruction:
    'Fuehre nach einer kurzen Qualifizierung sichtbar in die Fallaufnahme oder Weiterleitung. Frage niemals nach Passwoertern, MFA-Codes oder Admin-Zugangsdaten.',
};

function asObject(config: Record<string, unknown> | null | undefined) {
  return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
}

function asNonEmptyString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
        .map((entry) => entry.trim())
    : fallback;
}

function normalizeQuestionTexts(value: unknown, fallback: Record<string, string>) {
  const source = asObject(value as Record<string, unknown> | null | undefined);
  return {
    ...fallback,
    ...Object.fromEntries(
      Object.entries(source).filter(([, entry]) => typeof entry === 'string' && entry.trim()),
    ),
  } as Record<string, string>;
}

export function normalizeLocalServiceIntakeFlowConfig(value: unknown): LocalServiceIntakeFlowConfig {
  const source = asObject(value as Record<string, unknown> | null | undefined);
  const fallback = DEFAULT_LOCAL_SERVICE_INTAKE_FLOW;

  return {
    templateKey: asNonEmptyString(source.templateKey, fallback.templateKey || 'local-services'),
    subIndustry: asNonEmptyString(source.subIndustry, fallback.subIndustry || 'drain_cleaning'),
    requiredFields: asStringArray(source.requiredFields, fallback.requiredFields),
    questionOrder: asStringArray(source.questionOrder, fallback.questionOrder),
    genericLocalServiceKeywords: asStringArray(
      source.genericLocalServiceKeywords,
      fallback.genericLocalServiceKeywords,
    ),
    preferredVocabulary: asStringArray(source.preferredVocabulary, fallback.preferredVocabulary),
    forbiddenGenericTerms: asStringArray(source.forbiddenGenericTerms, fallback.forbiddenGenericTerms),
    problemKeywords: asStringArray(source.problemKeywords, fallback.problemKeywords),
    pricingKeywords: asStringArray(source.pricingKeywords, fallback.pricingKeywords),
    callbackKeywords: asStringArray(source.callbackKeywords, fallback.callbackKeywords),
    questionTexts: normalizeQuestionTexts(source.questionTexts, fallback.questionTexts),
    pricingAnswerTemplate: asNonEmptyString(source.pricingAnswerTemplate, fallback.pricingAnswerTemplate),
  };
}

export function normalizeLeadSalesModuleConfig(
  config: Record<string, unknown> | null | undefined,
): LeadSalesModuleConfig {
  const source = asObject(config);
  const primaryGoal =
    source.primaryGoal === 'appointment' ? 'appointment' : DEFAULT_LEAD_SALES_MODULE_CONFIG.primaryGoal;

  return {
    primaryGoal,
    ctaLabel: asNonEmptyString(source.ctaLabel, DEFAULT_LEAD_SALES_MODULE_CONFIG.ctaLabel),
    ctaDescription: asNonEmptyString(
      source.ctaDescription,
      DEFAULT_LEAD_SALES_MODULE_CONFIG.ctaDescription,
    ),
    qualificationFocus: asNonEmptyString(
      source.qualificationFocus,
      DEFAULT_LEAD_SALES_MODULE_CONFIG.qualificationFocus,
    ),
    handoffInstruction: asNonEmptyString(
      source.handoffInstruction,
      DEFAULT_LEAD_SALES_MODULE_CONFIG.handoffInstruction,
    ),
    intakeFlow: source.intakeFlow
      ? normalizeLocalServiceIntakeFlowConfig(source.intakeFlow)
      : undefined,
  };
}

export function normalizeEcommerceProductAdvisorModuleConfig(
  config: Record<string, unknown> | null | undefined,
): EcommerceProductAdvisorModuleConfig {
  const source = asObject(config);
  const catalogMode =
    source.catalogMode === 'shopify_catalog' || source.source === 'shopify'
      ? 'shopify_catalog'
      : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG.catalogMode;
  const recommendationStyle =
    source.recommendationStyle === 'direct'
      ? 'direct'
      : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG.recommendationStyle;

  return {
    catalogMode,
    recommendationStyle,
    ctaLabel: asNonEmptyString(
      source.ctaLabel,
      DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG.ctaLabel,
    ),
    ctaDescription: asNonEmptyString(
      source.ctaDescription,
      DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG.ctaDescription,
    ),
    productLinkInstruction: asNonEmptyString(
      source.productLinkInstruction,
      DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG.productLinkInstruction,
    ),
    fallbackInstruction: asNonEmptyString(
      source.fallbackInstruction,
      DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG.fallbackInstruction,
    ),
  };
}

export function normalizePropertyTicketingModuleConfig(
  config: Record<string, unknown> | null | undefined,
): PropertyTicketingModuleConfig {
  const source = asObject(config);
  const intakeMode =
    source.intakeMode === 'ticket_system'
      ? 'ticket_system'
      : DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG.intakeMode;
  const urgencyStyle =
    source.urgencyStyle === 'brief'
      ? 'brief'
      : DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG.urgencyStyle;

  return {
    intakeMode,
    urgencyStyle,
    ctaLabel: asNonEmptyString(
      source.ctaLabel,
      DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG.ctaLabel,
    ),
    ctaDescription: asNonEmptyString(
      source.ctaDescription,
      DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG.ctaDescription,
    ),
    incidentInstruction: asNonEmptyString(
      source.incidentInstruction,
      DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG.incidentInstruction,
    ),
    handoffInstruction: asNonEmptyString(
      source.handoffInstruction,
      DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG.handoffInstruction,
    ),
  };
}

export function normalizeModuleConfig(
  moduleKey: string,
  config: Record<string, unknown> | null | undefined,
) {
  if (moduleKey === 'lead-sales') {
    return normalizeLeadSalesModuleConfig(config);
  }

  if (moduleKey === 'ecommerce-product-advisor') {
    return normalizeEcommerceProductAdvisorModuleConfig(config);
  }

  if (moduleKey === 'property-ticketing') {
    return normalizePropertyTicketingModuleConfig(config);
  }

  return asObject(config);
}
