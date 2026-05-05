export type SiteModulePatch = {
  key: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
};

export type IndustryTemplate = {
  key: string;
  label: string;
  setupGoal: 'lead_capture' | 'support' | 'product_advice' | 'appointments';
  welcomeMessage: string;
  systemPrompt: string;
  recommendedQuestions: Record<string, string[]>;
  modules: SiteModulePatch[];
};

function baseModules(overrides: Partial<Record<string, SiteModulePatch>>) {
  const defaults: Record<string, SiteModulePatch> = {
    'lead-sales': { key: 'lead-sales', isEnabled: true },
    'knowledge-faq': { key: 'knowledge-faq', isEnabled: true },
    'ecommerce-product-advisor': { key: 'ecommerce-product-advisor', isEnabled: false },
    'property-ticketing': { key: 'property-ticketing', isEnabled: false },
    'reporting-insights': { key: 'reporting-insights', isEnabled: true },
  };

  return Object.entries(defaults).map(([key, value]) => overrides[key] ?? value);
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  'local-services': {
    key: 'local-services',
    label: 'Lokaler Dienstleister',
    setupGoal: 'lead_capture',
    welcomeMessage: 'Hi! Wie kann ich dir rund um unser Angebot weiterhelfen?',
    systemPrompt:
      'Führe kurze Beratungsgespräche für lokale Dienstleister. Kläre Bedarf, Einsatzort und Dringlichkeit und leite dann sichtbar Richtung Kontakt oder Termin.',
    recommendedQuestions: {
      '/': [
        'Worum geht es bei deinem Anliegen?',
        'Geht es um ein neues Projekt, Support oder eine konkrete Anfrage?',
      ],
    },
    modules: baseModules({}),
  },
  'ecommerce-shopify': {
    key: 'ecommerce-shopify',
    label: 'E-Commerce / Shopify',
    setupGoal: 'product_advice',
    welcomeMessage: 'Hi! Ich helfe dir bei der Produktauswahl und den nächsten Schritten im Shop.',
    systemPrompt:
      'Berate Nutzer bei der Produktauswahl, stelle kurze Rückfragen zu Bedarf, Größe oder Budget und verweise transparent auf passende Produkte oder Kategorien.',
    recommendedQuestions: {
      '/': [
        'Suchst du etwas Bestimmtes oder brauchst du erst eine Empfehlung?',
        'Soll ich dir passende Produkte nach Einsatzbereich oder Budget zeigen?',
      ],
    },
    modules: baseModules({
      'ecommerce-product-advisor': {
        key: 'ecommerce-product-advisor',
        isEnabled: true,
        config: {
          catalogMode: 'shopify_catalog',
          recommendationStyle: 'consultative',
        },
      },
    }),
  },
  'property-management': {
    key: 'property-management',
    label: 'Immobilienverwaltung',
    setupGoal: 'support',
    welcomeMessage: 'Hi! Ich unterstütze bei Anliegen, Rückfragen und Schadensmeldungen.',
    systemPrompt:
      'Hilf bei Mieteranliegen, strukturiere Schadensmeldungen und leite bei klaren Fällen in die Fallaufnahme oder Weiterleitung über.',
    recommendedQuestions: {
      '/': [
        'Geht es um eine allgemeine Frage oder um einen konkreten Schaden?',
        'Soll ich zuerst das Anliegen klären oder direkt die Schadensmeldung aufnehmen?',
      ],
    },
    modules: baseModules({
      'lead-sales': { key: 'lead-sales', isEnabled: false },
      'property-ticketing': {
        key: 'property-ticketing',
        isEnabled: true,
        config: {
          intakeMode: 'email_handoff',
          urgencyStyle: 'structured',
        },
      },
    }),
  },
  'it-support': {
    key: 'it-support',
    label: 'IT-Support',
    setupGoal: 'support',
    welcomeMessage: 'Hi! Ich helfe dir bei Support-Fragen und der ersten Einordnung des Problems.',
    systemPrompt:
      'Ordne Support-Fälle sauber ein, unterscheide zwischen Rückfrage und Störung und leite bei Bedarf in eine strukturierte Kontaktaufnahme weiter.',
    recommendedQuestions: {
      '/': [
        'Geht es um eine Störung, eine Rückfrage oder eine neue Anfrage?',
        'Soll ich zuerst das Problem eingrenzen oder direkt einen Rückruf vorbereiten?',
      ],
    },
    modules: baseModules({}),
  },
  'medical-practice': {
    key: 'medical-practice',
    label: 'Arztpraxis',
    setupGoal: 'appointments',
    welcomeMessage: 'Hi! Ich helfe bei allgemeinen Fragen und der Vorbereitung von Terminanfragen.',
    systemPrompt:
      'Beantworte allgemeine Praxisfragen knapp, weise bei sensiblen Themen transparent auf direkte Kontaktwege hin und führe bei passenden Fällen Richtung Terminanfrage.',
    recommendedQuestions: {
      '/': [
        'Geht es um allgemeine Informationen oder um eine Terminanfrage?',
        'Soll ich dir zuerst mit einer Frage helfen oder direkt die Terminanfrage vorbereiten?',
      ],
    },
    modules: baseModules({
      'lead-sales': {
        key: 'lead-sales',
        isEnabled: true,
        config: {
          primaryGoal: 'appointment',
        },
      },
    }),
  },
  'fitness-studio': {
    key: 'fitness-studio',
    label: 'Fitnessstudio',
    setupGoal: 'lead_capture',
    welcomeMessage: 'Hi! Ich helfe dir bei Fragen zu Training, Mitgliedschaft und dem nächsten Schritt.',
    systemPrompt:
      'Führe Interessenten kurz durch Angebote, Ziele und Mitgliedschaftsfragen und leite sichtbar in Probetraining oder Kontaktanfrage.',
    recommendedQuestions: {
      '/': [
        'Geht es um Mitgliedschaft, Probetraining oder eine allgemeine Frage?',
        'Soll ich dir zuerst passende Optionen zeigen oder direkt den nächsten Schritt vorbereiten?',
      ],
    },
    modules: baseModules({}),
  },
  'cleaning-trades': {
    key: 'cleaning-trades',
    label: 'Reinigung / Handwerk',
    setupGoal: 'lead_capture',
    welcomeMessage: 'Hi! Ich helfe dir bei der ersten Einordnung deiner Anfrage und dem nächsten Schritt.',
    systemPrompt:
      'Kläre Einsatzort, Anliegen und Dringlichkeit, fasse knapp zusammen und leite dann Richtung Kontakt oder Rückruf.',
    recommendedQuestions: {
      '/': [
        'Geht es um eine neue Anfrage, ein laufendes Projekt oder eine Rückfrage?',
        'Soll ich zuerst das Anliegen und den Einsatzort eingrenzen?',
      ],
    },
    modules: baseModules({}),
  },
};

export function listIndustryTemplates() {
  return Object.values(INDUSTRY_TEMPLATES);
}

export function getIndustryTemplate(key: string) {
  return INDUSTRY_TEMPLATES[key] || null;
}
