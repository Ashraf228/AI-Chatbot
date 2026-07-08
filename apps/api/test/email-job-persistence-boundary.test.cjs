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
  buildEmailQueueWriteResultFromDeliveryResult,
  buildFailedEmailQueueWriteResult,
  buildReadyEmailQueueWriteResult,
  buildSkippedEmailQueueWriteResult,
  isBlockedEmailQueueWriteResult,
  isFailedEmailQueueWriteResult,
  isReadyEmailQueueWriteResult,
  isSkippedEmailQueueWriteResult,
} = require('../dist/chat/email-queue-write.boundary.js');
const {
  buildBlockedEmailJobPersistenceResult,
  buildEmailJobPersistenceRequest,
  buildEmailJobPersistenceResultFromQueueWriteResult,
  buildFailedEmailJobPersistenceResult,
  buildReadyEmailJobPersistenceResult,
  buildSafeEmailJobPersistenceRequestForLog,
  buildSafeEmailJobPersistenceResultForAudit,
  buildSafeEmailJobPersistenceResultForLog,
  buildSkippedEmailJobPersistenceResult,
  isBlockedEmailJobPersistenceResult,
  isFailedEmailJobPersistenceResult,
  isReadyEmailJobPersistenceResult,
  isSkippedEmailJobPersistenceResult,
  validateEmailJobPersistenceInput,
  validateReadyEmailJobPersistenceRequest,
} = require('../dist/chat/email-job-persistence.boundary.js');

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

function buildReadyQueueWriteResult(overrides = {}) {
  const plan = buildDeliveryExecutionPlan(buildQueueEmailJobCommand({
    payload: buildEmailPayload(overrides),
  }));
  const deliveryResult = buildReadyEmailDeliveryResult(plan);
  return buildReadyEmailQueueWriteResult(deliveryResult);
}

function buildRawReadyQueueWriteResult(overrides = {}) {
  return {
    status: 'ready_to_enqueue',
    reasonCode: 'lead_email_ready',
    request: {
      type: 'email_queue_write_request',
      reasonCode: 'lead_email_ready',
      payload: buildEmailPayload(overrides),
    },
  };
}

test('email job persistence boundary classifies queue write and persistence results', () => {
  const ready = buildReadyQueueWriteResult();
  const skipped = buildSkippedEmailQueueWriteResult('missing_email_target', { channel: 'email' });
  const blocked = buildBlockedEmailQueueWriteResult('manual_block', 'invalid_payload');
  const failed = buildFailedEmailQueueWriteResult({ reasonCode: 'queue_write_failed', retryable: true });

  assert.equal(isReadyEmailQueueWriteResult(ready), true);
  assert.equal(isSkippedEmailQueueWriteResult(skipped), true);
  assert.equal(isBlockedEmailQueueWriteResult(blocked), true);
  assert.equal(isFailedEmailQueueWriteResult(failed), true);

  assert.equal(isReadyEmailJobPersistenceResult(buildReadyEmailJobPersistenceResult(ready)), true);
  assert.equal(isSkippedEmailJobPersistenceResult(buildSkippedEmailJobPersistenceResult('noop')), true);
  assert.equal(isBlockedEmailJobPersistenceResult(buildBlockedEmailJobPersistenceResult('blocked', 'invalid_payload')), true);
  assert.equal(isFailedEmailJobPersistenceResult(buildFailedEmailJobPersistenceResult({ retryable: true })), true);
});

test('email job persistence boundary validates ready source results only', () => {
  const ready = buildReadyQueueWriteResult();
  const missingPayload = {
    status: 'ready_to_enqueue',
    reasonCode: 'lead_email_ready',
    request: {
      type: 'email_queue_write_request',
      reasonCode: 'lead_email_ready',
    },
  };
  const missingRecipient = buildRawReadyQueueWriteResult({ recipientEmail: '   ' });
  const invalidBody = buildRawReadyQueueWriteResult({ subject: '', html: null, text: null });
  const skipped = buildSkippedEmailQueueWriteResult('delivery_channel_disabled', { channel: 'email' });
  const blocked = buildBlockedEmailQueueWriteResult('manual_block', 'invalid_payload');
  const failed = buildFailedEmailQueueWriteResult({ reasonCode: 'queue_write_failed', retryable: true });

  assert.deepEqual(validateEmailJobPersistenceInput(ready), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateEmailJobPersistenceInput(missingPayload), {
    valid: false,
    reasonCode: 'missing_email_job_persistence_request',
    errorCode: 'missing_request',
  });
  assert.deepEqual(validateEmailJobPersistenceInput(missingRecipient), {
    valid: false,
    reasonCode: 'missing_email_recipient',
    errorCode: 'missing_recipient',
  });
  assert.deepEqual(validateEmailJobPersistenceInput(invalidBody), {
    valid: false,
    reasonCode: 'invalid_email_queue_payload',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(validateEmailJobPersistenceInput(skipped), {
    valid: false,
    reasonCode: 'delivery_channel_disabled',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailJobPersistenceInput(blocked), {
    valid: false,
    reasonCode: 'manual_block',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailJobPersistenceInput(failed), {
    valid: false,
    reasonCode: 'queue_write_failed',
    errorCode: 'unsupported_source_status',
  });
});

test('email job persistence boundary builds request and result data objects only', () => {
  const ready = buildReadyQueueWriteResult({
    metadata: {
      conversationId: 'conversation-1',
      contactRequestId: 'contact-request-1',
    },
  });
  const request = buildEmailJobPersistenceRequest(ready);
  const readyResult = buildReadyEmailJobPersistenceResult(ready);
  const skippedResult = buildSkippedEmailJobPersistenceResult('missing_email_target', { channel: 'email' });
  const blockedResult = buildBlockedEmailJobPersistenceResult('manual_block', 'invalid_payload');
  const failedResult = buildFailedEmailJobPersistenceResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });

  assert.equal(request.type, 'email_job_persistence_request');
  assert.equal(request.reasonCode, 'lead_email_ready');
  assert.equal(request.payload.recipientEmail, 'team@example.test');
  assert.deepEqual(request.correlation, {
    siteId: 'site-1',
    sessionId: 'session-1',
    conversationId: 'conversation-1',
    leadId: 'lead-1',
    contactRequestId: 'contact-request-1',
  });
  assert.deepEqual(validateReadyEmailJobPersistenceRequest(request), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });

  assert.equal(readyResult.status, 'ready_to_persist');
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

test('email job persistence boundary maps queue write results without writes', () => {
  const ready = buildReadyQueueWriteResult();
  const skipped = buildEmailQueueWriteResultFromDeliveryResult(
    buildSkippedEmailDeliveryResult('missing_email_target', { channel: 'email' }),
  );
  const blocked = buildEmailQueueWriteResultFromDeliveryResult(
    buildBlockedEmailDeliveryResult('manual_block', 'invalid_payload'),
  );
  const failed = buildEmailQueueWriteResultFromDeliveryResult(
    buildFailedEmailDeliveryResult({
      reasonCode: 'queue_insert_failed',
      errorCode: 'queue_write_failed',
      retryable: true,
    }),
  );

  assert.equal(buildEmailJobPersistenceResultFromQueueWriteResult(ready).status, 'ready_to_persist');
  assert.deepEqual(buildEmailJobPersistenceResultFromQueueWriteResult(skipped), {
    status: 'skipped',
    reasonCode: 'missing_email_target',
    channel: 'email',
  });
  assert.deepEqual(buildEmailJobPersistenceResultFromQueueWriteResult(blocked), {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(buildEmailJobPersistenceResultFromQueueWriteResult(failed), {
    status: 'failed',
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });
  assert.equal(buildEmailJobPersistenceResultFromQueueWriteResult({ status: 'unknown' }).status, 'blocked');
});

test('email job persistence safe projections redact targets, body, contact values and secrets', () => {
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
  const queueResult = Object.freeze({
    status: 'ready_to_enqueue',
    reasonCode: 'lead_email_ready',
    request: Object.freeze({
      type: 'email_queue_write_request',
      reasonCode: 'lead_email_ready',
      payload,
      correlation: Object.freeze({
        siteId: 'site-1',
        sessionId: 'session-1',
        leadId: 'lead-1',
      }),
    }),
  });
  const request = buildEmailJobPersistenceRequest(queueResult);
  const result = buildReadyEmailJobPersistenceResult(queueResult);

  const projections = [
    buildSafeEmailJobPersistenceRequestForLog(request),
    buildSafeEmailJobPersistenceResultForLog(result),
    buildSafeEmailJobPersistenceResultForAudit(result),
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

  assert.equal(queueResult.request.payload.recipientEmail, 'team@example.test');
  assert.equal(queueResult.request.payload.apiKey, 'dummy-api-key');
  assert.equal(queueResult.request.payload.headers.authorization, 'Bearer dummy-token');
});

test('email job persistence boundary remains unwired and side-effect free', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-job-persistence.boundary.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher|IntegrationEventDispatcher/);
  assert.doesNotMatch(source, /processPendingJobs|process\.env|console\.|logger|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE |DELETE FROM/);

  const orchestratorSource = fs.readFileSync(
    path.join(__dirname, '../src/chat/chat-agent-orchestrator.service.ts'),
    'utf8',
  );
  assert.equal(orchestratorSource.includes('email-job-persistence.boundary'), false);
});
