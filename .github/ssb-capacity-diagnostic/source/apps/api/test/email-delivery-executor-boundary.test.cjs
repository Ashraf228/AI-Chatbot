const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildBlockedExecutionPlan,
  buildDeliveryExecutionPlan,
} = require('../dist/chat/delivery-execution.boundary.js');
const {
  buildNoopDeliveryCommand,
  buildQueueEmailJobCommand,
} = require('../dist/chat/delivery-side-effect.commands.js');
const {
  buildLeadEmailJobPayload,
} = require('../dist/chat/delivery-payload.builders.js');
const {
  buildBlockedEmailDeliveryResult,
  buildEmailDeliveryResultFromPlan,
  buildFailedEmailDeliveryResult,
  buildReadyEmailDeliveryResult,
  buildSafeEmailDeliveryResultForAudit,
  buildSafeEmailDeliveryResultForLog,
  buildSkippedEmailDeliveryResult,
  isBlockedEmailDeliveryPlan,
  isReadyEmailDeliveryPlan,
  isSkippedEmailDeliveryPlan,
  isUnsupportedEmailDeliveryPlan,
  validateEmailDeliveryPlanForExecutor,
  validateReadyEmailDeliveryPlan,
} = require('../dist/chat/email-delivery-executor.boundary.js');

function buildEmailPayload(overrides = {}) {
  const payload = buildLeadEmailJobPayload({
    mail: {
      to: 'team@example.test',
      subject: 'Neue Anfrage von max@example.test',
      html: '<p>Kontakt: max@example.test / +49 155 11410215</p>',
      text: 'Kontakt: max@example.test / +49 155 11410215',
    },
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    leadId: 'lead-1',
    contact: {
      name: 'Max Mustermann',
      email: 'max@example.test',
      phone: '+49 155 11410215',
      concern: 'Beratung',
    },
    scheduleIntent: false,
  });

  return {
    ...payload,
    ...overrides,
    metadata: {
      ...payload.metadata,
      ...(overrides.metadata || {}),
    },
  };
}

function buildReadyPlan(overrides = {}) {
  return buildDeliveryExecutionPlan(buildQueueEmailJobCommand({
    payload: buildEmailPayload(overrides),
  }));
}

test('email delivery executor boundary classifies ready, skipped, blocked and unsupported plans', () => {
  const readyPlan = buildReadyPlan();
  const skippedPlan = buildDeliveryExecutionPlan(buildNoopDeliveryCommand({
    reasonCode: 'missing_email_target',
    channel: 'email',
  }));
  const blockedPlan = buildBlockedExecutionPlan('manual_block', 'invalid_payload');
  const unsupportedPlan = { action: 'send_webhook', payload: {} };

  assert.equal(isReadyEmailDeliveryPlan(readyPlan), true);
  assert.equal(isSkippedEmailDeliveryPlan(skippedPlan), true);
  assert.equal(isBlockedEmailDeliveryPlan(blockedPlan), true);
  assert.equal(isUnsupportedEmailDeliveryPlan(unsupportedPlan), true);
});

test('email delivery executor boundary validates plans without side effects', () => {
  const validPlan = buildReadyPlan();
  const missingPayloadPlan = {
    action: 'queue_email_job',
    commandType: 'queue_email_job',
    reasonCode: 'lead_email_ready',
  };
  const missingRecipientPlan = {
    action: 'queue_email_job',
    commandType: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload: buildEmailPayload({ recipientEmail: '   ' }),
  };
  const invalidPayloadPlan = {
    action: 'queue_email_job',
    commandType: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload: buildEmailPayload({ subject: '', html: null, text: null }),
  };
  const noopPlan = buildDeliveryExecutionPlan(buildNoopDeliveryCommand({
    reasonCode: 'delivery_channel_disabled',
    channel: 'email',
  }));

  assert.deepEqual(validateEmailDeliveryPlanForExecutor(validPlan), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateReadyEmailDeliveryPlan(validPlan), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateReadyEmailDeliveryPlan(missingPayloadPlan), {
    valid: false,
    reasonCode: 'missing_email_job_payload',
    errorCode: 'missing_payload',
  });
  assert.deepEqual(validateReadyEmailDeliveryPlan(missingRecipientPlan), {
    valid: false,
    reasonCode: 'missing_email_recipient',
    errorCode: 'missing_recipient',
  });
  assert.deepEqual(validateReadyEmailDeliveryPlan(invalidPayloadPlan), {
    valid: false,
    reasonCode: 'invalid_email_job_payload',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(validateEmailDeliveryPlanForExecutor(noopPlan), {
    valid: true,
    reasonCode: 'delivery_channel_disabled',
  });
  assert.deepEqual(validateEmailDeliveryPlanForExecutor({ action: 'send_webhook' }), {
    valid: false,
    reasonCode: 'email_delivery_blocked',
    errorCode: 'unsupported_action',
  });
});

test('email delivery executor boundary builds result data objects only', () => {
  const readyPlan = buildReadyPlan();
  const skippedPlan = buildDeliveryExecutionPlan(buildNoopDeliveryCommand({
    reasonCode: 'missing_email_target',
    channel: 'email',
  }));
  const blockedPlan = buildBlockedExecutionPlan('manual_block', 'invalid_payload');

  assert.deepEqual(buildReadyEmailDeliveryResult(readyPlan), {
    status: 'ready',
    action: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload: readyPlan.payload,
  });
  assert.deepEqual(buildSkippedEmailDeliveryResult('missing_email_target', { channel: 'email' }), {
    status: 'skipped',
    reasonCode: 'missing_email_target',
    channel: 'email',
  });
  assert.deepEqual(buildBlockedEmailDeliveryResult('manual_block', 'invalid_payload'), {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(buildFailedEmailDeliveryResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  }), {
    status: 'failed',
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });
  assert.deepEqual(buildEmailDeliveryResultFromPlan(readyPlan), buildReadyEmailDeliveryResult(readyPlan));
  assert.deepEqual(buildEmailDeliveryResultFromPlan(skippedPlan), {
    status: 'skipped',
    reasonCode: 'missing_email_target',
    channel: 'email',
  });
  assert.deepEqual(buildEmailDeliveryResultFromPlan(blockedPlan), {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_payload',
  });
  assert.equal(buildEmailDeliveryResultFromPlan({ action: 'send_webhook' }).status, 'blocked');
});

test('email delivery executor safe projections redact targets, contact values, secrets and body fields', () => {
  const payload = Object.freeze({
    ...buildEmailPayload(),
    apiKey: 'dummy-api-key',
    signingSecret: 'dummy-signing-secret',
    headers: Object.freeze({
      authorization: 'Bearer dummy-token',
      'x-trace-id': 'trace-1',
    }),
    metadata: Object.freeze({
      ...buildEmailPayload().metadata,
      token: 'dummy-token',
      phone: '+49 155 11410215',
    }),
  });
  const result = Object.freeze({
    status: 'ready',
    action: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload,
  });

  const logSafe = buildSafeEmailDeliveryResultForLog(result);
  const auditSafe = buildSafeEmailDeliveryResultForAudit(result);

  for (const projection of [logSafe, auditSafe]) {
    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes('team@example.test'), false);
    assert.equal(serialized.includes('max@example.test'), false);
    assert.equal(serialized.includes('+49 155 11410215'), false);
    assert.equal(serialized.includes('dummy-api-key'), false);
    assert.equal(serialized.includes('dummy-signing-secret'), false);
    assert.equal(serialized.includes('dummy-token'), false);
    assert.equal(serialized.includes('apiKey'), false);
    assert.equal(serialized.includes('signingSecret'), false);
    assert.equal(serialized.includes('authorization'), false);
    assert.equal(serialized.includes('token'), false);
    assert.equal(serialized.includes('<p>Kontakt'), false);
    assert.equal(serialized.includes('[redacted-body]'), true);
    assert.equal(serialized.includes('[redacted-email]'), true);
    assert.equal(serialized.includes('[redacted-phone]'), true);
  }

  assert.equal(result.payload.recipientEmail, 'team@example.test');
  assert.equal(result.payload.apiKey, 'dummy-api-key');
  assert.equal(result.payload.headers.authorization, 'Bearer dummy-token');
});

test('email delivery executor boundary remains unwired and side-effect free', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-delivery-executor.boundary.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher|IntegrationEventDispatcher/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE |DELETE FROM/);

  const orchestratorSource = fs.readFileSync(
    path.join(__dirname, '../src/chat/chat-agent-orchestrator.service.ts'),
    'utf8',
  );
  assert.equal(orchestratorSource.includes('email-delivery-executor.boundary'), false);
});
