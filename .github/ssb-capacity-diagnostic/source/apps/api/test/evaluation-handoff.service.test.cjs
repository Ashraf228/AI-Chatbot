const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { EvaluationHandoffService } = require('../dist/evaluation/evaluation-handoff.service.js');
const { buildWebhookHeaders, serializeWebhookJson } = require('../dist/webhooks/webhook-hmac.js');

const access = {
  tenantUserId: 'viewer-1',
  tenantId: 'tenant-1',
  siteId: 'site-demo',
  viewerEmail: 'viewer@example.test',
  viewerDisplayName: 'Demo Viewer',
  siteDisplayName: 'Demo Site',
  accountExpiresAt: '2099-01-01T00:00:00.000Z',
  sessionExpiresAt: '2099-01-01T00:00:00.000Z',
  demoStatus: true,
};

function createHarness() {
  const state = {
    tickets: [{
      id: 'ticket-1',
      tenant_id: 'tenant-1',
      site_id: 'site-demo',
      title: 'Demo-Supportfall DEMO-ABC',
      description: 'Upload blockiert. Authorization: Bearer [REDACTED]',
      support_profile: 'product',
      product: 'Kooperationsdemonstrator',
      module: 'Formularverwaltung',
      customer_organization: 'Beispielkommune - Demonstrator',
      customer_reference: null,
      process_or_form_name: 'Antrag Upload',
      impact: 'high',
      device: 'Browser',
      operating_system: 'Windows',
      error_message: 'Fehler [REDACTED]',
      already_tried: 'Cache geleert',
      evaluation_chat_session_id: 'eval-session-1',
      demo_reference: 'DEMO-ABC',
      demo: true,
      synthetic: true,
      created_at: '2026-06-24T10:00:00.000Z',
    }],
    events: [],
    deliveries: [],
    receipts: [],
    audits: [],
  };
  const db = {
    async query(sql, params = []) {
      if (/FROM agent_tickets/i.test(sql)) {
        return { rows: state.tickets.filter((ticket) => ticket.evaluation_chat_session_id === params[2]) };
      }
      if (/FROM evaluation_handoff_events/i.test(sql) && /evaluation_ticket_id = \$1/i.test(sql)) {
        return { rows: state.events.filter((event) => event.evaluation_ticket_id === params[0]) };
      }
      if (/INSERT INTO evaluation_handoff_events/i.test(sql)) {
        state.events.push({
          id: params[0],
          event_id: params[1],
          event_type: params[2],
          tenant_id: params[3],
          site_id: params[4],
          tenant_user_id: params[5],
          evaluation_chat_session_id: params[6],
          conversation_id: params[7],
          evaluation_ticket_id: params[8],
          payload_body: params[9],
          payload_hash: params[10],
          status: 'queued',
          delivered_at: null,
          last_error_code: null,
          created_at: '2026-06-24T10:00:00.000Z',
        });
        return { rows: [] };
      }
      if (/FROM evaluation_handoff_events/i.test(sql) && /event_id = \$1/i.test(sql)) {
        return { rows: state.events.filter((event) => event.event_id === params[0]) };
      }
      if (/count\(\*\)::int AS count FROM evaluation_handoff_deliveries/i.test(sql)) {
        return { rows: [{ count: state.deliveries.filter((delivery) => delivery.event_id === params[0]).length }] };
      }
      if (/INSERT INTO evaluation_handoff_deliveries/i.test(sql)) {
        state.deliveries.push({
          id: params[0],
          delivery_id: params[1],
          event_id: params[2],
          attempt_number: params[3],
          status: 'mock_delivering',
          http_status: null,
          retryable: false,
          response_summary: null,
          error_code: null,
          completed_at: null,
        });
        return { rows: [] };
      }
      if (/UPDATE evaluation_handoff_events\s+SET status = 'delivering'/i.test(sql)) {
        const event = state.events.find((entry) => entry.event_id === params[0]);
        if (event) event.status = 'delivering';
        return { rows: [] };
      }
      if (/UPDATE evaluation_handoff_deliveries/i.test(sql)) {
        const delivery = state.deliveries.find((entry) => entry.delivery_id === params[0]);
        if (delivery) {
          delivery.status = params[1];
          delivery.http_status = params[2];
          delivery.retryable = params[3];
          delivery.error_code = params[4];
          delivery.response_summary = params[5];
          delivery.completed_at = '2026-06-24T10:00:01.000Z';
        }
        return { rows: [] };
      }
      if (/UPDATE evaluation_handoff_events\s+SET status = 'delivered'/i.test(sql)) {
        const event = state.events.find((entry) => entry.event_id === params[0]);
        if (event) {
          event.status = 'delivered';
          event.delivered_at = '2026-06-24T10:00:01.000Z';
          event.last_error_code = null;
        }
        return { rows: [] };
      }
      if (/UPDATE evaluation_handoff_events\s+SET status = \$2/i.test(sql)) {
        const event = state.events.find((entry) => entry.event_id === params[0]);
        if (event) {
          event.status = params[1];
          event.last_error_code = params[2];
        }
        return { rows: [] };
      }
      if (/FROM evaluation_handoff_deliveries/i.test(sql) && /ORDER BY attempt_number DESC/i.test(sql)) {
        return { rows: state.deliveries.filter((entry) => entry.event_id === params[0]).slice(-1) };
      }
      if (/INSERT INTO evaluation_mock_handoff_receipts/i.test(sql)) {
        const existing = state.receipts.find((entry) => entry.event_id === params[1]);
        if (existing) {
          existing.duplicate_count += 1;
          existing.last_delivery_id = params[2];
          return { rows: [{ duplicate_count: existing.duplicate_count }] };
        }
        state.receipts.push({
          id: params[0],
          event_id: params[1],
          first_delivery_id: params[2],
          last_delivery_id: params[2],
          tenant_id: params[3],
          site_id: params[4],
          payload_hash: params[5],
          duplicate_count: 0,
        });
        return { rows: [{ duplicate_count: 0 }] };
      }
      return { rows: [] };
    },
  };
  const auditLogs = { async record(entry) { state.audits.push(entry); } };
  return { service: new EvaluationHandoffService(db, auditLogs), state };
}

test('EvaluationHandoffService rejects browser-supplied handoff internals', async () => {
  const { service } = createHarness();
  await assert.rejects(
    () => service.requestHandoff(access, { conversationId: 'eval-session-1', receiverUrl: 'https://evil.test' }),
    BadRequestException,
  );
});

test('EvaluationHandoffService creates explicit signed mock delivery without reporter email or external IDs', async () => {
  const secret = Buffer.from('0123456789abcdef0123456789abcdef');
  process.env.EVALUATION_MOCK_HANDOFF_ENABLED = 'true';
  process.env.EVALUATION_MOCK_HANDOFF_SECRET_B64 = secret.toString('base64');
  process.env.EVALUATION_MOCK_RECEIVER_ORIGIN = 'https://api.example.test';

  const fetchCalls = [];
  const previousFetch = global.fetch;
  global.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return { ok: true, status: 200, text: async () => '{"ok":true}' };
  };

  try {
    const { service, state } = createHarness();
    const result = await service.requestHandoff(access, { conversationId: 'eval-session-1' });

    assert.equal(result.status, 'mock_delivered');
    assert.equal(result.signatureVerified, true);
    assert.equal(fetchCalls.length, 1);
    assert.equal(String(fetchCalls[0].url), 'https://api.example.test/internal/evaluation/mock-handoff/v1');
    assert.equal(fetchCalls[0].init.redirect, 'manual');
    assert.match(fetchCalls[0].init.headers['x-ssb-signature'], /^v1=[a-f0-9]{64}$/);
    const payload = JSON.parse(state.events[0].payload_body);
    assert.equal(payload.eventId, state.events[0].event_id);
    assert.equal(JSON.stringify(payload).includes('viewer@example.test'), false);
    assert.equal(JSON.stringify(payload).includes('tenant-1'), false);
  } finally {
    global.fetch = previousFetch;
  }
});

test('EvaluationHandoffService mock receiver verifies raw body and detects duplicates', async () => {
  const secret = Buffer.from('0123456789abcdef0123456789abcdef');
  process.env.EVALUATION_MOCK_HANDOFF_ENABLED = 'true';
  process.env.EVALUATION_MOCK_HANDOFF_SECRET_B64 = secret.toString('base64');
  const { service, state } = createHarness();
  const body = serializeWebhookJson({ schemaVersion: 1, eventType: 'evaluation.product_support_ticket.handoff', eventId: 'evt_test' });
  state.events.push({
    id: 'event-1',
    event_id: 'evt_test',
    event_type: 'evaluation.product_support_ticket.handoff',
    tenant_id: 'tenant-1',
    site_id: 'site-demo',
    tenant_user_id: 'viewer-1',
    evaluation_chat_session_id: 'eval-session-1',
    conversation_id: 'eval-session-1',
    evaluation_ticket_id: 'ticket-1',
    payload_body: body.toString('utf8'),
    payload_hash: require('node:crypto').createHash('sha256').update(body).digest('hex'),
    status: 'queued',
    delivered_at: null,
    last_error_code: null,
    created_at: '2026-06-24T10:00:00.000Z',
  });
  const timestamp = new Date().toISOString();
  const headers = buildWebhookHeaders({
    secret,
    eventId: 'evt_test',
    deliveryId: 'del_test',
    eventType: 'evaluation.product_support_ticket.handoff',
    timestamp,
    body,
  });

  const first = await service.receiveMockHandoff(headers, body);
  const second = await service.receiveMockHandoff({ ...headers, 'x-ssb-delivery-id': 'del_retry' }, body);

  assert.equal(first.verified, true);
  assert.equal(second.duplicate, true);
  assert.equal(state.receipts[0].duplicate_count, 1);
});
