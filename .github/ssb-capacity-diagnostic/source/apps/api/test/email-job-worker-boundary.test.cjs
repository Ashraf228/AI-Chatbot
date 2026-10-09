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
  buildEmailJobProcessingTriggerResultFromPersistenceResult,
  buildFailedEmailJobProcessingTriggerResult,
  buildReadyEmailJobProcessingTriggerResult,
  buildSkippedEmailJobProcessingTriggerResult,
} = require('../dist/chat/email-job-processing-trigger.boundary.js');
const {
  buildBlockedEmailJobRetryDecision,
  buildBlockedEmailJobWorkerResult,
  buildEmailJobRetryDecision,
  buildEmailJobWorkerResultFromTriggerResult,
  buildEmailJobWorkerSelectionPlan,
  buildFailedEmailJobWorkerResult,
  buildProcessingToFailedTransitionPlan,
  buildProcessingToRetryQueuedTransitionPlan,
  buildProcessingToSentTransitionPlan,
  buildQueuedToProcessingTransitionPlan,
  buildReadyEmailJobWorkerResult,
  buildSafeEmailJobRetryDecisionForLog,
  buildSafeEmailJobStatusTransitionPlanForLog,
  buildSafeEmailJobWorkerResultForAudit,
  buildSafeEmailJobWorkerResultForLog,
  buildSafeEmailJobWorkerSelectionPlanForLog,
  buildSkippedEmailJobWorkerResult,
  isBlockedEmailJobWorkerResult,
  isFailedEmailJobWorkerResult,
  isReadyEmailJobWorkerResult,
  isSkippedEmailJobWorkerResult,
  validateEmailJobRetryDecision,
  validateEmailJobStatusTransitionPlan,
  validateEmailJobWorkerInput,
  validateEmailJobWorkerSelectionPlan,
} = require('../dist/chat/email-job-worker.boundary.js');

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

function buildReadyTriggerResult(overrides = {}) {
  const plan = buildDeliveryExecutionPlan(buildQueueEmailJobCommand({
    payload: buildEmailPayload(overrides),
  }));
  const deliveryResult = buildReadyEmailDeliveryResult(plan);
  const queueResult = buildReadyEmailQueueWriteResult(deliveryResult);
  const persistenceResult = buildReadyEmailJobPersistenceResult(queueResult);
  return buildReadyEmailJobProcessingTriggerResult(persistenceResult);
}

test('email job worker boundary classifies trigger source and worker results', () => {
  const ready = buildReadyTriggerResult();
  const skipped = buildEmailJobProcessingTriggerResultFromPersistenceResult(
    buildSkippedEmailJobPersistenceResult('missing_email_target', { channel: 'email' }),
  );
  const blocked = buildEmailJobProcessingTriggerResultFromPersistenceResult(
    buildBlockedEmailJobPersistenceResult('manual_block', 'invalid_payload'),
  );
  const failed = buildEmailJobProcessingTriggerResultFromPersistenceResult(
    buildFailedEmailJobPersistenceResult({
      reasonCode: 'queue_insert_failed',
      errorCode: 'queue_write_failed',
      retryable: true,
    }),
  );

  assert.equal(buildEmailJobWorkerResultFromTriggerResult(ready).status, 'ready_to_select');
  assert.equal(buildEmailJobWorkerResultFromTriggerResult(skipped).status, 'skipped');
  assert.equal(buildEmailJobWorkerResultFromTriggerResult(blocked).status, 'blocked');
  assert.equal(buildEmailJobWorkerResultFromTriggerResult(failed).status, 'failed');

  assert.equal(isReadyEmailJobWorkerResult(buildReadyEmailJobWorkerResult(ready)), true);
  assert.equal(isSkippedEmailJobWorkerResult(buildSkippedEmailJobWorkerResult('noop')), true);
  assert.equal(isBlockedEmailJobWorkerResult(buildBlockedEmailJobWorkerResult('blocked', 'invalid_request')), true);
  assert.equal(isFailedEmailJobWorkerResult(buildFailedEmailJobWorkerResult({ retryable: true })), true);
});

test('email job worker boundary validates ready trigger input only', () => {
  const ready = buildReadyTriggerResult();
  const readyWithoutReason = {
    ...ready,
    reasonCode: '',
  };
  const skipped = buildSkippedEmailJobProcessingTriggerResult('missing_email_target', { channel: 'email' });
  const blocked = buildBlockedEmailJobProcessingTriggerResult('manual_block', 'invalid_request');
  const failed = buildFailedEmailJobProcessingTriggerResult({
    reasonCode: 'trigger_failed',
    errorCode: 'unknown_email_job_processing_trigger_error',
    retryable: true,
  });

  assert.deepEqual(validateEmailJobWorkerInput(ready), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateEmailJobWorkerInput(readyWithoutReason), {
    valid: false,
    reasonCode: 'missing_email_job_worker_reason',
    errorCode: 'missing_reason_code',
  });
  assert.deepEqual(validateEmailJobWorkerInput(skipped), {
    valid: false,
    reasonCode: 'missing_email_target',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailJobWorkerInput(blocked), {
    valid: false,
    reasonCode: 'manual_block',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailJobWorkerInput(failed), {
    valid: false,
    reasonCode: 'trigger_failed',
    errorCode: 'unsupported_source_status',
  });
  assert.deepEqual(validateEmailJobWorkerInput({ status: 'unknown' }), {
    valid: false,
    reasonCode: 'email_job_worker_blocked',
    errorCode: 'unsupported_source_status',
  });
});

test('email job worker boundary builds worker selection plans as data objects only', () => {
  const ready = buildReadyTriggerResult();
  const plan = buildEmailJobWorkerSelectionPlan(ready);

  assert.deepEqual(plan, {
    type: 'email_job_worker_selection_plan',
    reasonCode: 'lead_email_ready',
    criteria: {
      status: 'queued',
      availableNow: true,
      orderBy: ['available_at', 'created_at'],
      limit: 1,
      lockMode: 'for_update_skip_locked',
    },
  });
  assert.deepEqual(validateEmailJobWorkerSelectionPlan(plan), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateEmailJobWorkerSelectionPlan({
    ...plan,
    criteria: { ...plan.criteria, limit: 2 },
  }), {
    valid: false,
    reasonCode: 'invalid_email_job_worker_selection_plan',
    errorCode: 'invalid_selection_plan',
  });

  const result = buildReadyEmailJobWorkerResult(ready);
  assert.equal(result.status, 'ready_to_select');
  assert.deepEqual(result.selectionPlan, plan);
});

test('email job worker boundary builds status transition plans as data objects only', () => {
  const queuedToProcessing = buildQueuedToProcessingTransitionPlan('picked_for_processing');
  const processingToSent = buildProcessingToSentTransitionPlan('send_succeeded');
  const processingToRetry = buildProcessingToRetryQueuedTransitionPlan('send_failed_retry', 12);
  const processingToFailed = buildProcessingToFailedTransitionPlan('send_failed_final');

  assert.deepEqual(queuedToProcessing, {
    type: 'email_job_status_transition_plan',
    transition: 'queued_to_processing',
    reasonCode: 'picked_for_processing',
  });
  assert.deepEqual(processingToSent, {
    type: 'email_job_status_transition_plan',
    transition: 'processing_to_sent',
    reasonCode: 'send_succeeded',
  });
  assert.deepEqual(processingToRetry, {
    type: 'email_job_status_transition_plan',
    transition: 'processing_to_retry_queued',
    reasonCode: 'send_failed_retry',
    retryDelayMinutes: 12,
  });
  assert.deepEqual(processingToFailed, {
    type: 'email_job_status_transition_plan',
    transition: 'processing_to_failed',
    reasonCode: 'send_failed_final',
    retryable: false,
  });

  for (const plan of [queuedToProcessing, processingToSent, processingToRetry, processingToFailed]) {
    assert.equal(validateEmailJobStatusTransitionPlan(plan).valid, true);
  }
  assert.equal(validateEmailJobStatusTransitionPlan({ ...processingToRetry, retryDelayMinutes: 31 }).valid, false);
});

test('email job worker boundary builds deterministic retry decisions', () => {
  assert.deepEqual(buildEmailJobRetryDecision(1, 5), {
    decision: 'retry',
    reasonCode: 'email_job_worker_retry_available',
    nextRetryDelayMinutes: 2,
  });
  assert.deepEqual(buildEmailJobRetryDecision(20, 50), {
    decision: 'retry',
    reasonCode: 'email_job_worker_retry_available',
    nextRetryDelayMinutes: 30,
  });
  assert.deepEqual(buildEmailJobRetryDecision(5, 5), {
    decision: 'final_failed',
    reasonCode: 'email_job_worker_retry_exhausted',
  });
  assert.deepEqual(buildEmailJobRetryDecision(-1, 5), {
    decision: 'blocked',
    reasonCode: 'invalid_email_job_retry_attempts',
    errorCode: 'invalid_attempts',
  });
  assert.deepEqual(buildEmailJobRetryDecision(1, 0), {
    decision: 'blocked',
    reasonCode: 'invalid_email_job_retry_max_attempts',
    errorCode: 'invalid_max_attempts',
  });
  assert.deepEqual(buildBlockedEmailJobRetryDecision('manual_block', 'invalid_retry_decision'), {
    decision: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_retry_decision',
  });

  assert.equal(validateEmailJobRetryDecision(buildEmailJobRetryDecision(1, 5)).valid, true);
  assert.equal(validateEmailJobRetryDecision({ decision: 'retry', reasonCode: 'retry', nextRetryDelayMinutes: 31 }).valid, false);
});

test('email job worker boundary maps trigger results without execution', () => {
  const ready = buildReadyTriggerResult();
  const skipped = buildSkippedEmailJobProcessingTriggerResult('missing_email_target', { channel: 'email' });
  const blocked = buildBlockedEmailJobProcessingTriggerResult('manual_block', 'invalid_request');
  const failed = buildFailedEmailJobProcessingTriggerResult({
    reasonCode: 'trigger_failed',
    errorCode: 'unknown_email_job_processing_trigger_error',
    retryable: true,
  });

  assert.equal(buildEmailJobWorkerResultFromTriggerResult(ready).status, 'ready_to_select');
  assert.deepEqual(buildEmailJobWorkerResultFromTriggerResult(skipped), {
    status: 'skipped',
    reasonCode: 'missing_email_target',
    channel: 'email',
  });
  assert.deepEqual(buildEmailJobWorkerResultFromTriggerResult(blocked), {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_request',
  });
  assert.deepEqual(buildEmailJobWorkerResultFromTriggerResult(failed), {
    status: 'failed',
    reasonCode: 'trigger_failed',
    errorCode: 'unknown_email_job_processing_trigger_error',
    retryable: true,
  });
  assert.equal(buildEmailJobWorkerResultFromTriggerResult({ status: 'unknown' }).status, 'blocked');
});

test('email job worker safe projections redact targets, messages and secrets without mutation', () => {
  const result = Object.freeze({
    status: 'failed',
    reasonCode: 'smtp_failed',
    errorCode: 'unknown_email_job_worker_error',
    retryable: true,
    recipientEmail: 'team@example.test',
    phone: '+49 155 11410215',
    html: '<p>max@example.test</p>',
    body: 'Kontakt max@example.test / +49 155 11410215',
    providerError: 'SMTP failed for max@example.test with +49 155 11410215',
    sql: 'SELECT * FROM email_jobs WHERE recipient_email = team@example.test',
    apiKey: 'dummy-api-key',
    signingSecret: 'dummy-signing-secret',
    headers: Object.freeze({
      authorization: 'Bearer dummy-token',
    }),
  });
  const plan = buildEmailJobWorkerSelectionPlan(buildReadyTriggerResult());
  const transition = buildProcessingToRetryQueuedTransitionPlan('retry', 8);
  const retry = buildEmailJobRetryDecision(2, 5);

  const projections = [
    buildSafeEmailJobWorkerResultForLog(result),
    buildSafeEmailJobWorkerResultForAudit(result),
    buildSafeEmailJobWorkerSelectionPlanForLog(plan),
    buildSafeEmailJobStatusTransitionPlanForLog(transition),
    buildSafeEmailJobRetryDecisionForLog(retry),
  ];

  const serialized = JSON.stringify(projections);
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
  assert.equal(serialized.includes('SELECT *'), false);
  assert.equal(serialized.includes('[redacted-body]'), true);
  assert.equal(serialized.includes('[redacted-message]'), true);
  assert.equal(serialized.includes('[redacted-email]'), true);
  assert.equal(serialized.includes('[redacted-phone]'), true);

  assert.equal(result.recipientEmail, 'team@example.test');
  assert.equal(result.headers.authorization, 'Bearer dummy-token');
});

test('email job worker boundary remains unwired and side-effect free', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-job-worker.boundary.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher|IntegrationEventDispatcher/);
  assert.doesNotMatch(source, /processPendingJobs|process\.env|console\.|logger|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE |DELETE FROM|SELECT /);

  const orchestratorSource = fs.readFileSync(
    path.join(__dirname, '../src/chat/chat-agent-orchestrator.service.ts'),
    'utf8',
  );
  assert.equal(orchestratorSource.includes('email-job-worker.boundary'), false);
});
