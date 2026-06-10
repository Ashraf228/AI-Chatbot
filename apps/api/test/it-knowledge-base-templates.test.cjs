const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getItKnowledgeBaseTemplate,
  listItKnowledgeBaseTemplates,
  renderItKnowledgeTemplateAsKnowledgeDocument,
} = require('../dist/modules/it-support/it-knowledge-base-templates.js');

const CRITICAL_TEMPLATE_KEYS = [
  'phishing-mail-received',
  'malware-suspicion',
  'device-lost',
  'server-or-company-outage',
];

test('IT knowledge template catalog exposes complete unique templates', () => {
  const templates = listItKnowledgeBaseTemplates();
  assert.equal(templates.length, 15);

  const keys = new Set();
  for (const template of templates) {
    assert.equal(typeof template.key, 'string');
    assert.equal(typeof template.title, 'string');
    assert.equal(typeof template.category, 'string');
    assert.equal(typeof template.issueType, 'string');
    assert.ok(Array.isArray(template.tags) && template.tags.length > 0);
    assert.ok(Array.isArray(template.symptoms) && template.symptoms.length > 0);
    assert.ok(Array.isArray(template.safeSteps) && template.safeSteps.length > 0);
    assert.ok(Array.isArray(template.doNotDo) && template.doNotDo.length > 0);
    assert.ok(Array.isArray(template.escalateWhen) && template.escalateWhen.length > 0);
    assert.ok(Array.isArray(template.requiredTicketFields) && template.requiredTicketFields.length > 0);
    assert.match(template.customerFacingContent, new RegExp(`# ${template.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.equal(keys.has(template.key), false, `duplicate template key ${template.key}`);
    keys.add(template.key);
  }
});

test('IT knowledge templates avoid credential collection and risky commands', () => {
  const forbiddenRequestPatterns = [
    /senden sie (mir|uns|hier)?\s*(bitte\s*)?(ihr\s*)?(passwort|kennwort)/i,
    /nennen sie (mir|uns|hier)?\s*(bitte\s*)?(ihr\s*)?(passwort|kennwort)/i,
    /geben sie (mir|uns|hier)?\s*(bitte\s*)?(den|ihren)?\s*(mfa|2fa|tan|pin)/i,
    /senden sie (mir|uns|hier)?\s*(bitte\s*)?(den|ihren)?\s*(mfa|2fa|tan|pin)/i,
    /api[- ]?key\s*(anfordern|nennen|senden|schicken|eingeben)/i,
    /token\s*(anfordern|nennen|senden|schicken|eingeben)/i,
    /secret\s*(anfordern|nennen|senden|schicken|eingeben)/i,
  ];
  const riskyPatterns = [
    /regedit/i,
    /rm\s+-rf/i,
    /format\s+c:/i,
    /powershell\s+-enc/i,
    /bypass/i,
    /disable\s+antivirus/i,
    /antivirus\s+deaktivieren/i,
  ];

  for (const template of listItKnowledgeBaseTemplates()) {
    for (const pattern of forbiddenRequestPatterns) {
      assert.doesNotMatch(template.customerFacingContent, pattern, template.key);
    }
    for (const pattern of riskyPatterns) {
      assert.doesNotMatch(template.customerFacingContent, pattern, template.key);
    }
  }
});

test('critical IT knowledge templates escalate quickly and include safety do-not-do rules', () => {
  for (const key of CRITICAL_TEMPLATE_KEYS) {
    const template = getItKnowledgeBaseTemplate(key);
    assert.ok(template, key);
    assert.ok(template.escalateWhen.length > 0, key);
    assert.ok(
      template.safeSteps.some((step) => /support|ticket|melden|informieren/i.test(step)),
      `${key} should mention escalation or ticket in safe steps`,
    );
    assert.ok(
      template.doNotDo.some((entry) => /keine sensiblen daten|keine links|anhaenge|anhänge|links oder anhaenge/i.test(entry)),
      `${key} should include security do-not-do guidance`,
    );
  }
});

test('renderItKnowledgeTemplateAsKnowledgeDocument returns expected markdown sections', () => {
  const template = getItKnowledgeBaseTemplate('vpn-not-connecting');
  assert.ok(template);
  const rendered = renderItKnowledgeTemplateAsKnowledgeDocument(template);

  assert.match(rendered, /^# VPN verbindet nicht/m);
  assert.match(rendered, /## Woran du das Problem erkennst/);
  assert.match(rendered, /## Sichere erste Schritte/);
  assert.match(rendered, /## Bitte nicht tun/);
  assert.match(rendered, /## Wann ein Ticket sinnvoll ist/);
  assert.match(rendered, /## Hilfreiche Angaben fuer ein Ticket/);
});

test('getItKnowledgeBaseTemplate returns a template by key or null', () => {
  assert.equal(getItKnowledgeBaseTemplate('vpn-not-connecting')?.title, 'VPN verbindet nicht');
  assert.equal(getItKnowledgeBaseTemplate('unknown-template'), null);
});
