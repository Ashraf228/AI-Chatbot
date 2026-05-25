export type LeadSalesModuleConfig = {
  primaryGoal: 'lead_capture' | 'appointment';
  ctaLabel: string;
  ctaDescription: string;
  qualificationFocus: string;
  handoffInstruction: string;
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
