const test = require('node:test');
const assert = require('node:assert/strict');
const { IntegrationEventDispatcherService } = require('../dist/integrations/integration-event-dispatcher.service.js');

function createHarness(connections) {
  const webhookJobs = [];
  const auditLogs = [];
  const db = {
    async query(sql, params = []) {
      if (/INSERT INTO webhook_jobs/i.test(sql)) {
        webhookJobs.push({
          id: params[0],
          tenantId: params[1],
          siteId: params[2],
          providerKey: params[4],
          connectionKey: params[5],
          endpointUrl: params[6],
          method: params[7],
          headers: JSON.parse(params[8]),
          payload: JSON.parse(params[9]),
        });
      }
      return { rows: [] };
    },
  };
  const integrations = {
    async getActiveEventConnections(_siteId, eventType) {
      return connections.filter((connection) => connection.events.includes(eventType));
    },
    buildHeaders(config, secrets) {
      return {
        'content-type': 'application/json',
        authorization: secrets.bearerToken ? `Bearer ${secrets.bearerToken}` : undefined,
        'x-source': String(config.source || 'test'),
      };
    },
  };
  const auditLogsService = {
    async record(input) {
      auditLogs.push(input);
    },
  };
  return {
    service: new IntegrationEventDispatcherService(db, integrations, auditLogsService),
    webhookJobs,
    auditLogs,
  };
}

test('IntegrationEventDispatcherService queues matching webhook integrations and masks audit headers', async () => {
  process.env.ALLOW_PRIVATE_INTEGRATION_URLS = 'true';
  const { service, webhookJobs, auditLogs } = createHarness([
    {
      id: 'integration-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      providerKey: 'webhook',
      connectionKey: 'primary',
      type: 'webhook',
      displayName: 'Webhook',
      config: { url: 'https://example.com/webhook', source: 'dispatcher-test' },
      secrets: { bearerToken: 'secret-token' },
      events: ['lead.created'],
    },
  ]);

  const result = await service.dispatch('site-1', 'lead.created', { leadId: 'lead-1' }, {
    tenantId: 'tenant-1',
    conversationId: 'conversation-1',
    source: 'widget',
  });

  assert.equal(result[0].status, 'queued');
  assert.equal(webhookJobs.length, 1);
  assert.equal(webhookJobs[0].payload.eventType, 'lead.created');
  assert.equal(webhookJobs[0].payload.payload.leadId, 'lead-1');
  assert.equal(auditLogs[0].action, 'integration.event_dispatched');
  assert.equal(auditLogs[0].metadata.headers.authorization, '[masked]');
});

test('IntegrationEventDispatcherService skips email integrations without failing dispatch', async () => {
  const { service, webhookJobs } = createHarness([
    {
      id: 'integration-2',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      providerKey: 'smtp-override',
      connectionKey: 'primary',
      type: 'email',
      displayName: 'Mail',
      config: {},
      secrets: {},
      events: ['contact.requested'],
    },
  ]);

  const result = await service.dispatch('site-1', 'contact.requested', { contactRequestId: 'request-1' });

  assert.equal(result[0].status, 'skipped');
  assert.equal(webhookJobs.length, 0);
});
