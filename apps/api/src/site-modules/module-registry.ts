import {
  DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG,
  DEFAULT_IT_SUPPORT_MODULE_CONFIG,
  DEFAULT_LEAD_SALES_MODULE_CONFIG,
  DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG,
} from './module-configs';

export type SiteModuleDefinition = {
  key: string;
  label: string;
  description: string;
  category: 'sales' | 'support' | 'commerce' | 'operations';
  defaultEnabled?: boolean;
  defaultConfig: Record<string, unknown>;
  requiredFields: string[];
  optionalFields: string[];
};

export const SITE_MODULE_REGISTRY: SiteModuleDefinition[] = [
  {
    key: 'lead-sales',
    label: 'Lead- & Sales-Agent',
    description: 'Qualifiziert Interessenten, fuehrt Richtung Kontakt und unterstuetzt bei Beratungsgespraechen.',
    category: 'sales',
    defaultEnabled: true,
    defaultConfig: DEFAULT_LEAD_SALES_MODULE_CONFIG,
    requiredFields: [],
    optionalFields: [
      'primaryGoal',
      'ctaLabel',
      'ctaDescription',
      'qualificationFocus',
      'handoffInstruction',
    ],
  },
  {
    key: 'knowledge-faq',
    label: 'FAQ- & Wissensmodul',
    description: 'Nutzt FAQs, PDFs und weitere Wissensinhalte als Grundlage fuer Antworten.',
    category: 'support',
    defaultEnabled: true,
    defaultConfig: {},
    requiredFields: [],
    optionalFields: [],
  },
  {
    key: 'ecommerce-product-advisor',
    label: 'E-Commerce Produktberater',
    description: 'Bereitet den spaeteren Produktberater fuer Shops, Produktempfehlungen und Produktlinks vor.',
    category: 'commerce',
    defaultConfig: DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG,
    requiredFields: [],
    optionalFields: [
      'catalogMode',
      'recommendationStyle',
      'ctaLabel',
      'ctaDescription',
      'productLinkInstruction',
      'fallbackInstruction',
    ],
  },
  {
    key: 'property-ticketing',
    label: 'Immobilien- & Ticket-Agent',
    description: 'Bereitet Schadensmeldungen, Mieter-Support und Ticket-Weiterleitungen vor.',
    category: 'operations',
    defaultConfig: DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG,
    requiredFields: [],
    optionalFields: [
      'intakeMode',
      'urgencyStyle',
      'ctaLabel',
      'ctaDescription',
      'incidentInstruction',
      'handoffInstruction',
    ],
  },
  {
    key: 'it-support',
    label: 'IT-Support-Agent',
    description: 'Beantwortet IT-Support-Fragen, triagiert Störungen und bereitet strukturierte Support-Tickets vor.',
    category: 'support',
    defaultEnabled: false,
    defaultConfig: DEFAULT_IT_SUPPORT_MODULE_CONFIG,
    requiredFields: [],
    optionalFields: [
      'intakeMode',
      'ticketConfirmationRequired',
      'maxTroubleshootingSteps',
      'urgencyStyle',
      'ctaLabel',
      'ctaDescription',
      'requiredTicketFields',
      'escalationKeywords',
      'safeTroubleshootingInstruction',
      'handoffInstruction',
    ],
  },
  {
    key: 'reporting-insights',
    label: 'Berichte & Insights',
    description: 'Stellt kundenbezogene Berichte, Reports und spaetere modulare Auswertungen bereit.',
    category: 'operations',
    defaultEnabled: true,
    defaultConfig: {},
    requiredFields: [],
    optionalFields: [],
  },
];

export function getSiteModuleDefinition(key: string) {
  return SITE_MODULE_REGISTRY.find((module) => module.key === key) || null;
}

export function listSiteModuleCatalog() {
  return SITE_MODULE_REGISTRY.map((module) => ({
    key: module.key,
    label: module.label,
    description: module.description,
    category: module.category,
    defaultEnabled: Boolean(module.defaultEnabled),
    defaultConfig: module.defaultConfig,
    requiredFields: module.requiredFields,
    optionalFields: module.optionalFields,
  }));
}
