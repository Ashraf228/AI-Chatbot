const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildCompletedLeadMetadataPatch,
  buildContactRequestPayload,
  buildLeadAuditPayload,
  buildLeadEmailJobPayload,
  buildLeadNotificationPayload,
  buildLeadSideEffectCommands,
  buildWidgetLeadPayload,
  shouldCreateContactRequest,
  shouldCreateLead,
  shouldQueueLeadNotification,
  summarizeLeadConcern,
} = require('../dist/chat/lead-capture.builders.js');

test('lead capture builder builds widget lead payload from contact details', () => {
  const payload = buildWidgetLeadPayload({
    siteId: 'site-1',
    sessionId: 'session-1',
    contact: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      phone: '0155 11410215',
      concern: 'Ich brauche Beratung zur Automatisierung.',
    },
  });

  assert.deepEqual(payload, {
    siteId: 'site-1',
    sessionId: 'session-1',
    name: 'Max Mustermann',
    email: 'max@example.com',
    phone: '0155 11410215',
    message: 'Ich brauche Beratung zur Automatisierung.',
  });
});

test('lead capture builder keeps optional widget lead fields stable', () => {
  const payload = buildWidgetLeadPayload({
    siteId: 'site-1',
    sessionId: 'session-1',
    contact: {
      email: 'max@example.com',
      concern: 'Kontaktwunsch',
    },
  });

  assert.equal(payload.name, 'Unbekannt');
  assert.equal(payload.phone, null);
  assert.equal(payload.message, 'Kontaktwunsch');
  assert.deepEqual(Object.keys(payload).sort(), ['email', 'message', 'name', 'phone', 'sessionId', 'siteId']);
});

test('lead capture builder builds structured local-service concern without side effects', () => {
  const message = summarizeLeadConcern(
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

  assert.match(message, /Problem \/ Anliegen: Keller läuft voll/);
  assert.match(message, /Dringlichkeit: akut/);
  assert.match(message, /Einsatzadresse: Musterstraße 12/);
  assert.match(message, /Telefon: 0155 11410215/);
});

test('lead capture builder builds contact request payload only with contact channel', () => {
  assert.equal(
    buildContactRequestPayload({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      sessionId: 'session-1',
      contact: { name: 'Max Mustermann', concern: 'Rückruf' },
    }),
    null,
  );

  const payload = buildContactRequestPayload({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    contact: {
      name: 'Max Mustermann',
      phone: '0155 11410215',
      concern: 'Ich möchte einen Termin vereinbaren.',
    },
  });

  assert.equal(payload.tenantId, 'tenant-1');
  assert.equal(payload.siteId, 'site-1');
  assert.equal(payload.email, null);
  assert.equal(payload.phone, '0155 11410215');
  assert.equal(payload.preferredChannel, 'phone');
  assert.match(payload.note, /Widget session: session-1/);
  assert.match(payload.note, /Ich möchte einen Termin vereinbaren\./);
});

test('lead capture builder builds notification and email job payload without enqueueing', () => {
  assert.equal(
    buildLeadNotificationPayload({
      siteId: 'site-1',
      siteName: 'Demo Site',
      submittedAt: '2026-01-01T00:00:00.000Z',
      scheduleIntent: false,
      contact: { email: 'max@example.com', concern: 'Beratung' },
    }),
    null,
  );

  const notification = buildLeadNotificationPayload({
    recipientEmail: 'team@example.com',
    siteId: 'site-1',
    siteName: 'Demo Site',
    submittedAt: '2026-01-01T00:00:00.000Z',
    scheduleIntent: true,
    dashboardUrl: 'https://dashboard.example.test/sites/site-1/leads',
    contact: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      phone: '0155 11410215',
      concern: 'Terminwunsch',
    },
  });

  assert.equal(notification.recipientEmail, 'team@example.com');
  assert.equal(notification.source, 'Widget Chat');
  assert.equal(notification.lead.name, 'Max Mustermann');
  assert.equal(notification.lead.message, 'Terminwunsch');

  const job = buildLeadEmailJobPayload({
    mail: {
      to: notification.recipientEmail,
      subject: 'Neue Anfrage',
      html: '<p>Neue Anfrage</p>',
      text: 'Neue Anfrage',
    },
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    leadId: 'lead-1',
    contact: notification.lead,
    scheduleIntent: true,
  });

  assert.equal(job.recipientEmail, 'team@example.com');
  assert.equal(job.subject, 'Neue Anfrage');
  assert.equal(job.metadata.leadEmail, 'max@example.com');
  assert.equal(job.metadata.scheduleIntent, true);
});

test('lead capture builder builds sanitized audit payload', () => {
  const audit = buildLeadAuditPayload({
    leadId: 'lead-1',
    scheduleIntent: false,
    contact: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      phone: '0155 11410215',
      concern: 'Bitte kontaktieren',
    },
  });

  assert.equal(audit.action, 'lead_captured');
  assert.deepEqual(audit.metadata, {
    leadId: 'lead-1',
    scheduleIntent: false,
    hasEmail: true,
    hasPhone: true,
  });
  assert.equal(JSON.stringify(audit.metadata).includes('max@example.com'), false);
  assert.equal(JSON.stringify(audit.metadata).includes('Bitte kontaktieren'), false);
});

test('lead capture builder builds completed metadata patch without mutating input', () => {
  const contact = Object.freeze({
    name: 'Max Mustermann',
    email: 'max@example.com',
    concern: 'Beratung',
  });

  const patch = buildCompletedLeadMetadataPatch({
    contact,
    leadId: 'lead-1',
    scheduleIntent: true,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:10:00.000Z',
    conversationState: { stage: 'completed', intent: 'appointment' },
  });

  assert.equal(patch.pendingLead.status, 'completed');
  assert.equal(patch.pendingLead.intent, 'schedule');
  assert.equal(patch.pendingLead.completedLeadId, 'lead-1');
  assert.equal(patch.pendingLead.startedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(patch.pendingLead.completedAt, '2026-01-01T00:10:00.000Z');
  assert.deepEqual(contact, {
    name: 'Max Mustermann',
    email: 'max@example.com',
    concern: 'Beratung',
  });
});

test('lead capture builder returns expected side-effect commands for complete lead only', () => {
  assert.equal(shouldCreateLead({ email: 'max@example.com', concern: 'Beratung' }), true);
  assert.equal(shouldCreateLead({ email: 'max@example.com' }), false);
  assert.equal(shouldQueueLeadNotification({ recipientEmail: 'team@example.com' }), true);
  assert.equal(shouldQueueLeadNotification({}), false);
  assert.equal(shouldCreateContactRequest({ scheduleIntent: false, primaryGoal: 'appointment' }), true);

  const incompleteCommands = buildLeadSideEffectCommands({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    contact: { email: 'max@example.com' },
    scheduleIntent: false,
  });
  assert.deepEqual(incompleteCommands, []);

  const commands = buildLeadSideEffectCommands({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    leadId: 'lead-1',
    contact: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      concern: 'Beratung',
    },
    scheduleIntent: true,
    createContactRequest: true,
    recipientEmail: 'team@example.com',
    mail: {
      to: 'team@example.com',
      subject: 'Neue Anfrage',
      text: 'Neue Anfrage',
    },
    completedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.deepEqual(commands.map((command) => command.type), [
    'insert_widget_lead',
    'create_contact_request',
    'record_lead_audit',
    'update_metadata',
    'queue_email_job',
  ]);
  assert.equal(commands.some((command) => command.type.includes('ticket')), false);
});

test('lead capture builders stay pure and have no side-effect dependencies', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/lead-capture.builders.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
});
