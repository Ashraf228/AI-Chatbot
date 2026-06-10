const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_IT_SUPPORT_MODULE_CONFIG,
  normalizeItSupportModuleConfig,
} = require('../dist/site-modules/module-configs.js');

test('normalizeItSupportModuleConfig removes invalid and duplicate required ticket fields', () => {
  const config = normalizeItSupportModuleConfig({
    requiredTicketFields: [
      'description',
      'invalidField',
      'affectedSystem',
      'description',
      'reporterPhone',
      '',
      'impact',
      'reporterEmail',
    ],
  });

  assert.deepEqual(config.requiredTicketFields, [
    'description',
    'affectedSystem',
    'reporterPhone',
    'impact',
    'reporterEmail',
  ]);
});

test('normalizeItSupportModuleConfig falls back to default required fields when normalized list is empty', () => {
  const config = normalizeItSupportModuleConfig({
    requiredTicketFields: ['unknown', '', 123],
  });

  assert.deepEqual(config.requiredTicketFields, DEFAULT_IT_SUPPORT_MODULE_CONFIG.requiredTicketFields);
});

test('normalizeItSupportModuleConfig clamps troubleshooting steps and keeps ticket confirmation required', () => {
  assert.equal(normalizeItSupportModuleConfig({ maxTroubleshootingSteps: 0 }).maxTroubleshootingSteps, 1);
  assert.equal(normalizeItSupportModuleConfig({ maxTroubleshootingSteps: 99 }).maxTroubleshootingSteps, 5);
  assert.equal(normalizeItSupportModuleConfig({ maxTroubleshootingSteps: 3 }).maxTroubleshootingSteps, 3);
  assert.equal(normalizeItSupportModuleConfig({ ticketConfirmationRequired: false }).ticketConfirmationRequired, true);
});

test('normalizeItSupportModuleConfig deduplicates escalation keywords and falls back when empty', () => {
  const config = normalizeItSupportModuleConfig({
    escalationKeywords: ['Phishing', 'phishing', '  Malware  ', '', 123],
  });

  assert.deepEqual(config.escalationKeywords, ['Phishing', 'Malware']);
  assert.deepEqual(
    normalizeItSupportModuleConfig({ escalationKeywords: ['', 123] }).escalationKeywords,
    DEFAULT_IT_SUPPORT_MODULE_CONFIG.escalationKeywords,
  );
});
