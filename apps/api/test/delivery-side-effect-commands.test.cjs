const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDeliveryCommandAuditProjection,
  buildDeliveryCommandLogProjection,
  buildDeliveryCommandsAuditPayload,
  buildLeadEmailDeliveryCommands,
  buildNoopDeliveryCommand,
  buildQueueEmailJobCommand,
} = require('../dist/chat/delivery-side-effect.commands.js');
const {
  buildLeadDeliveryPayload,
  buildLeadEmailJobPayload,
} = require('../dist/chat/delivery-payload.builders.js');

function buildReadyFixtures() {
  const contact = Object.freeze({
    name: 'Max Mustermann',
    email: 'max@example.test',
    phone: '0155 11410215',
    concern: 'Ich brauche Beratung.',
  });
  const deliveryResult = buildLeadDeliveryPayload({
    recipientEmail: 'team@example.test',
    siteId: 'site-1',
    siteName: 'Demo Site',
    submittedAt: '2026-01-01T00:00:00.000Z',
    scheduleIntent: false,
    contact,
  });
  const emailJobPayload = buildLeadEmailJobPayload({
    mail: {
      to: 'team@example.test',
      subject: 'Neue Anfrage von max@example.test',
      html: '<p>Telefon 0155 11410215</p>',
      text: 'Kontakt: max@example.test / 0155 11410215',
    },
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    leadId: 'lead-1',
    contact,
    scheduleIntent: false,
  });
  return { contact, deliveryResult, emailJobPayload };
}

test('delivery side-effect command builder creates queue_email_job command for ready lead email payload', () => {
  const { contact, deliveryResult, emailJobPayload } = buildReadyFixtures();

  const commands = buildLeadEmailDeliveryCommands({ deliveryResult, emailJobPayload });

  assert.equal(deliveryResult.status, 'ready');
  assert.deepEqual(commands, [
    {
      type: 'queue_email_job',
      payload: emailJobPayload,
      reasonCode: 'lead_email_ready',
    },
  ]);
  assert.deepEqual(contact, {
    name: 'Max Mustermann',
    email: 'max@example.test',
    phone: '0155 11410215',
    concern: 'Ich brauche Beratung.',
  });
});

test('delivery side-effect command builder creates no-op command from delivery no-op result', () => {
  const deliveryResult = buildLeadDeliveryPayload({
    siteId: 'site-1',
    siteName: 'Demo Site',
    submittedAt: '2026-01-01T00:00:00.000Z',
    scheduleIntent: false,
    contact: { email: 'max@example.test', concern: 'Kontaktwunsch' },
  });

  const commands = buildLeadEmailDeliveryCommands({ deliveryResult });

  assert.equal(deliveryResult.status, 'noop');
  assert.deepEqual(commands, [
    {
      type: 'noop',
      reasonCode: 'missing_email_target',
      channel: 'email',
    },
  ]);
});

test('delivery side-effect command builder returns no-op when ready result has no email job payload', () => {
  const { deliveryResult } = buildReadyFixtures();

  assert.deepEqual(buildLeadEmailDeliveryCommands({ deliveryResult }), [
    {
      type: 'noop',
      reasonCode: 'missing_email_job_payload',
      channel: 'email',
    },
  ]);
});

test('delivery side-effect command builders expose small stable command helpers', () => {
  const { emailJobPayload } = buildReadyFixtures();

  assert.deepEqual(buildQueueEmailJobCommand({ payload: emailJobPayload }), {
    type: 'queue_email_job',
    payload: emailJobPayload,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(buildNoopDeliveryCommand({
    reasonCode: 'delivery_channel_disabled',
    channel: 'system',
  }), {
    type: 'noop',
    reasonCode: 'delivery_channel_disabled',
    channel: 'system',
  });
});

test('delivery side-effect command projections redact delivery targets and contact values', () => {
  const { emailJobPayload } = buildReadyFixtures();
  const command = buildQueueEmailJobCommand({ payload: emailJobPayload });

  const auditProjection = buildDeliveryCommandAuditProjection(command);
  const logProjection = buildDeliveryCommandLogProjection(command);
  const auditBatch = buildDeliveryCommandsAuditPayload([command]);

  for (const projection of [auditProjection, logProjection, auditBatch]) {
    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes('team@example.test'), false);
    assert.equal(serialized.includes('max@example.test'), false);
    assert.equal(serialized.includes('0155 11410215'), false);
    assert.equal(serialized.includes('[redacted-email]'), true);
    assert.equal(serialized.includes('[redacted-phone]'), true);
  }

  assert.equal(auditProjection.payload.recipientEmail, '[redacted]');
  assert.equal(auditProjection.payload.metadata.leadEmail, '[redacted-email]');
  assert.equal(logProjection.payload.recipientEmail, '[redacted]');
});

test('delivery side-effect command builder stays pure and avoids executor boundaries', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/delivery-side-effect.commands.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher|IntegrationEventDispatcher/);
  assert.doesNotMatch(source, /DeliveryExecutor|DeliverySideEffectCommandExecutor/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE |DELETE FROM/);
});
