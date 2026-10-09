const test = require('node:test');
const assert = require('node:assert/strict');
const { AgentPolicyService } = require('../dist/ai/orchestration/agent-policy.service.js');
const { AgentOrchestratorService } = require('../dist/ai/orchestration/agent-orchestrator.service.js');
const { AgentMemoryService } = require('../dist/ai/orchestration/agent-memory.service.js');
const { AgentRunLoggerService } = require('../dist/ai/orchestration/agent-run-logger.service.js');
const {
  DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
} = require('../dist/site-modules/module-configs.js');

function createPolicyContext(message, overrides = {}) {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    conversationId: 'conversation-1',
    sessionId: 'session-1',
    message,
    history: [],
    memory: {
      urgency: 'unknown',
      preferredContact: 'unknown',
      intentHistory: [],
      rawMetadata: {},
      ...(overrides.memory || {}),
    },
    moduleContext: {
      leadSalesEnabled: true,
      ecommerceAdvisorEnabled: true,
      propertyTicketingEnabled: true,
      supportEnabled: true,
      ...(overrides.moduleContext || {}),
    },
    siteConfig: {
      setupGoal: 'lead_capture',
      leadCaptureEnabled: true,
      ...(overrides.siteConfig || {}),
    },
  };
}

test('AgentPolicyService returns answer decision for normal informational chat', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Welche Leistungen bietet ihr an?'));

  assert.equal(decision.type, 'answer');
  assert.equal(decision.nextAction, 'continue_answer');
  assert.ok(decision.suggestedTools.includes('query_knowledge'));
});

test('AgentPolicyService treats greeting as answer without lead tools', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('hsallo'));

  assert.equal(decision.type, 'answer');
  assert.equal(decision.nextAction, 'continue_answer');
  assert.deepEqual(decision.suggestedTools, []);
  assert.match(decision.message, /Wobei kann ich dich/i);
});

test('AgentPolicyService warns on sensitive credential or payment data without tools', () => {
  const policy = new AgentPolicyService();

  for (const message of [
    'Mein Passwort ist SuperSecret123',
    'Der MFA Code lautet 123456',
    'Meine Kreditkarte ist 4111111111111111',
  ]) {
    const decision = policy.decide(createPolicyContext(message));

    assert.equal(decision.type, 'ask_followup', message);
    assert.equal(decision.nextAction, 'continue_answer', message);
    assert.deepEqual(decision.suggestedTools, [], message);
    assert.match(decision.message, /keine Passwoerter|keine Passwörter/i, message);
    assert.match(decision.message, /MFA-Codes|Zahlungsdaten|Ausweisdaten/i, message);
  }
});

test('AgentPolicyService recovers from confused pending lead without contact tool', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('was soll das', {
    memory: {
      pendingLeadStatus: 'pending',
      concern: 'KI Beratung',
    },
  }));

  assert.equal(decision.type, 'ask_followup');
  assert.equal(decision.nextAction, 'ask_for_missing_context');
  assert.deepEqual(decision.suggestedTools, []);
  assert.doesNotMatch(decision.message, /Wie koennen wir dich/i);
});

test('AgentPolicyService asks follow-up for incomplete lead intent', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Ich brauche Beratung'));

  assert.equal(decision.type, 'ask_followup');
  assert.equal(decision.nextAction, 'ask_for_contact_details');
  assert.ok(decision.requiredFields.includes('concern'));
});

test('AgentPolicyService prepares capture_lead when lead fields are complete', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Ich brauche ein Angebot', {
    memory: {
      knownName: 'Max Mustermann',
      knownEmail: 'max@example.de',
      concern: 'KI fuer Kundenanfragen',
    },
  }));

  assert.equal(decision.type, 'capture_lead');
  assert.equal(decision.nextAction, 'prepare_lead_capture');
  assert.ok(decision.suggestedTools.includes('capture_lead'));
});

test('AgentPolicyService treats local service emergencies as qualified lead follow-up', () => {
  const policy = new AgentPolicyService();

  for (const message of [
    'Meine Toilette ist verstopft',
    'Ich brauche Notdienst in Frankfurt',
  ]) {
    const decision = policy.decide(createPolicyContext(message, {
      moduleContext: {
        intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
      },
    }));

    assert.equal(decision.type, 'ask_followup', message);
    assert.equal(decision.nextAction, 'ask_for_contact_details', message);
    assert.deepEqual(decision.suggestedTools, [], message);
    assert.ok(decision.requiredFields.includes('email'), message);
    assert.ok(decision.requiredFields.includes('phone'), message);
  }
});

test('AgentPolicyService keeps local service price and area questions in knowledge mode', () => {
  const policy = new AgentPolicyService();

  for (const message of [
    'Was kostet eine Rohrreinigung?',
    'Rechnen Sie nach laufenden Metern ab?',
    'Ich wohne in Offenbach, kommen Sie auch dahin?',
  ]) {
    const decision = policy.decide(createPolicyContext(message, {
      moduleContext: {
        intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
      },
    }));

    assert.equal(decision.type, 'answer', message);
    assert.equal(decision.nextAction, 'continue_answer', message);
    assert.deepEqual(decision.requiredFields, [], message);
    assert.ok(decision.suggestedTools.includes('query_knowledge'), message);
  }
});

test('AgentPolicyService prepares schedule_contact for appointment intent', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Ich brauche einen Termin', {
    memory: {
      knownEmail: 'max@example.de',
      concern: 'Support Automatisierung',
    },
    siteConfig: {
      scheduleUrl: 'https://example.com/book',
    },
  }));

  assert.equal(decision.type, 'schedule_contact');
  assert.equal(decision.nextAction, 'prepare_schedule_contact');
  assert.ok(decision.suggestedTools.includes('schedule_contact'));
  assert.match(decision.message, /https:\/\/example.com\/book/);
});

test('AgentPolicyService prepares create_ticket for support cases', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Ich habe ein Problem mit meiner Bestellung', {
    memory: {
      knownEmail: 'kunde@example.de',
      concern: 'Problem mit Bestellung',
    },
  }));

  assert.equal(decision.type, 'create_ticket');
  assert.equal(decision.nextAction, 'prepare_ticket');
  assert.ok(decision.suggestedTools.includes('create_ticket'));
});

test('AgentPolicyService keeps IT support password how-to in knowledge mode when IT support is active', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Wie setze ich mein Passwort zurück?', {
    moduleContext: {
      itSupportEnabled: true,
    },
  }));

  assert.equal(decision.type, 'answer');
  assert.ok(decision.suggestedTools.includes('query_knowledge'));
  assert.ok(!decision.suggestedTools.includes('create_ticket'));
});

test('AgentPolicyService keeps IT support VPN issues in knowledge mode when IT support is active', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Mein VPN verbindet nicht', {
    moduleContext: {
      itSupportEnabled: true,
    },
  }));

  assert.equal(decision.type, 'answer');
  assert.ok(decision.suggestedTools.includes('query_knowledge'));
  assert.ok(!decision.suggestedTools.includes('create_ticket'));
});

test('AgentPolicyService offers escalation without create_ticket for critical IT incidents', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Unser Netzwerk ist komplett down', {
    moduleContext: {
      itSupportEnabled: true,
    },
  }));

  assert.ok(['ask_followup', 'handoff'].includes(decision.type));
  assert.match(decision.message, /Ticket|Eskalation/i);
  assert.ok(!decision.suggestedTools.includes('create_ticket'));
});

test('AgentPolicyService leaves explicit IT ticket request to pending-ticket flow', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Bitte Ticket erstellen, VPN geht nicht', {
    moduleContext: {
      itSupportEnabled: true,
    },
  }));

  assert.ok(['ask_followup', 'handoff'].includes(decision.type));
  assert.ok(!decision.suggestedTools.includes('create_ticket'));
  assert.ok(!decision.suggestedTools.includes('capture_lead'));
});

test('AgentPolicyService leaves IT human support request to pending-ticket flow', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Ich möchte mit einem Mitarbeiter sprechen, Outlook geht nicht', {
    moduleContext: {
      itSupportEnabled: true,
    },
  }));

  assert.ok(['ask_followup', 'handoff'].includes(decision.type));
  assert.ok(!decision.suggestedTools.includes('create_ticket'));
  assert.ok(!decision.suggestedTools.includes('capture_lead'));
});

test('AgentPolicyService does not route generic ticket or employee requests into IT support without IT signal', () => {
  const policy = new AgentPolicyService();

  const ticketDecision = policy.decide(createPolicyContext('Ich möchte ein Ticket öffnen', {
    moduleContext: {
      itSupportEnabled: true,
      propertyTicketingEnabled: true,
    },
  }));
  const employeeDecision = policy.decide(createPolicyContext('Ich möchte mit einem Mitarbeiter über meine Anfrage sprechen', {
    moduleContext: {
      itSupportEnabled: true,
      propertyTicketingEnabled: true,
    },
  }));

  assert.notEqual(ticketDecision.requiredFields[0], 'ticket_confirmation');
  assert.notEqual(ticketDecision.reason, 'IT support module is active; critical or explicit ticket requests must be confirmed by the pending-ticket flow.');
  assert.equal(employeeDecision.type, 'handoff');
  assert.notEqual(employeeDecision.reason, 'IT support module is active; critical or explicit ticket requests must be confirmed by the pending-ticket flow.');
});

test('AgentPolicyService prepares tickets for common IT support cases', () => {
  const policy = new AgentPolicyService();

  for (const message of [
    'Mein Passwort funktioniert nicht mehr',
    'VPN verbindet nicht',
    'Outlook sendet keine E-Mails',
    'Unser WLAN ist ausgefallen',
    'Der Drucker druckt nicht',
    'Ich habe keine Berechtigung auf die Freigabe',
  ]) {
    const decision = policy.decide(createPolicyContext(message, {
      memory: {
        knownEmail: 'user@example.de',
        concern: message,
      },
    }));

    assert.equal(decision.type, 'create_ticket', message);
    assert.equal(decision.nextAction, 'prepare_ticket', message);
    assert.ok(decision.suggestedTools.includes('create_ticket'), message);
  }
});

test('AgentPolicyService escalates security incidents instead of giving risky instructions', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Wir haben einen Phishing Sicherheitsvorfall und Datenverlust'));

  assert.equal(decision.type, 'handoff');
  assert.equal(decision.nextAction, 'ask_for_contact_details');
  assert.deepEqual(decision.suggestedTools, []);
  assert.doesNotMatch(decision.message, /passwort/i);
  assert.doesNotMatch(decision.message, /powershell|terminal/i);
});

test('AgentPolicyService recommends handoff when user asks for a human', () => {
  const policy = new AgentPolicyService();

  const decision = policy.decide(createPolicyContext('Ich moechte mit einem Mitarbeiter sprechen'));

  assert.equal(decision.type, 'handoff');
  assert.equal(decision.nextAction, 'ask_for_contact_details');
  assert.ok(decision.confidence >= 0.8);
});

test('AgentOrchestratorService logs agent_runs and returns structured decision', async () => {
  const dbCalls = [];
  const db = {
    async query(sql, params = []) {
      dbCalls.push({ sql, params });

      if (/SELECT id, metadata\s+FROM conversations/i.test(sql)) {
        return {
          rows: [
            {
              id: params[0],
              metadata: {
                conversationState: {
                  topic: 'Support Automatisierung',
                  urgency: 'high',
                },
              },
            },
          ],
        };
      }

      if (/SELECT config\s+FROM sites/i.test(sql)) {
        return {
          rows: [
            {
              config: {
                setupGoal: 'lead_capture',
                leadCaptureEnabled: true,
              },
            },
          ],
        };
      }

      return { rows: [] };
    },
  };
  const siteModules = {
    async listForSite() {
      return [
        { key: 'lead-sales', isEnabled: true, config: { primaryGoal: 'lead_capture' } },
        { key: 'knowledge-faq', isEnabled: true, config: {} },
      ];
    },
  };
  const service = new AgentOrchestratorService(
    db,
    siteModules,
    new AgentMemoryService(db),
    new AgentPolicyService(),
    new AgentRunLoggerService(db),
  );

  const decision = await service.decide({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    conversationId: 'conversation-1',
    sessionId: 'session-1',
    message: 'Ich brauche ein Angebot. Mein Name ist Max Mustermann, max@example.de',
    history: [],
  });

  assert.equal(decision.type, 'capture_lead');
  assert.ok(dbCalls.some((call) => /INSERT INTO agent_runs/i.test(call.sql)));
  assert.ok(dbCalls.some((call) => /UPDATE agent_runs/i.test(call.sql)));
  const update = dbCalls.find((call) => /UPDATE agent_runs/i.test(call.sql));
  assert.match(update.params[2], /capture_lead/);
});
