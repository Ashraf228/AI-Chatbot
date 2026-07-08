const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildBlockedEmailJobPersistenceResult,
  buildFailedEmailJobPersistenceResult,
  buildReadyEmailJobPersistenceResult,
  buildSkippedEmailJobPersistenceResult,
} = require('../dist/chat/email-job-persistence.boundary.js');
const {
  buildReadyEmailQueueWriteResult,
} = require('../dist/chat/email-queue-write.boundary.js');
const {
  buildReadyEmailDeliveryResult,
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
  buildBlockedEmailJobProcessingTriggerResult,
  buildEmailJobProcessingTriggerRequest,
  buildEmailJobProcessingTriggerResultFromPersistenceResult,
  buildFailedEmailJobProcessingTriggerResult,
  buildReadyEmailJobProcessingTriggerResult,
  buildSafeEmailJobProcessingTriggerRequestForLog,
  buildSafeEmailJobProcessingTriggerResultForAudit,
  buildSafeEmailJobProcessingTriggerResultForLog,
  buildSkippedEmailJobProcessingTriggerResult,
  isBlockedEmailJobProcessingTriggerResult,
  isFailedEmailJobProcessingTriggerResult,
  isReadyEmailJobProcessingTriggerResult,
  isSkippedEmailJobProcessingTriggerResult,
  validateEmailJobProcessingTriggerInput,
  validateReadyEmailJobProcessingTriggerRequest,
} = require('../dist/chat/email-job-processing-trigger.boundary.js');

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
      concern: 'Bitte melde dich wegen der Anfrage',
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

function buildReadyPersistenceResult(overrides = {}) {
  const plan = buildDeliveryExecutionPlan(buildQueueEmailJobCommand({
    payload: buildEmailPayload(overrides),
  }));
  const deliveryResult = buildReadyEmailDeliveryResult(plan);
  const queueResult = buildReadyEmailQueueWriteResult(deliveryResult);
  return buildReadyEmailJobPersistenceResult(queueResult);
}

test('email job processing trigger boundary classifies trigger and persistence results', () => {
  const ready = buildReadyPersistenceResult();
  const skipped = buildSkippedEmailJobPersistenceResult('missing_email_target', { channel: 'email' });
  const blocked = buildBlockedEmailJobPersistenceResult('manual_block', 'invalid_payload');
  const failed = buildFailedEmailJobPersistenceResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });

  const readyTrigger = buildReadyEmailJobProcessingTriggerResult(ready);
  const skippedTrigger = buildEmailJobProcessingTriggerResultFromPersistenceResult(skipped);
  const blockedTrigger = buildEmailJobProcessingTriggerResultFromPersistenceResult(blocked);
  const failedTrigger = buildEmailJobProcessingTriggerResultFromPersistenceResult(failed);

  assert.equal(isReadyEmailJobProcessingTriggerResult(readyTrigger), true);
  assert.equal(isSkippedEmailJobProcessingTriggerResult(skippedTrigger), true);
  assert.equal(isBlockedEmailJobProcessingTriggerResult(blockedTrigger), true);
  assert.equal(isFailedEmailJobProcessingTriggerResult(failedTrigger), true);
});

test('email job processing trigger boundary validates ready persistence source only', () => {
  const ready = buildReadyPersistenceResult();
  const readyWithoutReason = {
    ...ready,
    reasonCode: '',
  };
  const skipped = buildSkippedEmailJobPersistenceResult('delivery_channel_disabled', { channel: 'email' });
  const blocked = buildBlockedEmailJobPersistenceResult('manual_block', 'invalid_payload');
  const failed = buildFailedEmailJobPersistenceResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });

  assert.deepEqual(validateEmailJobProcessingTriggerInput(ready), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateEmailJobProcessingTriggerInput(readyWithoutReason), {
    valid: false,
    reasonCode: 'missing_email_job_processing_trigger_request',
    errorCode: 'missing_request',
  });
  assert.deepEqual(validateEmailJobProcessingTriggerInput(skipped), {
    valid: false,
    reasonCode: 'delivery_channel_disabled',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailJobProcessingTriggerInput(blocked), {
    valid: false,
    reasonCode: 'manual_block',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailJobProcessingTriggerInput(failed), {
    valid: false,
    reasonCode: 'queue_insert_failed',
    errorCode: 'unsupported_source_status',
  });
});

test('email job processing trigger boundary builds request and result data objects only', () => {
  const ready = buildReadyPersistenceResult({
    metadata: {
      conversationId: 'conversation-1',
      contactRequestId: 'contact-request-1',
    },
  });
  const request = buildEmailJobProcessingTriggerRequest(ready);
  const readyResult = buildReadyEmailJobProcessingTriggerResult(ready);
  const skippedResult = buildSkippedEmailJobProcessingTriggerResult('missing_email_target', { channel: 'email' });
  const blockedResult = buildBlockedEmailJobProcessingTriggerResult('manual_block', 'invalid_payload');
  const failedResult = buildFailedEmailJobProcessingTriggerResult({
    reasonCode: 'trigger_failed',
    errorCode: 'unknown_email_job_processing_trigger_error',
    retryable: true,
  });

  assert.deepEqual(request, {
    type: 'email_job_processing_trigger_request',
    reasonCode: 'lead_email_ready',
    source: {
      persistenceStatus: 'ready_to_persist',
    },
    correlation: {
      siteId: 'site-1',
      sessionId: 'session-1',
      conversationId: 'conversation-1',
      leadId: 'lead-1',
      contactRequestId: 'contact-request-1',
    },
  });
  assert.deepEqual(validateReadyEmailJobProcessingTriggerRequest(request), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });

  assert.deepEqual(readyResult, {
    status: 'ready_to_trigger',
    reasonCode: 'lead_email_ready',
    request,
  });
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
    reasonCode: 'trigger_failed',
    errorCode: 'unknown_email_job_processing_trigger_error',
    retryable: true,
  });
});

test('email job processing trigger boundary maps persistence results without execution', () => {
  const ready = buildReadyPersistenceResult();
  const skipped = buildSkippedEmailJobPersistenceResult('missing_email_target', { channel: 'email' });
  const blocked = buildBlockedEmailJobPersistenceResult('manual_block', 'invalid_payload');
  const failed = buildFailedEmailJobPersistenceResult({
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });

  assert.equal(buildEmailJobProcessingTriggerResultFromPersistenceResult(ready).status, 'ready_to_trigger');
  assert.deepEqual(buildEmailJobProcessingTriggerResultFromPersistenceResult(skipped), {
    status: 'skipped',
    reasonCode: 'missing_email_target',
    channel: 'email',
  });
  assert.deepEqual(buildEmailJobProcessingTriggerResultFromPersistenceResult(blocked), {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_payload',
  });
  assert.deepEqual(buildEmailJobProcessingTriggerResultFromPersistenceResult(failed), {
    status: 'failed',
    reasonCode: 'queue_insert_failed',
    errorCode: 'queue_write_failed',
    retryable: true,
  });
  assert.equal(buildEmailJobProcessingTriggerResultFromPersistenceResult({ status: 'unknown' }).status, 'blocked');
});

test('email job processing trigger safe projections redact targets, messages and secrets without mutation', () => {
  const request = Object.freeze({
    type: 'email_job_processing_trigger_request',
    reasonCode: 'lead_email_ready',
    source: Object.freeze({
      persistenceStatus: 'ready_to_persist',
      recipientEmail: 'team@example.test',
      phone: '+49 155 11410215',
      body: 'Kontakt: max@example.test / +49 155 11410215',
      providerError: 'SMTP failed for max@example.test with +49 155 11410215',
      apiKey: 'dummy-api-key',
      signingSecret: 'dummy-signing-secret',
      headers: Object.freeze({
        authorization: 'Bearer dummy-token',
      }),
    }),
    correlation: Object.freeze({
      siteId: 'site-1',
      sessionId: 'session-1',
      leadId: 'lead-1',
    }),
  });
  const result = Object.freeze({
    status: 'ready_to_trigger',
    reasonCode: 'lead_email_ready',
    request,
  });

  const projections = [
    buildSafeEmailJobProcessingTriggerRequestForLog(request),
    buildSafeEmailJobProcessingTriggerResultForLog(result),
    buildSafeEmailJobProcessingTriggerResultForAudit(result),
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
    assert.equal(serialized.includes('Bearer'), false);
    assert.equal(serialized.includes('SMTP failed'), false);
  }

  const combined = JSON.stringify(projections);
  assert.equal(combined.includes('[redacted-body]'), true);
  assert.equal(combined.includes('[redacted-message]'), true);
  assert.equal(combined.includes('[redacted-email]'), true);
  assert.equal(combined.includes('[redacted-phone]'), true);

  assert.equal(request.source.recipientEmail, 'team@example.test');
  assert.equal(request.source.apiKey, 'dummy-api-key');
  assert.equal(request.source.headers.authorization, 'Bearer dummy-token');
});

test('email job processing trigger boundary remains unwired and side-effect free', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-job-processing-trigger.boundary.ts'),
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
  assert.equal(orchestratorSource.includes('email-job-processing-trigger.boundary'), false);
});
