const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveChatRoute } = require('../dist/chat-routing/chat-route-resolver.js');

test('chat route resolver uses ecommerce advisor when shop intent and module are enabled', async () => {
  const decision = resolveChatRoute({
    message: 'Ich suche das passende Produkt fuer meinen Shopify Shop',
    enabledModuleKeys: ['knowledge-faq', 'ecommerce-product-advisor'],
    history: [],
    moduleConfigs: {
      'ecommerce-product-advisor': {
        catalogMode: 'shopify_catalog',
        ctaLabel: 'Shop-Beratung anfragen',
      },
    },
  });

  assert.equal(decision.route, 'advisor');
  assert.equal(decision.agentKey, 'ecommerce-product-advisor');
  assert.equal(decision.cta?.label, 'Shop-Beratung anfragen');
});

test('chat route resolver uses property agent when damage/ticket intent is detected', async () => {
  const decision = resolveChatRoute({
    message: 'Ich moechte einen Wasserschaden fuer einen Mieter melden',
    enabledModuleKeys: ['knowledge-faq', 'property-ticketing'],
    history: [],
    moduleConfigs: {
      'property-ticketing': {
        intakeMode: 'ticket_system',
        ctaLabel: 'Stoerung jetzt aufnehmen',
      },
    },
  });

  assert.equal(decision.route, 'agent');
  assert.equal(decision.agentKey, 'property-ticket-agent');
  assert.equal(decision.cta?.label, 'Stoerung jetzt aufnehmen');
});

test('chat route resolver uses hybrid sales path for lead-oriented consulting intent', async () => {
  const decision = resolveChatRoute({
    message: 'Ich brauche eine KI fuer meinen Kundenservice und moechte einen Termin',
    enabledModuleKeys: ['knowledge-faq', 'lead-sales'],
    history: [],
    moduleConfigs: {
      'lead-sales': {
        ctaLabel: 'Termin anfragen',
        ctaDescription: 'Wir melden uns fuer ein kurzes Beratungsgespraech.',
      },
    },
  });

  assert.equal(decision.route, 'hybrid');
  assert.equal(decision.agentKey, 'lead-sales-agent');
  assert.equal(decision.cta?.label, 'Termin anfragen');
});

test('chat route resolver falls back to faq when no specialized module intent matches', async () => {
  const decision = resolveChatRoute({
    message: 'Welche Leistungen bietet ihr an?',
    enabledModuleKeys: ['knowledge-faq'],
    history: [],
  });

  assert.equal(decision.route, 'faq');
  assert.equal(decision.agentKey, undefined);
});
