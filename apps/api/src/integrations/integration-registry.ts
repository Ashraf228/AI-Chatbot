export type IntegrationFieldDefinition = {
  key: string;
  label: string;
  kind: 'text' | 'url' | 'email' | 'password';
  placeholder?: string;
};

export type IntegrationDefinition = {
  providerKey: string;
  connectionKey: string;
  label: string;
  description: string;
  category: 'commerce' | 'support' | 'messaging' | 'automation';
  configFields: IntegrationFieldDefinition[];
  secretFields: IntegrationFieldDefinition[];
};

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  {
    providerKey: 'shopify',
    connectionKey: 'primary',
    label: 'Shopify Shop',
    description: 'Bereitet Produktdaten, Produktempfehlungen und spaetere Produktlinks fuer Shops vor.',
    category: 'commerce',
    configFields: [
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
        key: 'adminApiToken',
        label: 'Admin API Token',
        kind: 'password',
      },
    ],
  },
  {
    providerKey: 'crm-webhook',
    connectionKey: 'primary',
    label: 'CRM / Lead-Webhooks',
    description: 'Leitet qualifizierte Kontakte spaeter an CRM- oder Automationssysteme weiter.',
    category: 'automation',
    configFields: [
      {
        key: 'endpointUrl',
        label: 'Webhook-URL',
        kind: 'url',
        placeholder: 'https://crm.example.com/webhooks/leads',
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
    label: 'Ticket-Weiterleitung',
    description: 'Bereitet spaetere Weiterleitungen fuer Schadensmeldungen, Support- oder Ticket-Systeme vor.',
    category: 'support',
    configFields: [
      {
        key: 'endpointUrl',
        label: 'Ticket-Webhook-URL',
        kind: 'url',
        placeholder: 'https://tickets.example.com/intake',
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
    label: 'Abweichender Mailversand',
    description: 'Erlaubt spaeter kundenspezifische SMTP-Daten statt nur globaler ENV-Mailkonfiguration.',
    category: 'messaging',
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
