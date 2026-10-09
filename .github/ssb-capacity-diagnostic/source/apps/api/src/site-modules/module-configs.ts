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

export type ItSupportModuleConfig = {
  supportProfile: 'it' | 'product';
  intakeMode: 'knowledge_first' | 'ticket_first';
  ticketConfirmationRequired: boolean;
  maxTroubleshootingSteps: number;
  maximumTroubleshootingSteps: number;
  urgencyStyle: 'brief' | 'structured';
  ctaLabel: string;
  ctaDescription: string;
  requiredFields: string[];
  requiredTicketFields: string[];
  escalationKeywords: string[];
  requireExplicitConfirmation: boolean;
  allowExternalForwarding: boolean;
  collectContactFromAuthenticatedAccount: boolean;
  syntheticOrganizationLabel: string;
  urgentEscalationCategories: string[];
  safeTroubleshootingInstruction: string;
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
  requiredFields: ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'],
  questionOrder: ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'],
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
    location: 'Okay, wir kümmern uns darum. Bitte nennen Sie uns die vollständige Einsatzadresse mit Straße, Hausnummer, PLZ und Ort.',
    fullAddress: 'Okay, wir kümmern uns darum. Bitte nennen Sie uns die vollständige Einsatzadresse mit Straße, Hausnummer, PLZ und Ort.',
    urgency: 'Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?',
    phone: 'Unter welcher Telefonnummer kann der Notdienst Sie zurückrufen?',
    name: 'Danke. Auf welchen Vor- und Nachnamen dürfen wir die Anfrage aufnehmen?',
    fullName: 'Danke. Auf welchen Vor- und Nachnamen dürfen wir die Anfrage aufnehmen?',
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

export const DEFAULT_IT_SUPPORT_MODULE_CONFIG: ItSupportModuleConfig = {
  supportProfile: 'it',
  intakeMode: 'knowledge_first',
  ticketConfirmationRequired: true,
  maxTroubleshootingSteps: 2,
  maximumTroubleshootingSteps: 2,
  urgencyStyle: 'structured',
  ctaLabel: 'Support-Ticket öffnen',
  ctaDescription: 'Ich erfasse das Problem und leite es an den IT-Support weiter.',
  requiredFields: [
    'description',
    'affectedSystem',
    'impact',
    'reporterEmail',
  ],
  requiredTicketFields: [
    'description',
    'affectedSystem',
    'impact',
    'reporterEmail',
  ],
  escalationKeywords: [
    'datenverlust',
    'sicherheitsvorfall',
    'phishing',
    'malware',
    'ransomware',
    'serverausfall',
    'netzwerkausfall',
    'komplett down',
    'mfa gesperrt',
    '2fa gesperrt',
    'konto gesperrt',
    'login blockiert',
  ],
  requireExplicitConfirmation: true,
  allowExternalForwarding: true,
  collectContactFromAuthenticatedAccount: false,
  syntheticOrganizationLabel: '',
  urgentEscalationCategories: [
    'datenverlust',
    'sicherheitsvorfall',
    'unberechtigter zugriff',
    'ausfall',
    'kritisch',
  ],
  safeTroubleshootingInstruction:
    'Gib nur sichere First-Level-Schritte aus. Frage niemals nach Passwörtern, MFA-Codes, API-Keys oder Admin-Zugangsdaten. Gib keine riskanten PowerShell-, Terminal-, Registry- oder Löschbefehle ohne verifizierte Wissensbasis.',
  handoffInstruction:
    'Bei Sicherheitsvorfällen, Datenverlust, Komplettausfällen, Kontoübernahme oder unklaren Risiken immer Ticket oder menschliche Übergabe anbieten.',
};

export const IT_SUPPORT_ALLOWED_REQUIRED_TICKET_FIELDS = [
  'description',
  'affectedSystem',
  'product',
  'module',
  'customerOrganization',
  'customerReference',
  'processOrFormName',
  'impact',
  'reporterEmail',
  'reporterPhone',
  'reporterName',
  'device',
  'operatingSystem',
  'errorMessage',
  'alreadyTried',
  'department',
  'location',
] as const;

function asObject(config: Record<string, unknown> | null | undefined) {
  return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
}

function asNonEmptyString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const entries = value
    .filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    .map((entry) => entry.trim());

  return entries.length > 0 ? entries : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asClampedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(parsed, max));
}

function dedupeStringArray(entries: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of entries) {
    const normalized = entry.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function normalizeItSupportRequiredTicketFields(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_IT_SUPPORT_MODULE_CONFIG.requiredTicketFields;
  }

  const allowed = new Set<string>(IT_SUPPORT_ALLOWED_REQUIRED_TICKET_FIELDS);
  const normalized = dedupeStringArray(
    value.filter((entry): entry is string => typeof entry === 'string'),
  ).filter((entry) => allowed.has(entry));

  return normalized.length > 0
    ? normalized
    : DEFAULT_IT_SUPPORT_MODULE_CONFIG.requiredTicketFields;
}

function normalizeEscalationKeywords(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_IT_SUPPORT_MODULE_CONFIG.escalationKeywords;
  }

  const normalized = dedupeStringArray(
    value.filter((entry): entry is string => typeof entry === 'string'),
  );

  return normalized.length > 0
    ? normalized
    : DEFAULT_IT_SUPPORT_MODULE_CONFIG.escalationKeywords;
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

export function normalizeItSupportModuleConfig(
  config: Record<string, unknown> | null | undefined,
): ItSupportModuleConfig {
  const source = asObject(config);
  const supportProfile = source.supportProfile === 'product' ? 'product' : DEFAULT_IT_SUPPORT_MODULE_CONFIG.supportProfile;
  const intakeMode =
    source.intakeMode === 'ticket_first'
      ? 'ticket_first'
      : DEFAULT_IT_SUPPORT_MODULE_CONFIG.intakeMode;
  const urgencyStyle =
    source.urgencyStyle === 'brief'
      ? 'brief'
      : DEFAULT_IT_SUPPORT_MODULE_CONFIG.urgencyStyle;

  const requiredTicketFields = normalizeItSupportRequiredTicketFields(source.requiredTicketFields || source.requiredFields);
  const maxTroubleshootingSteps = asClampedInteger(
    source.maxTroubleshootingSteps ?? source.maximumTroubleshootingSteps,
    DEFAULT_IT_SUPPORT_MODULE_CONFIG.maxTroubleshootingSteps,
    1,
    5,
  );
  const escalationKeywords = normalizeEscalationKeywords(source.escalationKeywords);

  return {
    supportProfile,
    intakeMode,
    ticketConfirmationRequired: source.ticketConfirmationRequired === false
      ? true
      : asBoolean(
          source.ticketConfirmationRequired,
          DEFAULT_IT_SUPPORT_MODULE_CONFIG.ticketConfirmationRequired,
        ),
    maxTroubleshootingSteps,
    maximumTroubleshootingSteps: maxTroubleshootingSteps,
    urgencyStyle,
    ctaLabel: asNonEmptyString(source.ctaLabel, DEFAULT_IT_SUPPORT_MODULE_CONFIG.ctaLabel),
    ctaDescription: asNonEmptyString(
      source.ctaDescription,
      DEFAULT_IT_SUPPORT_MODULE_CONFIG.ctaDescription,
    ),
    requiredFields: requiredTicketFields,
    requiredTicketFields,
    escalationKeywords,
    requireExplicitConfirmation: source.requireExplicitConfirmation === false
      ? false
      : DEFAULT_IT_SUPPORT_MODULE_CONFIG.requireExplicitConfirmation,
    allowExternalForwarding: asBoolean(
      source.allowExternalForwarding,
      DEFAULT_IT_SUPPORT_MODULE_CONFIG.allowExternalForwarding,
    ),
    collectContactFromAuthenticatedAccount: asBoolean(
      source.collectContactFromAuthenticatedAccount,
      DEFAULT_IT_SUPPORT_MODULE_CONFIG.collectContactFromAuthenticatedAccount,
    ),
    syntheticOrganizationLabel: asNonEmptyString(
      source.syntheticOrganizationLabel,
      DEFAULT_IT_SUPPORT_MODULE_CONFIG.syntheticOrganizationLabel,
    ),
    urgentEscalationCategories: dedupeStringArray(asStringArray(
      source.urgentEscalationCategories,
      DEFAULT_IT_SUPPORT_MODULE_CONFIG.urgentEscalationCategories,
    )),
    safeTroubleshootingInstruction: asNonEmptyString(
      source.safeTroubleshootingInstruction,
      DEFAULT_IT_SUPPORT_MODULE_CONFIG.safeTroubleshootingInstruction,
    ),
    handoffInstruction: asNonEmptyString(
      source.handoffInstruction,
      DEFAULT_IT_SUPPORT_MODULE_CONFIG.handoffInstruction,
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

  if (moduleKey === 'it-support') {
    return normalizeItSupportModuleConfig(config);
  }

  return asObject(config);
}
