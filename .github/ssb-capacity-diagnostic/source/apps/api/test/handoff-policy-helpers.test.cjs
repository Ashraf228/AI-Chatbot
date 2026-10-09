const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildHandoffPolicyDecision,
  canPrepareHandoff,
  getHandoffFallbackBehavior,
  getMissingFieldsBeforeHandoff,
  hasRequiredFieldsForHandoff,
  isHandoffEnabled,
  normalizeHandoffRules,
  selectPostCaptureHandoffAction,
  shouldDeferHandoff,
  shouldPrepareHandoff,
  shouldRequireFieldsBeforeHandoff,
  shouldRequireSummaryBeforeHandoff,
} = require('../dist/chat/handoff-policy.helpers.js');

test('handoff policy normalizes legacy aliases without mutating input', () => {
  const input = {
    enabled: true,
    requiredBeforeHandoff: true,
    summaryBeforeHandoff: true,
    handoffWhenUncertain: true,
    fallbackBehavior: 'manual_review',
  };

  const normalized = normalizeHandoffRules(input);

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.requireAllFields, true);
  assert.equal(normalized.summarizeBeforeHandoff, true);
  assert.equal(normalized.handoffWhenUncertain, true);
  assert.equal(normalized.fallbackBehavior, 'manual_review');
  assert.deepEqual(input, {
    enabled: true,
    requiredBeforeHandoff: true,
    summaryBeforeHandoff: true,
    handoffWhenUncertain: true,
    fallbackBehavior: 'manual_review',
  });
});

test('handoff policy exposes boolean rule helpers', () => {
  const rules = {
    enabled: false,
    requireAllFields: true,
    summarizeBeforeHandoff: true,
    fallbackBehavior: 'continue_conversation',
  };

  assert.equal(isHandoffEnabled(rules), false);
  assert.equal(shouldRequireFieldsBeforeHandoff(rules), true);
  assert.equal(shouldRequireSummaryBeforeHandoff(rules), true);
  assert.equal(getHandoffFallbackBehavior(rules), 'continue_conversation');
});

test('handoff policy evaluates required fields with contact aliases', () => {
  const requiredFields = [
    { key: 'name', label: 'Name', required: true },
    { key: 'contact', label: 'Kontakt', required: true },
    { key: 'request', label: 'Anliegen', required: true },
    { key: 'priority', label: 'Prioritaet', required: false },
  ];

  assert.deepEqual(
    getMissingFieldsBeforeHandoff(requiredFields, {
      name: 'Max',
      phone: '015511410215',
      concern: 'VPN funktioniert nicht',
    }),
    [],
  );
  assert.equal(
    hasRequiredFieldsForHandoff(requiredFields, {
      name: 'Max',
      email: 'max@example.test',
      message: 'Bitte Rueckruf',
    }),
    true,
  );
  assert.deepEqual(getMissingFieldsBeforeHandoff(requiredFields, { name: 'Max' }), ['contact', 'request']);
});

test('handoff policy prepares or defers handoff without side effects', () => {
  const input = {
    handoffRules: {
      enabled: true,
      requireAllFields: true,
      handoffWhenUncertain: true,
    },
    requiredFields: ['name', 'contact', 'request'],
    collectedFields: {
      name: 'Max',
      email: 'max@example.test',
    },
    handoffRequested: true,
  };

  assert.equal(canPrepareHandoff(input), false);
  assert.equal(shouldPrepareHandoff(input), false);
  assert.equal(shouldDeferHandoff(input), true);

  const complete = {
    ...input,
    collectedFields: {
      ...input.collectedFields,
      concern: 'Bitte Support kontaktieren',
    },
  };

  assert.equal(canPrepareHandoff(complete), true);
  assert.equal(shouldPrepareHandoff(complete), true);
  assert.equal(shouldDeferHandoff(complete), false);
});

test('handoff policy decision preserves existing post-capture action priority', () => {
  assert.equal(
    selectPostCaptureHandoffAction({ hasScheduleTarget: true, hasContactRequest: true }),
    'suggest_schedule',
  );
  assert.equal(
    selectPostCaptureHandoffAction({ hasScheduleTarget: false, hasContactRequest: true }),
    'handoff_to_contact',
  );
  assert.equal(
    selectPostCaptureHandoffAction({ hasScheduleTarget: false, hasContactRequest: false }),
    'capture_lead',
  );

  const decision = buildHandoffPolicyDecision({
    handoffRules: {
      enabled: true,
      requireAllFields: true,
      summarizeBeforeHandoff: true,
      fallbackBehavior: 'ask_followup',
    },
    requiredFields: ['name', 'contact'],
    collectedFields: { name: 'Max' },
    hasContactRequest: true,
  });

  assert.equal(decision.shouldHandoff, false);
  assert.equal(decision.shouldAskForMoreInfo, true);
  assert.deepEqual(decision.missingFields, ['contact']);
  assert.equal(decision.requiresSummary, true);
  assert.equal(decision.reasonCode, 'missing_required_fields');
  assert.equal(decision.recommendedAction, 'handoff_to_contact');
});

test('handoff policy helpers stay pure and have no side-effect dependencies', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/handoff-policy.helpers.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
});
