const test = require('node:test');
const assert = require('node:assert/strict');
const { getIndustryTemplate } = require('../dist/industry-templates/industry-template-registry.js');

test('local-service-first-contact template configures the Handwerker first-contact package', () => {
  const template = getIndustryTemplate('local-service-first-contact');

  assert.equal(template.label, 'Handwerker / Erstkontakt');
  assert.equal(template.setupGoal, 'lead_capture');
  assert.equal(template.botType, 'handwerker-first-contact');
  assert.equal(template.ctaText, 'Soforthilfe');
  assert.equal(template.launcherLabel, 'Soforthilfe');
  assert.deepEqual(template.conversationFlow.questionOrder, [
    'problem',
    'urgency',
    'fullAddress',
    'fullName',
    'phone',
  ]);
  assert.match(template.conversationFlow.questionTexts.fullAddress, /vollständige Einsatzadresse/i);
  assert.match(template.conversationFlow.questionTexts.fullName, /Vor- und Nachnamen/i);

  const modulesByKey = Object.fromEntries(template.modules.map((module) => [module.key, module]));

  assert.equal(modulesByKey['lead-sales'].isEnabled, true);
  assert.equal(modulesByKey['knowledge-faq'].isEnabled, true);
  assert.equal(modulesByKey['reporting-insights'].isEnabled, true);
  assert.equal(modulesByKey['ecommerce-product-advisor'].isEnabled, false);
  assert.equal(modulesByKey['property-ticketing'].isEnabled, false);
  assert.equal(modulesByKey['lead-sales'].config.intakeFlow.templateKey, 'local-service-first-contact');
});

test('it-support template enables dedicated IT support module and agent foundation', () => {
  const template = getIndustryTemplate('it-support');

  assert.equal(template.label, 'IT-Support');
  assert.equal(template.setupGoal, 'support');
  assert.match(template.systemPrompt, /First-Level-Support/i);
  assert.match(template.systemPrompt, /Passwörtern|Passwoertern/i);
  assert.match(template.systemPrompt, /Sicherheitsvorfälle|Sicherheitsvorfaelle|Sicherheitsvorfall/i);
  assert.deepEqual(template.reportKpis, [
    'startedChats',
    'resolvedByKnowledge',
    'tickets',
    'handoffs',
    'topQuestions',
  ]);
  assert.ok(template.topTestQuestions.includes('Mein VPN verbindet nicht'));
  assert.ok(template.topTestQuestions.includes('Wir haben eine Phishing-Mail erhalten'));

  const modulesByKey = Object.fromEntries(template.modules.map((module) => [module.key, module]));

  assert.equal(modulesByKey['lead-sales'].isEnabled, false);
  assert.equal(modulesByKey['knowledge-faq'].isEnabled, true);
  assert.equal(modulesByKey['it-support'].isEnabled, true);
  assert.equal(modulesByKey['it-support'].config.intakeMode, 'knowledge_first');
  assert.equal(modulesByKey['it-support'].config.ticketConfirmationRequired, true);
  assert.equal(modulesByKey['property-ticketing'].isEnabled, false);
  assert.equal(modulesByKey['ecommerce-product-advisor'].isEnabled, false);
  assert.equal(modulesByKey['reporting-insights'].isEnabled, true);
});
