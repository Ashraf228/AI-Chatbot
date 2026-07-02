const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatAgentOrchestratorService } = require('../dist/chat/chat-agent-orchestrator.service.js');
const {
  DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
} = require('../dist/site-modules/module-configs.js');

const FORBIDDEN_LOCAL_SERVICE_TERMS =
  /Projekt|Support-Anfrage|Business-Prozess|Automatisierung|Beratungsgespräch/i;
const DRAIN_CLEANING_TERMS =
  /Toilette|Abfluss|Keller|Kanal|Rohr|Rückstau|rueckstau|Verstopfung/i;
const FULL_TEST_ADDRESS = 'Musterstraße 12, 65549 Limburg';

function buildLocalServiceFlow(overrides = {}) {
  return {
    ...DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    ...overrides,
    genericLocalServiceKeywords:
      overrides.genericLocalServiceKeywords ||
      DEFAULT_LOCAL_SERVICE_INTAKE_FLOW.genericLocalServiceKeywords,
    problemKeywords:
      overrides.problemKeywords ||
      DEFAULT_LOCAL_SERVICE_INTAKE_FLOW.problemKeywords,
    pricingKeywords:
      overrides.pricingKeywords ||
      DEFAULT_LOCAL_SERVICE_INTAKE_FLOW.pricingKeywords,
    callbackKeywords:
      overrides.callbackKeywords ||
      DEFAULT_LOCAL_SERVICE_INTAKE_FLOW.callbackKeywords,
    questionTexts: {
      ...DEFAULT_LOCAL_SERVICE_INTAKE_FLOW.questionTexts,
      ...(overrides.questionTexts || {}),
    },
  };
}

const ELECTRICIAN_INTAKE_FLOW = buildLocalServiceFlow({
  subIndustry: 'electrician',
  problemKeywords: [
    'strom',
    'stromausfall',
    'sicherung',
    'kurzschluss',
    'elektriker',
    'steckdose',
    'licht',
    'verteilerkasten',
  ],
  questionTexts: {
    problem: 'Was genau ist betroffen - Stromausfall, Sicherung, Steckdose oder Licht?',
    location: 'In welchem Ort oder welcher PLZ wird ein Elektriker benötigt?',
    urgency: 'Wie dringend ist es aktuell - Notfall, heute noch oder planbarer Termin?',
    phone: 'Unter welcher Telefonnummer kann der Elektriker Sie zurückrufen?',
    name: 'Auf welchen Namen dürfen wir die Anfrage aufnehmen?',
    callback: 'Gerne. Geht es um einen akuten Stromausfall oder um eine allgemeine Anfrage?',
  },
  pricingAnswerTemplate:
    'Die Kosten hängen vom Einsatz, der Dringlichkeit und dem benötigten Aufwand vor Ort ab. Eine genaue Einschätzung ist nach kurzer Problembeschreibung möglich.',
});

const SHK_INTAKE_FLOW = buildLocalServiceFlow({
  subIndustry: 'shk_heating',
  genericLocalServiceKeywords: [
    ...DEFAULT_LOCAL_SERVICE_INTAKE_FLOW.genericLocalServiceKeywords,
    'notfall',
    'hilfe',
  ],
  problemKeywords: [
    'heizung',
    'heizungsausfall',
    'warmes wasser',
    'warmwasser',
    'sanitär',
    'sanitaer',
    'therme',
    'boiler',
    'wasserhahn',
  ],
  questionTexts: {
    problem: 'Was genau ist betroffen - Heizung, Warmwasser, Sanitär oder ein anderes Problem?',
    location: 'In welchem Ort oder welcher PLZ wird Hilfe benötigt?',
    urgency: 'Wie dringend ist es aktuell - Notfall, heute noch oder planbarer Termin?',
    phone: 'Unter welcher Telefonnummer kann der Fachbetrieb Sie zurückrufen?',
    name: 'Auf welchen Namen dürfen wir die Anfrage aufnehmen?',
    callback: 'Gerne. Geht es um einen akuten Ausfall oder um eine allgemeine Anfrage?',
  },
  pricingAnswerTemplate:
    'Die Kosten hängen vom Problem, der Dringlichkeit und dem Aufwand vor Ort ab. Eine genaue Einschätzung ist nach kurzer Problembeschreibung möglich.',
});

const CLEANING_INTAKE_FLOW = buildLocalServiceFlow({
  subIndustry: 'building_cleaning',
  genericLocalServiceKeywords: [
    'einsatz',
    'einsatzort',
    'rückruf',
    'rueckruf',
    'kosten',
    'preis',
    'termin',
    'regelmäßig',
    'regelmaessig',
  ],
  problemKeywords: [
    'reinigung',
    'büroreinigung',
    'bueroereinigung',
    'büro',
    'buero',
    'gebäudereinigung',
    'gebaeudereinigung',
    'unterhaltsreinigung',
    'treppenhaus',
    'praxisreinigung',
  ],
  questionTexts: {
    problem: 'Um welche Reinigung geht es - Büro, Praxis, Treppenhaus oder ein anderes Objekt?',
    location: 'In welchem Ort oder welcher PLZ befindet sich das Objekt?',
    urgency: 'Geht es um einen einmaligen Einsatz oder eine regelmäßige Reinigung?',
    phone: 'Unter welcher Telefonnummer können wir Sie für die Rücksprache erreichen?',
    name: 'Auf welchen Namen dürfen wir die Anfrage aufnehmen?',
    callback: 'Gerne. Geht es um eine regelmäßige Reinigung oder um eine einmalige Anfrage?',
  },
  pricingAnswerTemplate:
    'Die Kosten hängen von Objektgröße, Umfang und Häufigkeit der Reinigung ab. Eine genaue Einschätzung ist nach kurzer Beschreibung möglich.',
});

function createHarness({
  smtpConfigured = true,
  leadNotificationEmail = 'leads@example.com',
  scheduleUrl = '',
  usageLimits,
  siteName = 'Demo Kunde',
  siteKey = 'demo-kunde',
  domain = 'demo.example',
  intakeFlow,
  industry,
  itSupportEnabled = false,
  itSupportEnabledSites,
  itSupportRequiredTicketFields,
  ticketToolFails = false,
  ticketForwardingStatus = 'queued',
} = {}) {
  const conversations = new Map([
    ['conversation-1', { metadata: {} }],
  ]);
  const leads = [];
  const tickets = [];
  const contactRequests = [];
  const emailJobs = [];
  const auditLogs = [];
  const ticketEvents = [];
  const isItSupportEnabledForSite = (siteId) =>
    Array.isArray(itSupportEnabledSites)
      ? itSupportEnabledSites.includes(siteId)
      : itSupportEnabled;

  const db = {
    async query(sql, params = []) {
      if (/SELECT\s+name,\s+site_key,/i.test(sql) || /SELECT name, config\s+FROM sites/i.test(sql)) {
        return {
          rows: [
            {
              name: siteName,
              site_key: siteKey,
              domain,
              config: {
                setupGoal: 'lead_capture',
                leadNotificationEmail,
                ctaText: 'Kontakt aufnehmen',
                scheduleUrl,
                industry,
                conversationFlow: intakeFlow || {},
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
              intakeFlow,
            },
          },
          ...(isItSupportEnabledForSite(siteId)
            ? [
                {
                  siteId,
                  key: 'it-support',
                  isEnabled: true,
                  config: {
                    requiredTicketFields: itSupportRequiredTicketFields || [
                      'description',
                      'affectedSystem',
                      'impact',
                      'reporterEmail',
                    ],
                  },
                },
              ]
            : []),
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
    undefined,
    {
      async executeTool(toolName, input, context = {}) {
        if (toolName !== 'create_ticket') {
          return { toolName, status: 'failed', message: 'Unsupported test tool' };
        }
        if (ticketToolFails) {
          return { toolName, status: 'failed', message: 'Simulierter Fehler' };
        }
        const ticket = {
          id: `ticket-${tickets.length + 1}`,
          subject: input.subject,
          description: input.description,
          category: input.category,
          priority: input.priority,
          issueType: input.issueType,
          affectedSystem: input.affectedSystem,
          impact: input.impact,
          reporterEmail: input.reporterEmail,
          reporterName: input.reporterName,
          reporterPhone: input.reporterPhone,
          device: input.device,
          operatingSystem: input.operatingSystem,
          metadata: input.metadata,
          tenantId: context.tenantId,
          siteId: context.siteId,
          conversationId: context.conversationId,
        };
        tickets.push(ticket);
        ticketEvents.push({
          eventType: 'ticket.created',
          payload: {
            ticketId: ticket.id,
            subject: input.subject,
            description: input.description,
            category: input.category,
            priority: input.priority,
            urgency: input.urgency,
            impact: input.impact,
            issueType: input.issueType,
            affectedSystem: input.affectedSystem,
            affectedUsers: input.affectedUsers,
            customerEmail: input.customerEmail,
            customerName: input.customerName,
            reporter: {
              name: input.reporterName,
              email: input.reporterEmail,
              phone: input.reporterPhone,
              department: input.department,
              location: input.location,
            },
            technicalContext: {
              device: input.device,
              operatingSystem: input.operatingSystem,
              errorMessage: input.errorMessage,
              alreadyTried: input.alreadyTried,
            },
            source: input.source,
            conversationId: input.conversationId,
            tenantId: context.tenantId,
            siteId: context.siteId,
            metadata: input.metadata,
          },
        });
        return {
          toolName,
          status: 'success',
          message: 'Support-Ticket wurde erstellt.',
          data: {
            ticketId: ticket.id,
            status: 'created',
            forwardingStatus: ticketForwardingStatus,
            webhookJobId: ticketForwardingStatus === 'queued' ? 'webhook-job-1' : undefined,
          },
        };
      },
    },
  );

  async function decide(message, history = [], overrides = {}) {
    return service.decide({
      tenantId: overrides.tenantId || 'tenant-1',
      siteId: overrides.siteId || 'site-1',
      conversationId: overrides.conversationId || 'conversation-1',
      sessionId: overrides.sessionId || 'session-1',
      message,
      history,
    });
  }

  return {
    service,
    decide,
    conversations,
    leads,
    tickets,
    ticketEvents,
    contactRequests,
    emailJobs,
    auditLogs,
  };
}

async function completeLocalLead(decide) {
  await decide('Mein Abfluss läuft nicht ab');
  await decide('heute noch');
  await decide(FULL_TEST_ADDRESS);
  await decide('Max Mustermann');
  return decide('015511410215');
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

test('ChatAgentOrchestratorService rejects sensitive credentials without storing a lead', async () => {
  const { decide, leads, conversations } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const result = await decide('Mein Passwort ist SuperSecret123');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /keine Passwörter|keine Passwoerter/i);
  assert.match(result.answer, /MFA-Codes|Zahlungsdaten|Ausweisdaten/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService keeps IT support knowledge-first and stores pending ticket state', async () => {
  const { decide, leads, conversations } = createHarness({
    itSupportEnabled: true,
  });

  const result = await decide('Mein VPN verbindet nicht');
  const metadata = conversations.get('conversation-1').metadata;

  assert.equal(result.handled, false);
  assert.equal(result.action, 'normal_answer');
  assert.equal(metadata.pendingTicket.status, 'solution_offered');
  assert.equal(metadata.pendingTicket.issueType, 'vpn');
  assert.match(metadata.pendingTicket.affectedSystem, /VPN/i);
  assert.equal(metadata.pendingTicket.lastAssistantAsk, 'solution_check');
  assert.equal(metadata.pendingTicket.solutionAttemptCount, 1);
  assert.equal(metadata.pendingLead, null);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService completes full IT support flow end-to-end with ticket event payload', async () => {
  const { decide, leads, conversations, tickets, ticketEvents } = createHarness({
    itSupportEnabled: true,
  });

  let result = await decide('Mein VPN verbindet nicht.');
  let ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.action, 'normal_answer');
  assert.equal(result.handled, false);
  assert.equal(ticket.status, 'solution_offered');
  assert.equal(ticket.issueType, 'vpn');
  assert.match(ticket.affectedSystem, /VPN/i);
  assert.equal(ticket.lastAssistantAsk, 'solution_check');
  assert.equal(tickets.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, null);

  result = await decide('Nein, hat nicht geholfen.');
  ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /Support-Ticket öffnen/i);
  assert.equal(ticket.status, 'ticket_offered');
  assert.equal(ticket.lastAssistantAsk, 'ticket_confirmation');
  assert.equal(tickets.length, 0);

  result = await decide('Ja');
  ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.equal(ticket.status, 'collecting');
  assert.equal(ticket.ticketConsent, true);
  assert.ok(ticket.nextExpectedField);
  assert.equal(tickets.length, 0);

  result = await decide('max@firma.de, betrifft VPN, nur mich, Windows Laptop, Fehler 809');
  ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.equal(ticket.reporterEmail, 'max@firma.de');
  assert.equal(ticket.impact, 'single_user');
  assert.match(`${ticket.device || ''} ${ticket.operatingSystem || ''}`, /Windows|Laptop/i);
  assert.match(ticket.errorMessage || '', /809/i);
  assert.equal(ticket.status, 'ready_to_create');
  assert.match(result.answer, /Support-Ticket gesammelt|Soll ich das Ticket jetzt erstellen/i);
  assert.equal(tickets.length, 0);

  result = await decide('Ja, bitte erstellen und weiterleiten.');
  ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.equal(ticket.status, 'created');
  assert.equal(ticket.createdTicketId, 'ticket-1');
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].category, 'it_support');
  assert.equal(tickets[0].issueType, 'vpn');
  assert.match(tickets[0].affectedSystem, /VPN/i);
  assert.equal(tickets[0].impact, 'single_user');
  assert.equal(tickets[0].reporterEmail, 'max@firma.de');
  assert.ok(['normal', 'high'].includes(tickets[0].priority));
  assert.equal(ticketEvents.length, 1);
  assert.equal(ticketEvents[0].eventType, 'ticket.created');
  assert.equal(ticketEvents[0].payload.subject, tickets[0].subject);
  assert.equal(ticketEvents[0].payload.description, tickets[0].description);
  assert.equal(ticketEvents[0].payload.category, 'it_support');
  assert.equal(ticketEvents[0].payload.customerEmail, 'max@firma.de');
  assert.equal(ticketEvents[0].payload.reporter.email, 'max@firma.de');
  assert.match(`${ticketEvents[0].payload.technicalContext.device || ''} ${ticketEvents[0].payload.technicalContext.operatingSystem || ''}`, /Windows|Laptop/i);
  assert.equal(ticketEvents[0].payload.impact, 'single_user');
  assert.equal(ticketEvents[0].payload.issueType, 'vpn');
  assert.match(ticketEvents[0].payload.affectedSystem, /VPN/i);
  assert.equal(ticketEvents[0].payload.conversationId, 'conversation-1');
  assert.equal(ticketEvents[0].payload.siteId, 'site-1');
  assert.equal(ticketEvents[0].payload.tenantId, 'tenant-1');
  assert.equal(ticketEvents[0].payload.metadata.sourceAgent, 'it-support-agent');
  assert.equal(leads.length, 0);

  result = await decide('Ja');

  assert.equal(result.handled, true);
  assert.match(result.answer, /bereits erstellt/i);
  assert.equal(tickets.length, 1);
  assert.equal(ticketEvents.length, 1);
});

test('ChatAgentOrchestratorService handles direct IT ticket request without creating before final confirmation', async () => {
  const { decide, conversations, tickets, leads } = createHarness({
    itSupportEnabled: true,
  });

  let result = await decide('Bitte Ticket erstellen, Outlook sendet keine E-Mails. Meine E-Mail ist max@firma.de, nur ich bin betroffen.');
  let ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.ok(['collecting', 'ready_to_create'].includes(ticket.status));
  assert.equal(ticket.ticketConsent, true);
  assert.ok(['outlook', 'email'].includes(ticket.issueType));
  assert.match(ticket.affectedSystem || '', /Outlook|E-Mail/i);
  assert.equal(ticket.reporterEmail, 'max@firma.de');
  assert.equal(ticket.impact, 'single_user');
  assert.equal(tickets.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, null);
  assert.equal(leads.length, 0);

  result = await decide('Ja');
  ticket = conversations.get('conversation-1').metadata.pendingTicket;

  if (ticket.status === 'created') {
    assert.equal(tickets.length, 1);
  } else {
    assert.equal(ticket.status, 'collecting');
    assert.ok(ticket.nextExpectedField);
    assert.equal(tickets.length, 0);
    assert.match(result.answer, /E-Mail-Adresse|betroffen|Telefon|Name|System|beschreibe|nicht funktioniert/i);
  }
});

test('ChatAgentOrchestratorService applies custom IT required ticket fields per site config', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
    itSupportRequiredTicketFields: [
      'description',
      'affectedSystem',
      'impact',
      'reporterEmail',
      'reporterPhone',
    ],
  });

  let result = await decide('Kannst du ein Ticket erstellen? Mein VPN geht nicht. max@firma.de, nur mich.');
  let ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.equal(ticket.status, 'collecting');
  assert.ok(ticket.missingFields.includes('reporterPhone'));
  assert.equal(ticket.nextExpectedField, 'reporterPhone');
  assert.match(result.answer, /Telefonnummer/i);
  assert.equal(tickets.length, 0);

  result = await decide('+49123456789');
  ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.equal(ticket.reporterPhone, '+49123456789');
  assert.equal(ticket.status, 'ready_to_create');
  assert.match(result.answer, /Soll ich das Ticket jetzt erstellen/i);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService keeps IT support tenant and site isolated', async () => {
  const { decide, conversations, tickets, ticketEvents } = createHarness({
    itSupportEnabledSites: ['site-a'],
  });

  await decide(
    'Kannst du ein Ticket erstellen? Mein VPN geht nicht. max@firma.de, nur mich.',
    [],
    {
      tenantId: 'tenant-a',
      siteId: 'site-a',
      conversationId: 'conversation-a',
      sessionId: 'session-a',
    },
  );
  await decide(
    'Ja',
    [],
    {
      tenantId: 'tenant-a',
      siteId: 'site-a',
      conversationId: 'conversation-a',
      sessionId: 'session-a',
    },
  );

  assert.equal(conversations.get('conversation-a').metadata.pendingTicket.status, 'created');
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].tenantId, 'tenant-a');
  assert.equal(tickets[0].siteId, 'site-a');
  assert.equal(ticketEvents[0].payload.tenantId, 'tenant-a');
  assert.equal(ticketEvents[0].payload.siteId, 'site-a');

  const siteBResult = await decide(
    'Mein VPN verbindet nicht.',
    [],
    {
      tenantId: 'tenant-b',
      siteId: 'site-b',
      conversationId: 'conversation-b',
      sessionId: 'session-b',
    },
  );

  assert.equal(siteBResult.handled, false);
  assert.equal(conversations.get('conversation-b')?.metadata?.pendingTicket, undefined);
  assert.equal(tickets.length, 1);
});

test('ChatAgentOrchestratorService blocks sensitive IT data before storing pending ticket or ticket', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });

  let result = await decide('Mein VPN geht nicht, mein Passwort ist Test123!');

  assert.equal(result.handled, true);
  assert.match(result.answer, /keine Passwörter|keine Passwoerter/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingTicket, undefined);
  assert.equal(tickets.length, 0);

  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'collecting',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      impact: 'single_user',
      ticketConsent: true,
      lastAssistantAsk: 'reporter_contact',
      nextExpectedField: 'reporterEmail',
    },
  };

  result = await decide('max@firma.de, mein MFA Code ist 123456');

  assert.equal(result.handled, true);
  assert.match(result.answer, /keine Passwörter|keine Passwoerter|MFA-Codes/i);
  assert.doesNotMatch(JSON.stringify(conversations.get('conversation-1').metadata.pendingTicket), /123456/);
  assert.equal(tickets.length, 0);

  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      impact: 'single_user',
      reporterEmail: 'max@firma.de',
      lastAssistantAsk: 'ticket_final_confirmation',
      missingFields: [],
    },
  };

  result = await decide('Ja, mein API Key ist abc123');

  assert.equal(result.handled, true);
  assert.match(result.answer, /keine Passwörter|keine Passwoerter|MFA-Codes|Zahlungsdaten|Ausweisdaten/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingTicket.status, 'ready_to_create');
  assert.doesNotMatch(JSON.stringify(conversations.get('conversation-1').metadata), /abc123/);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService offers IT ticket after failed solution', async () => {
  const { decide, conversations, leads } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'solution_offered',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      lastAssistantAsk: 'solution_check',
      solutionAttemptCount: 1,
    },
  };

  const result = await decide('Nein, hat nicht geholfen');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /Support-Ticket öffnen/i);
  assert.equal(ticket.status, 'ticket_offered');
  assert.equal(ticket.lastAssistantAsk, 'ticket_confirmation');
  assert.equal(ticket.nextExpectedField, 'ticketConsent');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService marks IT solution as resolved after positive solution check', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'solution_offered',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      lastAssistantAsk: 'solution_check',
      solutionAttemptCount: 1,
    },
  };

  const result = await decide('Ja, hat geholfen');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /gelöst|geloest/i);
  assert.equal(ticket.status, 'resolved');
  assert.equal(ticket.nextExpectedField, undefined);
  assert.deepEqual(ticket.missingFields, []);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService cancels offered IT ticket when user declines', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ticket_offered',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      lastAssistantAsk: 'ticket_confirmation',
    },
  };

  const result = await decide('Nein, kein Ticket');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /kein Ticket/i);
  assert.equal(ticket.status, 'cancelled');
  assert.equal(ticket.ticketConsent, false);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService starts IT ticket collection after confirmation', async () => {
  const { decide, conversations } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ticket_offered',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      lastAssistantAsk: 'ticket_confirmation',
    },
  };

  const result = await decide('Ja');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.equal(ticket.status, 'collecting');
  assert.equal(ticket.ticketConsent, true);
  assert.ok(ticket.nextExpectedField);
  assert.match(result.answer, /E-Mail-Adresse|betroffen|Nutzer|Unternehmen/i);
});

test('ChatAgentOrchestratorService cancels IT ticket collection on abort intent', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'collecting',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      ticketConsent: true,
      lastAssistantAsk: 'reporter_contact',
      nextExpectedField: 'reporterEmail',
    },
  };

  const result = await decide('abbrechen');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /Ticketerfassung ab/i);
  assert.equal(ticket.status, 'cancelled');
  assert.equal(ticket.ticketConsent, false);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService starts IT ticket collection for direct ticket request', async () => {
  const { decide, conversations, leads, tickets } = createHarness({
    itSupportEnabled: true,
  });

  const result = await decide('Kannst du ein Ticket erstellen? Mein VPN geht nicht.');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.ok(['collecting', 'ready_to_create'].includes(ticket.status));
  assert.equal(ticket.ticketConsent, true);
  assert.equal(ticket.issueType, 'vpn');
  assert.match(ticket.affectedSystem || '', /VPN/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, null);
  assert.equal(tickets.length, 0);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService starts IT ticket collection for human support handoff', async () => {
  const { decide, conversations, leads, tickets } = createHarness({
    itSupportEnabled: true,
  });

  const result = await decide('Bitte an einen Mitarbeiter weiterleiten, Outlook geht nicht.');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.ok(['collecting', 'ready_to_create'].includes(ticket.status));
  assert.equal(ticket.ticketConsent, true);
  assert.ok(['outlook', 'email'].includes(ticket.issueType));
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, null);
  assert.equal(tickets.length, 0);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService starts critical IT ticket intake safely for direct security request', async () => {
  const { decide, conversations, leads, tickets } = createHarness({
    itSupportEnabled: true,
  });

  const result = await decide('Bitte Ticket erstellen, wir haben Phishing und Malware-Verdacht.');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /keine Passwörter|keine Passwoerter|MFA-Codes|vertraulichen Daten/i);
  assert.match(result.answer, /keine weiteren Links|Anhänge|Anhaenge|Malware/i);
  assert.ok(['collecting', 'ready_to_create'].includes(ticket.status));
  assert.equal(ticket.ticketConsent, true);
  assert.equal(ticket.issueType, 'security');
  assert.ok(['urgent', 'critical'].includes(ticket.priority));
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, null);
  assert.equal(tickets.length, 0);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService marks IT ticket ready after required fields are collected', async () => {
  const { decide, conversations, leads } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'collecting',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      ticketConsent: true,
    },
  };

  const result = await decide('max@firma.de, nur mich, Windows Laptop');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.equal(ticket.reporterEmail, 'max@firma.de');
  assert.equal(ticket.impact, 'single_user');
  assert.match(`${ticket.device || ''} ${ticket.operatingSystem || ''}`, /Windows|Laptop/i);
  assert.equal(ticket.status, 'ready_to_create');
  assert.equal(ticket.lastAssistantAsk, 'ticket_final_confirmation');
  assert.match(result.answer, /Support-Ticket gesammelt/i);
  assert.match(result.answer, /Soll ich das Ticket jetzt erstellen/i);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService creates a real IT ticket after final confirmation', async () => {
  const { decide, conversations, leads, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet seit heute Morgen nicht',
      impact: 'single_user',
      urgency: 'normal',
      priority: 'normal',
      reporterEmail: 'max@firma.de',
      device: 'Windows Laptop',
      operatingSystem: 'Windows',
      lastAssistantAsk: 'ticket_final_confirmation',
      nextExpectedField: 'finalTicketConfirmation',
      missingFields: [],
    },
  };

  const result = await decide('Ja');
  const ticketState = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /Support-Ticket erstellt/i);
  assert.equal(ticketState.status, 'created');
  assert.equal(ticketState.createdTicketId, 'ticket-1');
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].category, 'it_support');
  assert.equal(tickets[0].issueType, 'vpn');
  assert.equal(tickets[0].affectedSystem, 'VPN');
  assert.equal(tickets[0].impact, 'single_user');
  assert.equal(tickets[0].reporterEmail, 'max@firma.de');
  assert.match(`${tickets[0].device || ''} ${tickets[0].operatingSystem || ''}`, /Windows|Laptop/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, null);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService does not create duplicate IT tickets after creation', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'created',
      createdTicketId: 'ticket-existing',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
    },
  };

  const result = await decide('Ja');

  assert.equal(result.handled, true);
  assert.match(result.answer, /bereits erstellt/i);
  assert.match(result.answer, /ticket-existing/i);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService starts a new IT context after a created ticket when a new problem is sent', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'created',
      createdTicketId: 'ticket-existing',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
    },
  };

  const result = await decide('Mein Drucker druckt nicht.');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.action, 'normal_answer');
  assert.equal(result.handled, false);
  assert.equal(ticket.status, 'solution_offered');
  assert.equal(ticket.issueType, 'printer');
  assert.match(ticket.affectedSystem, /Drucker/i);
  assert.equal(ticket.createdTicketId, undefined);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService starts a new IT context after resolved and cancelled terminal states', async () => {
  const resolvedHarness = createHarness({ itSupportEnabled: true });
  resolvedHarness.conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'resolved',
      issueType: 'vpn',
      affectedSystem: 'VPN',
      summary: 'VPN verbindet nicht',
    },
  };

  await resolvedHarness.decide('Outlook geht jetzt auch nicht.');
  let ticket = resolvedHarness.conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(ticket.status, 'solution_offered');
  assert.ok(['outlook', 'email'].includes(ticket.issueType));
  assert.equal(ticket.createdTicketId, undefined);
  assert.equal(resolvedHarness.tickets.length, 0);

  const cancelledHarness = createHarness({ itSupportEnabled: true });
  cancelledHarness.conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'cancelled',
      issueType: 'printer',
      affectedSystem: 'Drucker',
      summary: 'Druckerproblem',
      ticketConsent: false,
    },
  };

  await cancelledHarness.decide('Ich möchte doch ein Ticket erstellen, VPN geht nicht.');
  ticket = cancelledHarness.conversations.get('conversation-1').metadata.pendingTicket;

  assert.ok(['collecting', 'ready_to_create'].includes(ticket.status));
  assert.equal(ticket.ticketConsent, true);
  assert.equal(ticket.issueType, 'vpn');
  assert.equal(ticket.createdTicketId, undefined);
  assert.equal(cancelledHarness.tickets.length, 0);
});

test('ChatAgentOrchestratorService reports queued ticket forwarding only when integration dispatch queued', async () => {
  const { decide, conversations } = createHarness({
    itSupportEnabled: true,
    ticketForwardingStatus: 'queued',
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet seit heute Morgen nicht',
      affectedSystem: 'VPN',
      impact: 'single_user',
      reporterEmail: 'max@firma.de',
      lastAssistantAsk: 'ticket_final_confirmation',
    },
  };

  const result = await decide('Ja');

  assert.equal(result.handled, true);
  assert.match(result.answer, /zur Weiterleitung an den IT-Support eingereiht/i);
});

test('ChatAgentOrchestratorService does not claim forwarding when ticket forwarding is not configured', async () => {
  const { decide, conversations } = createHarness({
    itSupportEnabled: true,
    ticketForwardingStatus: 'not_configured',
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet seit heute Morgen nicht',
      affectedSystem: 'VPN',
      impact: 'single_user',
      reporterEmail: 'max@firma.de',
      lastAssistantAsk: 'ticket_final_confirmation',
    },
  };

  const result = await decide('Ja');

  assert.equal(result.handled, true);
  assert.match(result.answer, /Support-Ticket erstellt/i);
  assert.match(result.answer, /automatische Weiterleitung.*noch nicht eingerichtet/i);
  assert.doesNotMatch(result.answer, /zur Weiterleitung.*eingereiht|weitergeleitet/i);
});

test('ChatAgentOrchestratorService reports failed forwarding without claiming successful forwarding', async () => {
  const { decide, conversations } = createHarness({
    itSupportEnabled: true,
    ticketForwardingStatus: 'failed',
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet seit heute Morgen nicht',
      affectedSystem: 'VPN',
      impact: 'single_user',
      reporterEmail: 'max@firma.de',
      lastAssistantAsk: 'ticket_final_confirmation',
    },
  };

  const result = await decide('Ja');

  assert.equal(result.handled, true);
  assert.match(result.answer, /Support-Ticket erstellt/i);
  assert.match(result.answer, /Weiterleitung konnte gerade nicht bestätigt werden/i);
  assert.doesNotMatch(result.answer, /zur Weiterleitung.*eingereiht|weitergeleitet/i);
});

test('ChatAgentOrchestratorService cancels ready IT ticket on final no', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      affectedSystem: 'VPN',
      impact: 'single_user',
      reporterEmail: 'max@firma.de',
      lastAssistantAsk: 'ticket_final_confirmation',
    },
  };

  const result = await decide('Nein');
  const ticketState = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /kein Support-Ticket|kein Ticket/i);
  assert.equal(ticketState.status, 'cancelled');
  assert.equal(ticketState.ticketConsent, false);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService keeps ready IT ticket on unclear final answer', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      affectedSystem: 'VPN',
      impact: 'single_user',
      reporterEmail: 'max@firma.de',
      lastAssistantAsk: 'ticket_final_confirmation',
    },
  };

  const result = await decide('vielleicht');
  const ticketState = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /Bitte antworte mit Ja oder Nein/i);
  assert.equal(ticketState.status, 'ready_to_create');
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService keeps ready IT ticket when create_ticket fails', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
    ticketToolFails: true,
  });
  conversations.get('conversation-1').metadata = {
    pendingTicket: {
      status: 'ready_to_create',
      summary: 'VPN verbindet nicht',
      description: 'VPN verbindet nicht',
      affectedSystem: 'VPN',
      impact: 'single_user',
      reporterEmail: 'max@firma.de',
      lastAssistantAsk: 'ticket_final_confirmation',
    },
  };

  const result = await decide('Ja');
  const ticketState = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /konnte das Ticket gerade nicht erstellen/i);
  assert.equal(ticketState.status, 'ready_to_create');
  assert.equal(ticketState.createdTicketId, undefined);
  assert.equal(tickets.length, 0);
});

test('ChatAgentOrchestratorService offers urgent IT ticket for critical outages', async () => {
  const { decide, conversations, leads } = createHarness({
    itSupportEnabled: true,
  });

  const result = await decide('Unser komplettes Netzwerk ist down');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /kritischen IT-Vorfall|dringendes Support-Ticket/i);
  assert.equal(ticket.status, 'ticket_offered');
  assert.ok(['urgent', 'critical'].includes(ticket.priority));
  assert.equal(ticket.impact, 'company_wide');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, null);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService offers safe escalation for IT security incidents', async () => {
  const { decide, conversations } = createHarness({
    itSupportEnabled: true,
  });

  const result = await decide('Wir haben eine Phishing-Mail bekommen und vielleicht Malware');
  const ticket = conversations.get('conversation-1').metadata.pendingTicket;

  assert.equal(result.handled, true);
  assert.match(result.answer, /keine Passwörter|MFA-Codes|vertraulichen Daten/i);
  assert.match(result.answer, /Support-Ticket|Eskalation|weiterleiten/i);
  assert.equal(ticket.issueType, 'security');
  assert.ok(['urgent', 'critical'].includes(ticket.priority));
});

test('ChatAgentOrchestratorService leaves IT-like messages untouched when IT support is inactive', async () => {
  const { decide, conversations, leads } = createHarness();

  const result = await decide('Mein VPN verbindet nicht');

  assert.equal(result.handled, false);
  assert.equal(result.action, 'normal_answer');
  assert.equal(conversations.get('conversation-1').metadata.pendingTicket, undefined);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService does not start IT pending tickets for generic appointment or employee requests', async () => {
  const { decide, conversations, tickets } = createHarness({
    itSupportEnabled: true,
  });

  const appointment = await decide('Ich möchte einen Termin vereinbaren');

  assert.notEqual(conversations.get('conversation-1').metadata.pendingTicket?.status, 'collecting');
  assert.equal(conversations.get('conversation-1').metadata.pendingTicket, undefined);
  assert.equal(tickets.length, 0);
  assert.notEqual(appointment.decision?.metadata?.rule, 'it_support');

  conversations.get('conversation-1').metadata = {};
  const employee = await decide('Ich möchte mit einem Mitarbeiter über meine Anfrage sprechen');

  assert.equal(conversations.get('conversation-1').metadata.pendingTicket, undefined);
  assert.equal(tickets.length, 0);
  assert.notEqual(employee.decision?.reason, 'IT support module is active; critical or explicit ticket requests must be confirmed by the pending-ticket flow.');
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
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const result = await decide('Meine Toilette ist verstopft');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /dringend|Notfall|heute|Terminwunsch/i);
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
  const { decide, conversations, leads, emailJobs } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const first = await decide('Mein Abfluss läuft nicht ab');
  const urgency = await decide('heute noch');
  const partialAddress = await decide('65549');
  const fullAddress = await decide(FULL_TEST_ADDRESS);
  const partialName = await decide('Müller');
  const fullName = await decide('Max Mustermann');
  const final = await decide('015511410215');

  assert.match(first.answer, /dringend|Notfall|heute|Terminwunsch/i);
  assert.match(urgency.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort/i);
  assert.match(partialAddress.answer, /vollständige Einsatzadresse|Straße|Hausnummer|Ort/i);
  assert.match(fullAddress.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.match(partialName.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.match(fullName.answer, /Telefonnummer|Rückruf|zurückrufen/i);
  assert.match(final.answer, /Daten wurden aufgenommen/i);
  assert.match(final.answer, /schnellstmöglich kontaktiert/i);
  assert.doesNotMatch(final.answer, /Nächster Schritt|Terminabstimmung/i);
  assert.doesNotMatch(final.answer, /\b(du|dir|dich|deine|deinen|deiner|deinem)\b/i);
  assert.equal(leads.length, 1);
  assert.equal(emailJobs.length, 1);
  assert.equal(emailJobs[0].metadata.leadId, leads[0].id);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'Mein Abfluss läuft nicht ab');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, FULL_TEST_ADDRESS);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
});

test('ChatAgentOrchestratorService explains the current missing local service field', async () => {
  const { decide, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const problem = await decide('Mein Klo ist verstopft');
  const urgency = await decide('heute');
  const partialAddress = await decide('65549');
  const fullAddress = await decide(FULL_TEST_ADDRESS);
  const partialName = await decide('Müller');

  assert.match(problem.answer, /fehlt noch: Dringlichkeit/i);
  assert.match(urgency.answer, /fehlt noch: vollständige Einsatzadresse/i);
  assert.match(partialAddress.answer, /PLZ allein reicht noch nicht|Straße, Hausnummer und Ort/i);
  assert.match(fullAddress.answer, /fehlt noch: Vor- und Nachname/i);
  assert.match(partialName.answer, /einzelner Name reicht noch nicht|Vor- und Nachnamen/i);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService does not derive phone or name from a full address without comma', async () => {
  const { decide, conversations, leads, emailJobs } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });
  const addressWithoutComma = 'Musterstrasse 36 76355 Musterstadt';

  await decide('Mein Klo ist verstopft');
  await decide('heute noch');
  const addressReply = await decide(addressWithoutComma);

  assert.equal(addressReply.action, 'ask_for_contact');
  assert.match(addressReply.answer, /Vor- und Nachname/i);
  assert.doesNotMatch(addressReply.answer, /Daten wurden aufgenommen|Telefonnummer/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, addressWithoutComma);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(leads.length, 0);

  const nameReply = await decide('Max Müller');

  assert.equal(nameReply.action, 'ask_for_contact');
  assert.match(nameReply.answer, /Telefonnummer|zurückrufen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, 'Max Müller');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(leads.length, 0);

  const final = await decide('017600000000');

  assert.equal(final.action, 'capture_lead');
  assert.match(final.answer, /Daten wurden aufgenommen/i);
  assert.equal(leads.length, 1);
  assert.equal(emailJobs.length, 1);
  assert.equal(emailJobs[0].metadata.leadId, leads[0].id);
});

test('ChatAgentOrchestratorService rejects address-like digits as phone when phone is pending', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await decide('Mein Klo ist verstopft');
  await decide('heute');
  await decide(FULL_TEST_ADDRESS);
  await decide('Max Müller');
  const invalidPhone = await decide('36 76355');

  assert.equal(invalidPhone.action, 'ask_for_contact');
  assert.match(invalidPhone.answer, /Telefonnummer wirkt unvollständig|gültige Rückrufnummer/i);
  assert.doesNotMatch(invalidPhone.answer, /Daten wurden aufgenommen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService stores local lead without email job when no lead recipient is configured', async () => {
  const { decide, leads, emailJobs } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    leadNotificationEmail: '',
  });

  const final = await completeLocalLead(decide);

  assert.equal(final.action, 'capture_lead');
  assert.match(final.answer, /Daten wurden aufgenommen/i);
  assert.equal(leads.length, 1);
  assert.equal(emailJobs.length, 0);
});

test('ChatAgentOrchestratorService accepts lowercase and umlaut full names when name is pending', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await decide('Mein Klo ist verstopft');
  await decide('heute noch');
  await decide(FULL_TEST_ADDRESS);
  const nameReply = await decide('Müller thomas');

  assert.equal(nameReply.action, 'ask_for_contact');
  assert.match(nameReply.answer, /Telefonnummer|zurückrufen|Rückruf/i);
  assert.doesNotMatch(nameReply.answer, /Guten Tag|Vor- und Nachnamen|Vor- und Nachname|Daten wurden aufgenommen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, 'Müller thomas');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService accepts TEST demo full names when name is pending', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await decide('Mein Klo ist verstopft');
  await decide('heute noch');
  await decide(FULL_TEST_ADDRESS);
  const nameReply = await decide('test loom');

  assert.equal(nameReply.action, 'ask_for_contact');
  assert.match(nameReply.answer, /Telefonnummer|zurückrufen|Rückruf/i);
  assert.doesNotMatch(nameReply.answer, /Guten Tag|Vor- und Nachnamen|Vor- und Nachname|Daten wurden aufgenommen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, 'test loom');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService keeps pricing informational and starts intake on the next problem', async () => {
  const { decide, conversations, leads } = createHarness({
    siteName: 'Rohrreinigung-ffm24',
    siteKey: 'rohrreinigung-ffm24',
    domain: 'rohrreinigung-ffm24.de',
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const price = await decide('Was kostet eine Rohrreinigung?');
  const problem = await decide('Mein Klo ist verstopft');

  assert.equal(price.action, 'normal_answer');
  assert.match(price.answer, /Kosten hängen vom Aufwand/i);
  assert.doesNotMatch(price.answer, /Telefonnummer|E-Mail|Name|Anfrage aufgenommen/i);
  assert.equal(problem.action, 'ask_for_contact');
  assert.match(problem.answer, /dringend|Notfall|heute|Terminwunsch/i);
  assert.doesNotMatch(problem.answer, /Ihre Anfrage aufgenommen|Nächster Schritt|Terminabstimmung/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'Mein Klo ist verstopft');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
});

test('ChatAgentOrchestratorService ignores stale completed conversation fields for a new local problem', async () => {
  const { decide, conversations, leads } = createHarness({
    siteName: 'Rohrreinigung-ffm24',
    siteKey: 'rohrreinigung-ffm24',
    domain: 'rohrreinigung-ffm24.de',
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });
  conversations.get('conversation-1').metadata = {
    conversationState: {
      stage: 'completed',
      collectedFields: {
        concern: 'Alte abgeschlossene Anfrage',
        location: 'Frankfurt',
        urgency: 'akut',
        phone: '017600000000',
        name: 'Test Alt',
      },
    },
  };

  const result = await decide('Mein Klo ist verstopft');

  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /dringend|Notfall|heute|Terminwunsch/i);
  assert.doesNotMatch(result.answer, /Ihre Anfrage aufgenommen|Nächster Schritt|Terminabstimmung/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'Mein Klo ist verstopft');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
});

test('ChatAgentOrchestratorService completes local intake only after phone and name are present', async () => {
  const { decide, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const problem = await decide('Mein Klo ist verstopft');
  const urgency = await decide('heute');
  const partialAddress = await decide('65549');
  const fullAddress = await decide(FULL_TEST_ADDRESS);
  const partialName = await decide('Müller');
  const fullName = await decide('Thomas Müller');
  const final = await decide('017600000000');

  assert.match(problem.answer, /dringend|Notfall|heute|Termin/i);
  assert.match(urgency.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort/i);
  assert.match(partialAddress.answer, /vollständige Einsatzadresse|Straße|Hausnummer|Ort/i);
  assert.match(fullAddress.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.match(partialName.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.match(fullName.answer, /Telefonnummer|zurückrufen/i);
  assert.match(final.answer, /Daten wurden aufgenommen/i);
  assert.match(final.answer, /schnellstmöglich kontaktiert/i);
  assert.doesNotMatch(`${problem.answer} ${urgency.answer} ${partialAddress.answer} ${fullAddress.answer} ${partialName.answer} ${fullName.answer}`, /Ihre Anfrage aufgenommen/i);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].name, 'Thomas Müller');
});

test('ChatAgentOrchestratorService restarts local intake after a completed lead when a new problem is sent', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const completed = await completeLocalLead(decide);
  const restarted = await decide('Meine Toilette ist verstopft');

  assert.match(completed.answer, /Daten wurden aufgenommen/i);
  assert.equal(leads.length, 1);
  assert.equal(restarted.action, 'ask_for_contact');
  assert.match(restarted.answer, /dringend|Notfall|heute|Terminwunsch/i);
  assert.doesNotMatch(restarted.answer, /Ihre Anfrage aufgenommen/i);
  assert.equal(leads.length, 1);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(
    conversations.get('conversation-1').metadata.pendingLead.concern,
    'Meine Toilette ist verstopft',
  );
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
});

test('ChatAgentOrchestratorService acknowledges harmless messages after a completed local lead without restarting intake', async () => {
  for (const message of ['okay', 'hast mir schon geholfen']) {
    const { decide, conversations, leads } = createHarness({
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    });

    await completeLocalLead(decide);
    const result = await decide(message);

    assert.equal(result.action, 'normal_answer', message);
    assert.match(result.answer, /Ihre Anfrage wurde aufgenommen/i, message);
    assert.doesNotMatch(result.answer, /Ort|PLZ|Telefonnummer|Was genau ist betroffen/i, message);
    assert.equal(leads.length, 1, message);
    assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'completed', message);
  }
});

test('ChatAgentOrchestratorService starts a fresh local intake for short problem keywords after completed lead', async () => {
  for (const message of ['Keller', 'klo verstopft']) {
    const { decide, conversations, leads } = createHarness({
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    });

    await completeLocalLead(decide);
    const restarted = await decide(message);

    assert.equal(restarted.action, 'ask_for_contact', message);
    assert.doesNotMatch(restarted.answer, /Ihre Anfrage aufgenommen/i, message);
    assert.equal(leads.length, 1, message);
    assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending', message);
    assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined, message);
    assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined, message);
  }
});

test('ChatAgentOrchestratorService treats post-completion drain keywords as new intake before generic completed fallback', async () => {
  const { decide, conversations, leads } = createHarness({
    siteName: 'Demo Kunde',
    siteKey: 'rohrreinigung-ffm24',
    domain: 'rohrreinigung-ffm24.de',
    industry: 'local-services',
  });

  await completeLocalLead(decide);

  const restarted = await decide('Keller', [
    {
      role: 'assistant',
      content: 'Danke, ich habe Ihre Anfrage aufgenommen. Nächster Schritt: Kontakt aufnehmen',
    },
  ]);

  assert.equal(leads.length, 1);
  assert.equal(restarted.action, 'ask_for_contact');
  assert.match(restarted.answer, /dringend|Notfall|heute|Terminwunsch/i);
  assert.doesNotMatch(restarted.answer, /Wobei kann ich Ihnen helfen|Ihre Anfrage aufgenommen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'Keller');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
});

test('ChatAgentOrchestratorService uses default local intake for explicit legacy completed lead state without stored flow config', async () => {
  const { decide, conversations, leads } = createHarness({
    siteName: 'Rohrreinigung-ffm24',
    industry: 'local-services',
  });
  conversations.get('conversation-1').metadata = {
    pendingLead: {
      status: 'completed',
      concern: 'TEST Deployment - Abfluss verstopft',
      location: 'Frankfurt',
      urgency: 'heute',
      phone: '0000000000',
      name: 'TEST Deployment',
    },
  };

  const restarted = await decide('Keller');

  assert.equal(restarted.action, 'ask_for_contact');
  assert.match(restarted.answer, /dringend|Notfall|heute|Terminwunsch/i);
  assert.doesNotMatch(restarted.answer, /Ihre Anfrage aufgenommen/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'Keller');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
});

test('ChatAgentOrchestratorService treats explicit drain-cleaning legacy config as local service without stored flow config', async () => {
  const { decide, conversations, leads } = createHarness({
    siteName: 'Demo Kunde',
    siteKey: 'rohrreinigung-ffm24',
    domain: 'rohrreinigung-ffm24.de',
    industry: 'local-services',
  });

  const first = await decide('mein Klo ist verstopft');
  const urgency = await decide('heute');
  const partialAddress = await decide('65549');
  const fullAddress = await decide(FULL_TEST_ADDRESS);
  const nameBeforePhone = await decide('Müller');

  assert.equal(first.action, 'ask_for_contact');
  assert.match(first.answer, /dringend|Notfall|heute|Termin/i);
  assert.match(urgency.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort/i);
  assert.match(partialAddress.answer, /vollständige Einsatzadresse|Straße|Hausnummer|Ort/i);
  assert.match(fullAddress.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.match(nameBeforePhone.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.doesNotMatch(nameBeforePhone.answer, /Ihre Anfrage aufgenommen/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, FULL_TEST_ADDRESS);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
});

test('ChatAgentOrchestratorService keeps default local keywords when stored flow arrays are empty', async () => {
  const { decide, conversations, leads } = createHarness({
    siteName: 'Rohrreinigung-ffm24',
    intakeFlow: {
      templateKey: 'local-service-first-contact',
      genericLocalServiceKeywords: [],
      problemKeywords: [],
      pricingKeywords: [],
      callbackKeywords: [],
      questionOrder: [],
      requiredFields: [],
      questionTexts: {},
    },
  });

  const first = await decide('mein Klo ist verstopft');
  const urgency = await decide('heute');
  const partialAddress = await decide('65549');
  const fullAddress = await decide(FULL_TEST_ADDRESS);
  const nameBeforePhone = await decide('Müller');

  assert.equal(first.action, 'ask_for_contact');
  assert.match(first.answer, /dringend|Notfall|heute|Termin/i);
  assert.match(urgency.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort/i);
  assert.match(partialAddress.answer, /vollständige Einsatzadresse|Straße|Hausnummer|Ort/i);
  assert.match(fullAddress.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.match(nameBeforePhone.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.doesNotMatch(nameBeforePhone.answer, /Ihre Anfrage aufgenommen/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
});

test('ChatAgentOrchestratorService restarts local intake after a completed lead when notdienst is sent', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await completeLocalLead(decide);
  const restarted = await decide('Notdienst');

  assert.equal(leads.length, 1);
  assert.equal(restarted.action, 'ask_for_contact');
  assert.match(restarted.answer, /Toilette|Abfluss|Keller|Kanal|betroffen/i);
  assert.doesNotMatch(restarted.answer, /Ihre Anfrage aufgenommen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
});

test('ChatAgentOrchestratorService restarts local intake after a completed lead when notfall is sent', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await completeLocalLead(decide);
  const restarted = await decide('notfall');

  assert.equal(leads.length, 1);
  assert.equal(restarted.action, 'ask_for_contact');
  assert.match(restarted.answer, /Toilette|Abfluss|Keller|Kanal|betroffen/i);
  assert.doesNotMatch(restarted.answer, /Ihre Anfrage aufgenommen/i);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.phone, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.name, undefined);
});

test('ChatAgentOrchestratorService does not treat a name as phone in local service intake', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await decide('mein klo ist verstopft');
  await decide('heute');
  await decide(FULL_TEST_ADDRESS);
  const nameBeforePhone = await decide('Müller');

  assert.equal(nameBeforePhone.action, 'ask_for_contact');
  assert.match(nameBeforePhone.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.doesNotMatch(nameBeforePhone.answer, /Ihre Anfrage aufgenommen/i);
  assert.equal(leads.length, 0);
  await decide('Max Müller');
  const final = await decide('017600000000');

  assert.equal(final.action, 'capture_lead');
  assert.match(final.answer, /Daten wurden aufgenommen/i);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].name, 'Max Müller');
  assert.equal(leads[0].phone, '017600000000');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'completed');
});

test('ChatAgentOrchestratorService does not treat notdienst as a location when location is missing', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await decide('mein klo ist verstopft');
  const notdienstInsteadOfLocation = await decide('Notdienst');

  assert.equal(notdienstInsteadOfLocation.action, 'ask_for_contact');
  assert.match(notdienstInsteadOfLocation.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort/i);
  assert.doesNotMatch(notdienstInsteadOfLocation.answer, /Telefonnummer|Ihre Anfrage aufgenommen/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
});

test('ChatAgentOrchestratorService respects local service stop intent without lead capture', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  await decide('Meine Toilette ist verstopft');
  const stop = await decide('nerv nicht');
  const neither = await decide('weder noch', [
    { role: 'assistant', content: '[DATEN BEREINIGT]' },
  ]);

  assert.equal(stop.action, 'normal_answer');
  assert.match(stop.answer, /breche die Aufnahme der Anfrage hier ab/i);
  assert.doesNotMatch(stop.answer, /Telefonnummer|E-Mail|Name/i);
  assert.doesNotMatch(stop.answer, /\b(du|dir|dich|deine|deinen|deiner|deinem|sag mir|wenn du magst)\b/i);
  assert.equal(neither.action, 'normal_answer');
  assert.match(neither.answer, /Verstanden/i);
  assert.doesNotMatch(neither.answer, /\[DATEN BEREINIGT\]/i);
  assert.doesNotMatch(neither.answer, /\b(du|dir|dich|deine|deinen|deiner|deinem|sag mir|wenn du magst)\b/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.status, 'paused');
});

test('ChatAgentOrchestratorService keeps local service stop intents from asking contact details', async () => {
  for (const message of ['nein', 'stop', 'egal', 'lass gut']) {
    const { decide, leads } = createHarness({
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    });

    await decide('Meine Toilette ist verstopft');
    const result = await decide(message);

    assert.equal(result.action, 'normal_answer', message);
    assert.match(result.answer, /breche die Aufnahme der Anfrage hier ab/i, message);
    assert.doesNotMatch(result.answer, /Telefonnummer|E-Mail|Name/i, message);
    assert.equal(leads.length, 0, message);
  }
});

test('ChatAgentOrchestratorService uses formal fallback wording for local services', async () => {
  const { decide, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const greeting = await decide('hallo');
  await decide('Meine Toilette ist verstopft');
  const recovery = await decide('was soll das');

  assert.match(greeting.answer, /behilflich/i);
  assert.match(recovery.answer, /kann ich Ihnen|Ich kann Ihnen/i);
  assert.doesNotMatch(`${greeting.answer} ${recovery.answer}`, /\b(du|dir|dich|deine|deinen|deiner|deinem)\b/i);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService asks for the affected problem when local notdienst lacks details', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const result = await decide('Ich brauche Notdienst in Frankfurt');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, undefined);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.urgency, 'akut');
});

test('ChatAgentOrchestratorService answers local service pricing without lead pressure', async () => {
  const { decide, leads, conversations } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const result = await decide('Was kostet eine Rohrreinigung?');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /Kosten hängen vom Aufwand/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService answers broad local service cost questions without lead capture', async () => {
  const { decide, leads, conversations } = createHarness({
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const result = await decide('Mit wie viel muss ich rechnen?');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /Kosten hängen vom Aufwand/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService uses local service pricing answer from template config', async () => {
  const templatePricingAnswer = 'Template-Preisantwort fuer lokale Dienstleister.';
  const { decide } = createHarness({
    intakeFlow: {
      ...DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
      pricingAnswerTemplate: templatePricingAnswer,
    },
  });

  const result = await decide('Was kostet eine Rohrreinigung?');

  assert.match(result.answer, new RegExp(templatePricingAnswer));
});

test('ChatAgentOrchestratorService handles local service meter billing question without lead pressure', async () => {
  const { decide, leads, conversations } = createHarness({
    siteName: 'Rohrreinigung-ffm24',
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const result = await decide('Rechnen Sie nach laufenden Metern ab?');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /laufenden Metern/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService does not treat standalone area statements as complete local intake', async () => {
  const { decide, leads } = createHarness({
    siteName: 'Rohrreinigung-ffm24',
    intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  });

  const result = await decide('Ich wohne in Offenbach');

  assert.equal(result.action, 'normal_answer');
  assert.notEqual(result.action, 'capture_lead');
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService falls back to local service intake from site industry', async () => {
  for (const industry of ['local-services', 'local-service-first-contact']) {
    const { decide, leads } = createHarness({
      siteName: 'Rohrreinigung-ffm24',
      industry,
    });

    const result = await decide('Was kostet eine Rohrreinigung?');

    assert.equal(result.handled, true, industry);
    assert.equal(result.action, 'normal_answer', industry);
    assert.match(result.answer, /Kosten hängen vom Aufwand/i, industry);
    assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i, industry);
    assert.equal(leads.length, 0, industry);
  }
});

test('ChatAgentOrchestratorService clarifies callback urgency before asking for phone on local sites', async () => {
  for (const message of ['Ich möchte zurückgerufen werden', 'Können Sie mich anrufen?']) {
    const { decide, leads } = createHarness({
      siteName: 'Rohrreinigung-ffm24',
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    });

    const result = await decide(message);

    assert.equal(result.handled, true, message);
    assert.equal(result.action, 'ask_for_contact', message);
    assert.match(result.answer, /akuten Notfall|allgemeine Anfrage/i, message);
    assert.doesNotMatch(result.answer, /Telefonnummer|E-Mail|Name/i, message);
    assert.equal(leads.length, 0, message);
  }
});

test('ChatAgentOrchestratorService supports electrician local service intake from config', async () => {
  const { decide, conversations, leads } = createHarness({
    siteName: 'Elektro Musterbetrieb',
    intakeFlow: ELECTRICIAN_INTAKE_FLOW,
  });

  const first = await decide('Bei mir ist der Strom ausgefallen');
  const urgency = await decide('heute noch');
  const address = await decide('Hauptstraße 5, 34117 Kassel');
  const callback = await decide('Können Sie mich zurückrufen?');

  assert.equal(first.action, 'ask_for_contact');
  assert.match(first.answer, /dringend|Notfall|planbarer Termin/i);
  assert.match(urgency.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort/i);
  assert.match(address.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.match(callback.answer, /Vor- und Nachnamen|Vor- und Nachname/i);
  assert.doesNotMatch(first.answer, DRAIN_CLEANING_TERMS);
  assert.doesNotMatch(urgency.answer, DRAIN_CLEANING_TERMS);
  assert.doesNotMatch(`${first.answer} ${urgency.answer} ${address.answer}`, FORBIDDEN_LOCAL_SERVICE_TERMS);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.concern, 'Bei mir ist der Strom ausgefallen');
  assert.equal(conversations.get('conversation-1').metadata.pendingLead.location, 'Hauptstraße 5, 34117 Kassel');
});

test('ChatAgentOrchestratorService answers electrician pricing without aggressive lead capture', async () => {
  const { decide, conversations, leads } = createHarness({
    intakeFlow: ELECTRICIAN_INTAKE_FLOW,
  });

  const result = await decide('Was kostet ein Einsatz?');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'normal_answer');
  assert.match(result.answer, /Kosten hängen vom Einsatz/i);
  assert.doesNotMatch(result.answer, /Telefon|E-Mail|Name/i);
  assert.doesNotMatch(result.answer, DRAIN_CLEANING_TERMS);
  assert.equal(leads.length, 0);
  assert.equal(conversations.get('conversation-1').metadata.pendingLead, undefined);
});

test('ChatAgentOrchestratorService supports SHK heating and sanitary intake from config', async () => {
  for (const message of [
    'Meine Heizung funktioniert nicht',
    'Ich habe kein warmes Wasser',
    'Ich brauche heute noch Hilfe',
  ]) {
    const { decide, leads } = createHarness({
      siteName: 'SHK Musterbetrieb',
      intakeFlow: SHK_INTAKE_FLOW,
    });

    const result = await decide(message);

    assert.equal(result.handled, true, message);
    assert.equal(result.action, 'ask_for_contact', message);
    assert.match(result.answer, /Ort|PLZ|Hilfe|Notfall|allgemeine Anfrage/i, message);
    assert.doesNotMatch(result.answer, DRAIN_CLEANING_TERMS, message);
    assert.doesNotMatch(result.answer, FORBIDDEN_LOCAL_SERVICE_TERMS, message);
    assert.equal(leads.length, 0, message);
  }
});

test('ChatAgentOrchestratorService treats SHK emergency questions as clarification, not unsafe certainty', async () => {
  const { decide, leads } = createHarness({
    siteName: 'SHK Musterbetrieb',
    intakeFlow: SHK_INTAKE_FLOW,
  });

  const result = await decide('Ist das ein Notfall?');

  assert.equal(result.handled, true);
  assert.equal(result.action, 'ask_for_contact');
  assert.match(result.answer, /Was genau ist betroffen|Heizung|Warmwasser|Sanitär|Notfall/i);
  assert.doesNotMatch(result.answer, /garantiert|muss sofort|sicher ein Notfall/i);
  assert.equal(leads.length, 0);
});

test('ChatAgentOrchestratorService supports building cleaning intake without forcing emergency language', async () => {
  const firstHarness = createHarness({
    siteName: 'Gebäudereinigung Muster',
    intakeFlow: CLEANING_INTAKE_FLOW,
  });
  const priceHarness = createHarness({
    siteName: 'Gebäudereinigung Muster',
    intakeFlow: CLEANING_INTAKE_FLOW,
  });
  const recurringHarness = createHarness({
    siteName: 'Gebäudereinigung Muster',
    intakeFlow: CLEANING_INTAKE_FLOW,
  });
  const callbackHarness = createHarness({
    siteName: 'Gebäudereinigung Muster',
    intakeFlow: CLEANING_INTAKE_FLOW,
  });

  const first = await firstHarness.decide('Ich brauche eine Büroreinigung');
  const price = await priceHarness.decide('Was kostet eine Reinigung?');
  const recurring = await recurringHarness.decide('Wir suchen regelmäßige Reinigung für ein Büro');
  const callback = await callbackHarness.decide('Können Sie mich zurückrufen?');

  assert.match(first.answer, /einmaligen Einsatz|regelmäßige Reinigung/i);
  assert.match(price.answer, /Objektgröße|Umfang|Häufigkeit/i);
  assert.match(recurring.answer, /vollständige Einsatzadresse|Straße|Hausnummer|PLZ|Ort|regelmäßige Reinigung/i);
  assert.match(callback.answer, /regelmäßige Reinigung|einmalige Anfrage/i);
  assert.doesNotMatch(`${first.answer} ${price.answer} ${recurring.answer} ${callback.answer}`, /Notdienst|akuter Notfall/i);
  assert.doesNotMatch(`${first.answer} ${price.answer} ${recurring.answer} ${callback.answer}`, DRAIN_CLEANING_TERMS);
  assert.doesNotMatch(`${first.answer} ${price.answer} ${recurring.answer} ${callback.answer}`, FORBIDDEN_LOCAL_SERVICE_TERMS);
  assert.equal(firstHarness.leads.length, 0);
  assert.equal(priceHarness.leads.length, 0);
  assert.equal(recurringHarness.leads.length, 0);
  assert.equal(callbackHarness.leads.length, 0);
  assert.equal(firstHarness.conversations.get('conversation-1').metadata.pendingLead.status, 'pending');
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

test('ChatAgentOrchestratorService keeps universal required fields out of local service intake', async () => {
  const { decide, leads } = createHarness({
    intakeFlow: {
      requiredFields: ['name', 'email', 'phone', 'request'],
      questionOrder: ['request', 'name', 'email', 'phone'],
      questionTexts: {
        request: 'Worum geht es?',
        phone: 'Wie können wir Sie erreichen?',
      },
    },
    industry: 'universal-assistant',
  });

  const result = await decide('Hallo, ich brauche Hilfe.');

  assert.equal(result.handled, true);
  assert.doesNotMatch(
    result.answer,
    /Branche|Handwerker|lokaler Dienstleister|Einsatzadresse|vollständige Adresse|Dringlichkeit|vor Ort/i,
  );
  assert.match(result.answer, /wie heißt|E-Mail|Telefon|erreichen|Worum|Fragen|helfen|Website|KI|Support|Beratung/i);
  assert.equal(leads.length, 0);
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
