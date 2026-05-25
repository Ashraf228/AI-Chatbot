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

test('chat route resolver treats price, shipping and returns as ecommerce intents', async () => {
  for (const message of [
    'Was kostet der Hoodie?',
    'Wie lange dauert der Versand?',
    'Kann ich den Artikel zurueckgeben?',
    'Ist das Produkt auf Lager?',
  ]) {
    const decision = resolveChatRoute({
      message,
      enabledModuleKeys: ['knowledge-faq', 'ecommerce-product-advisor'],
      history: [],
      moduleConfigs: {
        'ecommerce-product-advisor': {
          catalogMode: 'shopify_catalog',
        },
      },
    });

    assert.equal(decision.route, 'advisor', message);
    assert.equal(decision.agentKey, 'ecommerce-product-advisor', message);
  }
});

test('chat route resolver keeps ecommerce order support in advisor when no ticket module is enabled', async () => {
  const decision = resolveChatRoute({
    message: 'Ich habe eine Frage zu meiner Bestellung',
    enabledModuleKeys: ['knowledge-faq', 'ecommerce-product-advisor'],
    history: [],
    moduleConfigs: {
      'ecommerce-product-advisor': {
        catalogMode: 'shopify_catalog',
      },
    },
  });

  assert.equal(decision.route, 'advisor');
  assert.equal(decision.agentKey, 'ecommerce-product-advisor');
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

test('chat route resolver uses ticket agent for common IT support cases', async () => {
  for (const message of [
    'Mein Passwort funktioniert nicht mehr',
    'VPN verbindet nicht',
    'Outlook sendet keine E-Mails',
    'Der Drucker druckt nicht',
    'Ich habe keine Berechtigung auf den Ordner',
  ]) {
    const decision = resolveChatRoute({
      message,
      enabledModuleKeys: ['knowledge-faq', 'property-ticketing'],
      history: [],
      moduleConfigs: {
        'property-ticketing': {
          intakeMode: 'ticket_system',
        },
      },
    });

    assert.equal(decision.route, 'agent', message);
    assert.equal(decision.agentKey, 'property-ticket-agent', message);
    assert.match(decision.guide, /Frage niemals nach Passwoertern/i);
    assert.match(decision.guide, /keine riskanten PowerShell/i);
  }
});

test('chat route resolver escalates security incidents through ticket safety guide', async () => {
  const decision = resolveChatRoute({
    message: 'Wir haben einen Phishing Sicherheitsvorfall und mehrere Rechner sind betroffen',
    enabledModuleKeys: ['knowledge-faq', 'property-ticketing'],
    history: [],
    moduleConfigs: {
      'property-ticketing': {
        intakeMode: 'ticket_system',
      },
    },
  });

  assert.equal(decision.route, 'agent');
  assert.equal(decision.agentKey, 'property-ticket-agent');
  assert.match(decision.guide, /Sicherheitsvorfall/i);
  assert.match(decision.guide, /an einen Menschen eskalieren/i);
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

test('chat route resolver uses hybrid sales path for local service emergency intent', async () => {
  for (const message of [
    'Meine Toilette ist verstopft',
    'Ich brauche Notdienst in Frankfurt',
    'Der Abfluss läuft nicht mehr ab',
    'Wir haben Rückstau im Keller',
  ]) {
    const decision = resolveChatRoute({
      message,
      enabledModuleKeys: ['knowledge-faq', 'lead-sales'],
      history: [],
      moduleConfigs: {
        'lead-sales': {
          ctaLabel: 'Rückruf anfragen',
          ctaDescription: 'Wir nehmen den Fall kurz auf.',
        },
      },
    });

    assert.equal(decision.route, 'hybrid', message);
    assert.equal(decision.agentKey, 'lead-sales-agent', message);
    assert.equal(decision.cta?.label, 'Rückruf anfragen', message);
  }
});

test('chat route resolver keeps local service pricing questions in faq mode', async () => {
  for (const message of [
    'Was kostet eine Rohrreinigung?',
    'Rechnen Sie nach laufenden Metern ab?',
  ]) {
    const decision = resolveChatRoute({
      message,
      enabledModuleKeys: ['knowledge-faq', 'lead-sales'],
      history: [],
      moduleConfigs: {
        'lead-sales': {
          ctaLabel: 'Rückruf anfragen',
        },
      },
    });

    assert.equal(decision.route, 'faq', message);
    assert.equal(decision.agentKey, undefined, message);
  }
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
