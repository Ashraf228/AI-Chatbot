export type SiteModuleDefinition = {
  key: string;
  label: string;
  description: string;
  category: 'sales' | 'support' | 'commerce' | 'operations';
  defaultEnabled?: boolean;
};

export const SITE_MODULE_REGISTRY: SiteModuleDefinition[] = [
  {
    key: 'lead-sales',
    label: 'Lead- & Sales-Agent',
    description: 'Qualifiziert Interessenten, fuehrt Richtung Kontakt und unterstuetzt bei Beratungsgespraechen.',
    category: 'sales',
    defaultEnabled: true,
  },
  {
    key: 'knowledge-faq',
    label: 'FAQ- & Wissensmodul',
    description: 'Nutzt FAQs, PDFs und weitere Wissensinhalte als Grundlage fuer Antworten.',
    category: 'support',
    defaultEnabled: true,
  },
  {
    key: 'ecommerce-product-advisor',
    label: 'E-Commerce Produktberater',
    description: 'Bereitet den spaeteren Produktberater fuer Shops, Produktempfehlungen und Produktlinks vor.',
    category: 'commerce',
  },
  {
    key: 'property-ticketing',
    label: 'Immobilien- & Ticket-Agent',
    description: 'Bereitet Schadensmeldungen, Mieter-Support und Ticket-Weiterleitungen vor.',
    category: 'operations',
  },
  {
    key: 'reporting-insights',
    label: 'Berichte & Insights',
    description: 'Stellt kundenbezogene Berichte, Reports und spaetere modulare Auswertungen bereit.',
    category: 'operations',
    defaultEnabled: true,
  },
];

export function getSiteModuleDefinition(key: string) {
  return SITE_MODULE_REGISTRY.find((module) => module.key === key) || null;
}
