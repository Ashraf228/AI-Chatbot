const test = require('node:test');
const assert = require('node:assert/strict');
const { ToolExecutorService } = require('../dist/tools/tool-executor.service.js');
const { ToolAuditService } = require('../dist/tools/tool-audit.service.js');
const { ToolRegistryService } = require('../dist/tools/tool-registry.service.js');
const { ChatPipelineService } = require('../dist/ai/chat-pipeline/chat-pipeline.service.js');
const { ResponseComposerService } = require('../dist/ai/chat-pipeline/response-composer.service.js');

function createToolHarness({ usageLimits } = {}) {
  const conversations = new Map([
    ['conversation-1', { id: 'conversation-1', session_id: 'session-1', metadata: {} }],
  ]);
  const leads = [];
  const contactRequests = [];
  const tickets = [];
  const agentRuns = [];
  const toolInvocations = [];
  const dispatchedEvents = [];

  const db = {
    async query(sql, params = []) {
      if (/INSERT INTO agent_runs/i.test(sql)) {
        agentRuns.push({ id: params[0], tenantId: params[1], siteId: params[2], metadata: params[5] });
        return { rows: [] };
      }

      if (/SELECT id\s+FROM agent_runs/i.test(sql)) {
        const run = agentRuns.find((entry) => entry.id === params[0] && entry.siteId === params[1]);
        return { rows: run ? [{ id: run.id }] : [] };
      }

      if (/INSERT INTO tool_invocations/i.test(sql)) {
        toolInvocations.push({
          id: params[0],
          runId: params[1],
          tenantId: params[2],
          siteId: params[3],
          toolName: params[4],
          input: JSON.parse(params[5]),
          status: 'queued',
        });
        return { rows: [] };
      }

      if (/UPDATE tool_invocations/i.test(sql)) {
        const invocation = toolInvocations.find((entry) => entry.id === params[0]);
        if (invocation) {
          invocation.status = params[1];
          invocation.output = JSON.parse(params[2]);
          invocation.error = params[3];
        }
        return { rows: [] };
      }

      if (/UPDATE agent_runs/i.test(sql)) {
        return { rows: [] };
      }

      if (/SELECT id, session_id, metadata\s+FROM conversations/i.test(sql)) {
        const conversation = conversations.get(params[0]);
        return { rows: conversation && params[1] === 'site-1' ? [conversation] : [] };
      }

      if (/UPDATE conversations\s+SET metadata = COALESCE/i.test(sql)) {
        const conversation = conversations.get(params[0]);
        if (conversation) {
          conversation.metadata = {
            ...(conversation.metadata || {}),
            ...JSON.parse(params[2]),
          };
        }
        return { rows: [] };
      }

      if (/SELECT id\s+FROM widget_leads/i.test(sql)) {
        const existing = leads.find((lead) =>
          lead.siteId === params[0] &&
          lead.sessionId === params[1] &&
          ((params[2] && lead.email === params[2]) || (params[3] && lead.phone === params[3]))
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

      if (/SELECT id\s+FROM agent_contact_requests/i.test(sql)) {
        return { rows: [] };
      }

      if (/INSERT INTO agent_contact_requests/i.test(sql)) {
        contactRequests.push({
          id: params[0],
          tenantId: params[1],
          siteId: params[2],
          runId: params[3],
          email: params[5],
          phone: params[6],
        });
        return { rows: [] };
      }

      if (/INSERT INTO agent_tickets/i.test(sql)) {
        tickets.push({
          id: params[0],
          tenantId: params[1],
          siteId: params[2],
          runId: params[3],
          subject: params[4],
          description: params[5],
          email: params[6],
          priority: params[7],
        });
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  const sites = {
    async getSite(siteId) {
      if (siteId !== 'site-1') {
        return null;
      }
      return {
        id: 'site-1',
        tenant_id: 'tenant-1',
        name: 'Demo',
        config: { setupGoal: 'lead_capture', industry: 'it-support' },
      };
    },
  };
  const integrations = {
    async getConnectionForSite() {
      return null;
    },
  };
  const webhookJobs = {
    async enqueue(input) {
      return { id: `webhook-${input.providerKey}`, queued: true };
    },
  };
  const integrationEvents = {
    async dispatch(siteId, eventType, payload, context) {
      dispatchedEvents.push({ siteId, eventType, payload, context });
      return [{ status: 'queued', providerKey: 'webhook', connectionKey: 'primary' }];
    },
  };
  const embedder = {
    async embed() {
      return [0.1, 0.2];
    },
  };
  const vector = {
    async search() {
      return [
        {
          id: 'chunk-1',
          title: 'FAQ',
          source_url: 'https://example.com/faq',
          score: 0.91,
          metadata: {},
          content: 'Demo Inhalt',
        },
      ];
    },
  };

  const service = new ToolExecutorService(
    db,
    sites,
    integrations,
    webhookJobs,
    embedder,
    vector,
    new ToolRegistryService(),
    new ToolAuditService(db),
    integrationEvents,
    usageLimits || {
      async assertWithinLimit() {},
      async withMonthlyLeadLimit(_tenantId, callback) {
        return callback(db, async () => undefined);
      },
    },
  );

  const context = {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    conversationId: 'conversation-1',
    source: 'widget',
  };

  return {
    service,
    context,
    conversations,
    leads,
    contactRequests,
    tickets,
    agentRuns,
    toolInvocations,
    dispatchedEvents,
  };
}

test('ToolExecutorService capture_lead success stores lead and metadata', async () => {
  const { service, context, conversations, leads, toolInvocations, dispatchedEvents } = createToolHarness();

  const result = await service.executeTool('capture_lead', {
    name: 'Max Mustermann',
    email: 'max@example.de',
    need: 'KI Support',
  }, context);

  assert.equal(result.status, 'success');
  assert.equal(leads.length, 1);
  assert.equal(conversations.get('conversation-1').metadata.toolExecutor.leadId, leads[0].id);
  assert.equal(toolInvocations.length, 1);
  assert.equal(toolInvocations[0].input.email, '[email]');
  assert.equal(dispatchedEvents[0].eventType, 'lead.created');
});

test('ToolExecutorService capture_lead returns missing_fields without contact', async () => {
  const { service, context, leads } = createToolHarness();

  const result = await service.executeTool('capture_lead', { name: 'Max' }, context);

  assert.equal(result.status, 'missing_fields');
  assert.deepEqual(result.missingFields, ['email', 'phone']);
  assert.equal(leads.length, 0);
});

test('ToolExecutorService capture_lead returns limit_exceeded without storing lead', async () => {
  const { service, context, leads } = createToolHarness({
    usageLimits: {
      async assertWithinLimit() {},
      async withMonthlyLeadLimit(_tenantId, callback) {
        return callback(
          {
            async query(sql, params = []) {
              if (/SELECT id\s+FROM widget_leads/i.test(sql)) {
                return { rows: [] };
              }
              if (/INSERT INTO widget_leads/i.test(sql)) {
                leads.push({ id: params[0] });
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

  const result = await service.executeTool('capture_lead', {
    name: 'Max Mustermann',
    email: 'max@example.de',
    need: 'KI Support',
  }, context);

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'limit_exceeded');
  assert.match(result.message, /maximal 1 Anfragen/i);
  assert.equal(leads.length, 0);
});

test('ToolExecutorService schedule_contact returns missing_fields without contact path', async () => {
  const { service, context, contactRequests } = createToolHarness();

  const result = await service.executeTool('schedule_contact', { topic: 'Demo' }, context);

  assert.equal(result.status, 'missing_fields');
  assert.deepEqual(result.missingFields, ['email', 'phone']);
  assert.equal(contactRequests.length, 0);
});

test('ToolExecutorService create_ticket success stores ticket', async () => {
  const { service, context, tickets } = createToolHarness();

  const result = await service.executeTool('create_ticket', {
    subject: 'Bestellung defekt',
    description: 'Paket kam beschaedigt an',
    customerEmail: 'kunde@example.de',
  }, context);

  assert.equal(result.status, 'success');
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].subject, 'Bestellung defekt');
});

test('ToolExecutorService create_ticket returns missing_fields without description', async () => {
  const { service, context, tickets } = createToolHarness();

  const result = await service.executeTool('create_ticket', { subject: 'Problem' }, context);

  assert.equal(result.status, 'missing_fields');
  assert.deepEqual(result.missingFields, ['description']);
  assert.equal(tickets.length, 0);
});

test('ToolExecutorService query_knowledge returns sources', async () => {
  const { service, context } = createToolHarness();

  const result = await service.executeTool('query_knowledge', { query: 'Support KI' }, context);

  assert.equal(result.status, 'success');
  assert.equal(result.data.resultCount, 1);
  assert.equal(result.data.sources[0].title, 'FAQ');
});

test('ToolExecutorService handoff updates conversation metadata', async () => {
  const { service, context, conversations } = createToolHarness();

  const result = await service.executeTool('handoff', { reason: 'Nutzer will Mensch', priority: 'high' }, context);

  assert.equal(result.status, 'success');
  assert.equal(conversations.get('conversation-1').metadata.handoff.recommended, true);
  assert.equal(conversations.get('conversation-1').metadata.handoff.priority, 'high');
});

test('ToolExecutorService rejects invalid tool names', async () => {
  const { service, context, toolInvocations } = createToolHarness();

  const result = await service.executeTool('delete_everything', {}, context);

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'invalid_tool');
  assert.equal(toolInvocations.length, 0);
});

test('ChatPipeline executes allowed suggested tools and skips tools with required fields', async () => {
  const executedTools = [];
  const db = {
    async query() {
      return { rows: [] };
    },
  };
  const conversationState = {
    async ensureConversation() {
      return { id: 'conversation-1', sessionId: 'session-1' };
    },
    async touchWidgetSession() {},
    async appendMessage() {},
    async loadHistory() {
      return [];
    },
    async touchConversation() {},
  };
  const toolExecutor = {
    async executeTool(toolName) {
      executedTools.push(toolName);
      return { toolName, status: 'success', message: 'ok' };
    },
  };
  const makePipeline = (decision) => new ChatPipelineService(
    db,
    {},
    {},
    {},
    {},
    {},
    {
      async decide() {
        return {
          action: 'normal_answer',
          handled: true,
          answer: 'Antwort',
          decision,
        };
      },
    },
    conversationState,
    new ResponseComposerService(),
    toolExecutor,
    { async assertWithinLimit() {} },
  );

  await makePipeline({
    type: 'capture_lead',
    confidence: 0.9,
    reason: 'complete',
    message: 'ok',
    metadata: { agentRunId: 'run-1' },
    suggestedTools: ['capture_lead'],
    requiredFields: [],
    collectedFields: { email: 'max@example.de', concern: 'KI' },
    nextAction: 'prepare_lead_capture',
  }).process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    conversationId: 'conversation-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Hallo',
  });

  await makePipeline({
    type: 'capture_lead',
    confidence: 0.7,
    reason: 'missing',
    message: 'missing',
    metadata: { agentRunId: 'run-2' },
    suggestedTools: ['capture_lead'],
    requiredFields: ['email', 'phone'],
    collectedFields: { concern: 'KI' },
    nextAction: 'ask_for_contact_details',
  }).process({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    conversationId: 'conversation-1',
    sessionId: 'session-1',
    source: 'widget',
    message: 'Hallo',
  });

  assert.deepEqual(executedTools, ['capture_lead']);
});
