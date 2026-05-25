const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatAgentOrchestratorService } = require('../dist/chat/chat-agent-orchestrator.service.js');

function createHarness({
  smtpConfigured = true,
  leadNotificationEmail = 'leads@example.com',
  scheduleUrl = '',
  usageLimits,
  siteName = 'Demo Kunde',
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
              name: siteName,
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
    usageLimits || {
      async withMonthlyLeadLimit(_tenantId, callback) {
        return callback(db, async () => undefined);
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

test('ChatAgentOrchestratorService answers greetings without starting lead capture', async () => {
  const { decide, leads, conversations } = createHarness();

  const result = await decide('hallo');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /Wobei kann ich dich unterstützen/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService treats greeting typos as greeting', async () => {
  const { decide, leads, conversations } = createHarness();

  const result = await decide('hsallo');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /Wobei kann ich dich unterstützen/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
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

test('ChatAgentOrchestratorService starts local service intake without price or time promises', async () => {
  const { decide, conversations, leads } = createHarness();

  const result = await decide('Meine Toilette ist verstopft');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /Ort|PLZ|Einsatzort/i);
  assert.doesNotMatch(result.answer, /E-Mail|Telefon|Name|erreichen/i);
  assert.doesNotMatch(result.answer, /garantiert|kostenlos|in \d+ minuten|festpreis/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(
    conversations.get('conversation-1').metadata.pendingLead.concern,
    'Meine Toilette ist verstopft',
  );
});

test('ChatAgentOrchestratorService handles local service free-text intake step by step', async () => {
  const { decide, conversations, leads } = createHarness();

  const first = await decide('Mein Abfluss läuft nicht ab');
  const location = await decide('Frankfurt');
  const urgency = await decide('akut, Wasser läuft zurück');
  const phone = await decide('015511410215');

  assert.match(first.answer, /Ort|PLZ|Einsatzort/i);
  assert.match(location.answer, /dringend|Wasser|planbar/i);
  assert.match(urgency.answer, /Telefonnummer|Rückruf/i);
  assert.match(phone.answer, /Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'Mein Abfluss läuft nicht ab');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, 'Frankfurt');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
});

test('ChatAgentOrchestratorService asks for the affected problem when local notdienst lacks details', async () => {
  const { decide, conversations, leads } = createHarness();

  const result = await decide('Ich brauche Notdienst in Frankfurt');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /Toilette|Abfluss|Keller|Kanal/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, 'Frankfurt');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
});

test('ChatAgentOrchestratorService answers local service pricing without lead pressure', async () => {
  const { decide, leads, conversations } = createHarness();

  const result = await decide('Was kostet eine Rohrreinigung?');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /Kosten hängen vom Aufwand/i);
  assert.match(result.answer, /kurz schildern/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService handles local service meter billing question without lead pressure', async () => {
  const { decide, leads, conversations } = createHarness({ siteName: 'Rohrreinigung-ffm24' });

  const result = await decide('Rechnen Sie nach laufenden Metern ab?');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /laufenden Metern/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService lets standalone service area statements use normal knowledge flow', async () => {
  const { decide, leads } = createHarness({ siteName: 'Rohrreinigung-ffm24' });

  const result = await decide('Ich wohne in Offenbach');

  assert.equal(result.handled, false);
  assert.equal(result.action, 'normal_answer');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService clarifies callback urgency before asking for phone on local sites', async () => {
  for (const message of ['Ich möchte zurückgerufen werden', 'Können Sie mich anrufen?']) {
    const { decide, leads } = createHarness({ siteName: 'Rohrreinigung-ffm24' });

    const result = await decide(message);

    assert.equal(result.handled, true, message);
    assert.equal(result.action, 'ask_for_contact', message);
    assert.match(result.answer, /akuten Notfall|allgemeine Anfrage/i, message);
    assert.doesNotMatch(result.answer, /Telefonnummer|E-Mail|Name/i, message);
    assert.equal(leads.length, 0, message);
  }
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

test('ChatAgentOrchestratorService pauses pending lead on confusion instead of repeating contact prompt', async () => {
  const { decide, conversations, leads } = createHarness();

  await decide('Ich brauche Beratung');
  const result = await decide('was soll das');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /zu früh nach Kontaktdaten/i);
  assert.doesNotMatch(result.answer, /E-Mail oder Telefon/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'paused');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.leadCapturePaused, true);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService does not repeat contact question after refusal', async () => {
  const { decide, conversations, leads } = createHarness();

  await decide('Ich brauche Beratung');
  await decide('Es geht um KI für Kundenanfragen');
  const result = await decide('nein');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.doesNotMatch(result.answer, /E-Mail oder Telefon/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'paused');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.pauseReason, 'refusal');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService qualifies broad AI need before asking for contact', async () => {
  const { decide, conversations, leads } = createHarness();

  const result = await decide('Ich brauche eine KI für mein Unternehmen');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /Support, Kundengewinnung oder interne Prozesse/i);
  assert.doesNotMatch(result.answer, /E-Mail oder Telefon/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
  assert.equal(conversations.get('conversation-1').metadata.conversationState.stage, 'qualification');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService allows offer intent to enter lead flow', async () => {
  const { decide, conversations, leads } = createHarness();

  const result = await decide('Ich möchte ein Angebot');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /Worum geht es genau/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService captures when user provides email in pending lead flow', async () => {
  const { decide, leads } = createHarness();

  await decide('Ich brauche Beratung');
  await decide('Es geht um KI für Kundenanfragen');
  await decide('Max Mustermann');
  const result = await decide('max@example.de');

  assert.equal(result.action, 'capture_lead');
  assert.equal(leads.length, 1);
  assert.equal(leads[0].email, 'max@example.de');
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

test('ChatAgentOrchestratorService uses stored conversation topic for appointment contact collection', async () => {
  const { decide, conversations } = createHarness();
  conversations.set('conversation-1', {
    metadata: {
      conversationState: {
        intent: 'support',
        stage: 'qualification',
        topic: 'KI für Unternehmen / Support',
        urgency: 'high',
        goal: 'answer_question',
        collectedFields: {
          concern: 'KI für Unternehmen / Support',
        },
      },
    },
  });

  const result = await decide('einen termin');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.doesNotMatch(result.answer, /Worum geht es genau/i);
  assert.match(result.answer, /E-Mail oder Telefon/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.scheduleIntent, true);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'KI für Unternehmen / Support');
  assert.equal(conversations.get('conversation-1').metadata.conversationState.goal, 'schedule_call');
  assert.equal(conversations.get('conversation-1').metadata.conversationState.stage, 'contact_collection');
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

test('ChatAgentOrchestratorService turns preferred phone channel into a concrete phone request', async () => {
  const { decide, conversations, leads } = createHarness();

  await decide('Ich brauche eine KI für mein Unternehmen');
  await decide('um Support');
  const appointmentReply = await decide('einen termin');
  const phoneChannelReply = await decide('telefon');

  assert.match(appointmentReply.answer, /E-Mail oder Telefon/i);
  assert.doesNotMatch(phoneChannelReply.answer, /Wie können wir dich am besten erreichen/i);
  assert.match(phoneChannelReply.answer, /Telefonnummer/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.preferredContact, 'phone');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.scheduleIntent, true);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService stops lead prompt after one unanswered contact request', async () => {
  const { decide, conversations, leads } = createHarness();

  await decide('Ich brauche Beratung');
  await decide('Es geht um KI für Kundenanfragen');
  const result = await decide('ok');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.doesNotMatch(result.answer, /E-Mail oder Telefon/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'paused');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.pauseReason, 'prompt_limit');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService recovers from bot complaint without capture', async () => {
  const { decide, conversations, leads } = createHarness();

  await decide('Ich brauche Beratung');
  const result = await decide('du wiederholst dich');

  assert.equal(result.handled, true);
  assert.match(result.answer, /normal weiterhelfen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'paused');
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

test('ChatAgentOrchestratorService returns a plan limit message without storing lead', async () => {
  const { decide, leads } = createHarness({
    usageLimits: {
      async withMonthlyLeadLimit(_tenantId, callback) {
        return callback(
          {
            async query(sql) {
              if (/SELECT id\s+FROM widget_leads/i.test(sql)) {
                return { rows: [] };
              }
              if (/INSERT INTO widget_leads/i.test(sql)) {
                leads.push({ id: 'should-not-store' });
                return { rows: [] };
              }
              return { rows: [] };
            },
          },
          async () => {
            const error = new Error('Dein aktueller Plan erlaubt maximal 1 Anfragen pro Monat. Upgrade erforderlich.');
            error.response = {
              code: 'limit_exceeded',
              message: 'Dein aktueller Plan erlaubt maximal 1 Anfragen pro Monat. Upgrade erforderlich.',
            };
            throw error;
          },
        );
      },
    },
  });

  const result = await decide(
    'Ich brauche Beratung zu KI Automatisierung. Mein Name ist Max Mustermann, max@example.de',
  );

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /maximal 1 Anfragen/i);
  assert.equal(leads.length, 0);
});
