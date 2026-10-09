export type AgentDefinition = {
  key: string;
  label: string;
  description: string;
  category: 'sales' | 'commerce' | 'support';
  requiredModuleKeys: string[];
  toolKeys: string[];
  defaultToolPlan: string[];
};

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    key: 'lead-sales-agent',
    label: 'Lead- & Sales-Agent',
    description: 'Fuehrt Interessenten durch Beratungsgespraeche und leitet sie Richtung Kontakt oder Termin.',
    category: 'sales',
    requiredModuleKeys: ['lead-sales', 'knowledge-faq'],
    toolKeys: ['capture_lead', 'schedule_contact', 'query_knowledge'],
    defaultToolPlan: ['query_knowledge', 'capture_lead', 'schedule_contact'],
  },
  {
    key: 'ecommerce-product-advisor',
    label: 'E-Commerce Produktberater',
    description: 'Bereitet Produktempfehlungen, Shop-Beratung und spaetere Produktlinks im Chat vor.',
    category: 'commerce',
    requiredModuleKeys: ['ecommerce-product-advisor', 'knowledge-faq'],
    toolKeys: ['search_catalog', 'query_knowledge', 'push_webhook'],
    defaultToolPlan: ['search_catalog', 'query_knowledge', 'push_webhook'],
  },
  {
    key: 'property-ticket-agent',
    label: 'Immobilien- & Ticket-Agent',
    description: 'Bereitet Mieter-Support, Schadensmeldungen und spaetere Ticket-Anlagen vor.',
    category: 'support',
    requiredModuleKeys: ['property-ticketing', 'knowledge-faq'],
    toolKeys: ['create_ticket', 'push_webhook', 'query_knowledge'],
    defaultToolPlan: ['query_knowledge', 'create_ticket', 'push_webhook'],
  },
  {
    key: 'it-support-agent',
    label: 'IT-Support-Agent',
    description: 'First-Level-Support, Wissensfragen, Triage und strukturierte IT-Tickets.',
    category: 'support',
    requiredModuleKeys: ['it-support', 'knowledge-faq'],
    toolKeys: ['query_knowledge', 'create_ticket', 'push_webhook', 'handoff'],
    defaultToolPlan: ['query_knowledge', 'create_ticket', 'push_webhook'],
  },
];

export function getAgentDefinition(key: string) {
  return AGENT_REGISTRY.find((agent) => agent.key === key) || null;
}
