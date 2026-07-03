const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildAgentTicketPayload,
  buildCompletedTicketMetadataPatch,
  buildCreatedItTicketAnswer,
  buildTicketConversationState,
  buildTicketMetadataPatch,
  buildTicketSideEffectCommands,
  extractItTicketFields,
  getMissingItTicketFields,
  isActivePendingTicket,
  isTicketCaptureComplete,
  mapTicketMissingFieldToAssistantAsk,
  mergePendingTicket,
  parseTicketForwardingStatus,
  shouldAskForTicketField,
  shouldCreateTicket,
  withItSecurityWarning,
} = require('../dist/chat/it-support-ticket.helpers.js');

test('ticket helper extracts ticket fields without side effects', () => {
  const fields = extractItTicketFields(
    'Mein VPN funktioniert nicht, mehrere Nutzer sind betroffen. Name: Max Mustermann, max@example.test, Windows Laptop.',
  );

  assert.equal(fields.issueType, 'vpn');
  assert.equal(fields.affectedSystem, 'VPN');
  assert.equal(fields.impact, 'multiple_users');
  assert.equal(fields.operatingSystem, 'Windows');
  assert.match(fields.device, /Laptop/i);
  assert.equal(fields.reporterName, 'Max Mustermann');
  assert.equal(fields.reporterEmail, 'max@example.test');
  assert.equal(fields.description?.includes('max@example.test'), false);
});

test('ticket helper keeps existing description and summary stable', () => {
  const previous = {
    status: 'collecting',
    description: 'Bestehende Beschreibung',
    summary: 'Bestehende Zusammenfassung',
  };

  const fields = extractItTicketFields('Outlook zeigt eine Fehlermeldung.', previous);

  assert.equal(fields.description, undefined);
  assert.equal(fields.summary, undefined);
  assert.equal(fields.issueType, 'outlook');
  assert.equal(fields.affectedSystem, 'Outlook');
});

test('ticket helper returns no fields for empty messages', () => {
  assert.deepEqual(extractItTicketFields('   '), {});
});

test('ticket helper detects missing fields and ready state', () => {
  const partialTicket = mergePendingTicket(null, {
    status: 'collecting',
    description: 'VPN funktioniert nicht.',
    affectedSystem: 'VPN',
  });

  assert.deepEqual(
    getMissingItTicketFields(partialTicket, ['description', 'affectedSystem', 'impact', 'reporterEmail']),
    ['impact', 'reporterEmail'],
  );
  assert.equal(isTicketCaptureComplete(partialTicket, ['description', 'affectedSystem', 'impact', 'reporterEmail']), false);
  assert.equal(shouldAskForTicketField(partialTicket, ['description', 'affectedSystem', 'impact', 'reporterEmail']), true);

  const completeTicket = mergePendingTicket(partialTicket, {
    impact: 'single_user',
    reporterEmail: 'max@example.test',
  });

  assert.deepEqual(
    getMissingItTicketFields(completeTicket, ['description', 'affectedSystem', 'impact', 'reporterEmail']),
    [],
  );
  assert.equal(isTicketCaptureComplete(completeTicket, ['description', 'affectedSystem', 'impact', 'reporterEmail']), true);
  assert.equal(shouldAskForTicketField(completeTicket, ['description', 'affectedSystem', 'impact', 'reporterEmail']), false);
});

test('ticket helper maps missing fields to assistant ask state', () => {
  assert.equal(mapTicketMissingFieldToAssistantAsk('reporterEmail'), 'reporter_contact');
  assert.equal(mapTicketMissingFieldToAssistantAsk('reporterPhone'), 'reporter_contact');
  assert.equal(mapTicketMissingFieldToAssistantAsk('reporterName'), 'reporter_contact');
  assert.equal(mapTicketMissingFieldToAssistantAsk('affectedSystem'), 'affected_system');
  assert.equal(mapTicketMissingFieldToAssistantAsk('impact'), 'impact');
  assert.equal(mapTicketMissingFieldToAssistantAsk('errorMessage'), 'error_message');
  assert.equal(mapTicketMissingFieldToAssistantAsk('unknown'), 'description');
});

test('ticket helper builds metadata patches without mutating input', () => {
  const previousState = Object.freeze({
    intent: 'support',
    topic: 'Alter Kontext',
    collectedFields: Object.freeze({
      name: 'Vorhandener Name',
    }),
  });
  const ticket = Object.freeze({
    status: 'ready_to_create',
    description: 'VPN funktioniert nicht.',
    affectedSystem: 'VPN',
    reporterEmail: 'max@example.test',
    missingFields: [],
  });

  const patch = buildTicketMetadataPatch({
    previousConversationState: previousState,
    pendingTicket: ticket,
    stage: 'contact_collection',
  });

  assert.equal(patch.pendingLead, null);
  assert.equal(patch.pendingTicket, ticket);
  assert.equal(patch.conversationState.intent, 'ticket');
  assert.equal(patch.conversationState.goal, 'create_ticket');
  assert.equal(patch.conversationState.collectedFields.email, 'max@example.test');
  assert.equal(previousState.intent, 'support');

  const completed = buildCompletedTicketMetadataPatch({
    previousConversationState: previousState,
    pendingTicket: ticket,
  });

  assert.equal(completed.conversationState.stage, 'completed');
});

test('ticket helper builds conversation state and preserves collected fields', () => {
  const state = buildTicketConversationState(
    {
      collectedFields: {
        company: 'Demo GmbH',
      },
    },
    {
      status: 'collecting',
      summary: 'VPN: Verbindungsfehler',
      urgency: 'urgent',
      reporterPhone: '0155 11410215',
      missingFields: ['reporterEmail'],
      nextExpectedField: 'reporterEmail',
    },
    'contact_collection',
  );

  assert.equal(state.intent, 'ticket');
  assert.equal(state.goal, 'create_ticket');
  assert.equal(state.topic, 'VPN: Verbindungsfehler');
  assert.equal(state.urgency, 'urgent');
  assert.equal(state.collectedFields.company, 'Demo GmbH');
  assert.equal(state.collectedFields.phone, '0155 11410215');
  assert.deepEqual(state.missingFields, ['reporterEmail']);
  assert.equal(state.nextExpectedField, 'reporterEmail');
});

test('ticket helper builds agent ticket payload without lead fields or secrets', () => {
  const ticket = mergePendingTicket(null, {
    status: 'ready_to_create',
    description: 'VPN funktioniert nicht. Passwort ist supersecret.',
    affectedSystem: 'VPN',
    impact: 'single_user',
    reporterEmail: 'max@example.test',
    reporterName: 'Max Mustermann',
    errorMessage: 'Fehler: token abc123',
  });

  const payload = buildAgentTicketPayload({
    ticket,
    tenantId: 'tenant-1',
    siteId: 'site-1',
    conversationId: 'conversation-1',
  });

  assert.equal(payload.category, 'it_support');
  assert.equal(payload.conversationId, 'conversation-1');
  assert.equal(payload.reporterEmail, 'max@example.test');
  assert.equal(payload.customerEmail, 'max@example.test');
  assert.equal(payload.metadata.tenantId, 'tenant-1');
  assert.equal(payload.metadata.siteId, 'site-1');
  assert.equal(JSON.stringify(payload).includes('supersecret'), false);
  assert.equal(JSON.stringify(payload).includes('abc123'), false);
  assert.equal(Object.hasOwn(payload, 'widgetLeadId'), false);
  assert.equal(Object.hasOwn(payload, 'leadId'), false);
});

test('ticket helper builds side effect commands as data only', () => {
  const incomplete = mergePendingTicket(null, {
    status: 'collecting',
    description: 'VPN funktioniert nicht.',
  });
  assert.deepEqual(buildTicketSideEffectCommands({ ticket: incomplete, requiredFields: ['description', 'reporterEmail'] }), []);

  const complete = mergePendingTicket(incomplete, {
    status: 'ready_to_create',
    reporterEmail: 'max@example.test',
  });
  const commands = buildTicketSideEffectCommands({
    ticket: complete,
    requiredFields: ['description', 'reporterEmail'],
    metadataPatch: { pendingTicket: complete },
    auditPayload: { action: 'ticket_ready', metadata: { hasEmail: true } },
    notificationPayload: { channel: 'ticket' },
  });

  assert.deepEqual(commands.map((command) => command.type), [
    'update_metadata',
    'record_ticket_audit',
    'queue_ticket_notification',
    'insert_agent_ticket',
  ]);
  assert.equal(commands.some((command) => command.type === 'insert_widget_lead'), false);
  assert.equal(commands.some((command) => String(command.type).includes('lead')), false);
});

test('ticket helper exposes status and answer helpers unchanged', () => {
  assert.equal(isActivePendingTicket({ status: 'collecting' }), true);
  assert.equal(isActivePendingTicket({ status: 'created' }), false);
  assert.equal(parseTicketForwardingStatus('queued'), 'queued');
  assert.equal(parseTicketForwardingStatus('unexpected'), 'unknown');
  assert.equal(shouldCreateTicket({ status: 'ready_to_create' }), true);
  assert.equal(shouldCreateTicket({ status: 'ready_to_create', createdTicketId: 'ticket-1' }), false);

  const answer = buildCreatedItTicketAnswer({
    status: 'created',
    createdTicketId: 'ticket-1',
    description: 'VPN funktioniert nicht.',
    affectedSystem: 'VPN',
    impact: 'single_user',
    reporterEmail: 'max@example.test',
    priority: 'normal',
  }, 'queued');

  assert.match(answer, /Support-Ticket erstellt/);
  assert.match(answer, /Ticket: ticket-1/);

  const warning = withItSecurityWarning('Antwort');
  assert.match(warning, /kritischen IT- oder Sicherheitsvorfall/);
  assert.match(warning, /\n\nAntwort$/);
});

test('ticket helper source stays side-effect free', () => {
  const sourcePath = path.join(__dirname, '../src/chat/it-support-ticket.helpers.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.equal(/\bawait\b/.test(source), false);
  assert.equal(/process\.env/.test(source), false);
  assert.equal(/logEvent|Logger|console\./.test(source), false);
  assert.equal(/prisma|queryRaw|executeRaw|INSERT INTO|UPDATE\s+/i.test(source), false);
  assert.equal(/email_jobs|webhook_jobs|widget_leads/.test(source), false);
  assert.equal(/executeTool|ToolExecutor|ToolDispatcher/.test(source), false);
});
