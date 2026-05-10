export type ToolDefinition = {
  key: string;
  label: string;
  description: string;
  category: 'lead' | 'commerce' | 'support' | 'automation' | 'knowledge' | 'service';
};

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    key: 'capture_lead',
    label: 'Lead erfassen',
    description: 'Nimmt Kontaktdaten strukturiert auf und uebergibt sie an den Lead-Flow.',
    category: 'lead',
  },
  {
    key: 'schedule_contact',
    label: 'Kontaktwunsch vormerken',
    description: 'Merkt Rueckruf- oder Kontaktwuensche fuer spaetere Folgeaktionen vor.',
    category: 'lead',
  },
  {
    key: 'search_catalog',
    label: 'Produktkatalog durchsuchen',
    description: 'Sucht spaeter in Produkt- oder Katalogdaten, etwa fuer Shopify-Shops.',
    category: 'commerce',
  },
  {
    key: 'create_ticket',
    label: 'Ticket anlegen',
    description: 'Bereitet spaetere Schadensmeldungen oder Supporttickets strukturiert vor.',
    category: 'support',
  },
  {
    key: 'push_webhook',
    label: 'Webhook ausloesen',
    description: 'Leitet strukturierte Daten spaeter an CRM-, Ticket- oder Automationssysteme weiter.',
    category: 'automation',
  },
  {
    key: 'query_knowledge',
    label: 'Wissensquelle durchsuchen',
    description: 'Nutzt spaeter FAQ-, PDF- oder externe Wissensquellen als Tool-Aufruf.',
    category: 'knowledge',
  },
  {
    key: 'recommend_service',
    label: 'Service empfehlen',
    description: 'Bereitet eine strukturierte Service-Empfehlung anhand Intent und Kontext vor.',
    category: 'service',
  },
  {
    key: 'handoff',
    label: 'Menschliche Uebergabe vorbereiten',
    description: 'Markiert ein Gespraech fuer menschliche Nachbearbeitung.',
    category: 'support',
  },
];

export function getToolDefinition(key: string) {
  return TOOL_REGISTRY.find((tool) => tool.key === key) || null;
}
