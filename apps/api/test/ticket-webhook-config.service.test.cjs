const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { TicketWebhookConfigService } = require('../dist/integrations/ticket-webhook-config.service.js');

function createHarness({ initialConnection = null, dispatchResults } = {}) {
  let connection = initialConnection;
  const calls = {
    create: [],
    patch: [],
    delete: [],
    dispatch: [],
  };

  const integrations = {
    async getMaskedConnectionForSite(siteId, providerKey, connectionKey) {
      assert.equal(siteId, 'site-1');
      assert.equal(providerKey, 'ticket-webhook');
      assert.equal(connectionKey, 'primary');
      return connection;
    },
    async createForSite(siteId, input) {
      calls.create.push({ siteId, input });
      connection = {
        id: 'conn-1',
        displayName: input.displayName,
        enabled: input.enabled !== false,
        status: input.enabled === false ? 'disconnected' : 'connected',
        config: input.config,
        configuredSecretCount: input.secrets?.signingSecret ? 1 : 0,
      };
      return connection;
    },
    async patchForSite(siteId, integrationId, input) {
      calls.patch.push({ siteId, integrationId, input });
      connection = {
        ...connection,
        id: integrationId,
        displayName: input.displayName ?? connection.displayName,
        enabled: input.enabled === undefined ? connection.enabled : input.enabled,
        status: input.enabled === undefined
          ? connection.status
          : input.enabled ? 'connected' : 'disconnected',
        config: {
          ...(connection?.config || {}),
          ...(input.config || {}),
        },
        configuredSecretCount: input.secrets?.signingSecret
          ? 1
          : connection?.configuredSecretCount || 0,
      };
      return connection;
    },
    async deleteForSite(siteId, integrationId) {
      calls.delete.push({ siteId, integrationId });
      connection = null;
      return { ok: true };
    },
  };

  const dispatcher = {
    async dispatch(siteId, eventType, payload, context) {
      calls.dispatch.push({ siteId, eventType, payload, context });
      return dispatchResults || [
        {
          status: 'queued',
          providerKey: 'ticket-webhook',
          connectionKey: 'primary',
          type: 'ticket_webhook',
          webhookJobId: 'job-1',
        },
      ];
    },
  };

  return {
    service: new TicketWebhookConfigService(integrations, dispatcher),
    calls,
  };
}

test('TicketWebhookConfigService returns safe empty config without secrets', async () => {
  const { service } = createHarness();

  const result = await service.getConfig('site-1');

  assert.equal(result.forwardingConfigured, false);
  assert.equal(result.enabled, false);
  assert.equal(result.hasSigningSecret, false);
  assert.equal(result.status, 'not_configured');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'signingSecret'), false);
});

test('TicketWebhookConfigService creates ticket webhook config and does not return the secret', async () => {
  const { service, calls } = createHarness();

  const result = await service.updateConfig('site-1', {
    enabled: true,
    label: 'IT Tickets',
    targetUrl: 'https://example.com/webhook',
    signingSecret: 'test-secret',
  });

  assert.equal(calls.create.length, 1);
  assert.equal(calls.create[0].input.providerKey, 'ticket-webhook');
  assert.equal(calls.create[0].input.config.endpointUrl, 'https://example.com/webhook');
  assert.deepEqual(calls.create[0].input.config.events, ['ticket.created']);
  assert.equal(calls.create[0].input.secrets.signingSecret, 'test-secret');
  assert.equal(result.forwardingConfigured, true);
  assert.equal(result.hasSigningSecret, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'signingSecret'), false);
});

test('TicketWebhookConfigService updates existing config instead of creating duplicates', async () => {
  const { service, calls } = createHarness({
    initialConnection: {
      id: 'conn-1',
      displayName: 'Alt',
      enabled: true,
      status: 'connected',
      config: { endpointUrl: 'https://old.example.com/webhook' },
      configuredSecretCount: 1,
    },
  });

  const result = await service.updateConfig('site-1', {
    enabled: false,
    targetUrl: 'https://new.example.com/webhook',
  });

  assert.equal(calls.create.length, 0);
  assert.equal(calls.patch.length, 1);
  assert.equal(calls.patch[0].integrationId, 'conn-1');
  assert.equal(result.enabled, false);
  assert.equal(result.targetUrl, 'https://new.example.com/webhook');
});

test('TicketWebhookConfigService deletes config without touching historical webhook jobs', async () => {
  const { service, calls } = createHarness({
    initialConnection: {
      id: 'conn-1',
      displayName: 'Tickets',
      enabled: true,
      status: 'connected',
      config: { endpointUrl: 'https://example.com/webhook' },
      configuredSecretCount: 1,
    },
  });

  const result = await service.disableConfig('site-1');

  assert.equal(calls.delete.length, 1);
  assert.equal(calls.delete[0].integrationId, 'conn-1');
  assert.equal(result.forwardingConfigured, false);
});

test('TicketWebhookConfigService queues a safe ticket.created test webhook and stores test status', async () => {
  const { service, calls } = createHarness({
    initialConnection: {
      id: 'conn-1',
      displayName: 'Tickets',
      enabled: true,
      status: 'connected',
      config: { endpointUrl: 'https://example.com/webhook' },
      configuredSecretCount: 1,
    },
  });

  const result = await service.sendTest('site-1', {
    tenantId: 'tenant-1',
    actorId: 'operator-1',
    actorRole: 'operator',
  });

  assert.equal(result.status, 'queued');
  assert.equal(calls.dispatch.length, 1);
  assert.equal(calls.dispatch[0].eventType, 'ticket.created');
  assert.equal(calls.dispatch[0].payload.test, true);
  assert.equal(calls.dispatch[0].payload.customerEmail, 'test@example.com');
  assert.doesNotMatch(JSON.stringify(calls.dispatch[0].payload), /secret/i);
  assert.equal(calls.patch[0].input.config.lastTestStatus, 'queued');
});

test('TicketWebhookConfigService rejects test webhook without active config', async () => {
  const { service, calls } = createHarness();

  await assert.rejects(
    () => service.sendTest('site-1'),
    (error) => error instanceof BadRequestException,
  );
  assert.equal(calls.dispatch.length, 0);
});
