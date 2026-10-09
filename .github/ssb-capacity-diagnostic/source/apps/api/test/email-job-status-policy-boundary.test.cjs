const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildBlockedEmailJobStatusPolicyResult,
  buildEmailJobLockingPolicy,
  buildEmailJobRetryPolicy,
  buildEmailJobStaleProcessingPolicy,
  buildFailedEmailJobStatusPolicyResult,
  buildProcessingToFailedPolicy,
  buildProcessingToRetryQueuedPolicy,
  buildProcessingToSentPolicy,
  buildQueuedToProcessingPolicy,
  buildReadyEmailJobStatusPolicyResult,
  buildSafeEmailJobStatusPolicyForLog,
  buildSafeEmailJobStatusPolicyResultForAudit,
  buildSafeEmailJobStatusPolicyResultForLog,
  buildSkippedEmailJobStatusPolicyResult,
  calculateEmailJobRetryDelayMinutes,
  isAllowedEmailJobStatusTransition,
  isBlockedEmailJobStatusPolicyResult,
  isFailedEmailJobStatusPolicyResult,
  isReadyEmailJobStatusPolicyResult,
  isSkippedEmailJobStatusPolicyResult,
  validateEmailJobLockingPolicy,
  validateEmailJobRetryPolicy,
  validateEmailJobStaleProcessingPolicy,
  validateEmailJobStatusTransitionPolicy,
} = require('../dist/chat/email-job-status-policy.boundary.js');

test('email job status policy boundary builds allowed transition policies as data objects only', () => {
  const queuedToProcessing = buildQueuedToProcessingPolicy('pick_ready');
  const processingToSent = buildProcessingToSentPolicy('send_succeeded');
  const processingToRetry = buildProcessingToRetryQueuedPolicy('retry_scheduled');
  const processingToFailed = buildProcessingToFailedPolicy('final_failed');

  assert.deepEqual(queuedToProcessing, {
    type: 'email_job_status_transition_policy',
    transition: 'queued_to_processing',
    from: 'queued',
    to: 'processing',
    reasonCode: 'pick_ready',
  });
  assert.deepEqual(processingToSent, {
    type: 'email_job_status_transition_policy',
    transition: 'processing_to_sent',
    from: 'processing',
    to: 'sent',
    reasonCode: 'send_succeeded',
  });
  assert.deepEqual(processingToRetry, {
    type: 'email_job_status_transition_policy',
    transition: 'processing_to_retry_queued',
    from: 'processing',
    to: 'queued',
    reasonCode: 'retry_scheduled',
  });
  assert.deepEqual(processingToFailed, {
    type: 'email_job_status_transition_policy',
    transition: 'processing_to_failed',
    from: 'processing',
    to: 'failed',
    reasonCode: 'final_failed',
  });

  for (const policy of [queuedToProcessing, processingToSent, processingToRetry, processingToFailed]) {
    assert.deepEqual(validateEmailJobStatusTransitionPolicy(policy), {
      valid: true,
      reasonCode: policy.reasonCode,
    });
  }
});

test('email job status policy boundary blocks invalid transitions and unknown statuses', () => {
  assert.equal(isAllowedEmailJobStatusTransition('queued', 'processing'), true);
  assert.equal(isAllowedEmailJobStatusTransition('processing', 'sent'), true);
  assert.equal(isAllowedEmailJobStatusTransition('processing', 'queued'), true);
  assert.equal(isAllowedEmailJobStatusTransition('processing', 'failed'), true);
  assert.equal(isAllowedEmailJobStatusTransition('sent', 'processing'), false);
  assert.equal(isAllowedEmailJobStatusTransition('failed', 'processing'), false);
  assert.equal(isAllowedEmailJobStatusTransition('unknown', 'processing'), false);

  assert.deepEqual(validateEmailJobStatusTransitionPolicy({
    ...buildQueuedToProcessingPolicy('bad_matrix'),
    from: 'sent',
  }), {
    valid: false,
    reasonCode: 'invalid_email_job_status_transition_matrix',
    errorCode: 'invalid_transition',
  });
  assert.deepEqual(validateEmailJobStatusTransitionPolicy({
    ...buildQueuedToProcessingPolicy('bad_status'),
    from: 'unknown',
  }), {
    valid: false,
    reasonCode: 'invalid_email_job_status_transition_status',
    errorCode: 'invalid_transition',
  });
});

test('email job retry policy computes deterministic retry and final failure decisions', () => {
  assert.deepEqual(buildEmailJobRetryPolicy(1, 5), {
    type: 'email_job_retry_policy',
    retryCount: 1,
    maxAttempts: 5,
    decision: 'retry',
    nextRetryDelayMinutes: 4,
    reasonCode: 'email_job_retry_available',
  });
  assert.deepEqual(buildEmailJobRetryPolicy(20, 50), {
    type: 'email_job_retry_policy',
    retryCount: 20,
    maxAttempts: 50,
    decision: 'retry',
    nextRetryDelayMinutes: 30,
    reasonCode: 'email_job_retry_available',
  });
  assert.deepEqual(buildEmailJobRetryPolicy(5, 5), {
    type: 'email_job_retry_policy',
    retryCount: 5,
    maxAttempts: 5,
    decision: 'final_failed',
    reasonCode: 'email_job_retry_exhausted',
  });
  assert.equal(calculateEmailJobRetryDelayMinutes(1), 2);
  assert.equal(calculateEmailJobRetryDelayMinutes(99), 30);
  assert.equal(calculateEmailJobRetryDelayMinutes(0), 1);
  assert.equal(validateEmailJobRetryPolicy(buildEmailJobRetryPolicy(1, 5)).valid, true);
  assert.equal(validateEmailJobRetryPolicy(buildEmailJobRetryPolicy(5, 5)).valid, true);
});

test('email job retry policy blocks invalid retry_count and max_attempts without scheduling updates', () => {
  assert.deepEqual(buildEmailJobRetryPolicy(-1, 5), {
    type: 'email_job_retry_policy',
    retryCount: -1,
    maxAttempts: 5,
    decision: 'blocked',
    reasonCode: 'invalid_email_job_retry_count',
    errorCode: 'invalid_retry_count',
  });
  assert.deepEqual(buildEmailJobRetryPolicy(1, 0), {
    type: 'email_job_retry_policy',
    retryCount: 1,
    maxAttempts: 0,
    decision: 'blocked',
    reasonCode: 'invalid_email_job_max_attempts',
    errorCode: 'invalid_max_attempts',
  });
  assert.deepEqual(validateEmailJobRetryPolicy({
    ...buildEmailJobRetryPolicy(1, 5),
    nextRetryDelayMinutes: 31,
  }), {
    valid: false,
    reasonCode: 'invalid_email_job_retry_policy',
    errorCode: 'invalid_retry_policy',
  });
});

test('email job locking policy is a single-job data object and validates no query execution', () => {
  const policy = buildEmailJobLockingPolicy('select_next_job');

  assert.deepEqual(policy, {
    type: 'email_job_locking_policy',
    lockMode: 'for_update_skip_locked',
    status: 'queued',
    availableNow: true,
    orderBy: ['available_at', 'created_at'],
    limit: 1,
    reasonCode: 'select_next_job',
  });
  assert.deepEqual(validateEmailJobLockingPolicy(policy), {
    valid: true,
    reasonCode: 'select_next_job',
  });
  assert.equal(validateEmailJobLockingPolicy({ ...policy, lockMode: 'none' }).valid, false);
  assert.equal(validateEmailJobLockingPolicy({ ...policy, limit: 2 }).valid, false);
  assert.equal(validateEmailJobLockingPolicy({ ...policy, orderBy: ['created_at'] }).valid, false);
});

test('email job stale processing policy models candidates without requeue or status updates', () => {
  assert.deepEqual(buildEmailJobStaleProcessingPolicy({
    thresholdMinutes: 30,
    processingAgeMinutes: 45,
  }), {
    type: 'email_job_stale_processing_policy',
    thresholdMinutes: 30,
    processingAgeMinutes: 45,
    candidateStatus: 'processing',
    decision: 'recovery_candidate',
    reasonCode: 'email_job_stale_processing_candidate',
  });
  assert.deepEqual(buildEmailJobStaleProcessingPolicy({
    thresholdMinutes: 30,
    processingAgeMinutes: 5,
  }), {
    type: 'email_job_stale_processing_policy',
    thresholdMinutes: 30,
    processingAgeMinutes: 5,
    candidateStatus: 'processing',
    decision: 'not_stale',
    reasonCode: 'email_job_processing_not_stale',
  });
  assert.equal(buildEmailJobStaleProcessingPolicy({
    thresholdMinutes: 30,
    processingAgeMinutes: 60,
    candidateStatus: 'sent',
  }).decision, 'not_stale');
  assert.equal(buildEmailJobStaleProcessingPolicy({
    thresholdMinutes: 30,
    processingAgeMinutes: 60,
    candidateStatus: 'failed',
  }).decision, 'not_stale');
  assert.equal(validateEmailJobStaleProcessingPolicy(buildEmailJobStaleProcessingPolicy({
    thresholdMinutes: 30,
    processingAgeMinutes: 45,
  })).valid, true);
  assert.equal(validateEmailJobStaleProcessingPolicy(buildEmailJobStaleProcessingPolicy({
    thresholdMinutes: 0,
    processingAgeMinutes: 45,
  })).valid, false);
});

test('email job status policy result builders and classifiers are stable', () => {
  const ready = buildReadyEmailJobStatusPolicyResult(buildProcessingToSentPolicy('send_succeeded'));
  const skipped = buildSkippedEmailJobStatusPolicyResult('manual_skip');
  const blocked = buildBlockedEmailJobStatusPolicyResult('manual_block', 'invalid_transition');
  const failed = buildFailedEmailJobStatusPolicyResult('policy_failed', 'unknown_email_job_status_policy_error', true);

  assert.equal(isReadyEmailJobStatusPolicyResult(ready), true);
  assert.equal(isSkippedEmailJobStatusPolicyResult(skipped), true);
  assert.equal(isBlockedEmailJobStatusPolicyResult(blocked), true);
  assert.equal(isFailedEmailJobStatusPolicyResult(failed), true);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.policy.type, 'email_job_status_transition_policy');
  assert.deepEqual(skipped, { status: 'skipped', reasonCode: 'manual_skip' });
  assert.deepEqual(blocked, {
    status: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_transition',
  });
  assert.deepEqual(failed, {
    status: 'failed',
    reasonCode: 'policy_failed',
    errorCode: 'unknown_email_job_status_policy_error',
    retryable: true,
  });
});

test('email job status policy safe projections redact secrets, targets, messages and body without mutation', () => {
  const result = Object.freeze({
    status: 'ready',
    reasonCode: 'safe_projection_test',
    policy: Object.freeze({
      ...buildEmailJobRetryPolicy(1, 5),
      recipientEmail: 'ops@example.test',
      phone: '+49 155 11410215',
      html: '<p>max@example.test</p>',
      text: 'Kontakt max@example.test / +49 155 11410215',
      body: 'User message with max@example.test and +49 155 11410215',
      providerError: 'SMTP failed for max@example.test with +49 155 11410215',
      errorMessage: 'Provider said token dummy-token failed',
      sql: 'select from email_jobs for unsafe debug',
      apiKey: 'dummy-api-key',
      signingSecret: 'dummy-signing-secret',
      headers: Object.freeze({
        authorization: 'Bearer dummy-token',
      }),
    }),
  });

  const projections = [
    buildSafeEmailJobStatusPolicyForLog(result.policy),
    buildSafeEmailJobStatusPolicyResultForLog(result),
    buildSafeEmailJobStatusPolicyResultForAudit(result),
  ];
  const serialized = JSON.stringify(projections);

  assert.equal(serialized.includes('ops@example.test'), false);
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
  assert.equal(serialized.includes('select from email_jobs'), false);
  assert.equal(serialized.includes('[redacted-body]'), true);
  assert.equal(serialized.includes('[redacted-message]'), true);
  assert.equal(serialized.includes('[redacted-email]'), true);
  assert.equal(serialized.includes('[redacted-phone]'), true);

  assert.equal(result.policy.recipientEmail, 'ops@example.test');
  assert.equal(result.policy.headers.authorization, 'Bearer dummy-token');
});

test('email job status policy boundary remains unwired and side-effect free', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-job-status-policy.boundary.ts'),
    'utf8',
  );
  const orchestratorSource = fs.readFileSync(
    path.join(__dirname, '../src/chat/chat-agent-orchestrator.service.ts'),
    'utf8',
  );
  const emailJobsServiceSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/widget/services/email-jobs.service.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher|IntegrationEventDispatcher/);
  assert.doesNotMatch(source, /processPendingJobs|process\.env|console\.|logger|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE |DELETE FROM|SELECT /);
  assert.equal(orchestratorSource.includes('email-job-status-policy.boundary'), false);
  assert.equal(emailJobsServiceSource.includes('email-job-status-policy.boundary'), false);
});
