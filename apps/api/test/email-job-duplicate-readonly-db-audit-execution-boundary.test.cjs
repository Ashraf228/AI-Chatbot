const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildAggregateCountsOnlyDbAuditOutputPolicy,
  buildAggregateStatusKindDbAuditQueryStep,
  buildBackfillDbAuditApprovalGate,
  buildBlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  buildBlockedRawOutputDbAuditOutputPolicy,
  buildCleanupDbAuditApprovalGate,
  buildContentFingerprintDbAuditQueryStep,
  buildDbTargetConfirmedPrecondition,
  buildDocsOnlyDbAuditApprovalGate,
  buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment,
  buildEnforcementDbAuditApprovalGate,
  buildFailedEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  buildFailedRetryAmbiguityDbAuditQueryStep,
  buildLimitRequiredPrecondition,
  buildManualReviewSummaryOnlyDbAuditOutputPolicy,
  buildMigrationIndexDbAuditApprovalGate,
  buildNoCleanupOrWriteActionsPrecondition,
  buildNoCommittedResultsPrecondition,
  buildNoRawPiiOutputPrecondition,
  buildNoSelectStarPrecondition,
  buildPiiFingerprintingDbAuditApprovalGate,
  buildProcessingStaleAmbiguityDbAuditQueryStep,
  buildProductionReadApprovalRequiredPrecondition,
  buildProductionReadDbAuditApprovalGate,
  buildProposedEmailJobDuplicateReadOnlyDbAuditExecutionPlan,
  buildPseudonymizedFingerprintOnlyDbAuditOutputPolicy,
  buildQueryTimeoutRequiredPrecondition,
  buildReadOnlyRoleRequiredPrecondition,
  buildReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  buildRecipientFingerprintDbAuditQueryStep,
  buildReportGenerationDbAuditApprovalGate,
  buildReportRunDuplicateDbAuditQueryStep,
  buildSafeEmailJobDuplicateReadOnlyDbAuditApprovalGateForLog,
  buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionPlanForLog,
  buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultForAudit,
  buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultForLog,
  buildSafeEmailJobDuplicateReadOnlyDbAuditOutputPolicyForLog,
  buildSafeEmailJobDuplicateReadOnlyDbAuditPreconditionForLog,
  buildSafeEmailJobDuplicateReadOnlyDbAuditQueryStepForLog,
  buildSafeEmailJobDuplicateReadOnlyDbAuditRiskAssessmentForLog,
  buildSanitizedOutputReviewRequiredPrecondition,
  buildSkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  buildSourceMetadataDuplicateDbAuditQueryStep,
  buildStagingReadDbAuditApprovalGate,
  buildStatusBucketDbAuditQueryStep,
  buildTimeWindowDbAuditQueryStep,
  buildTimeWindowRequiredPrecondition,
  isBlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  isFailedEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  isReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  isSkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult,
  validateEmailJobDuplicateReadOnlyDbAuditApprovalGate,
  validateEmailJobDuplicateReadOnlyDbAuditExecutionPlan,
  validateEmailJobDuplicateReadOnlyDbAuditExecutionPlanItem,
  validateEmailJobDuplicateReadOnlyDbAuditOutputPolicy,
  validateEmailJobDuplicateReadOnlyDbAuditPrecondition,
  validateEmailJobDuplicateReadOnlyDbAuditQueryStep,
  validateEmailJobDuplicateReadOnlyDbAuditRiskAssessment,
} = require('../dist/chat/email-job-duplicate-readonly-db-audit-execution.boundary.js');

test('db audit preconditions remain required execution blockers only', () => {
  const preconditions = [
    buildDbTargetConfirmedPrecondition(),
    buildReadOnlyRoleRequiredPrecondition(),
    buildProductionReadApprovalRequiredPrecondition(),
    buildNoSelectStarPrecondition(),
    buildLimitRequiredPrecondition(),
    buildTimeWindowRequiredPrecondition(),
    buildQueryTimeoutRequiredPrecondition(),
    buildSanitizedOutputReviewRequiredPrecondition(),
    buildNoCommittedResultsPrecondition(),
    buildNoRawPiiOutputPrecondition(),
    buildNoCleanupOrWriteActionsPrecondition(),
  ];

  for (const precondition of preconditions) {
    assert.equal(validateEmailJobDuplicateReadOnlyDbAuditPrecondition(precondition).valid, true);
    assert.equal(precondition.required, true);
    assert.equal(precondition.blocksExecutionWithoutApproval, true);
  }
});

test('db audit query steps stay proposed-only and preserve documented risk boundaries', () => {
  const aggregate = buildAggregateStatusKindDbAuditQueryStep('production');
  const reportRun = buildReportRunDuplicateDbAuditQueryStep('production');
  const sourceMetadata = buildSourceMetadataDuplicateDbAuditQueryStep('production');
  const recipientFingerprint = buildRecipientFingerprintDbAuditQueryStep('production');
  const contentFingerprint = buildContentFingerprintDbAuditQueryStep('production');
  const statusBucket = buildStatusBucketDbAuditQueryStep('production');
  const timeWindow = buildTimeWindowDbAuditQueryStep('production');
  const failedRetry = buildFailedRetryAmbiguityDbAuditQueryStep('production');
  const processingStale = buildProcessingStaleAmbiguityDbAuditQueryStep('production');

  for (const step of [
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
    assert.equal(validateEmailJobDuplicateReadOnlyDbAuditQueryStep(step).valid, true);
    assert.equal(step.type, 'email_job_duplicate_readonly_db_audit_query_step');
    assert.equal(step.version, 'v1');
    assert.equal(step.status, 'proposed_only');
    assert.equal(step.requiresExplicitApproval, true);
    assert.equal(step.requiresLimit, true);
  }

  assert.equal(aggregate.outputMode, 'aggregate_counts_only');
  assert.equal(reportRun.order, 4);
  assert.equal(sourceMetadata.performanceRisk, 'high');
  assert.equal(recipientFingerprint.piiRisk, 'high');
  assert.equal(contentFingerprint.piiRisk, 'blocked');
  assert.equal(contentFingerprint.performanceRisk, 'blocked');
  assert.equal(contentFingerprint.outputMode, 'blocked_raw_output');
  assert.equal(failedRetry.outputMode, 'manual_review_summary_only');
  assert.equal(processingStale.outputMode, 'manual_review_summary_only');

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
  assert.equal(serialized.includes('queried'), false);
  assert.equal(serialized.includes('reported'), false);
});

test('db audit approval gates remain separate and are never granted by the boundary', () => {
  const gates = [
    buildDocsOnlyDbAuditApprovalGate(),
    buildStagingReadDbAuditApprovalGate(),
    buildProductionReadDbAuditApprovalGate(),
    buildPiiFingerprintingDbAuditApprovalGate(),
    buildReportGenerationDbAuditApprovalGate(),
    buildCleanupDbAuditApprovalGate(),
    buildBackfillDbAuditApprovalGate(),
    buildMigrationIndexDbAuditApprovalGate(),
    buildEnforcementDbAuditApprovalGate(),
  ];

  for (const gate of gates) {
    assert.equal(validateEmailJobDuplicateReadOnlyDbAuditApprovalGate(gate).valid, true);
    assert.equal(gate.grantedByBoundary, false);
  }

  assert.equal(buildProductionReadDbAuditApprovalGate().required, true);
  assert.equal(buildStagingReadDbAuditApprovalGate().required, true);
  assert.equal(buildPiiFingerprintingDbAuditApprovalGate().required, true);
  assert.equal(buildDocsOnlyDbAuditApprovalGate().required, false);
});

test('db audit output policies block raw recipient and raw content fields', () => {
  const aggregate = buildAggregateCountsOnlyDbAuditOutputPolicy();
  const fingerprint = buildPseudonymizedFingerprintOnlyDbAuditOutputPolicy();
  const manualReview = buildManualReviewSummaryOnlyDbAuditOutputPolicy();
  const blocked = buildBlockedRawOutputDbAuditOutputPolicy();

  for (const policy of [aggregate, fingerprint, manualReview, blocked]) {
    assert.equal(validateEmailJobDuplicateReadOnlyDbAuditOutputPolicy(policy).valid, true);
    assert.equal(policy.allowsRawRecipientEmail, false);
    assert.equal(policy.allowsSubject, false);
    assert.equal(policy.allowsHtml, false);
    assert.equal(policy.allowsText, false);
    assert.equal(policy.allowsBody, false);
    assert.equal(policy.allowsFullMetadata, false);
    assert.equal(policy.allowsLastError, false);
    assert.equal(policy.allowsRowDump, false);
    assert.equal(policy.allowsCsvExport, false);
    assert.equal(policy.allowsJsonExport, false);
    assert.equal(policy.allowsCommittedReport, false);
  }

  assert.equal(aggregate.allowsAggregateCounts, true);
  assert.equal(fingerprint.allowsPseudonymizedFingerprints, true);
  assert.equal(manualReview.mode, 'manual_review_summary_only');
  assert.equal(blocked.mode, 'blocked_raw_output');
});

test('db audit risk assessments preserve documented pii and performance constraints', () => {
  const aggregate = buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment('aggregate_by_status_kind');
  const reportRun = buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment('duplicate_by_report_run');
  const recipient = buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment('duplicate_by_recipient_fingerprint');
  const content = buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment('duplicate_by_content_fingerprint');
  const timeWindow = buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment('time_window_scan');

  for (const assessment of [aggregate, reportRun, recipient, content, timeWindow]) {
    assert.equal(validateEmailJobDuplicateReadOnlyDbAuditRiskAssessment(assessment).valid, true);
    assert.equal(assessment.requiresLimit, true);
    assert.equal(assessment.requiresManualApproval, true);
  }

  assert.equal(aggregate.piiRisk, 'low');
  assert.equal(reportRun.performanceRisk, 'high');
  assert.equal(recipient.piiRisk, 'high');
  assert.equal(content.piiRisk, 'blocked');
  assert.equal(content.performanceRisk, 'blocked');
  assert.equal(timeWindow.requiresTimeWindow, true);
});

test('proposed db audit execution plan stays proposed-only and carries only planning objects', () => {
  const plan = buildProposedEmailJobDuplicateReadOnlyDbAuditExecutionPlan('production');

  assert.equal(validateEmailJobDuplicateReadOnlyDbAuditExecutionPlan(plan).valid, true);
  assert.equal(validateEmailJobDuplicateReadOnlyDbAuditExecutionPlanItem(plan).valid, true);
  assert.equal(plan.type, 'email_job_duplicate_readonly_db_audit_execution_plan');
  assert.equal(plan.version, 'v1');
  assert.equal(plan.status, 'proposed_only');
  assert.equal(plan.target, 'production');
  assert.equal(plan.preconditions.length >= 11, true);
  assert.equal(plan.approvalGates.length >= 9, true);
  assert.equal(plan.steps.length, 9);
  assert.equal(plan.steps.every((step) => step.status === 'proposed_only'), true);
  assert.equal(plan.approvalGates.every((gate) => gate.grantedByBoundary === false), true);
  assert.equal(plan.outputPolicy.mode, 'pseudonymized_fingerprints_only');
  assert.equal(plan.riskAssessment.requiresManualApproval, true);

  const serialized = JSON.stringify(plan);
  assert.equal(serialized.includes('executed'), false);
  assert.equal(serialized.includes('query_result'), false);
  assert.equal(serialized.includes('grantedByBoundary":true'), false);
});

test('result builders and classifiers remain stable for ready skipped blocked and failed states', () => {
  const ready = buildReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult(
    buildProposedEmailJobDuplicateReadOnlyDbAuditExecutionPlan('unknown'),
  );
  const skipped = buildSkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult('not_in_scope');
  const blocked = buildBlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
    'invalid_db_audit_output_policy',
    'invalid_output_policy',
  );
  const failed = buildFailedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
    'db_audit_projection_failed',
    'unknown_email_job_duplicate_readonly_db_audit_execution_error',
    true,
  );

  assert.equal(isReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult(ready), true);
  assert.equal(isSkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult(skipped), true);
  assert.equal(isBlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult(blocked), true);
  assert.equal(isFailedEmailJobDuplicateReadOnlyDbAuditExecutionResult(failed), true);
  assert.equal(validateEmailJobDuplicateReadOnlyDbAuditExecutionPlanItem(ready.plan).valid, true);
  assert.equal(failed.retryable, true);
});

test('safe projections redact raw content identifiers secrets and sql-like text without mutating inputs', () => {
  const precondition = buildDbTargetConfirmedPrecondition();
  const step = buildRecipientFingerprintDbAuditQueryStep('production');
  const gate = buildProductionReadDbAuditApprovalGate();
  const policy = buildPseudonymizedFingerprintOnlyDbAuditOutputPolicy();
  const assessment = buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment('duplicate_by_recipient_fingerprint');
  const plan = buildProposedEmailJobDuplicateReadOnlyDbAuditExecutionPlan('production');

  const unsafePrecondition = Object.freeze({
    ...precondition,
    queryResults: ['row-1'],
    token: 'token-value',
  });
  const unsafeStep = Object.freeze({
    ...step,
    recipientEmail: 'recipient@example.com',
    subject: 'Visible subject',
    html: '<p>visible body</p>',
    text: 'visible text',
    body: 'visible body',
    metadata: {
      apiKey: 'api-key-value',
      signingSecret: 'signing-secret-value',
      authorization: 'auth-demo-value',
      reportRunId: 'report-run-1',
      conversationId: 'conversation-1',
    },
    sql: 'select * from email_jobs',
    reportPath: '/tmp/report.csv',
    queryResults: [{ id: 'row-1' }],
  });
  const unsafeGate = Object.freeze({
    ...gate,
    token: 'token-value',
  });
  const unsafePolicy = Object.freeze({
    ...policy,
    lastError: 'smtp failure',
  });
  const unsafeAssessment = Object.freeze({
    ...assessment,
    reportRunId: 'report-run-2',
  });
  const unsafePlan = Object.freeze({
    ...plan,
    recipientEmail: 'recipient@example.com',
    metadata: {
      reportRunId: 'report-run-3',
      apiKey: 'api-key-value',
    },
    sql: 'select status from email_jobs',
  });

  const safePrecondition = buildSafeEmailJobDuplicateReadOnlyDbAuditPreconditionForLog(unsafePrecondition);
  const safeStep = buildSafeEmailJobDuplicateReadOnlyDbAuditQueryStepForLog(unsafeStep);
  const safeGate = buildSafeEmailJobDuplicateReadOnlyDbAuditApprovalGateForLog(unsafeGate);
  const safePolicy = buildSafeEmailJobDuplicateReadOnlyDbAuditOutputPolicyForLog(unsafePolicy);
  const safeAssessment = buildSafeEmailJobDuplicateReadOnlyDbAuditRiskAssessmentForLog(unsafeAssessment);
  const safePlan = buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionPlanForLog(unsafePlan);
  const safeReady = buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultForLog(
    buildReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult(unsafePlan),
  );
  const safeAudit = buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultForAudit(
    buildReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult(unsafeStep),
  );

  const serialized = JSON.stringify([
    safePrecondition,
    safeStep,
    safeGate,
    safePolicy,
    safeAssessment,
    safePlan,
    safeReady,
    safeAudit,
  ]);

  assert.equal(serialized.includes('recipient@example.com'), false);
  assert.equal(serialized.includes('Visible subject'), false);
  assert.equal(serialized.includes('visible body'), false);
  assert.equal(serialized.includes('report-run-1'), false);
  assert.equal(serialized.includes('conversation-1'), false);
  assert.equal(serialized.includes('api-key-value'), false);
  assert.equal(serialized.includes('signing-secret-value'), false);
  assert.equal(serialized.includes('auth-demo-value'), false);
  assert.equal(serialized.includes('select * from email_jobs'), false);
  assert.equal(serialized.includes('/tmp/report.csv'), false);
  assert.equal(serialized.includes('queryResults'), true);
  assert.equal(serialized.includes('[redacted]') || serialized.includes('[omitted]'), true);

  assert.equal(unsafeStep.recipientEmail, 'recipient@example.com');
  assert.equal(unsafeStep.metadata.apiKey, 'api-key-value');
  assert.equal(unsafePlan.metadata.reportRunId, 'report-run-3');
});

test('source file remains pure and side-effect free', () => {
  const filePath = path.resolve(
    __dirname,
    '../src/chat/email-job-duplicate-readonly-db-audit-execution.boundary.ts',
  );
  const source = fs.readFileSync(filePath, 'utf8');

  assert.equal(/process\.env/.test(source), false);
  assert.equal(/\bLogger\b/.test(source), false);
  assert.equal(/\bEmailJobsService\b/.test(source), false);
  assert.equal(/\bprocessPendingJobs\b/.test(source), false);
  assert.equal(/\bRepository\b/.test(source), false);
  assert.equal(/\bdb\.query\b/.test(source), false);
  assert.equal(/\bSELECT\b/.test(source), false);
  assert.equal(/\bFROM\b/.test(source), false);
  assert.equal(/\bWHERE\b/.test(source), false);
  assert.equal(/NOLIS/i.test(source), false);
});
