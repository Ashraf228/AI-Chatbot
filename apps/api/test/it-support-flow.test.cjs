const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildItSupportAnswerGuide,
  buildCreateTicketInputFromPendingTicket,
  buildSafeFallbackTroubleshootingSteps,
  classifyTicketPriority,
  getMissingItTicketFields,
  shouldStartNewItSupportContext,
} = require('../dist/modules/it-support/it-support-flow.js');

test('it-support answer guide contains first-level support and safety rules', () => {
  const guide = buildItSupportAnswerGuide({
    knowledgeAvailable: false,
  });

  assert.match(guide, /First-Level-Support/i);
  assert.match(guide, /Wissensbasis/i);
  assert.match(guide, /Hat das geholfen/i);
  assert.match(guide, /Passwörtern|Passwoertern/i);
  assert.match(guide, /MFA-Codes/i);
  assert.match(guide, /API-Keys/i);
  assert.match(guide, /Tokens/i);
  assert.match(guide, /Secrets/i);
  assert.match(guide, /PowerShell/i);
  assert.match(guide, /Terminal/i);
  assert.match(guide, /Registry/i);
  assert.match(guide, /Löschbefehle|Loeschbefehle/i);
});

test('it-support fallback steps for vpn are safe', () => {
  const steps = buildSafeFallbackTroubleshootingSteps('vpn').join(' ');

  assert.match(steps, /Internetverbindung/i);
  assert.match(steps, /VPN-Client/i);
  assert.match(steps, /Fehlermeldung/i);
  assert.doesNotMatch(steps, /powershell|regedit|rm -rf|format/i);
});

test('it-support fallback steps for security avoid risky actions and escalate', () => {
  const steps = buildSafeFallbackTroubleshootingSteps('security').join(' ');

  assert.match(steps, /Keine Links oder Anhänge öffnen/i);
  assert.match(steps, /Keine Passwörter/i);
  assert.match(steps, /Ticket|Eskalation/i);
  assert.doesNotMatch(steps, /Passwort.*senden|MFA.*senden/i);
});

test('it-support fallback steps default to safe generic triage', () => {
  const steps = buildSafeFallbackTroubleshootingSteps('unknown').join(' ');

  assert.match(steps, /Problem kurz eingrenzen/i);
  assert.match(steps, /Fehlermeldung/i);
  assert.match(steps, /welches System/i);
  assert.match(steps, /Ticket anbieten/i);
});

test('it-support flow builds create_ticket input from pending ticket state', () => {
  const input = buildCreateTicketInputFromPendingTicket({
    status: 'ready_to_create',
    issueType: 'vpn',
    affectedSystem: 'VPN',
    summary: 'VPN verbindet nicht',
    description: 'VPN verbindet nicht seit heute Morgen',
    impact: 'single_user',
    urgency: 'normal',
    priority: 'normal',
    reporterEmail: 'max@firma.de',
    reporterName: 'Max',
    device: 'Windows Laptop',
    operatingSystem: 'Windows',
    errorMessage: 'Fehler 809',
    alreadyTried: 'VPN-App neu gestartet',
    solutionAttemptCount: 1,
    lastAssistantAsk: 'ticket_final_confirmation',
  }, {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    conversationId: 'conversation-1',
  });

  assert.match(input.subject, /^IT-Support: VPN - VPN verbindet nicht/);
  assert.equal(input.category, 'it_support');
  assert.equal(input.issueType, 'vpn');
  assert.equal(input.affectedSystem, 'VPN');
  assert.equal(input.reporterEmail, 'max@firma.de');
  assert.equal(input.customerEmail, 'max@firma.de');
  assert.equal(input.metadata.sourceAgent, 'it-support-agent');
  assert.equal(input.metadata.pendingTicketStatus, 'ready_to_create');
  assert.equal(input.conversationId, 'conversation-1');
  assert.match(input.description, /Betroffenes System: VPN/);
});

test('it-support flow classifies critical security tickets as critical', () => {
  const priority = classifyTicketPriority({
    status: 'ticket_offered',
    issueType: 'security',
    summary: 'Phishing und Malware',
    urgency: 'critical',
  });

  assert.equal(priority, 'critical');
});

test('it-support flow redacts sensitive values from ticket input', () => {
  const input = buildCreateTicketInputFromPendingTicket({
    status: 'ready_to_create',
    issueType: 'security',
    affectedSystem: 'Login',
    summary: 'Passwort ist SuperSecret123 und MFA Code ist 123456',
    description: 'API key ist abc123 und token ist xyz789',
    impact: 'single_user',
    reporterEmail: 'max@firma.de',
    errorMessage: 'access_token xyz und refresh_token abc',
    alreadyTried: 'Bearer abcdef123456',
    attemptedSolutions: ['client_secret test123'],
  });

  const serialized = JSON.stringify(input);
  assert.doesNotMatch(serialized, /SuperSecret123|123456|abc123|xyz789|test123|abcdef123456/);
  assert.match(serialized, /\[redacted\]/);
});

test('it-support flow detects new IT problems after terminal pending ticket states', () => {
  assert.equal(shouldStartNewItSupportContext({
    text: 'Ja',
    pendingTicket: { status: 'created', createdTicketId: 'ticket-1' },
  }), false);
  assert.equal(shouldStartNewItSupportContext({
    text: 'Mein Drucker druckt nicht.',
    pendingTicket: { status: 'created', createdTicketId: 'ticket-1' },
  }), true);
  assert.equal(shouldStartNewItSupportContext({
    text: 'Ich möchte ein Ticket erstellen.',
    pendingTicket: { status: 'created', createdTicketId: 'ticket-1' },
  }), false);
  assert.equal(shouldStartNewItSupportContext({
    text: 'Outlook geht nicht.',
    pendingTicket: { status: 'resolved' },
  }), true);
  assert.equal(shouldStartNewItSupportContext({
    text: 'Ich möchte doch ein Ticket erstellen, VPN geht nicht.',
    pendingTicket: { status: 'cancelled' },
  }), true);
});

test('it-support flow keeps required field detection intact', () => {
  const missing = getMissingItTicketFields({
    status: 'collecting',
    description: 'VPN verbindet nicht',
    affectedSystem: 'VPN',
  }, ['description', 'affectedSystem', 'impact', 'reporterEmail']);

  assert.deepEqual(missing, ['impact', 'reporterEmail']);
});
