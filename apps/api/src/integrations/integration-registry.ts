export type IntegrationFieldDefinition = {
  key: string;
  label: string;
  kind: 'text' | 'url' | 'email' | 'password' | 'textarea' | 'multiselect';
  placeholder?: string;
  options?: string[];
};

export const INTEGRATION_EVENTS = [
  'lead.created',
  'ticket.created',
  'contact.requested',
  'conversation.handoff',
  'tool.executed',
] as const;

export type IntegrationEventType = (typeof INTEGRATION_EVENTS)[number];

export type IntegrationDefinition = {
  providerKey: string;
  connectionKey: string;
  type: 'webhook' | 'email' | 'crm_webhook' | 'ticket_webhook' | 'shopify';
  label: string;
  displayName: string;
  description: string;
  category: 'commerce' | 'support' | 'messaging' | 'automation';
  supportedEvents: IntegrationEventType[];
  requiresSecret: boolean;
  testable: boolean;
  configFields: IntegrationFieldDefinition[];
  secretFields: IntegrationFieldDefinition[];
};

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  {
    providerKey: 'webhook',
    connectionKey: 'primary',
    type: 'webhook',
    label: 'Generischer Webhook',
    displayName: 'Generischer Webhook',
    description: 'Sendet frei waehlbare Ereignisse an externe Systeme wie Make, Zapier oder n8n.',
    category: 'automation',
    supportedEvents: ['lead.created', 'ticket.created', 'contact.requested', 'conversation.handoff', 'tool.executed'],
    requiresSecret: false,
    testable: true,
    configFields: [
      { key: 'url', label: 'Webhook-URL', kind: 'url', placeholder: 'https://example.com/webhook' },
      { key: 'method', label: 'Methode', kind: 'text', placeholder: 'POST' },
      {
        key: 'events',
        label: 'Events',
        kind: 'multiselect',
        options: [...INTEGRATION_EVENTS],
      },
      { key: 'headers', label: 'Header als JSON', kind: 'textarea', placeholder: '{"x-source":"ai-chatbot"}' },
    ],
    secretFields: [
      { key: 'secret', label: 'Optionales Secret', kind: 'password' },
      { key: 'bearerToken', label: 'Bearer Token', kind: 'password' },
    ],
  },
  {
    providerKey: 'shopify',
    connectionKey: 'primary',
    type: 'shopify',
    label: 'Shopify Shop',
    displayName: 'Shopify Shop',
    description: 'Bereitet Produktdaten, Produktempfehlungen und spaetere Produktlinks fuer Shops vor.',
    category: 'commerce',
    supportedEvents: [],
    requiresSecret: true,
    testable: true,
    configFields: [
      {
        key: 'storeDomain',
        label: 'Store-Domain',
        kind: 'text',
        placeholder: 'mein-shop.myshopify.com',
      },
      {
        key: 'shopDomain',
        label: 'Shop-Domain',
        kind: 'text',
        placeholder: 'mein-shop.myshopify.com',
      },
      {
        key: 'storefrontBaseUrl',
        label: 'Storefront-URL',
        kind: 'url',
        placeholder: 'https://mein-shop.de',
      },
    ],
    secretFields: [
      {
        key: 'storefrontToken',
        label: 'Storefront Token',
        kind: 'password',
      },
      {
        key: 'adminApiToken',
        label: 'Admin API Token',
        kind: 'password',
      },
    ],
  },
  {
    providerKey: 'crm-webhook',
    connectionKey: 'primary',
    type: 'crm_webhook',
    label: 'CRM / Lead-Webhooks',
    displayName: 'CRM Webhook',
    description: 'Leitet qualifizierte Kontakte spaeter an CRM- oder Automationssysteme weiter.',
    category: 'automation',
    supportedEvents: ['lead.created', 'contact.requested'],
    requiresSecret: false,
    testable: true,
    configFields: [
      {
        key: 'endpointUrl',
        label: 'Webhook-URL',
        kind: 'url',
        placeholder: 'https://crm.example.com/webhooks/leads',
      },
      {
        key: 'url',
        label: 'Webhook-URL',
        kind: 'url',
        placeholder: 'https://crm.example.com/webhooks/leads',
      },
      {
        key: 'events',
        label: 'Events',
        kind: 'multiselect',
        options: ['lead.created', 'contact.requested'],
      },
      {
        key: 'headers',
        label: 'Header als JSON',
        kind: 'textarea',
      },
      {
        key: 'fieldMapping',
        label: 'Feld-Mapping als JSON',
        kind: 'textarea',
      },
    ],
    secretFields: [
      {
        key: 'bearerToken',
        label: 'Bearer Token',
        kind: 'password',
      },
    ],
  },
  {
    providerKey: 'ticket-webhook',
    connectionKey: 'primary',
    type: 'ticket_webhook',
    label: 'Ticket-Weiterleitung',
    displayName: 'Ticket Webhook',
    description: 'Bereitet spaetere Weiterleitungen fuer Schadensmeldungen, Support- oder Ticket-Systeme vor.',
    category: 'support',
    supportedEvents: ['ticket.created', 'conversation.handoff'],
    requiresSecret: false,
    testable: true,
    configFields: [
      {
        key: 'endpointUrl',
        label: 'Ticket-Webhook-URL',
        kind: 'url',
        placeholder: 'https://tickets.example.com/intake',
      },
      {
        key: 'url',
        label: 'Ticket-Webhook-URL',
        kind: 'url',
        placeholder: 'https://tickets.example.com/intake',
      },
      {
        key: 'events',
        label: 'Events',
        kind: 'multiselect',
        options: ['ticket.created', 'conversation.handoff'],
      },
      {
        key: 'headers',
        label: 'Header als JSON',
        kind: 'textarea',
      },
      {
        key: 'fieldMapping',
        label: 'Feld-Mapping als JSON',
        kind: 'textarea',
      },
    ],
    secretFields: [
      {
        key: 'apiKey',
        label: 'API-Schluessel',
        kind: 'password',
      },
    ],
  },
  {
    providerKey: 'smtp-override',
    connectionKey: 'primary',
    type: 'email',
    label: 'Abweichender Mailversand',
    displayName: 'E-Mail Benachrichtigung',
    description: 'Erlaubt spaeter kundenspezifische SMTP-Daten statt nur globaler ENV-Mailkonfiguration.',
    category: 'messaging',
    supportedEvents: ['lead.created', 'ticket.created', 'contact.requested', 'conversation.handoff'],
    requiresSecret: true,
    testable: true,
    configFields: [
      {
        key: 'host',
        label: 'SMTP Host',
        kind: 'text',
        placeholder: 'smtp.example.com',
      },
      {
        key: 'port',
        label: 'SMTP Port',
        kind: 'text',
        placeholder: '587',
      },
      {
        key: 'fromEmail',
        label: 'Absender E-Mail',
        kind: 'email',
        placeholder: 'bot@example.com',
      },
      {
        key: 'notifyEmails',
        label: 'Empfaenger',
        kind: 'text',
        placeholder: 'team@example.com, sales@example.com',
      },
      {
        key: 'events',
        label: 'Events',
        kind: 'multiselect',
        options: ['lead.created', 'ticket.created', 'contact.requested', 'conversation.handoff'],
      },
      {
        key: 'username',
        label: 'SMTP Benutzername',
        kind: 'text',
        placeholder: 'bot@example.com',
      },
    ],
    secretFields: [
      {
        key: 'password',
        label: 'SMTP Passwort',
        kind: 'password',
      },
    ],
  },
];

export function getIntegrationDefinition(providerKey: string, connectionKey: string) {
  return (
    INTEGRATION_REGISTRY.find(
      (integration) =>
        integration.providerKey === providerKey && integration.connectionKey === connectionKey,
    ) || null
  );
}
