const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWebhookHeaders,
  decodeWebhookSecretB64,
  normalizeSignatureToleranceSeconds,
  payloadSha256Hex,
  serializeWebhookJson,
  signWebhookBody,
  verifyWebhookSignature,
} = require('../dist/webhooks/webhook-hmac.js');

const secret = Buffer.from('0123456789abcdef0123456789abcdef');

test('webhook HMAC signs the exact raw JSON bytes with v1 lower-case hex', () => {
  const body = serializeWebhookJson({ b: 2, a: 1 });
  const timestamp = '2026-06-24T10:00:00.000Z';
  const signature = signWebhookBody(secret, timestamp, body);

  assert.match(signature, /^v1=[a-f0-9]{64}$/);
  assert.equal(
    verifyWebhookSignature({
      secret,
      signatureHeader: signature,
      timestampHeader: timestamp,
      body,
      nowMs: Date.parse(timestamp),
      toleranceSeconds: 300,
    }).ok,
    true,
  );

  const reserialized = Buffer.from(JSON.stringify({ a: 1, b: 2 }), 'utf8');
  assert.equal(
    verifyWebhookSignature({
      secret,
      signatureHeader: signature,
      timestampHeader: timestamp,
      body: reserialized,
      nowMs: Date.parse(timestamp),
      toleranceSeconds: 300,
    }).ok,
    false,
  );
});

test('webhook HMAC rejects malformed signatures and stale timestamps', () => {
  const body = serializeWebhookJson({ ok: true });
  const timestamp = '2026-06-24T10:00:00.000Z';
  const headers = buildWebhookHeaders({
    secret,
    eventId: 'evt_1',
    deliveryId: 'del_1',
    eventType: 'evaluation.product_support_ticket.handoff',
    timestamp,
    body,
  });

  assert.equal(verifyWebhookSignature({
    secret,
    signatureHeader: 'v1=abc',
    timestampHeader: timestamp,
    body,
    nowMs: Date.parse(timestamp),
  }).code, 'invalid_version');

  assert.equal(verifyWebhookSignature({
    secret,
    signatureHeader: headers['x-ssb-signature'],
    timestampHeader: timestamp,
    body,
    nowMs: Date.parse(timestamp) + 301000,
    toleranceSeconds: 300,
  }).code, 'timestamp_out_of_range');
});

test('webhook HMAC validates secret length, tolerance clamp and payload hash', () => {
  assert.equal(decodeWebhookSecretB64(Buffer.from('short').toString('base64')), null);
  assert.equal(decodeWebhookSecretB64(secret.toString('base64')).length, 32);
  assert.equal(normalizeSignatureToleranceSeconds(0), 300);
  assert.equal(normalizeSignatureToleranceSeconds(29), 300);
  assert.equal(normalizeSignatureToleranceSeconds(601), 300);
  assert.equal(normalizeSignatureToleranceSeconds(60), 60);
  assert.match(payloadSha256Hex(Buffer.from('abc')), /^[a-f0-9]{64}$/);
});
