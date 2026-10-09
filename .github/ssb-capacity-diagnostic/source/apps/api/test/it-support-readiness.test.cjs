const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateItSupportReadiness } = require('../dist/modules/it-support/it-support-readiness.js');

test('it-support readiness returns ready when all checks pass', () => {
  const result = evaluateItSupportReadiness({
    itSupportEnabled: true,
    knowledgeFaqEnabled: true,
    requiredTicketFields: ['description', 'affectedSystem', 'impact', 'reporterEmail'],
    ticketConfirmationRequired: true,
    escalationKeywords: ['phishing'],
    hasTicketWebhook: true,
    hasActiveKnowledgeSources: true,
    availableItKnowledgeTemplateKeys: ['vpn-not-connecting'],
    importedItKnowledgeTemplateKeys: ['vpn-not-connecting'],
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.checks.itSupportEnabled, true);
  assert.equal(result.checks.requiredTicketFieldsValid, true);
  assert.equal(result.checks.ticketForwardingConfigured, true);
});

test('it-support readiness reports blocking missing setup', () => {
  const result = evaluateItSupportReadiness({
    itSupportEnabled: false,
    knowledgeFaqEnabled: false,
    requiredTicketFields: ['description', 'reporterEmail'],
    ticketConfirmationRequired: false,
  });

  assert.equal(result.status, 'not_ready');
  assert.ok(result.missing.some((entry) => /it-support Modul/i.test(entry)));
  assert.ok(result.missing.some((entry) => /knowledge-faq Modul/i.test(entry)));
  assert.ok(result.missing.some((entry) => /requiredTicketFields/i.test(entry)));
  assert.ok(result.warnings.some((entry) => /Ticket-Bestätigung/i.test(entry)));
  assert.equal(result.checks.requiredTicketFieldsValid, true);
});

test('it-support readiness reports warnings for optional operational gaps', () => {
  const result = evaluateItSupportReadiness({
    itSupportEnabled: true,
    knowledgeFaqEnabled: true,
    requiredTicketFields: ['description', 'affectedSystem', 'impact', 'reporterEmail'],
    ticketConfirmationRequired: true,
    escalationKeywords: [],
    hasTicketWebhook: false,
    hasActiveKnowledgeSources: false,
    availableItKnowledgeTemplateKeys: ['vpn-not-connecting'],
    importedItKnowledgeTemplateKeys: [],
  });

  assert.equal(result.status, 'warning');
  assert.deepEqual(result.missing, []);
  assert.ok(result.warnings.some((entry) => /Eskalations-Keywords/i.test(entry)));
  assert.ok(result.warnings.some((entry) => /Ticket-Weiterleitung/i.test(entry)));
  assert.ok(result.warnings.some((entry) => /Wissensquellen|IT-Templates/i.test(entry)));
  assert.equal(result.checks.ticketForwardingConfigured, false);
  assert.equal(result.checks.knowledgeBasePrepared, false);
});

test('it-support readiness accepts custom active knowledge without imported templates', () => {
  const result = evaluateItSupportReadiness({
    itSupportEnabled: true,
    knowledgeFaqEnabled: true,
    requiredTicketFields: ['description', 'affectedSystem', 'impact', 'reporterEmail'],
    ticketConfirmationRequired: true,
    escalationKeywords: ['phishing'],
    hasTicketWebhook: true,
    hasActiveKnowledgeSources: true,
    availableItKnowledgeTemplateKeys: ['vpn-not-connecting'],
    importedItKnowledgeTemplateKeys: [],
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.checks.itKnowledgeTemplatesImported, false);
  assert.equal(result.checks.knowledgeBasePrepared, true);
  assert.deepEqual(result.warnings, []);
});

test('it-support readiness rejects invalid required ticket fields', () => {
  const result = evaluateItSupportReadiness({
    itSupportEnabled: true,
    knowledgeFaqEnabled: true,
    requiredTicketFields: ['description', 'affectedSystem', 'impact', 'reporterEmail', 'invalidField'],
    ticketConfirmationRequired: true,
    escalationKeywords: ['phishing'],
    hasTicketWebhook: true,
    hasActiveKnowledgeSources: true,
    importedItKnowledgeTemplateKeys: ['vpn-not-connecting'],
  });

  assert.equal(result.status, 'not_ready');
  assert.equal(result.checks.requiredTicketFieldsValid, false);
  assert.ok(result.missing.some((entry) => /ungültige|ungueltige|leere Felder/i.test(entry)));
});

test('it-support readiness treats imported IT templates as knowledge preparation', () => {
  const result = evaluateItSupportReadiness({
    itSupportEnabled: true,
    knowledgeFaqEnabled: true,
    requiredTicketFields: ['description', 'affectedSystem', 'impact', 'reporterEmail'],
    ticketConfirmationRequired: true,
    escalationKeywords: ['phishing'],
    hasTicketWebhook: true,
    hasActiveKnowledgeSources: false,
    availableItKnowledgeTemplateKeys: ['vpn-not-connecting'],
    importedItKnowledgeTemplateKeys: ['vpn-not-connecting'],
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.checks.activeKnowledgeSourcesAvailable, false);
  assert.equal(result.checks.itKnowledgeTemplatesImported, true);
  assert.equal(result.checks.knowledgeBasePrepared, true);
});
