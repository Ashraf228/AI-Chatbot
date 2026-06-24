const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { BadRequestException } = require('@nestjs/common');
const { IntegrationsService } = require('../dist/integrations/integrations.service.js');
const { IntegrationSecretsService } = require('../dist/integrations/integration-secrets.service.js');
const { WebhookJobsService } = require('../dist/tools/webhook-jobs.service.js');
const {
  verifyWebhookSignature,
} = require('../dist/webhooks/webhook-hmac.js');

const TEST_SECRET_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

function hmacSecret() {
  return randomBytes(32).toString('base64');
}

function createIntegrationHarness({ existing = null } = {}) {
  process.env.ALLOW_PRIVATE_INTEGRATION_URLS = 'true';
  process.env.INTEGRATION_SECRET_KEY = TEST_SECRET_KEY;
  const queries = [];
  const db = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/FROM integration_connections/i.test(sql) && /LIMIT 1/i.test(sql)) {
        return { rows: existing ? [existing] : [] };
      }
      if (/FROM integration_connections/i.test(sql)) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const sites = {
    async getSite(id) {
      return { id, tenant_id: 'tenant-1' };
    },
  };
  return {
    service: new IntegrationsService(db, sites, new IntegrationSecretsService()),
    queries,
  };
}

function insertCall(queries) {
  const call = queries.find((entry) => /INSERT INTO integration_connections/i.test(entry.sql));
  assert.ok(call, 'expected integration insert call');
  return call;
}

test('generic webhook migration classifies existing webhooks as legacy and defaults new rows to HMAC', () => {
  const sql = readFileSync(join(__dirname, '../migrations/028_generic_webhook_signing_modes.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS signing_mode TEXT/i);
  assert.match(sql, /provider_key IN \('webhook', 'crm-webhook', 'ticket-webhook'\)/i);
  assert.match(sql, /SET DEFAULT 'hmac_sha256'/i);
  assert.match(sql, /CHECK \(signing_mode IN \('hmac_sha256', 'legacy_secret_header'\)\)/i);
  assert.doesNotMatch(sql, /UPDATE integration_connections\s+SET\s+secrets/i);
});

test('new generic webhook defaults to HMAC and keeps signing mode outside config', async () => {
  const { service, queries } = createIntegrationHarness();
  await service.createForSite('site-1', {
    providerKey: 'webhook',
    config: {
      url: 'https://example.com/webhook',
      headers: '{"x-source":"demo"}',
    },
    secrets: {
      secret: hmacSecret(),
      bearerToken: 'transport-token',
    },
  });

  const call = insertCall(queries);
  assert.equal(call.params[10], 'hmac_sha256');
  assert.equal(JSON.parse(call.params[7]).signingMode, undefined);
  assert.match(JSON.parse(call.params[8]).secret, /^enc:v2:/);
});

test('normal new webhook requests cannot choose legacy and unknown signing modes are rejected', async () => {
  const { service } = createIntegrationHarness();
  await assert.rejects(
    () => service.createForSite('site-1', {
      providerKey: 'webhook',
      config: { url: 'https://example.com/webhook', signingMode: 'legacy_secret_header' },
      secrets: { secret: hmacSecret() },
    }),
    (error) => error instanceof BadRequestException,
  );
  await assert.rejects(
    () => service.createForSite('site-1', {
      providerKey: 'webhook',
      config: { url: 'https://example.com/webhook', signingMode: 'plain_text' },
      secrets: { secret: hmacSecret() },
    }),
    (error) => error instanceof BadRequestException,
  );
});

test('existing legacy webhook update preserves legacy mode and does not delete secrets', async () => {
  const existing = {
    id: 'conn-legacy',
    tenant_id: 'tenant-1',
    site_id: 'site-1',
    provider_key: 'webhook',
    connection_key: 'primary',
    display_name: 'Legacy',
    status: 'connected',
    config: { url: 'https://old.example.com/webhook' },
    secrets: { secret: 'legacy-secret' },
    secrets_encrypted: false,
    signing_mode: 'legacy_secret_header',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  const { service, queries } = createIntegrationHarness({ existing });
  await service.patchForSite('site-1', 'conn-legacy', {
    config: { url: 'https://example.com/webhook' },
  });

  const call = insertCall(queries);
  assert.equal(call.params[10], 'legacy_secret_header');
  const storedSecrets = JSON.parse(call.params[8]);
  assert.match(storedSecrets.secret, /^enc:v2:/);
  assert.equal(new IntegrationSecretsService().decryptRecord(storedSecrets, true).secret, 'legacy-secret');
});

test('reserved signature headers are rejected in customer-controlled config', async () => {
  const { service } = createIntegrationHarness();
  await assert.rejects(
    () => service.createForSite('site-1', {
      providerKey: 'webhook',
      config: { url: 'https://example.com/webhook', headers: '{"x-ssb-signature":"forged"}' },
      secrets: { secret: hmacSecret() },
    }),
    (error) => error instanceof BadRequestException,
  );
  await assert.rejects(
    () => service.createForSite('site-1', {
      providerKey: 'webhook',
      config: { url: 'https://example.com/webhook', headers: '{"x-webhook-secret":"forged"}' },
      secrets: { secret: hmacSecret() },
    }),
    (error) => error instanceof BadRequestException,
  );
});

test('headers separate transport authentication from HMAC signing and keep legacy compatible', () => {
  const { service } = createIntegrationHarness();
  const hmacHeaders = service.buildHeaders(
    { headers: '{"x-source":"demo","x-ssb-event-id":"ignored"}' },
    { secret: 'not-transported', bearerToken: 'bearer-token', apiKey: 'api-key' },
    'hmac_sha256',
  );
  assert.equal(hmacHeaders.authorization, 'Bearer bearer-token');
  assert.equal(hmacHeaders['x-api-key'], 'api-key');
  assert.equal(hmacHeaders['x-source'], 'demo');
  assert.equal(hmacHeaders['x-webhook-secret'], undefined);
  assert.equal(hmacHeaders['x-ssb-event-id'], undefined);

  const legacyHeaders = service.buildHeaders(
    {},
    { signingSecret: 'legacy-secret-value' },
    'legacy_secret_header',
  );
  assert.equal(legacyHeaders['x-webhook-secret'], 'legacy-secret-value');
});

test('HMAC webhook delivery signs exact stored payload bytes without sending the secret', async () => {
  const secret = hmacSecret();
  const sent = [];
  const updates = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    sent.push({ url, init });
    return { ok: true, status: 204, async text() { return ''; } };
  };

  try {
    const service = new WebhookJobsService(
      { async query(sql, params = []) { updates.push({ sql, params }); return { rows: [] }; } },
      new IntegrationSecretsService(),
    );
    const job = {
      id: 'job-1',
      provider_key: 'webhook',
      connection_key: 'primary',
      endpoint_url: 'https://example.com/webhook',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': 'legacy-should-not-send' },
      payload: { eventType: 'lead.created' },
      payload_body: '{"eventType":"lead.created","value":0}',
      signing_mode: 'hmac_sha256',
      event_id: 'evt_static',
      signing_secret: { signingSecret: secret },
      signing_secret_encrypted: false,
      retry_count: 0,
      max_attempts: 5,
    };

    await service.processJob(job);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.processJob(job);

    assert.equal(sent.length, 2);
    assert.equal(sent[0].init.body.toString('utf8'), job.payload_body);
    assert.equal(sent[1].init.body.toString('utf8'), job.payload_body);
    assert.equal(sent[0].init.headers['x-webhook-secret'], undefined);
    assert.equal(sent[0].init.headers['x-ssb-event-id'], 'evt_static');
    assert.equal(sent[1].init.headers['x-ssb-event-id'], 'evt_static');
    assert.notEqual(sent[0].init.headers['x-ssb-delivery-id'], sent[1].init.headers['x-ssb-delivery-id']);
    assert.equal(JSON.stringify(sent[0].init.body).includes(secret), false);
    const verified = verifyWebhookSignature({
      secret: Buffer.from(secret, 'base64'),
      signatureHeader: sent[0].init.headers['x-ssb-signature'],
      timestampHeader: sent[0].init.headers['x-ssb-timestamp'],
      body: Buffer.from(job.payload_body, 'utf8'),
      toleranceSeconds: 600,
    });
    assert.deepEqual(verified, { ok: true });
    assert.equal(updates.some((entry) => /last_delivery_id/i.test(entry.sql)), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('HMAC webhook delivery fails safely when the HMAC secret is missing', async () => {
  let fetchCalled = false;
  const updates = [];
  const originalFetch = global.fetch;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, status: 204, async text() { return ''; } };
  };

  try {
    const service = new WebhookJobsService(
      { async query(sql, params = []) { updates.push({ sql, params }); return { rows: [] }; } },
      new IntegrationSecretsService(),
    );
    await service.processJob({
      id: 'job-2',
      provider_key: 'webhook',
      connection_key: 'primary',
      endpoint_url: 'https://example.com/webhook',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: { eventType: 'lead.created' },
      payload_body: '{"eventType":"lead.created"}',
      signing_mode: 'hmac_sha256',
      event_id: 'evt_missing_secret',
      signing_secret: {},
      signing_secret_encrypted: false,
      retry_count: 0,
      max_attempts: 1,
    });
    assert.equal(fetchCalled, false);
    assert.equal(updates.some((entry) => String(entry.params?.[4] || '').includes('HMAC signing secret')), true);
  } finally {
    global.fetch = originalFetch;
  }
});
