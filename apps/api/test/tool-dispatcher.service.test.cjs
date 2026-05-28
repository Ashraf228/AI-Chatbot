const test = require('node:test');
const assert = require('node:assert/strict');
const { ToolDispatcherService } = require('../dist/tools/tool-dispatcher.service.js');

function createDispatcher(overrides = {}) {
  const db = overrides.db || {
    async query() {
      return { rows: [] };
    },
  };

  return new ToolDispatcherService(
    db,
    overrides.sites || {
      async getSite(id) {
        return { id, name: 'Default Site', tenant_id: 'tenant-1' };
      },
    },
    overrides.integrations || {
      async getConnectionForSite() {
        return null;
      },
    },
    overrides.emailJobs || { async enqueue() {} },
    overrides.leadMailer || { buildLeadNotification() { return {}; } },
    overrides.reportMailer || { isConfigured() { return false; } },
    overrides.webhookJobs || { async enqueue() { return { id: 'webhook-job-1', queued: true }; } },
    overrides.shopifyCatalog || { async searchProductsForSite() { return []; } },
    overrides.embedder || {
      async embed() {
        return [0.1, 0.2];
      },
    },
    overrides.vector || {
      async search() {
        return [];
      },
    },
    overrides.propertyTicketing || {
      async getConfigForSite() {
        return { intakeMode: 'email_handoff' };
      },
    },
    overrides.usageLimits || {
      async withMonthlyLeadLimit(_tenantId, callback) {
        return callback(db, async () => undefined);
      },
    },
  );
}

test('ToolDispatcherService capture_lead stores lead and queues notification mail', async () => {
  const dbCalls = [];
  const queuedJobs = [];

  const service = createDispatcher({
    db: {
      async query(sql, params) {
        dbCalls.push({ sql, params });

        if (/SELECT id, tenant_id, site_id, status\s+FROM agent_runs/i.test(sql)) {
          return {
            rows: [
              {
                id: 'run-1',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                status: 'queued',
              },
            ],
          };
        }

        if (/SELECT\s+id,\s+agent_run_id,/i.test(sql) && /FROM tool_invocations/i.test(sql)) {
          return {
            rows: [
              {
                id: 'invocation-1',
                agent_run_id: 'run-1',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                tool_key: 'capture_lead',
                status: 'completed',
                input_payload: {
                  name: 'Max Mustermann',
                  email: 'max@example.com',
                },
                output_payload: {
                  leadId: 'lead-1',
                  status: 'new',
                  queuedNotification: true,
                },
                error_message: null,
                created_at: '2026-05-04T10:00:00.000Z',
                completed_at: '2026-05-04T10:00:01.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
    sites: {
      async getSite(id) {
        return {
          id,
          name: 'SouleSmartBusiness',
          tenant_id: 'tenant-1',
          config: {
            companyName: 'SouleSmartBusiness',
            leadNotificationEmail: 'hello@soulesmartbusiness.com',
          },
        };
      },
    },
    emailJobs: {
      async enqueue(payload) {
        queuedJobs.push(payload);
      },
    },
    leadMailer: {
      buildLeadNotification(payload) {
        return {
          to: payload.recipientEmail,
          subject: 'Neuer Lead',
          html: '<p>Lead</p>',
          text: 'Lead',
        };
      },
    },
    reportMailer: {
      isConfigured() {
        return true;
      },
    },
  });

  const result = await service.execute('run-1', {
    toolKey: 'capture_lead',
    inputPayload: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      phone: '12345',
      message: 'Bitte kontaktieren',
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.toolKey, 'capture_lead');
  assert.equal(result.outputPayload.queuedNotification, true);
  assert.equal(queuedJobs.length, 1);
  assert.equal(queuedJobs[0].kind, 'lead_notification');
  assert.equal(queuedJobs[0].metadata.agentRunId, 'run-1');
  const leadInsert = dbCalls.find((call) => /INSERT INTO widget_leads/i.test(call.sql));
  assert.ok(leadInsert);
  assert.equal(queuedJobs[0].metadata.leadId, leadInsert.params[0]);
  assert.ok(dbCalls.some((call) => /INSERT INTO tool_invocations/i.test(call.sql)));
  assert.ok(dbCalls.some((call) => /UPDATE agent_runs/i.test(call.sql)));
});

test('ToolDispatcherService capture_lead stays completed when notification queue fails', async () => {
  const dbCalls = [];

  const service = createDispatcher({
    db: {
      async query(sql, params) {
        dbCalls.push({ sql, params });

        if (/SELECT id, tenant_id, site_id, status\s+FROM agent_runs/i.test(sql)) {
          return {
            rows: [
              {
                id: 'run-mail-fail',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                status: 'queued',
              },
            ],
          };
        }

        if (/SELECT\s+id,\s+agent_run_id,/i.test(sql) && /FROM tool_invocations/i.test(sql)) {
          return {
            rows: [
              {
                id: 'invocation-mail-fail',
                agent_run_id: 'run-mail-fail',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                tool_key: 'capture_lead',
                status: 'completed',
                input_payload: {
                  name: 'TEST Lead',
                  email: 'test@example.com',
                },
                output_payload: {
                  leadId: 'lead-mail-fail',
                  status: 'new',
                  queuedNotification: false,
                },
                error_message: null,
                created_at: '2026-05-04T10:00:00.000Z',
                completed_at: '2026-05-04T10:00:01.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
    sites: {
      async getSite(id) {
        return {
          id,
          name: 'SouleSmartBusiness',
          tenant_id: 'tenant-1',
          config: {
            companyName: 'SouleSmartBusiness',
            leadNotificationEmail: 'hello@soulesmartbusiness.com',
          },
        };
      },
    },
    emailJobs: {
      async enqueue() {
        throw new Error('email queue unavailable');
      },
    },
    leadMailer: {
      buildLeadNotification() {
        return {
          to: 'hello@soulesmartbusiness.com',
          subject: 'Neuer Lead',
          html: '<p>Lead</p>',
          text: 'Lead',
        };
      },
    },
    reportMailer: {
      isConfigured() {
        return true;
      },
    },
  });

  const result = await service.execute('run-mail-fail', {
    toolKey: 'capture_lead',
    inputPayload: {
      name: 'TEST Lead',
      email: 'test@example.com',
      phone: '0000000000',
      message: 'TEST Lead',
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.toolKey, 'capture_lead');
  assert.equal(result.outputPayload.queuedNotification, false);
  assert.ok(dbCalls.some((call) => /INSERT INTO widget_leads/i.test(call.sql)));
});

test('ToolDispatcherService search_catalog returns Shopify product matches', async () => {
  const service = createDispatcher({
    db: {
      async query(sql) {
        if (/SELECT id, tenant_id, site_id, status\s+FROM agent_runs/i.test(sql)) {
          return {
            rows: [
              {
                id: 'run-2',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                status: 'queued',
              },
            ],
          };
        }

        if (/SELECT\s+id,\s+agent_run_id,/i.test(sql) && /FROM tool_invocations/i.test(sql)) {
          return {
            rows: [
              {
                id: 'invocation-2',
                agent_run_id: 'run-2',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                tool_key: 'search_catalog',
                status: 'completed',
                input_payload: {
                  query: 'Sneaker',
                },
                output_payload: {
                  resultCount: 1,
                  products: [{ title: 'Sneaker One', url: 'https://shop.example/products/sneaker-one' }],
                },
                error_message: null,
                created_at: '2026-05-05T10:00:00.000Z',
                completed_at: '2026-05-05T10:00:01.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
    shopifyCatalog: {
      async searchProductsForSite() {
        return [
          {
            id: 'prod-1',
            title: 'Sneaker One',
            handle: 'sneaker-one',
            url: 'https://shop.example/products/sneaker-one',
          },
        ];
      },
    },
  });

  const result = await service.execute('run-2', {
    toolKey: 'search_catalog',
    inputPayload: {
      query: 'Sneaker',
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.toolKey, 'search_catalog');
  assert.equal(result.outputPayload.resultCount, 1);
});

test('ToolDispatcherService query_knowledge returns vector hits', async () => {
  const vectorCalls = [];
  const service = createDispatcher({
    db: {
      async query(sql) {
        if (/SELECT id, tenant_id, site_id, status\s+FROM agent_runs/i.test(sql)) {
          return {
            rows: [
              {
                id: 'run-3',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                status: 'queued',
              },
            ],
          };
        }

        if (/SELECT\s+id,\s+agent_run_id,/i.test(sql) && /FROM tool_invocations/i.test(sql)) {
          return {
            rows: [
              {
                id: 'invocation-3',
                agent_run_id: 'run-3',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                tool_key: 'query_knowledge',
                status: 'completed',
                input_payload: { query: 'FAQ Frage' },
                output_payload: { resultCount: 1, hits: [{ title: 'FAQ', content: 'Antwort' }] },
                error_message: null,
                created_at: '2026-05-05T10:00:00.000Z',
                completed_at: '2026-05-05T10:00:01.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
    vector: {
      async search(tenantId, siteId) {
        vectorCalls.push({ tenantId, siteId });
        return [
          {
            id: 'chunk-1',
            title: 'FAQ',
            source_url: null,
            score: 0.91,
            content: 'Antwort',
            metadata: { kind: 'faq' },
          },
        ];
      },
    },
  });

  const result = await service.execute('run-3', {
    toolKey: 'query_knowledge',
    inputPayload: {
      query: 'FAQ Frage',
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.outputPayload.resultCount, 1);
  assert.equal(result.outputPayload.hits[0].title, 'FAQ');
  assert.equal(vectorCalls[0].tenantId, 'tenant-1');
  assert.equal(vectorCalls[0].siteId, 'site-1');
});

test('ToolDispatcherService query_knowledge prefers the agent run tenant over a mismatching site tenant', async () => {
  const vectorCalls = [];
  const service = createDispatcher({
    db: {
      async query(sql) {
        if (/SELECT id, tenant_id, site_id, status\s+FROM agent_runs/i.test(sql)) {
          return {
            rows: [
              {
                id: 'run-tenant-scope',
                tenant_id: 'tenant-run',
                site_id: 'site-9',
                status: 'queued',
              },
            ],
          };
        }

        if (/SELECT\s+id,\s+agent_run_id,/i.test(sql) && /FROM tool_invocations/i.test(sql)) {
          return {
            rows: [
              {
                id: 'invocation-tenant-scope',
                agent_run_id: 'run-tenant-scope',
                tenant_id: 'tenant-run',
                site_id: 'site-9',
                tool_key: 'query_knowledge',
                status: 'completed',
                input_payload: { query: 'Mandantenfrage' },
                output_payload: { resultCount: 0, hits: [] },
                error_message: null,
                created_at: '2026-05-05T10:00:00.000Z',
                completed_at: '2026-05-05T10:00:01.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
    sites: {
      async getSite(id) {
        return { id, name: 'Other Tenant Site', tenant_id: 'tenant-site' };
      },
    },
    vector: {
      async search(tenantId, siteId) {
        vectorCalls.push({ tenantId, siteId });
        return [];
      },
    },
  });

  await service.execute('run-tenant-scope', {
    toolKey: 'query_knowledge',
    inputPayload: {
      query: 'Mandantenfrage',
    },
  });

  assert.equal(vectorCalls[0].tenantId, 'tenant-run');
  assert.equal(vectorCalls[0].siteId, 'site-9');
});

test('ToolDispatcherService create_ticket stores a structured ticket', async () => {
  const dbCalls = [];
  const service = createDispatcher({
    db: {
      async query(sql, params) {
        dbCalls.push({ sql, params });
        if (/SELECT id, tenant_id, site_id, status\s+FROM agent_runs/i.test(sql)) {
          return {
            rows: [
              {
                id: 'run-4',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                status: 'queued',
              },
            ],
          };
        }

        if (/SELECT\s+id,\s+agent_run_id,/i.test(sql) && /FROM tool_invocations/i.test(sql)) {
          return {
            rows: [
              {
                id: 'invocation-4',
                agent_run_id: 'run-4',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                tool_key: 'create_ticket',
                status: 'completed',
                input_payload: { description: 'Wasserschaden im Bad' },
                output_payload: { ticketId: 'ticket-1', status: 'new' },
                error_message: null,
                created_at: '2026-05-05T10:00:00.000Z',
                completed_at: '2026-05-05T10:00:01.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
  });

  const result = await service.execute('run-4', {
    toolKey: 'create_ticket',
    inputPayload: {
      title: 'Wasserschaden',
      description: 'Wasserschaden im Bad',
      priority: 'high',
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.toolKey, 'create_ticket');
  assert.ok(dbCalls.some((call) => /INSERT INTO agent_tickets/i.test(call.sql)));
});

test('ToolDispatcherService create_ticket also queues external forwarding for ticket systems', async () => {
  const queuedWebhookJobs = [];

  const service = createDispatcher({
    db: {
      async query(sql) {
        if (/SELECT id, tenant_id, site_id, status\s+FROM agent_runs/i.test(sql)) {
          return {
            rows: [
              {
                id: 'run-5',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                status: 'queued',
              },
            ],
          };
        }

        if (/SELECT\s+id,\s+agent_run_id,/i.test(sql) && /FROM tool_invocations/i.test(sql)) {
          return {
            rows: [
              {
                id: 'invocation-5',
                agent_run_id: 'run-5',
                tenant_id: 'tenant-1',
                site_id: 'site-1',
                tool_key: 'create_ticket',
                status: 'completed',
                input_payload: { description: 'Heizung defekt' },
                output_payload: {
                  ticketId: 'ticket-2',
                  status: 'new',
                  forwardedToExternal: true,
                  forwardingStatus: 'queued',
                  webhookJobId: 'webhook-job-5',
                },
                error_message: null,
                created_at: '2026-05-05T10:00:00.000Z',
                completed_at: '2026-05-05T10:00:01.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
    integrations: {
      async getConnectionForSite(_siteId, providerKey) {
        if (providerKey === 'ticket-webhook') {
          return {
            status: 'connected',
            config: {
              endpointUrl: 'https://tickets.example.com/intake',
            },
            secrets: {
              apiKey: 'secret-1',
            },
          };
        }

        return null;
      },
    },
    webhookJobs: {
      async enqueue(payload) {
        queuedWebhookJobs.push(payload);
        return { id: 'webhook-job-5', queued: true };
      },
    },
    propertyTicketing: {
      async getConfigForSite() {
        return { intakeMode: 'ticket_system' };
      },
    },
  });

  const result = await service.execute('run-5', {
    toolKey: 'create_ticket',
    inputPayload: {
      title: 'Heizung defekt',
      description: 'Heizung ist seit gestern kalt',
      reporterEmail: 'mieter@example.com',
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.outputPayload.forwardedToExternal, true);
  assert.equal(result.outputPayload.forwardingStatus, 'queued');
  assert.equal(result.outputPayload.webhookJobId, 'webhook-job-5');
  assert.equal(queuedWebhookJobs.length, 1);
  assert.equal(queuedWebhookJobs[0].providerKey, 'ticket-webhook');
});
