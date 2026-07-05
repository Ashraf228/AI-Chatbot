const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDeliveryAuditPayload,
  buildEmailJobPayload,
  buildLeadDeliveryPayload,
  buildLeadEmailJobPayload,
  buildLeadNotificationPayload,
  buildSafeDeliveryPayloadForLog,
  summarizeDeliveryConcern,
} = require('../dist/chat/delivery-payload.builders.js');

test('delivery payload builder builds ready lead email payload without side effects', () => {
  const contact = Object.freeze({
    name: 'Max Mustermann',
    email: 'max@example.test',
    phone: '0155 11410215',
    concern: 'Ich brauche Beratung.',
  });

  const result = buildLeadDeliveryPayload({
    recipientEmail: 'team@example.test',
    siteId: 'site-1',
    siteName: 'Demo Site',
    submittedAt: '2026-01-01T00:00:00.000Z',
    scheduleIntent: true,
    dashboardUrl: 'https://dashboard.example.test/sites/site-1/leads',
    contact,
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.payload.recipientEmail, 'team@example.test');
  assert.equal(result.payload.lead.email, 'max@example.test');
  assert.equal(result.payload.lead.message, 'Ich brauche Beratung.');
  assert.equal(result.auditPayload.recipientEmail, '[redacted]');
  assert.equal(result.auditPayload.lead.email, 'max@example.test');
  assert.deepEqual(contact, {
    name: 'Max Mustermann',
    email: 'max@example.test',
    phone: '0155 11410215',
    concern: 'Ich brauche Beratung.',
  });
});

test('delivery payload builder returns no-op for missing lead email target', () => {
  const result = buildLeadDeliveryPayload({
    siteId: 'site-1',
    siteName: 'Demo Site',
    submittedAt: '2026-01-01T00:00:00.000Z',
    scheduleIntent: false,
    contact: {
      email: 'max@example.test',
      concern: 'Kontaktwunsch',
    },
  });

  assert.deepEqual(result, {
    status: 'noop',
    reasonCode: 'missing_email_target',
    auditPayload: {
      type: 'lead_email',
      siteId: 'site-1',
      reasonCode: 'missing_email_target',
    },
  });
});

test('delivery payload builder keeps legacy lead notification payload shape stable', () => {
  assert.equal(
    buildLeadNotificationPayload({
      siteId: 'site-1',
      siteName: 'Demo Site',
      submittedAt: '2026-01-01T00:00:00.000Z',
      scheduleIntent: false,
      contact: { email: 'max@example.test', concern: 'Beratung' },
    }),
    null,
  );

  const payload = buildLeadNotificationPayload({
    recipientEmail: 'team@example.test',
    siteId: 'site-1',
    siteName: 'Demo Site',
    submittedAt: '2026-01-01T00:00:00.000Z',
    scheduleIntent: false,
    contact: {
      name: 'Max Mustermann',
      email: 'max@example.test',
      phone: '0155 11410215',
      concern: 'Beratung',
    },
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    'dashboardUrl',
    'lead',
    'recipientEmail',
    'scheduleIntent',
    'siteId',
    'siteName',
    'source',
    'submittedAt',
  ]);
  assert.equal(payload.source, 'Widget Chat');
  assert.equal(payload.lead.phone, '0155 11410215');
});

test('delivery payload builder builds email job payload through stable aliases', () => {
  const params = {
    mail: {
      to: 'team@example.test',
      subject: 'Neue Anfrage',
      html: '<p>Neue Anfrage</p>',
      text: 'Neue Anfrage',
    },
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    leadId: 'lead-1',
    contact: {
      email: 'max@example.test',
      concern: 'Beratung',
    },
    scheduleIntent: false,
  };

  assert.deepEqual(buildEmailJobPayload(params), buildLeadEmailJobPayload(params));
  assert.equal(buildEmailJobPayload(params).metadata.leadEmail, 'max@example.test');
});

test('delivery payload builder sanitizes audit and log-safe payload projections', () => {
  const payload = {
    recipientEmail: 'team@example.test',
    deliveryChannels: {
      webhook: {
        webhookUrl: 'https://hooks.example.test/intake',
        signingSecret: 'dummy-signing-secret',
        headers: {
          authorization: 'Bearer dummy-token',
        },
      },
    },
  };

  const audit = buildDeliveryAuditPayload(payload);
  const logSafe = buildSafeDeliveryPayloadForLog(payload);

  assert.equal(audit.recipientEmail, '[redacted]');
  assert.equal(audit.deliveryChannels.webhook.webhookUrl, '[redacted]');
  assert.equal(audit.deliveryChannels.webhook.signingSecret, '[redacted]');
  assert.equal(audit.deliveryChannels.webhook.headers.authorization, '[redacted]');
  assert.deepEqual(audit, logSafe);
  assert.equal(JSON.stringify(audit).includes('dummy-signing-secret'), false);
  assert.equal(JSON.stringify(audit).includes('dummy-token'), false);
});

test('delivery concern summarizer preserves legacy local-service wording', () => {
  const summary = summarizeDeliveryConcern(
    {
      name: 'Max Mustermann',
      phone: '0155 11410215',
      concern: 'Keller läuft voll',
      location: 'Musterstraße 12',
      urgency: 'akut',
    },
    'Kontaktanfrage aus dem Chat',
    true,
  );

  assert.match(summary, /Problem \/ Anliegen: Keller läuft voll/);
  assert.match(summary, /Dringlichkeit: akut/);
  assert.match(summary, /Einsatzadresse: Musterstraße 12/);
  assert.match(summary, /Telefon: 0155 11410215/);
});

test('delivery payload builders stay pure and avoid executor boundaries', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/delivery-payload.builders.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher|IntegrationEventDispatcher/);
  assert.doesNotMatch(source, /DeliveryExecutor|DeliverySideEffectCommandBuilder/);
});
