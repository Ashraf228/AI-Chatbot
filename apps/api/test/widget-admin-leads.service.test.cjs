const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetAdminLeadsService } = require('../dist/modules/widget/services/widget-admin-leads.service.js');

function createLeadRow(overrides = {}) {
  return {
    id: 'lead-1',
    site_id: 'site-a',
    session_id: 'session-1',
    name: 'Test Lead',
    email: 'lead@example.com',
    phone: null,
    message: 'Test concern',
    status: 'new',
    created_at: '2026-05-28T10:00:00.000Z',
    site_name: 'Test Site',
    ...overrides,
  };
}

test('WidgetAdminLeadsService returns delivery status without exposing job payloads', async () => {
  const calls = [];
  const service = new WidgetAdminLeadsService({
    async query(sql, params = []) {
      calls.push({ sql, params });
      return {
        rows: [
          createLeadRow({
            id: 'lead-sent',
            email_delivery_status: 'sent',
            email_retry_count: 1,
            email_sent_at: '2026-05-28T10:02:00.000Z',
          }),
          createLeadRow({
            id: 'lead-pending',
            email_delivery_status: 'queued',
            email_retry_count: 0,
          }),
          createLeadRow({
            id: 'lead-failed',
            email_delivery_status: 'failed',
            email_retry_count: 5,
            webhook_delivery_status: 'failed',
            webhook_retry_count: 5,
          }),
          createLeadRow({ id: 'lead-stored' }),
        ],
      };
    },
  });

  const leads = await service.listLeads({ siteId: 'site-a' });

  assert.equal(leads.length, 4);
  assert.equal(leads[0].delivery.stored, true);
  assert.equal(leads[0].delivery.email, 'sent');
  assert.equal(leads[0].delivery.emailAttempts, 1);
  assert.equal(leads[1].delivery.email, 'pending');
  assert.equal(leads[2].delivery.email, 'failed');
  assert.equal(leads[2].delivery.webhook, 'failed');
  assert.equal(leads[3].delivery.email, 'not_configured');
  assert.equal(leads[3].delivery.webhook, 'not_configured');
  assert.equal(Object.prototype.hasOwnProperty.call(leads[0], 'payload'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(leads[0], 'metadata'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(leads[0], 'lastError'), false);

  assert.deepEqual(calls[0].params, ['site-a']);
});

test('WidgetAdminLeadsService scopes delivery job lookup to the lead site', async () => {
  const calls = [];
  const service = new WidgetAdminLeadsService({
    async query(sql, params = []) {
      calls.push({ sql, params });
      return { rows: [createLeadRow()] };
    },
  });

  await service.listLeads({ siteId: 'site-a' });

  const sql = calls[0].sql;
  assert.match(sql, /ej\.metadata->>'leadId'\s*=\s*l\.id/i);
  assert.match(sql, /ej\.metadata->>'siteId'\s*=\s*l\.site_id/i);
  assert.match(sql, /ej\.metadata->>'sessionId'\s*=\s*l\.session_id/i);
  assert.match(sql, /wj\.site_id\s*=\s*l\.site_id/i);
  assert.match(sql, /wj\.payload\s*#>>\s*'\{payload,leadId\}'\s*=\s*l\.id/i);
  assert.match(sql, /ORDER BY ej\.created_at DESC/i);
  assert.match(sql, /ORDER BY wj\.created_at DESC/i);
});
