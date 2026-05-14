const test = require('node:test');
const assert = require('node:assert/strict');
const { AgentPolicyService } = require('../dist/ai/orchestration/agent-policy.service.js');
const { AgentOrchestratorService } = require('../dist/ai/orchestration/agent-orchestrator.service.js');
const { AgentMemoryService } = require('../dist/ai/orchestration/agent-memory.service.js');
const { AgentRunLoggerService } = require('../dist/ai/orchestration/agent-run-logger.service.js');

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
