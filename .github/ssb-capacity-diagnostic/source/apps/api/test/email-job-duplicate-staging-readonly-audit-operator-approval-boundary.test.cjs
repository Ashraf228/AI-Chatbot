const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDbReadOnlyAuditOperatorApprovalDecision,
  buildStagingDbReadOperatorApprovalDecision,
  buildProductionDbReadOperatorApprovalDecision,
  buildSqlExecutionOperatorApprovalDecision,
  buildQueryRunnerOperatorApprovalDecision,
  buildQueryResultsOperatorApprovalDecision,
  buildReportsWithDataOperatorApprovalDecision,
  buildPiiFingerprintingOperatorApprovalDecision,
  buildManualReviewPackOperatorApprovalDecision,
  buildCleanupOperatorApprovalDecision,
  buildBackfillOperatorApprovalDecision,
  buildMigrationIndexOperatorApprovalDecision,
  buildIdempotencyEnforcementOperatorApprovalDecision,
  buildDefaultStagingReadOnlyAuditRequiredEvidence,
  buildDefaultStagingReadOnlyAuditDecisionMatrix,
  buildDefaultStagingReadOnlyAuditNonApprovalClauses,
  buildExampleHumanApprovalFormat,
  buildDefaultStagingReadOnlyAuditOperatorStopCriteria,
  validateEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision,
  validateEmailJobDuplicateStagingReadOnlyAuditRequiredEvidence,
  validateEmailJobDuplicateStagingReadOnlyAuditDecisionMatrix,
  validateEmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses,
  validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat,
  validateEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria,
  buildReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  buildSkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  buildBlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  buildFailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  isReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  isSkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  isBlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  isFailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditDecisionMatrixForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditNonApprovalClausesForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteriaForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResultForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResultForAudit,
} = require('../dist/chat/email-job-duplicate-staging-readonly-audit-operator-approval.boundary.js');

test('approval decisions remain non-granting for every risky area', () => {
  const decisions = [
    buildDbReadOnlyAuditOperatorApprovalDecision(),
    buildStagingDbReadOperatorApprovalDecision(),
    buildProductionDbReadOperatorApprovalDecision(),
    buildSqlExecutionOperatorApprovalDecision(),
    buildQueryRunnerOperatorApprovalDecision(),
    buildQueryResultsOperatorApprovalDecision(),
    buildReportsWithDataOperatorApprovalDecision(),
    buildPiiFingerprintingOperatorApprovalDecision(),
    buildManualReviewPackOperatorApprovalDecision(),
    buildCleanupOperatorApprovalDecision(),
    buildBackfillOperatorApprovalDecision(),
    buildMigrationIndexOperatorApprovalDecision(),
    buildIdempotencyEnforcementOperatorApprovalDecision(),
  ];

  for (const decision of decisions) {
    assert.equal(
      validateEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision(decision).valid,
      true,
    );
    assert.equal(decision.requiredBeforeApproval, true);
    assert.equal(decision.grantedByBoundary, false);
    assert.equal(decision.allowsDbRead, false);
    assert.equal(decision.allowsStagingDbRead, false);
    assert.equal(decision.allowsProductionDbRead, false);
    assert.equal(decision.allowsSqlExecution, false);
    assert.equal(decision.allowsQueryRunner, false);
    assert.equal(decision.allowsQueryResults, false);
    assert.equal(decision.allowsReportsWithData, false);
    assert.equal(decision.allowsCleanup, false);
    assert.equal(decision.allowsBackfill, false);
    assert.equal(decision.allowsEnforcement, false);
  }

  assert.equal(buildDbReadOnlyAuditOperatorApprovalDecision().currentDecision, 'not_approved');
  assert.equal(buildStagingDbReadOperatorApprovalDecision().currentDecision, 'not_approved');
  assert.equal(buildProductionDbReadOperatorApprovalDecision().currentDecision, 'not_approved');
  assert.equal(buildSqlExecutionOperatorApprovalDecision().currentDecision, 'not_allowed');
  assert.equal(buildQueryRunnerOperatorApprovalDecision().currentDecision, 'not_allowed');
  assert.equal(buildQueryResultsOperatorApprovalDecision().currentDecision, 'not_allowed');
  assert.equal(buildReportsWithDataOperatorApprovalDecision().currentDecision, 'not_allowed');
  assert.equal(buildCleanupOperatorApprovalDecision().currentDecision, 'not_allowed');
  assert.equal(buildBackfillOperatorApprovalDecision().currentDecision, 'not_allowed');
  assert.equal(buildIdempotencyEnforcementOperatorApprovalDecision().currentDecision, 'not_allowed');
});

test('required evidence covers every mandatory proof and stays unconfirmed', () => {
  const evidence = buildDefaultStagingReadOnlyAuditRequiredEvidence();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditRequiredEvidence(evidence).valid, true);
  assert.equal(evidence.items.length, 12);

  const evidenceKeys = new Set(evidence.items.map((item) => item.evidence));
  assert.equal(evidenceKeys.has('confirmed_human_operator_approval'), true);
  assert.equal(evidenceKeys.has('confirmed_no_committed_query_results'), true);
  assert.equal(evidenceKeys.has('confirmed_no_reports_with_data'), true);
  assert.equal(evidence.items.every((item) => item.requiredBeforeApproval === true), true);
  assert.equal(evidence.items.every((item) => item.currentlyConfirmed === false), true);
  assert.equal(evidence.items.every((item) => item.grantedByBoundary === false), true);
});

test('decision matrix covers all risky areas and keeps production read separately blocked', () => {
  const matrix = buildDefaultStagingReadOnlyAuditDecisionMatrix();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditDecisionMatrix(matrix).valid, true);
  assert.equal(matrix.entries.length, 13);

  const areas = new Set(matrix.entries.map((entry) => entry.area));
  assert.equal(areas.has('db_readonly_audit'), true);
  assert.equal(areas.has('staging_db_read'), true);
  assert.equal(areas.has('production_db_read'), true);
  assert.equal(areas.has('sql_execution'), true);
  assert.equal(areas.has('query_runner'), true);
  assert.equal(areas.has('reports_with_data'), true);
  assert.equal(areas.has('cleanup'), true);
  assert.equal(areas.has('idempotency_enforcement'), true);

  for (const entry of matrix.entries) {
    assert.equal(entry.requiredBeforeApproval, true);
    assert.equal(entry.grantedByBoundary, false);
    assert.equal(entry.allowsDbRead, false);
    assert.equal(entry.allowsStagingDbRead, false);
    assert.equal(entry.allowsProductionDbRead, false);
    assert.equal(entry.allowsSqlExecution, false);
    assert.equal(entry.allowsQueryRunner, false);
    assert.equal(entry.allowsQueryResults, false);
    assert.equal(entry.allowsReportsWithData, false);
    assert.equal(entry.allowsCleanup, false);
    assert.equal(entry.allowsBackfill, false);
    assert.equal(entry.allowsEnforcement, false);
  }

  const production = matrix.entries.find((entry) => entry.area === 'production_db_read');
  assert.equal(production.currentDecision, 'not_approved');
});

test('non-approval clauses explicitly block staging read production read sql runner reports and cleanup lines', () => {
  const clauses = buildDefaultStagingReadOnlyAuditNonApprovalClauses();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses(clauses).valid, true);
  assert.equal(clauses.clauses.length, 13);

  const rendered = clauses.clauses.map((clause) => `${clause.area}:${clause.clause.toLowerCase()}`).join('\n');
  assert.match(rendered, /staging_db_read:.*does not approve a staging db read/);
  assert.match(rendered, /production_db_read:.*does not approve a production db read/);
  assert.match(rendered, /sql_execution:.*does not allow sql execution/);
  assert.match(rendered, /query_runner:.*does not allow a query runner/);
  assert.match(rendered, /reports_with_data:.*does not allow reports with data/);
  assert.match(rendered, /cleanup:.*does not allow cleanup work/);
  assert.match(rendered, /backfill:.*does not allow backfill work/);
  assert.match(rendered, /idempotency_enforcement:.*does not allow idempotency enforcement/);
});

test('human approval format stays example-only scope-bounded and not granted', () => {
  const format = buildExampleHumanApprovalFormat();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat(format).valid, true);
  assert.equal(format.scope, 'staging_only');
  assert.equal(format.exampleOnly, true);
  assert.equal(format.humanApprovalGranted, false);
  assert.equal(format.currentDecision, 'not_approved');
  assert.equal(format.requiredBeforeApproval, true);
  assert.equal(format.grantedByBoundary, false);
  assert.equal(format.allowsDbRead, false);
  assert.equal(format.allowsStagingDbRead, false);
  assert.equal(format.allowsProductionDbRead, false);
  assert.equal(format.allowsSqlExecution, false);
  assert.equal(format.allowsQueryRunner, false);
  assert.equal(format.allowsQueryResults, false);
  assert.equal(format.allowsReportsWithData, false);
  assert.equal(format.allowsCleanup, false);
  assert.equal(format.allowsBackfill, false);
  assert.equal(format.allowsEnforcement, false);
  assert.match(format.exampleApprovalText, /example only/i);
  assert.match(format.exampleApprovalText, /not granted/i);
  assert.equal(format.requiredScopeBoundaries.includes('no reports with data'), true);
  assert.equal(format.requiredScopeBoundaries.includes('no cleanup'), true);
  assert.equal(format.requiredScopeBoundaries.includes('no enforcement'), true);
});

test('stop criteria block unsafe staging execution shapes and missing operator approval', () => {
  const criteria = buildDefaultStagingReadOnlyAuditOperatorStopCriteria();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria(criteria).valid, true);
  assert.equal(criteria.blocksUnclearStagingEnvironment, true);
  assert.equal(criteria.blocksAccidentalProductionTarget, true);
  assert.equal(criteria.blocksMissingReadOnlyRole, true);
  assert.equal(criteria.blocksWritePermissionsPresent, true);
  assert.equal(criteria.blocksMissingLimit, true);
  assert.equal(criteria.blocksMissingTimeWindow, true);
  assert.equal(criteria.blocksPotentialFullTableScan, true);
  assert.equal(criteria.blocksRawPiiOutput, true);
  assert.equal(criteria.blocksRawContentOutput, true);
  assert.equal(criteria.blocksFullMetadataOutput, true);
  assert.equal(criteria.blocksCommittedQueryResults, true);
  assert.equal(criteria.blocksCommittedReportsWithData, true);
  assert.equal(criteria.blocksMissingHumanOperatorApproval, true);
  assert.equal(criteria.blocksCleanupBackfillEnforcementRequests, true);
  assert.equal(criteria.blocksUnclearPerformanceRisk, true);
  assert.equal(criteria.blocksUnresolvedPiiStrategy, true);
});

test('result builders and classifiers work while ready still does not imply approval', () => {
  const format = buildExampleHumanApprovalFormat();
  const ready = buildReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(format);
  const skipped = buildSkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult('not_applicable');
  const blocked = buildBlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
    'missing_human_approval',
    'invalid_result',
  );
  const failed = buildFailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
    'projection_failed',
    'unknown_email_job_duplicate_staging_readonly_audit_operator_approval_error',
    true,
  );

  assert.equal(isReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(ready), true);
  assert.equal(isSkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(skipped), true);
  assert.equal(isBlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(blocked), true);
  assert.equal(isFailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(failed), true);
  assert.equal(ready.plan.humanApprovalGranted, false);
  assert.equal(ready.plan.allowsStagingDbRead, false);
  assert.equal(ready.plan.allowsProductionDbRead, false);
  assert.equal(failed.retryable, true);
});

test('safe projections remove secrets sql query results report paths pii and false approval signals without mutating input', () => {
  const decision = buildStagingDbReadOperatorApprovalDecision();
  const evidence = buildDefaultStagingReadOnlyAuditRequiredEvidence();
  const matrix = buildDefaultStagingReadOnlyAuditDecisionMatrix();
  const clauses = buildDefaultStagingReadOnlyAuditNonApprovalClauses();
  const format = buildExampleHumanApprovalFormat();
  const criteria = buildDefaultStagingReadOnlyAuditOperatorStopCriteria();

  const unsafeDecision = Object.freeze({
    ...decision,
    recipientEmail: 'person@example.com',
    authorization: 'Bearer demo-token',
    sql: 'SELECT * FROM email_jobs',
    queryResults: [{ id: 'row-1' }],
    reportPath: '/tmp/report.csv',
  });
  const unsafeEvidence = Object.freeze({
    ...evidence,
    items: evidence.items,
    metadata: { apiKey: 'demo-api-key', signingSecret: 'demo-signing-secret' },
  });
  const unsafeMatrix = Object.freeze({
    ...matrix,
    entries: matrix.entries,
    reportPath: '/tmp/report.json',
  });
  const unsafeClauses = Object.freeze({
    ...clauses,
    clauses: clauses.clauses,
    payload: { token: 'demo-token' },
  });
  const unsafeFormat = Object.freeze({
    ...format,
    exampleApprovalText: 'I approve staging db read for person@example.com with report /tmp/report.csv',
  });
  const unsafeCriteria = Object.freeze({
    ...criteria,
    last_error: 'smtp failed',
  });

  const safeDecision = buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionForLog(unsafeDecision);
  const safeEvidence = buildSafeEmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceForLog(unsafeEvidence);
  const safeMatrix = buildSafeEmailJobDuplicateStagingReadOnlyAuditDecisionMatrixForLog(unsafeMatrix);
  const safeClauses = buildSafeEmailJobDuplicateStagingReadOnlyAuditNonApprovalClausesForLog(unsafeClauses);
  const safeFormat = buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog(unsafeFormat);
  const safeCriteria = buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteriaForLog(unsafeCriteria);
  const ready = buildReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(format);
  const safeReadyLog = buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResultForLog(ready);
  const safeReadyAudit = buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResultForAudit(ready);

  for (const projection of [
    safeDecision,
    safeEvidence,
    safeMatrix,
    safeClauses,
    safeFormat,
    safeCriteria,
    safeReadyLog,
    safeReadyAudit,
  ]) {
    const serialized = JSON.stringify(projection).toLowerCase();
    assert.equal(serialized.includes('person@example.com'), false);
    assert.equal(serialized.includes('select * from email_jobs'), false);
    assert.equal(serialized.includes('row-1'), false);
    assert.equal(serialized.includes('/tmp/report.csv'), false);
    assert.equal(serialized.includes('/tmp/report.json'), false);
    assert.equal(serialized.includes('demo-token'), false);
    assert.equal(serialized.includes('demo-api-key'), false);
    assert.equal(serialized.includes('demo-signing-secret'), false);
    assert.equal(serialized.includes('"humanapprovalgranted":true'), false);
  }

  assert.equal(unsafeDecision.recipientEmail, 'person@example.com');
  assert.equal(unsafeFormat.exampleApprovalText.includes('I approve'), true);
});

test('boundary source stays side-effect free and does not wire runtime dependencies', () => {
  const boundaryPath = path.resolve(
    __dirname,
    '../src/chat/email-job-duplicate-staging-readonly-audit-operator-approval.boundary.ts',
  );
  const source = fs.readFileSync(boundaryPath, 'utf8');

  for (const forbidden of [
    'process.env',
    'Logger',
    'Repository',
    'DataSource',
    'Prisma',
    'EmailJobsService',
    'processPendingJobs',
    'enqueue(',
    'nolis',
  ]) {
    assert.equal(source.includes(forbidden), false, `unexpected forbidden token: ${forbidden}`);
  }

  assert.equal(/['"`][^'"`\n]+\.sql['"`]/.test(source), false, 'unexpected SQL file reference');
});
