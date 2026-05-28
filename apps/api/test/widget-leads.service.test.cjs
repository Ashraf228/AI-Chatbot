const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetLeadsService } = require('../dist/modules/widget/services/widget-leads.service.js');

function createService({ leadNotificationEmail = 'hello@soulesmartbusiness.com', failEmailQueue = false } = {}) {
  const dbCalls = [];
  const queuedJobs = [];

  const service = new WidgetLeadsService(
    {
      async query(sql, params) {
        dbCalls.push({ sql, params });
        return { rows: [] };
      },
    },
    {
      async getSiteByKey(siteKey) {
        return {
          id: 'site-1',
          name: 'SouleSmartBusiness',
          companyName: 'SouleSmartBusiness',
          tenantId: 'tenant-1',
          leadNotificationEmail,
          siteKey,
        };
      },
    },
    {
      async enforceOrigin() {},
      async assertSessionBelongsToSite() {},
    },
    {
      buildLeadNotification(payload) {
        return {
          to: payload.recipientEmail,
          subject: 'Neuer Lead',
          html: `<p>${payload.lead.email}</p>`,
          text: payload.lead.email,
        };
      },
    },
    {
      async enqueue(payload) {
        if (failEmailQueue) {
          throw new Error('email queue unavailable');
        }
        queuedJobs.push(payload);
      },
    },
    {
      isConfigured() {
        return true;
      },
    },
    {
      async assertWithinLimit() {},
      async withMonthlyLeadLimit(_tenantId, callback) {
        return callback(
          {
            async query(sql, params) {
              dbCalls.push({ sql, params });
              return { rows: [] };
            },
          },
          async () => undefined,
        );
      },
    },
  );

  return { service, dbCalls, queuedJobs };
}

test('WidgetLeadsService.capture stores lead and queues notification email when configured', async () => {
  const { service, dbCalls, queuedJobs } = createService();

  const result = await service.capture({
    siteKey: 'soule-smart-business',
    sessionId: 'session-1',
    name: 'Max Mustermann',
    email: 'max@example.com',
    phone: '12345',
    message: 'Ich brauche Hilfe',
  });

  assert.ok(result.id);
  assert.equal(result.siteId, 'site-1');
  assert.equal(dbCalls.length, 2);
  assert.match(dbCalls[0].sql, /INSERT INTO widget_leads/i);
  assert.match(dbCalls[1].sql, /UPDATE widget_sessions/i);
  assert.equal(queuedJobs.length, 1);
  assert.equal(queuedJobs[0].kind, 'lead_notification');
  assert.equal(queuedJobs[0].to, 'hello@soulesmartbusiness.com');
  assert.equal(queuedJobs[0].metadata.leadId, result.id);
  assert.equal(queuedJobs[0].metadata.leadEmail, 'max@example.com');
});

test('WidgetLeadsService.capture keeps working without notification email', async () => {
  const { service, queuedJobs } = createService({ leadNotificationEmail: '' });

  await service.capture({
    siteKey: 'soule-smart-business',
    sessionId: 'session-1',
    name: 'Max Mustermann',
    email: 'max@example.com',
  });

  assert.equal(queuedJobs.length, 0);
});

test('WidgetLeadsService.capture keeps the stored lead when notification queue fails', async () => {
  const { service, dbCalls, queuedJobs } = createService({ failEmailQueue: true });

  const result = await service.capture({
    siteKey: 'soule-smart-business',
    sessionId: 'session-1',
    name: 'TEST Lead',
    email: 'test@example.com',
    phone: '0000000000',
    message: 'TEST - Meine Toilette ist verstopft',
  });

  assert.ok(result.id);
  assert.equal(result.name, 'TEST Lead');
  assert.equal(dbCalls.length, 2);
  assert.match(dbCalls[0].sql, /INSERT INTO widget_leads/i);
  assert.match(dbCalls[1].sql, /UPDATE widget_sessions/i);
  assert.equal(queuedJobs.length, 0);
});
