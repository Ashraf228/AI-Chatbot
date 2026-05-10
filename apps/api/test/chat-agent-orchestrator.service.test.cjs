const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatAgentOrchestratorService } = require('../dist/chat/chat-agent-orchestrator.service.js');

function createHarness({
  smtpConfigured = true,
  leadNotificationEmail = 'leads@example.com',
  scheduleUrl = '',
} = {}) {
  const conversations = new Map([
    ['conversation-1', { metadata: {} }],
  ]);
  const leads = [];
  const contactRequests = [];
  const emailJobs = [];
  const auditLogs = [];

  const db = {
    async query(sql, params = []) {
      if (/SELECT name, config\s+FROM sites/i.test(sql)) {
        return {
          rows: [
            {
              name: 'Demo Kunde',
              config: {
                setupGoal: 'lead_capture',
                leadNotificationEmail,
                ctaText: 'Kontakt aufnehmen',
                scheduleUrl,
              },
            },
          ],
        };
      }

      if (/SELECT id, metadata\s+FROM conversations/i.test(sql)) {
        const conversation = conversations.get(params[0]) || { metadata: {} };
        return { rows: [{ id: params[0], metadata: conversation.metadata }] };
      }

      if (/UPDATE conversations\s+SET metadata = jsonb_set/i.test(sql)) {
        const conversation = conversations.get(params[0]) || { metadata: {} };
        conversation.metadata = {
          ...conversation.metadata,
          pendingLead: JSON.parse(params[1]),
        };
        conversations.set(params[0], conversation);
        return { rows: [] };
      }

      if (/UPDATE conversations\s+SET metadata = COALESCE\(metadata/i.test(sql)) {
        const conversation = conversations.get(params[0]) || { metadata: {} };
        conversation.metadata = {
          ...conversation.metadata,
          ...JSON.parse(params[1]),
        };
        conversations.set(params[0], conversation);
        return { rows: [] };
      }

      if (/SELECT id\s+FROM widget_leads/i.test(sql)) {
        const [siteId, sessionId, email, phone] = params;
        const existing = leads.find((lead) =>
          lead.siteId === siteId &&
          lead.sessionId === sessionId &&
          ((email && lead.email === email) || (phone && lead.phone === phone))
        );
        return { rows: existing ? [{ id: existing.id }] : [] };
      }

      if (/INSERT INTO widget_leads/i.test(sql)) {
        leads.push({
          id: params[0],
          siteId: params[1],
          sessionId: params[2],
          name: params[3],
          email: params[4],
          phone: params[5],
          message: params[6],
        });
        return { rows: [] };
      }

      if (/UPDATE widget_sessions/i.test(sql)) {
        return { rows: [] };
      }

      if (/SELECT id\s+FROM agent_contact_requests/i.test(sql)) {
        const [siteId, email, phone] = params;
        const existing = contactRequests.find((request) =>
          request.siteId === siteId && ((email && request.email === email) || (phone && request.phone === phone))
        );
        return { rows: existing ? [{ id: existing.id }] : [] };
      }

      if (/INSERT INTO agent_contact_requests/i.test(sql)) {
        contactRequests.push({
          id: params[0],
          tenantId: params[1],
          siteId: params[2],
          name: params[3],
          email: params[4],
          phone: params[5],
          preferredChannel: params[6],
          note: params[7],
        });
        return { rows: [] };
      }

      if (/INSERT INTO email_jobs/i.test(sql)) {
        emailJobs.push({
          id: params[0],
          to: params[1],
          subject: params[2],
          metadata: JSON.parse(params[5]),
        });
        return { rows: [] };
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditLogs.push({
          id: params[0],
          tenantId: params[1],
          siteId: params[2],
          action: params[3],
          metadata: JSON.parse(params[4]),
        });
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  const service = new ChatAgentOrchestratorService(
    db,
    {
      async listForSite(siteId) {
        return [
          {
            siteId,
            key: 'lead-sales',
            isEnabled: true,
            config: {
              primaryGoal: 'lead_capture',
              ctaLabel: 'Kontaktdaten hinterlassen',
              ctaDescription: 'Wir nehmen deine Anfrage auf.',
            },
          },
        ];
      },
    },
    {
      buildLeadNotification(payload) {
        return {
          to: payload.recipientEmail,
          subject: `Neue Anfrage über den Chatbot – ${payload.siteName}`,
          html: `<p>${payload.lead.name}</p>`,
          text: payload.lead.name,
        };
      },
    },
    {
      isConfigured() {
        return smtpConfigured;
      },
    },
  );

  async function decide(message, history = []) {
    return service.decide({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      conversationId: 'conversation-1',
      sessionId: 'session-1',
      message,
      history,
    });
  }

  return {
    service,
    decide,
    conversations,
    leads,
    contactRequests,
    emailJobs,
    auditLogs,
  };
}

test('ChatAgentOrchestratorService lets normal chat continue untouched', async () => {
  const { decide, leads, conversations } = createHarness();

  const result = await decide('Welche Leistungen bietet ihr an?');

  assert.equal(result.handled, false);
  assert.equal(result.action, 'normal_answer');
  assert.equal(leads.length, 0);
  assert.deepEqual(conversations.get('conversation-1').metadata, {});
});

test('ChatAgentOrchestratorService starts a pending lead and asks for the concern first', async () => {
  const { decide, conversations, auditLogs } = createHarness();

  const result = await decide('Ich brauche Beratung');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /Worum geht es genau/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(auditLogs[0].action, 'lead_pending_started');
  assert.deepEqual(auditLogs[0].metadata.missingFields, ['concern', 'name', 'contact']);
});

test('ChatAgentOrchestratorService captures a lead over multiple messages', async () => {
  const { decide, conversations, leads, emailJobs, auditLogs } = createHarness();

  await decide('Ich brauche Beratung');
  const concernReply = await decide('Es geht um KI für Kundenanfragen');
  const nameReply = await decide('Ich heiße Max Mustermann');
  const finalReply = await decide('max@example.de');

  assert.match(concernReply.answer, /Wie heißt du/i);
  assert.match(nameReply.answer, /E-Mail oder Telefon/i);
  assert.equal(finalReply.action, 'capture_lead');
  assert.equal(leads.length, 1);
  assert.equal(leads[0].name, 'Max Mustermann');
  assert.equal(leads[0].email, 'max@example.de');
  assert.equal(leads[0].message, 'Es geht um KI für Kundenanfragen');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'completed');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.completedLeadId, leads[0].id);
  assert.equal(emailJobs.length, 1);
  assert.equal(emailJobs[0].to, 'leads@example.com');
  assert.ok(auditLogs.some((entry) => entry.action === 'lead_captured'));
  assert.equal(
    auditLogs.some((entry) => JSON.stringify(entry.metadata).includes('KI für Kundenanfragen')),
    false,
  );
});

test('ChatAgentOrchestratorService marks schedule intent and prepares contact handoff', async () => {
  const { decide, conversations, leads, contactRequests } = createHarness({
    scheduleUrl: 'https://example.com/termin',
  });

  const result = await decide(
    'Ich möchte einen Termin machen. Es geht um KI Beratung. Mein Name ist Max Mustermann, max@example.de',
  );

  assert.equal(result.action, 'suggest_schedule');
  assert.match(result.answer, /https:\/\/example.com\/termin/);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.scheduleIntent, true);
  assert.equal(leads.length, 1);
  assert.equal(contactRequests.length, 1);
  assert.equal(contactRequests[0].preferredChannel, 'email');
});

test('ChatAgentOrchestratorService keeps context when appointment intent follows discovery', async () => {
  const { decide, conversations, auditLogs } = createHarness();

  await decide('Ich brauche eine KI für mein Unternehmen');
  await decide('um Support');
  await decide('sehr groß');
  const result = await decide('einen termin');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.doesNotMatch(result.answer, /Worum geht es genau/i);
  assert.match(result.answer, /E-Mail oder Telefon/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.scheduleIntent, true);
  assert.match(conversations.get('conversation-1').metadata.pendingLead.concern, /KI/i);
  assert.match(conversations.get('conversation-1').metadata.pendingLead.concern, /Support/i);
  assert.equal(conversations.get('conversation-1').metadata.conversationState.goal, 'schedule_call');
  assert.equal(conversations.get('conversation-1').metadata.conversationState.intent, 'appointment');
  assert.equal(conversations.get('conversation-1').metadata.conversationState.urgency, 'high');
  assert.ok(auditLogs.some((entry) => entry.action === 'schedule_intent_detected'));
});

test('ChatAgentOrchestratorService returns schedule link when appointment lead is complete', async () => {
  const { decide, leads, contactRequests } = createHarness({
    scheduleUrl: 'https://example.com/book',
  });

  await decide('Ich brauche eine KI für mein Unternehmen');
  await decide('um Support');
  const contactReply = await decide('einen termin');
  const nameReply = await decide('max@example.de');
  const finalReply = await decide('Max Mustermann');

  assert.match(contactReply.answer, /E-Mail oder Telefon/i);
  assert.match(nameReply.answer, /Wie heißt du/i);
  assert.equal(finalReply.action, 'suggest_schedule');
  assert.match(finalReply.answer, /https:\/\/example.com\/book/);
  assert.equal(leads.length, 1);
  assert.equal(contactRequests.length, 1);
});

test('ChatAgentOrchestratorService asks for contact when appointment has context but no schedule link', async () => {
  const { decide, leads } = createHarness();

  await decide('Ich brauche eine KI für mein Unternehmen');
  await decide('um Support');
  const result = await decide('einen termin');

  assert.equal(result.action, 'ask_for_contact');
  assert.doesNotMatch(result.answer, /Worum geht es genau/i);
  assert.match(result.answer, /E-Mail oder Telefon/i);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService deduplicates repeated lead data in the same session', async () => {
  const { decide, leads, emailJobs } = createHarness();
  const message = 'Ich brauche Beratung zu KI Automatisierung. Mein Name ist Max Mustermann, max@example.de';

  await decide(message);
  await decide(message);

  assert.equal(leads.length, 1);
  assert.equal(emailJobs.length, 1);
});

test('ChatAgentOrchestratorService stores lead when SMTP is missing and does not throw', async () => {
  const { decide, leads, emailJobs, auditLogs } = createHarness({ smtpConfigured: false });

  const result = await decide(
    'Ich brauche Beratung zu KI Automatisierung. Mein Name ist Max Mustermann, max@example.de',
  );

  assert.equal(result.handled, true);
  assert.equal(result.action, 'capture_lead');
  assert.equal(leads.length, 1);
  assert.equal(emailJobs.length, 0);
  assert.ok(auditLogs.some((entry) => entry.action === 'lead_captured'));
});
