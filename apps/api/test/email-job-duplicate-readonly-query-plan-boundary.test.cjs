const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildAggregateOnlyQueryOutputPolicy,
  buildAggregateStatusKindQueryClassPlan,
  buildBackfillApprovalRequirement,
  buildBlockedEmailJobDuplicateReadOnlyQueryPlanResult,
  buildBlockedRawRowsQueryOutputPolicy,
  buildCleanupApprovalRequirement,
  buildContentFingerprintDuplicateQueryClassPlan,
  buildDbTargetConfirmedSafetyGate,
  buildDocsOnlyApprovalRequirement,
  buildEmailJobDuplicateQueryRiskAssessment,
  buildEnforcementApprovalRequirement,
  buildFailedEmailJobDuplicateReadOnlyQueryPlanResult,
  buildFailedRetryAmbiguityQueryClassPlan,
  buildLimitRequiredSafetyGate,
  buildMigrationIndexApprovalRequirement,
  buildNoCommittedResultsSafetyGate,
  buildNoSelectStarSafetyGate,
  buildPiiFingerprintingApprovalRequirement,
  buildProcessingStaleAmbiguityQueryClassPlan,
  buildProductionReadApprovalRequirement,
  buildPseudonymizedFingerprintQueryOutputPolicy,
  buildReadOnlyRoleSafetyGate,
  buildReadyEmailJobDuplicateReadOnlyQueryPlanResult,
  buildRecipientFingerprintDuplicateQueryClassPlan,
  buildReportGenerationApprovalRequirement,
  buildReportRunDuplicateQueryClassPlan,
  buildSafeEmailJobDuplicateQueryApprovalRequirementForLog,
  buildSafeEmailJobDuplicateQueryOutputPolicyForLog,
  buildSafeEmailJobDuplicateQueryRiskAssessmentForLog,
  buildSafeEmailJobDuplicateQuerySafetyGateForLog,
  buildSafeEmailJobDuplicateReadOnlyQueryClassPlanForLog,
  buildSafeEmailJobDuplicateReadOnlyQueryPlanResultForAudit,
  buildSafeEmailJobDuplicateReadOnlyQueryPlanResultForLog,
  buildSanitizedOutputReviewSafetyGate,
  buildSkippedEmailJobDuplicateReadOnlyQueryPlanResult,
  buildSourceMetadataDuplicateQueryClassPlan,
  buildStagingReadApprovalRequirement,
  buildStatusBucketQueryClassPlan,
  buildTimeoutRequiredSafetyGate,
  buildTimeWindowDuplicateQueryClassPlan,
  buildTimeWindowRequiredSafetyGate,
  isBlockedEmailJobDuplicateReadOnlyQueryPlanResult,
  isFailedEmailJobDuplicateReadOnlyQueryPlanResult,
  isReadyEmailJobDuplicateReadOnlyQueryPlanResult,
  isSkippedEmailJobDuplicateReadOnlyQueryPlanResult,
  validateEmailJobDuplicateQueryApprovalRequirement,
  validateEmailJobDuplicateQueryOutputPolicy,
  validateEmailJobDuplicateQueryRiskAssessment,
  validateEmailJobDuplicateQuerySafetyGate,
  validateEmailJobDuplicateReadOnlyQueryClassPlan,
  validateEmailJobDuplicateReadOnlyQueryPlanItem,
} = require('../dist/chat/email-job-duplicate-readonly-query-plan.boundary.js');

test('query class plans stay proposed-only and match documented risk boundaries', () => {
  const aggregate = buildAggregateStatusKindQueryClassPlan();
  const reportRun = buildReportRunDuplicateQueryClassPlan();
  const sourceMetadata = buildSourceMetadataDuplicateQueryClassPlan();
  const recipientFingerprint = buildRecipientFingerprintDuplicateQueryClassPlan();
  const contentFingerprint = buildContentFingerprintDuplicateQueryClassPlan();
  const statusBucket = buildStatusBucketQueryClassPlan();
  const timeWindow = buildTimeWindowDuplicateQueryClassPlan();
  const failedRetry = buildFailedRetryAmbiguityQueryClassPlan();
  const processingStale = buildProcessingStaleAmbiguityQueryClassPlan();

  for (const plan of [
    aggregate,
    reportRun,
    sourceMetadata,
    recipientFingerprint,
    contentFingerprint,
    statusBucket,
    timeWindow,
    failedRetry,
    processingStale,
  ]) {
    assert.equal(validateEmailJobDuplicateReadOnlyQueryClassPlan(plan).valid, true);
    assert.equal(plan.type, 'email_job_duplicate_readonly_query_class_plan');
    assert.equal(plan.version, 'v1');
    assert.equal(plan.status, 'proposed_only');
    assert.equal(plan.requiresLimit, true);
  }

  assert.equal(aggregate.outputShape, 'aggregate_counts');
  assert.equal(aggregate.piiRisk, 'low');
  assert.equal(reportRun.requiresProductionReadApproval, true);
  assert.equal(sourceMetadata.performanceRisk, 'high');
  assert.equal(recipientFingerprint.requiresPiiStrategy, true);
  assert.equal(recipientFingerprint.outputShape, 'pseudonymized_fingerprints');
  assert.equal(contentFingerprint.piiRisk, 'blocked');
  assert.equal(contentFingerprint.performanceRisk, 'blocked');
  assert.equal(contentFingerprint.outputShape, 'blocked_raw_rows');
  assert.equal(timeWindow.requiresTimeWindow, true);
  assert.equal(failedRetry.outputShape, 'manual_review_summary');
  assert.equal(processingStale.outputShape, 'manual_review_summary');

  const serialized = JSON.stringify([
    aggregate,
    reportRun,
    sourceMetadata,
    recipientFingerprint,
    contentFingerprint,
    statusBucket,
    timeWindow,
    failedRetry,
    processingStale,
  ]);
  assert.equal(serialized.includes('executed'), false);
  assert.equal(serialized.includes('query_result'), false);
});

test('query safety gates are required and execution-blocking only', () => {
  const gates = [
    buildReadOnlyRoleSafetyGate(),
    buildNoSelectStarSafetyGate(),
    buildLimitRequiredSafetyGate(),
    buildTimeWindowRequiredSafetyGate(),
    buildTimeoutRequiredSafetyGate(),
    buildSanitizedOutputReviewSafetyGate(),
    buildNoCommittedResultsSafetyGate(),
    buildDbTargetConfirmedSafetyGate(),
  ];

  for (const gate of gates) {
    assert.equal(validateEmailJobDuplicateQuerySafetyGate(gate).valid, true);
    assert.equal(gate.required, true);
    assert.equal(gate.blocksExecutionWithoutApproval, true);
  }
});

test('query output policies block raw data while allowing approved aggregate concepts', () => {
  const aggregate = buildAggregateOnlyQueryOutputPolicy();
  const fingerprint = buildPseudonymizedFingerprintQueryOutputPolicy();
  const blockedRows = buildBlockedRawRowsQueryOutputPolicy();

  for (const policy of [aggregate, fingerprint, blockedRows]) {
    assert.equal(validateEmailJobDuplicateQueryOutputPolicy(policy).valid, true);
    assert.equal(policy.allowsRawRecipientEmail, false);
    assert.equal(policy.allowsSubject, false);
    assert.equal(policy.allowsHtml, false);
    assert.equal(policy.allowsText, false);
    assert.equal(policy.allowsFullMetadata, false);
    assert.equal(policy.allowsRowDump, false);
    assert.equal(policy.allowsCommittedReport, false);
  }

  assert.equal(aggregate.allowsAggregateCounts, true);
  assert.equal(aggregate.allowsPseudonymizedFingerprints, false);
  assert.equal(fingerprint.allowsAggregateCounts, true);
  assert.equal(fingerprint.allowsPseudonymizedFingerprints, true);
  assert.equal(blockedRows.allowsAggregateCounts, false);
  assert.equal(blockedRows.allowsPseudonymizedFingerprints, false);
});

test('approval requirements remain separate and do not imply granted approvals', () => {
  const docsOnly = buildDocsOnlyApprovalRequirement();
  const stagingRead = buildStagingReadApprovalRequirement();
  const productionRead = buildProductionReadApprovalRequirement();
  const pii = buildPiiFingerprintingApprovalRequirement();
  const report = buildReportGenerationApprovalRequirement();
  const cleanup = buildCleanupApprovalRequirement();
  const backfill = buildBackfillApprovalRequirement();
  const migration = buildMigrationIndexApprovalRequirement();
  const enforcement = buildEnforcementApprovalRequirement();

  for (const requirement of [
    docsOnly,
    stagingRead,
    productionRead,
    pii,
    report,
    cleanup,
    backfill,
    migration,
    enforcement,
  ]) {
    assert.equal(validateEmailJobDuplicateQueryApprovalRequirement(requirement).valid, true);
  }

  assert.equal(docsOnly.required, false);
  assert.equal(stagingRead.required, true);
  assert.equal(productionRead.required, true);
  assert.equal(pii.required, true);
  assert.equal(report.required, true);
  assert.equal(cleanup.required, true);
  assert.equal(backfill.required, true);
  assert.equal(migration.required, true);
  assert.equal(enforcement.required, true);
});

test('risk assessments preserve documented pii and performance constraints', () => {
  const aggregate = buildEmailJobDuplicateQueryRiskAssessment('aggregate_by_status_kind');
  const reportRun = buildEmailJobDuplicateQueryRiskAssessment('duplicate_by_report_run');
  const recipient = buildEmailJobDuplicateQueryRiskAssessment('duplicate_by_recipient_fingerprint');
  const content = buildEmailJobDuplicateQueryRiskAssessment('duplicate_by_content_fingerprint');
  const timeWindow = buildEmailJobDuplicateQueryRiskAssessment('time_window_scan');

  for (const assessment of [aggregate, reportRun, recipient, content, timeWindow]) {
    assert.equal(validateEmailJobDuplicateQueryRiskAssessment(assessment).valid, true);
    assert.equal(assessment.requiresLimit, true);
  }

  assert.equal(aggregate.piiRisk, 'low');
  assert.equal(reportRun.performanceRisk, 'high');
  assert.equal(recipient.piiRisk, 'high');
  assert.equal(content.piiRisk, 'blocked');
  assert.equal(content.performanceRisk, 'blocked');
  assert.equal(timeWindow.requiresTimeWindow, true);
});

test('result builders and classifiers remain stable for ready skipped blocked and failed states', () => {
  const ready = buildReadyEmailJobDuplicateReadOnlyQueryPlanResult(buildAggregateStatusKindQueryClassPlan());
  const skipped = buildSkippedEmailJobDuplicateReadOnlyQueryPlanResult('not_in_scope');
  const blocked = buildBlockedEmailJobDuplicateReadOnlyQueryPlanResult(
    'invalid_query_output_policy',
    'invalid_output_policy',
  );
  const failed = buildFailedEmailJobDuplicateReadOnlyQueryPlanResult(
    'query_plan_projection_failed',
    'unknown_email_job_duplicate_readonly_query_plan_error',
    true,
  );

  assert.equal(isReadyEmailJobDuplicateReadOnlyQueryPlanResult(ready), true);
  assert.equal(isSkippedEmailJobDuplicateReadOnlyQueryPlanResult(skipped), true);
  assert.equal(isBlockedEmailJobDuplicateReadOnlyQueryPlanResult(blocked), true);
  assert.equal(isFailedEmailJobDuplicateReadOnlyQueryPlanResult(failed), true);
  assert.equal(validateEmailJobDuplicateReadOnlyQueryPlanItem(ready.plan).valid, true);
  assert.equal(failed.retryable, true);
});

test('safe projections redact sensitive and raw output fields without mutating inputs', () => {
  const plan = buildRecipientFingerprintDuplicateQueryClassPlan();
  const gate = buildReadOnlyRoleSafetyGate();
  const policy = buildPseudonymizedFingerprintQueryOutputPolicy();
  const approval = buildProductionReadApprovalRequirement();
  const assessment = buildEmailJobDuplicateQueryRiskAssessment('duplicate_by_recipient_fingerprint');

  const unsafePlan = Object.freeze({
    ...plan,
    recipientEmail: 'recipient-demo-value',
    subject: 'Visible subject should not survive',
    html: '<p>visible body should not survive</p>',
    metadata: {
      apiKey: 'api-key-value',
      signingSecret: 'signing-secret-value',
      authorization: 'auth-demo-value',
      reportRunId: 'report-run-1',
    },
  });
  const safePlan = buildSafeEmailJobDuplicateReadOnlyQueryClassPlanForLog(unsafePlan);
  const safeGate = buildSafeEmailJobDuplicateQuerySafetyGateForLog({
    ...gate,
    token: 'token-value',
  });
  const safePolicy = buildSafeEmailJobDuplicateQueryOutputPolicyForLog({
    ...policy,
    webhookUrl: 'https://example.test/with-token',
  });
  const safeApproval = buildSafeEmailJobDuplicateQueryApprovalRequirementForLog({
    ...approval,
    apiKey: 'hidden-api-key',
  });
  const safeAssessment = buildSafeEmailJobDuplicateQueryRiskAssessmentForLog({
    ...assessment,
    sql: 'select from hidden source',
  });
  const ready = buildReadyEmailJobDuplicateReadOnlyQueryPlanResult(plan);
  const unsafeReady = {
    ...ready,
    token: 'token-value',
    plan: {
      ...ready.plan,
      metadata: { recipientEmail: 'recipient-demo-value' },
    },
  };
  const safeReadyLog = buildSafeEmailJobDuplicateReadOnlyQueryPlanResultForLog(unsafeReady);
  const safeReadyAudit = buildSafeEmailJobDuplicateReadOnlyQueryPlanResultForAudit(unsafeReady);

  const serialized = JSON.stringify([
    safePlan,
    safeGate,
    safePolicy,
    safeApproval,
    safeAssessment,
    safeReadyLog,
    safeReadyAudit,
  ]);

  assert.equal(serialized.includes('recipient-demo-value'), false);
  assert.equal(serialized.includes('Visible subject should not survive'), false);
  assert.equal(serialized.includes('visible body should not survive'), false);
  assert.equal(serialized.includes('api-key-value'), false);
  assert.equal(serialized.includes('signing-secret-value'), false);
  assert.equal(serialized.includes('auth-demo-value'), false);
  assert.equal(serialized.includes('token-value'), false);
  assert.equal(serialized.includes('select from hidden source'), false);
  assert.equal(serialized.toUpperCase().includes('SELECT'), false);
  assert.equal(JSON.stringify(unsafePlan).includes('recipient-demo-value'), true);
});

test('source file stays pure and does not introduce side-effecting dependencies or runtime wiring', () => {
  const sourcePath = path.join(__dirname, '../src/chat/email-job-duplicate-readonly-query-plan.boundary.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.equal(source.includes('PrismaService'), false);
  assert.equal(source.includes('EmailJobsService'), false);
  assert.equal(source.includes('processPendingJobs'), false);
  assert.equal(source.includes('process.env'), false);
  assert.equal(source.includes('logger'), false);
  assert.equal(source.includes('query('), false);
  assert.equal(source.includes('Repository'), false);
});
