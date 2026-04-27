const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetLeadsService } = require('../dist/modules/widget/services/widget-leads.service.js');

function createService({ leadNotificationEmail = 'hello@soulesmartbusiness.com' } = {}) {
  const dbCalls = [];
  const sentMails = [];

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
      async sendLeadNotification(payload) {
        sentMails.push(payload);
      },
    },
  );

  return { service, dbCalls, sentMails };
}

test('WidgetLeadsService.capture stores lead and sends notification email when configured', async () => {
  const { service, dbCalls, sentMails } = createService();

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
  assert.equal(sentMails.length, 1);
  assert.equal(sentMails[0].recipientEmail, 'hello@soulesmartbusiness.com');
  assert.equal(sentMails[0].lead.email, 'max@example.com');
});

test('WidgetLeadsService.capture keeps working without notification email', async () => {
  const { service, sentMails } = createService({ leadNotificationEmail: '' });

  await service.capture({
    siteKey: 'soule-smart-business',
    sessionId: 'session-1',
    name: 'Max Mustermann',
    email: 'max@example.com',
  });

  assert.equal(sentMails.length, 0);
});
