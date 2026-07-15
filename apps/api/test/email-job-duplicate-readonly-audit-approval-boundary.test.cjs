const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDocsOnlyApprovalDecision,
  buildStagingReadApprovalDecision,
  buildProductionReadApprovalDecision,
  buildPiiFingerprintingApprovalDecision,
  buildReportGenerationApprovalDecision,
  buildManualReviewPackApprovalDecision,
  buildCleanupApprovalDecision,
  buildBackfillApprovalDecision,
  buildMigrationIndexApprovalDecision,
  buildEnforcementApprovalDecision,
  buildDefaultEmailJobDuplicateReadOnlyAuditApprovalMatrix,
  buildDefaultEmailJobDuplicateReadOnlyAuditEnvironmentSequence,
  buildDefaultEmailJobDuplicateReadOnlyAuditStopCriteria,
  buildDefaultEmailJobDuplicateReadOnlyAuditOutputPolicy,
  buildReadyEmailJobDuplicateReadOnlyAuditApprovalResult,
  buildSkippedEmailJobDuplicateReadOnlyAuditApprovalResult,
  buildBlockedEmailJobDuplicateReadOnlyAuditApprovalResult,
  buildFailedEmailJobDuplicateReadOnlyAuditApprovalResult,
  buildSafeEmailJobDuplicateReadOnlyAuditApprovalDecisionForLog,
  buildSafeEmailJobDuplicateReadOnlyAuditApprovalMatrixForLog,
  buildSafeEmailJobDuplicateReadOnlyAuditEnvironmentSequenceForLog,
  buildSafeEmailJobDuplicateReadOnlyAuditStopCriteriaForLog,
  buildSafeEmailJobDuplicateReadOnlyAuditOutputPolicyForLog,
  buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultForLog,
  buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultForAudit,
  isReadyEmailJobDuplicateReadOnlyAuditApprovalResult,
  isSkippedEmailJobDuplicateReadOnlyAuditApprovalResult,
  isBlockedEmailJobDuplicateReadOnlyAuditApprovalResult,
  isFailedEmailJobDuplicateReadOnlyAuditApprovalResult,
  validateEmailJobDuplicateReadOnlyAuditApprovalDecision,
  validateEmailJobDuplicateReadOnlyAuditApprovalMatrix,
  validateEmailJobDuplicateReadOnlyAuditEnvironmentSequence,
  validateEmailJobDuplicateReadOnlyAuditStopCriteria,
  validateEmailJobDuplicateReadOnlyAuditOutputPolicy,
  validateEmailJobDuplicateReadOnlyAuditApprovalPlanItem,
} = require('../dist/chat/email-job-duplicate-readonly-audit-approval.boundary.js');

test('approval decisions remain non-granting and keep risky areas blocked', () => {
  const docsOnly = buildDocsOnlyApprovalDecision();
  const stagingRead = buildStagingReadApprovalDecision();
  const productionRead = buildProductionReadApprovalDecision();
  const pii = buildPiiFingerprintingApprovalDecision();
  const report = buildReportGenerationApprovalDecision();
  const manualReview = buildManualReviewPackApprovalDecision();
  const cleanup = buildCleanupApprovalDecision();
  const backfill = buildBackfillApprovalDecision();
  const migration = buildMigrationIndexApprovalDecision();
  const enforcement = buildEnforcementApprovalDecision();

  for (const decision of [
    docsOnly,
    stagingRead,
    productionRead,
    pii,
    report,
    manualReview,
    cleanup,
    backfill,
    migration,
    enforcement,
  ]) {
    assert.equal(validateEmailJobDuplicateReadOnlyAuditApprovalDecision(decision).valid, true);
    assert.equal(decision.currentStatus, 'not_granted');
    assert.equal(decision.grantedByBoundary, false);
    assert.equal(decision.allowsDbRead, false);
    assert.equal(decision.allowsSqlExecution, false);
    assert.equal(decision.allowsQueryRunner, false);
    assert.equal(decision.allowsReportsWithData, false);
    assert.equal(decision.allowsCleanup, false);
    assert.equal(decision.allowsBackfill, false);
    assert.equal(decision.allowsEnforcement, false);
  }

  assert.equal(docsOnly.required, false);
  assert.equal(stagingRead.required, true);
  assert.equal(productionRead.required, true);
  assert.equal(pii.required, true);
  assert.equal(report.required, true);
  assert.equal(manualReview.required, true);
  assert.equal(cleanup.required, true);
  assert.equal(backfill.required, true);
  assert.equal(migration.required, true);
  assert.equal(enforcement.required, true);
});

test('default approval matrix includes all areas and still blocks DB-read approval', () => {
  const matrix = buildDefaultEmailJobDuplicateReadOnlyAuditApprovalMatrix();

  assert.equal(validateEmailJobDuplicateReadOnlyAuditApprovalMatrix(matrix).valid, true);
  assert.equal(validateEmailJobDuplicateReadOnlyAuditApprovalPlanItem(matrix).valid, true);
  assert.equal(matrix.entries.length, 10);

  const areas = new Set(matrix.entries.map((entry) => entry.area));
  for (const area of [
    'docs_only',
    'staging_read',
    'production_read',
    'pii_fingerprinting',
    'report_generation',
    'manual_review_pack',
    'cleanup',
    'backfill',
    'migration_index',
    'enforcement',
  ]) {
    assert.equal(areas.has(area), true);
  }

  const serialized = JSON.stringify(matrix);
  assert.equal(serialized.includes('"currentStatus":"not_granted"'), true);
  assert.equal(serialized.includes('"allowsDbRead":true'), false);
  assert.equal(serialized.includes('"allowsSqlExecution":true'), false);
  assert.equal(serialized.includes('"allowsQueryRunner":true'), false);
  assert.equal(serialized.includes('"allowsReportsWithData":true'), false);
});

test('default environment sequence keeps staging before production and remains planning only', () => {
  const sequence = buildDefaultEmailJobDuplicateReadOnlyAuditEnvironmentSequence();

  assert.equal(validateEmailJobDuplicateReadOnlyAuditEnvironmentSequence(sequence).valid, true);
  assert.equal(validateEmailJobDuplicateReadOnlyAuditApprovalPlanItem(sequence).valid, true);
  assert.deepEqual(
    sequence.steps.map((step) => step.step),
    [
      'docs_only_decision_gate',
      'approval_boundary',
      'staging_read_only_audit_proposal',
      'staging_read_only_audit_execution',
      'production_read_only_audit_proposal',
      'production_read_only_audit_execution',
      'report_review',
      'cleanup_planning',
      'enforcement_planning',
    ],
  );

  for (const step of sequence.steps) {
    assert.equal(step.status, 'planned_only');
    assert.equal(step.allowsDbRead, false);
    assert.equal(step.allowsSqlExecution, false);
    assert.equal(step.allowsQueryRunner, false);
    assert.equal(step.allowsReportsWithData, false);
    assert.equal(step.allowsCleanup, false);
    assert.equal(step.allowsBackfill, false);
    assert.equal(step.allowsEnforcement, false);
  }
});

test('stop criteria keep unsafe DB-read shapes blocked', () => {
  const stopCriteria = buildDefaultEmailJobDuplicateReadOnlyAuditStopCriteria();

  assert.equal(validateEmailJobDuplicateReadOnlyAuditStopCriteria(stopCriteria).valid, true);
  assert.equal(validateEmailJobDuplicateReadOnlyAuditApprovalPlanItem(stopCriteria).valid, true);
  assert.equal(stopCriteria.blocksUnknownDbTarget, true);
  assert.equal(stopCriteria.requiresChatbotDbTarget, true);
  assert.equal(stopCriteria.blocksMissingReadOnlyRole, true);
  assert.equal(stopCriteria.blocksSelectStar, true);
  assert.equal(stopCriteria.blocksMissingLimit, true);
  assert.equal(stopCriteria.blocksMissingTimeWindow, true);
  assert.equal(stopCriteria.blocksRawPiiOutput, true);
  assert.equal(stopCriteria.blocksCommittedQueryResults, true);
  assert.equal(stopCriteria.blocksCommittedReportsWithData, true);
  assert.equal(stopCriteria.blocksCleanupUpdateDelete, true);
});

test('output policy only allows aggregate-safe outputs and blocks raw fields', () => {
  const outputPolicy = buildDefaultEmailJobDuplicateReadOnlyAuditOutputPolicy();

  assert.equal(validateEmailJobDuplicateReadOnlyAuditOutputPolicy(outputPolicy).valid, true);
  assert.equal(validateEmailJobDuplicateReadOnlyAuditApprovalPlanItem(outputPolicy).valid, true);
  assert.equal(outputPolicy.allowsAggregateCounts, true);
  assert.equal(outputPolicy.allowsStatusBuckets, true);
  assert.equal(outputPolicy.allowsKindBuckets, true);
  assert.equal(outputPolicy.allowsRiskGroupCounts, true);
  assert.equal(outputPolicy.allowsReasonCodes, true);
  assert.equal(outputPolicy.allowsPseudonymizedIdentifiers, false);
  assert.equal(outputPolicy.allowsRawRecipientEmail, false);
  assert.equal(outputPolicy.allowsSubject, false);
  assert.equal(outputPolicy.allowsHtml, false);
  assert.equal(outputPolicy.allowsText, false);
  assert.equal(outputPolicy.allowsBody, false);
  assert.equal(outputPolicy.allowsFullMetadata, false);
  assert.equal(outputPolicy.allowsRowDump, false);
  assert.equal(outputPolicy.allowsCsvExport, false);
  assert.equal(outputPolicy.allowsJsonExport, false);
  assert.equal(outputPolicy.allowsCommittedReportsWithData, false);
  assert.equal(outputPolicy.allowsQueryResults, false);
});

test('result builders and classifiers remain stable without implying DB-read approval', () => {
  const ready = buildReadyEmailJobDuplicateReadOnlyAuditApprovalResult(
    buildDefaultEmailJobDuplicateReadOnlyAuditApprovalMatrix(),
  );
  const skipped = buildSkippedEmailJobDuplicateReadOnlyAuditApprovalResult('not_in_scope');
  const blocked = buildBlockedEmailJobDuplicateReadOnlyAuditApprovalResult(
    'approval_matrix_invalid',
    'invalid_matrix',
  );
  const failed = buildFailedEmailJobDuplicateReadOnlyAuditApprovalResult(
    'approval_projection_failed',
    'unknown_email_job_duplicate_readonly_audit_approval_error',
    true,
  );

  assert.equal(isReadyEmailJobDuplicateReadOnlyAuditApprovalResult(ready), true);
  assert.equal(isSkippedEmailJobDuplicateReadOnlyAuditApprovalResult(skipped), true);
  assert.equal(isBlockedEmailJobDuplicateReadOnlyAuditApprovalResult(blocked), true);
  assert.equal(isFailedEmailJobDuplicateReadOnlyAuditApprovalResult(failed), true);
  assert.equal(validateEmailJobDuplicateReadOnlyAuditApprovalPlanItem(ready.plan).valid, true);
  assert.equal(failed.retryable, true);
  assert.equal(ready.plan.entries.every((entry) => entry.currentStatus === 'not_granted'), true);
});

test('safe projections redact secrets raw content sql-like text and report paths without mutating input', () => {
  const decision = buildProductionReadApprovalDecision();
  const matrix = buildDefaultEmailJobDuplicateReadOnlyAuditApprovalMatrix();
  const sequence = buildDefaultEmailJobDuplicateReadOnlyAuditEnvironmentSequence();
  const stopCriteria = buildDefaultEmailJobDuplicateReadOnlyAuditStopCriteria();
  const outputPolicy = buildDefaultEmailJobDuplicateReadOnlyAuditOutputPolicy();

  const unsafeDecision = Object.freeze({
    ...decision,
    recipientEmail: 'recipient@example.com',
    subject: 'Visible subject',
    html: '<p>visible body</p>',
    metadata: {
      apiKey: 'api-key-value',
      signingSecret: 'signing-secret-value',
      authorization: 'auth-demo-value',
      reportRunId: 'report-run-1',
    },
    queryResults: [{ id: 'row-1' }],
    sql: 'select * from email_jobs',
    reportPath: '/tmp/report.csv',
  });
  const unsafeMatrix = Object.freeze({
    ...matrix,
    token: 'token-value',
  });
  const unsafeSequence = Object.freeze({
    ...sequence,
    body: 'visible body',
  });
  const unsafeStopCriteria = Object.freeze({
    ...stopCriteria,
    lastError: 'provider failure',
  });
  const unsafeOutputPolicy = Object.freeze({
    ...outputPolicy,
    jsonPath: '/tmp/output.json',
  });

  const safeDecision = buildSafeEmailJobDuplicateReadOnlyAuditApprovalDecisionForLog(unsafeDecision);
  const safeMatrix = buildSafeEmailJobDuplicateReadOnlyAuditApprovalMatrixForLog(unsafeMatrix);
  const safeSequence = buildSafeEmailJobDuplicateReadOnlyAuditEnvironmentSequenceForLog(unsafeSequence);
  const safeStopCriteria = buildSafeEmailJobDuplicateReadOnlyAuditStopCriteriaForLog(unsafeStopCriteria);
  const safeOutputPolicy = buildSafeEmailJobDuplicateReadOnlyAuditOutputPolicyForLog(unsafeOutputPolicy);
  const safeReady = buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultForLog(
    buildReadyEmailJobDuplicateReadOnlyAuditApprovalResult(unsafeDecision),
  );
  const safeAudit = buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultForAudit(
    buildReadyEmailJobDuplicateReadOnlyAuditApprovalResult(unsafeMatrix),
  );

  const serialized = JSON.stringify([
    safeDecision,
    safeMatrix,
    safeSequence,
    safeStopCriteria,
    safeOutputPolicy,
    safeReady,
    safeAudit,
  ]);

  assert.equal(serialized.includes('recipient@example.com'), false);
  assert.equal(serialized.includes('Visible subject'), false);
  assert.equal(serialized.includes('visible body'), false);
  assert.equal(serialized.includes('report-run-1'), false);
  assert.equal(serialized.includes('api-key-value'), false);
  assert.equal(serialized.includes('signing-secret-value'), false);
  assert.equal(serialized.includes('auth-demo-value'), false);
  assert.equal(serialized.includes('select * from email_jobs'), false);
  assert.equal(serialized.includes('/tmp/report.csv'), false);
  assert.equal(serialized.includes('/tmp/output.json'), false);
  assert.equal(serialized.includes('[redacted]') || serialized.includes('[omitted]'), true);
  assert.equal(serialized.includes('queryResults'), true);

  assert.equal(unsafeDecision.recipientEmail, 'recipient@example.com');
  assert.equal(unsafeDecision.metadata.apiKey, 'api-key-value');
  assert.equal(unsafeOutputPolicy.jsonPath, '/tmp/output.json');
});

test('source file remains pure and side-effect free', () => {
  const filePath = path.resolve(
    __dirname,
    '../src/chat/email-job-duplicate-readonly-audit-approval.boundary.ts',
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
