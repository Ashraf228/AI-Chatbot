const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertNoPublicDeliverySecrets,
  getNotificationNoopReason,
  getPublicUnsafeDeliveryKeys,
  hasAnyUsableDeliveryTarget,
  hasUsableEmailTarget,
  hasUsableWebhookTarget,
  isDeliverySecretField,
  isSensitiveDeliveryKey,
  isSensitiveDeliveryPath,
  redactDeliverySensitiveValue,
  sanitizeDeliveryConfigForAdminRead,
  sanitizeDeliveryConfigForLog,
  sanitizeDeliveryHeaders,
  sanitizeNotificationPayloadForAudit,
  shouldNoopNotification,
  stripPublicNotificationFields,
} = require('../dist/chat/notification-safety.guard.js');

test('notification safety detects delivery secrets without classifying recipient email as a secret', () => {
  assert.equal(isSensitiveDeliveryKey('signingSecret'), true);
  assert.equal(isSensitiveDeliveryKey('token'), true);
  assert.equal(isSensitiveDeliveryKey('apiKey'), true);
  assert.equal(isSensitiveDeliveryKey('authorization'), true);
  assert.equal(isSensitiveDeliveryKey('bearerToken'), true);
  assert.equal(isSensitiveDeliveryKey('privateKey'), true);
  assert.equal(isDeliverySecretField('secret'), true);
  assert.equal(isSensitiveDeliveryPath('headers.authorization'), true);
  assert.equal(isSensitiveDeliveryPath(['deliveryChannels', 'webhook', 'headers', 'Authorization']), true);
  assert.equal(isSensitiveDeliveryKey('recipientEmail'), false);
  assert.equal(isSensitiveDeliveryKey('status'), false);
});

test('notification safety sanitizes headers without mutating input', () => {
  const headers = Object.freeze({
    Authorization: 'Bearer dummy-auth-value',
    'x-api-key': 'dummy-api-key',
    'content-type': 'application/json',
  });

  const sanitized = sanitizeDeliveryHeaders(headers);

  assert.equal(sanitized.Authorization, '[redacted]');
  assert.equal(sanitized['x-api-key'], '[redacted]');
  assert.equal(sanitized['content-type'], 'application/json');
  assert.equal(headers.Authorization, 'Bearer dummy-auth-value');
  assert.equal(JSON.stringify(sanitized).includes('dummy-auth-value'), false);
  assert.equal(JSON.stringify(sanitized).includes('dummy-api-key'), false);
});

test('notification safety recursively sanitizes delivery config for logs and admin reads', () => {
  const config = Object.freeze({
    deliveryChannels: Object.freeze({
      email: Object.freeze({
        enabled: true,
        recipientEmail: 'team@example.test',
        label: 'Internal team',
      }),
      webhook: Object.freeze({
        enabled: true,
        webhookUrl: 'https://hooks.example.test/intake',
        signingSecret: 'dummy-signing-secret',
        headers: Object.freeze({
          authorization: 'Bearer dummy-token',
          'x-trace-id': 'trace-1',
        }),
      }),
    }),
    harmless: 'visible',
  });

  const logSafe = sanitizeDeliveryConfigForLog(config);
  const adminSafe = sanitizeDeliveryConfigForAdminRead(config);
  const serializedLogSafe = JSON.stringify(logSafe);
  const serializedAdminSafe = JSON.stringify(adminSafe);

  assert.equal(logSafe.deliveryChannels.email.recipientEmail, 'team@example.test');
  assert.equal(logSafe.deliveryChannels.webhook.signingSecret, '[redacted]');
  assert.equal(logSafe.deliveryChannels.webhook.headers.authorization, '[redacted]');
  assert.equal(adminSafe.deliveryChannels.email.recipientEmail, undefined);
  assert.equal(adminSafe.deliveryChannels.webhook.webhookUrl, undefined);
  assert.equal(adminSafe.deliveryChannels.webhook.signingSecret, undefined);
  assert.equal(adminSafe.deliveryChannels.webhook.headers.authorization, undefined);
  assert.equal(adminSafe.deliveryChannels.webhook.headers['x-trace-id'], 'trace-1');
  assert.equal(adminSafe.harmless, 'visible');
  assert.equal(serializedLogSafe.includes('dummy-signing-secret'), false);
  assert.equal(serializedLogSafe.includes('dummy-token'), false);
  assert.equal(serializedAdminSafe.includes('team@example.test'), false);
  assert.equal(serializedAdminSafe.includes('https://hooks.example.test/intake'), false);
  assert.equal(config.deliveryChannels.webhook.signingSecret, 'dummy-signing-secret');
});

test('notification safety sanitizes audit and public output separately', () => {
  const payload = {
    recipientEmail: 'audit@example.test',
    lead: { email: 'lead@example.test', message: 'Support request' },
    deliveryChannels: {
      webhook: {
        enabled: true,
        webhookUrl: 'https://hooks.example.test/ticket',
        apiKey: 'dummy-api-key',
      },
    },
  };

  const auditSafe = sanitizeNotificationPayloadForAudit(payload);
  const publicSafe = stripPublicNotificationFields(payload);

  assert.equal(auditSafe.recipientEmail, '[redacted]');
  assert.equal(auditSafe.deliveryChannels.webhook.webhookUrl, '[redacted]');
  assert.equal(auditSafe.deliveryChannels.webhook.apiKey, '[redacted]');
  assert.equal(publicSafe.recipientEmail, undefined);
  assert.equal(publicSafe.deliveryChannels, undefined);
  assert.equal(JSON.stringify(auditSafe).includes('dummy-api-key'), false);
  assert.equal(JSON.stringify(publicSafe).includes('audit@example.test'), false);
});

test('notification safety evaluates no-op and usable target decisions as data only', () => {
  assert.equal(hasUsableEmailTarget({ enabled: true, recipientEmail: 'team@example.test' }), true);
  assert.equal(hasUsableEmailTarget({ enabled: false, recipientEmail: 'team@example.test' }), false);
  assert.equal(hasUsableEmailTarget({ recipientEmail: '   ' }), false);
  assert.equal(hasUsableWebhookTarget({ enabled: true, webhookUrl: 'https://hooks.example.test' }), true);
  assert.equal(hasUsableWebhookTarget({ enabled: false, webhookUrl: 'https://hooks.example.test' }), false);
  assert.equal(hasUsableWebhookTarget({ webhookUrl: '' }), false);
  assert.equal(
    hasAnyUsableDeliveryTarget({
      deliveryChannels: {
        email: { enabled: false, recipientEmail: 'team@example.test' },
        webhook: { enabled: true, webhookUrl: 'https://hooks.example.test' },
      },
    }),
    true,
  );

  assert.equal(getNotificationNoopReason({ type: 'email', config: {} }), 'missing_email_target');
  assert.equal(getNotificationNoopReason({ type: 'webhook', config: { webhookUrl: '' } }), 'missing_webhook_target');
  assert.equal(getNotificationNoopReason({ config: null }), 'missing_delivery_config');
  assert.equal(getNotificationNoopReason({ enabled: false, config: { recipientEmail: 'team@example.test' } }), 'delivery_channel_disabled');
  assert.equal(shouldNoopNotification({ type: 'email', config: { recipientEmail: 'team@example.test' } }), false);
});

test('notification safety reports public-unsafe keys', () => {
  const unsafe = getPublicUnsafeDeliveryKeys({
    deliveryChannels: {
      email: { recipientEmail: 'team@example.test' },
      webhook: { signingSecret: 'dummy-signing-secret' },
    },
    headers: { authorization: 'Bearer dummy-token' },
    harmless: 'visible',
  });

  assert.deepEqual(unsafe.sort(), [
    'deliveryChannels',
    'deliveryChannels.email.recipientEmail',
    'deliveryChannels.webhook.signingSecret',
    'headers.authorization',
  ]);
  assert.equal(assertNoPublicDeliverySecrets({ harmless: 'visible' }), true);
  assert.equal(assertNoPublicDeliverySecrets({ token: 'dummy-token' }), false);
});

test('notification safety redacts scalar sensitive values only when present', () => {
  assert.equal(redactDeliverySensitiveValue('dummy-token'), '[redacted]');
  assert.equal(redactDeliverySensitiveValue(''), '');
  assert.equal(redactDeliverySensitiveValue(null), null);
  assert.equal(redactDeliverySensitiveValue(undefined), undefined);
});

test('notification safety guard stays pure and has no side-effect dependencies', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/notification-safety.guard.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher/);
});
