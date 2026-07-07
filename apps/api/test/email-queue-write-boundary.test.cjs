const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildBlockedEmailDeliveryResult,
  buildFailedEmailDeliveryResult,
  buildReadyEmailDeliveryResult,
  buildSkippedEmailDeliveryResult,
} = require('../dist/chat/email-delivery-executor.boundary.js');
const {
  buildDeliveryExecutionPlan,
} = require('../dist/chat/delivery-execution.boundary.js');
const {
  buildQueueEmailJobCommand,
} = require('../dist/chat/delivery-side-effect.commands.js');
const {
  buildLeadEmailJobPayload,
} = require('../dist/chat/delivery-payload.builders.js');
const {
  buildBlockedEmailQueueWriteResult,
  buildEmailQueueWriteRequest,
  buildEmailQueueWriteResultFromDeliveryResult,
  buildFailedEmailQueueWriteResult,
  buildReadyEmailQueueWriteResult,
  buildSafeEmailQueueWriteRequestForLog,
  buildSafeEmailQueueWriteResultForAudit,
  buildSafeEmailQueueWriteResultForLog,
  buildSkippedEmailQueueWriteResult,
  isBlockedEmailDeliveryExecutionResult,
  isBlockedEmailQueueWriteResult,
  isFailedEmailDeliveryExecutionResult,
  isFailedEmailQueueWriteResult,
  isReadyEmailDeliveryExecutionResult,
  isReadyEmailQueueWriteResult,
  isSkippedEmailDeliveryExecutionResult,
  isSkippedEmailQueueWriteResult,
  validateEmailQueueWriteInput,
  validateReadyEmailQueueWriteRequest,
} = require('../dist/chat/email-queue-write.boundary.js');

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

function buildReadyDeliveryResult(overrides = {}) {
  const plan = buildDeliveryExecutionPlan(buildQueueEmailJobCommand({
    payload: buildEmailPayload(overrides),
  }));
  return buildReadyEmailDeliveryResult(plan);
}

test('email queue write boundary classifies source delivery results', () => {
  const ready = buildReadyDeliveryResult();
  const skipped = buildSkippedEmailDeliveryResult('missing_email_target', { channel: 'email' });
  const blocked = buildBlockedEmailDeliveryResult('invalid_email_job_payload', 'invalid_payload');
  const failed = buildFailedEmailDeliveryResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });

  assert.equal(isReadyEmailDeliveryExecutionResult(ready), true);
  assert.equal(isSkippedEmailDeliveryExecutionResult(skipped), true);
  assert.equal(isBlockedEmailDeliveryExecutionResult(blocked), true);
  assert.equal(isFailedEmailDeliveryExecutionResult(failed), true);
  assert.equal(isReadyEmailDeliveryExecutionResult({ status: 'ready', action: 'send_webhook' }), false);
});

test('email queue write boundary validates ready source results only', () => {
  const ready = buildReadyDeliveryResult();
  const missingPayload = { status: 'ready', action: 'queue_email_job', reasonCode: 'lead_email_ready' };
  const missingRecipient = {
    status: 'ready',
    action: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload: buildEmailPayload({ recipientEmail: '   ' }),
  };
  const invalidBody = {
    status: 'ready',
    action: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload: buildEmailPayload({ subject: '', html: null, text: null }),
  };
  const skipped = buildSkippedEmailDeliveryResult('delivery_channel_disabled', { channel: 'email' });
  const blocked = buildBlockedEmailDeliveryResult('manual_block', 'invalid_payload');
  const failed = buildFailedEmailDeliveryResult({ reasonCode: 'queue_write_failed', retryable: true });

  assert.deepEqual(validateEmailQueueWriteInput(ready), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateEmailQueueWriteInput(missingPayload), {
    valid: false,
    reasonCode: 'missing_email_queue_payload',
    errorCode: 'missing_payload',
  });
  assert.deepEqual(validateEmailQueueWriteInput(missingRecipient), {
    valid: false,
    reasonCode: 'missing_email_recipient',
    errorCode: 'missing_recipient',
  });
  assert.deepEqual(validateEmailQueueWriteInput(invalidBody), {
    valid: false,
    reasonCode: 'invalid_email_queue_payload',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(validateEmailQueueWriteInput(skipped), {
    valid: false,
    reasonCode: 'delivery_channel_disabled',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailQueueWriteInput(blocked), {
    valid: false,
    reasonCode: 'manual_block',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailQueueWriteInput(failed), {
    valid: false,
    reasonCode: 'queue_write_failed',
    errorCode: 'unsupported_source_status',
  });
});

test('email queue write boundary builds request and result data objects only', () => {
  const ready = buildReadyDeliveryResult({
    metadata: {
      conversationId: 'conversation-1',
      contactRequestId: 'contact-request-1',
    },
  });
  const request = buildEmailQueueWriteRequest(ready);
  const readyResult = buildReadyEmailQueueWriteResult(ready);
  const skippedResult = buildSkippedEmailQueueWriteResult('missing_email_target', { channel: 'email' });
  const blockedResult = buildBlockedEmailQueueWriteResult('manual_block', 'invalid_payload');
  const failedResult = buildFailedEmailQueueWriteResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });

  assert.equal(request.type, 'email_queue_write_request');
  assert.equal(request.reasonCode, 'lead_email_ready');
  assert.equal(request.payload.recipientEmail, 'team@example.test');
  assert.deepEqual(request.correlation, {
    siteId: 'site-1',
    sessionId: 'session-1',
    conversationId: 'conversation-1',
    leadId: 'lead-1',
    contactRequestId: 'contact-request-1',
  });
  assert.deepEqual(validateReadyEmailQueueWriteRequest(request), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });

  assert.equal(readyResult.status, 'ready_to_enqueue');
  assert.deepEqual(readyResult.request, request);
  assert.deepEqual(skippedResult, {
    status: 'skipped',
    reasonCode: 'missing_email_target',
    channel: 'email',
  });
  assert.deepEqual(blockedResult, {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(failedResult, {
    status: 'failed',
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });
});

test('email queue write boundary maps delivery results without enqueueing', () => {
  const ready = buildReadyDeliveryResult();
  const skipped = buildSkippedEmailDeliveryResult('missing_email_target', { channel: 'email' });
  const blocked = buildBlockedEmailDeliveryResult('manual_block', 'invalid_payload');
  const failed = buildFailedEmailDeliveryResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });

  assert.equal(buildEmailQueueWriteResultFromDeliveryResult(ready).status, 'ready_to_enqueue');
  assert.deepEqual(buildEmailQueueWriteResultFromDeliveryResult(skipped), {
    status: 'skipped',
    reasonCode: 'missing_email_target',
    channel: 'email',
  });
  assert.deepEqual(buildEmailQueueWriteResultFromDeliveryResult(blocked), {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(buildEmailQueueWriteResultFromDeliveryResult(failed), {
    status: 'failed',
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });
  assert.equal(buildEmailQueueWriteResultFromDeliveryResult({ status: 'unknown' }).status, 'blocked');
});

test('email queue write boundary classifies queue write results', () => {
  const readyResult = buildReadyEmailQueueWriteResult(buildReadyDeliveryResult());
  const skippedResult = buildSkippedEmailQueueWriteResult('missing_email_target', { channel: 'email' });
  const blockedResult = buildBlockedEmailQueueWriteResult('manual_block', 'invalid_payload');
  const failedResult = buildFailedEmailQueueWriteResult({ retryable: false });

  assert.equal(isReadyEmailQueueWriteResult(readyResult), true);
  assert.equal(isSkippedEmailQueueWriteResult(skippedResult), true);
  assert.equal(isBlockedEmailQueueWriteResult(blockedResult), true);
  assert.equal(isFailedEmailQueueWriteResult(failedResult), true);
});

test('email queue write safe projections redact target, body, contact values and secrets', () => {
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
  const source = Object.freeze({
    status: 'ready',
    action: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload,
  });
  const request = buildEmailQueueWriteRequest(source);
  const result = buildReadyEmailQueueWriteResult(source);

  const projections = [
    buildSafeEmailQueueWriteRequestForLog(request),
    buildSafeEmailQueueWriteResultForLog(result),
    buildSafeEmailQueueWriteResultForAudit(result),
  ];

  for (const projection of projections) {
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

  assert.equal(source.payload.recipientEmail, 'team@example.test');
  assert.equal(source.payload.apiKey, 'dummy-api-key');
  assert.equal(source.payload.headers.authorization, 'Bearer dummy-token');
});

test('email queue write boundary remains unwired and side-effect free', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-queue-write.boundary.ts'),
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
  assert.equal(orchestratorSource.includes('email-queue-write.boundary'), false);
});
