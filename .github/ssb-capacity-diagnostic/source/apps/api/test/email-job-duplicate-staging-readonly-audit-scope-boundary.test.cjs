const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDefaultEmailJobDuplicateStagingReadOnlyAuditScope,
  buildStagingEnvironmentRequirement,
  buildStagingReadApprovalPrecondition,
  buildProductionReadStillSeparateApprovalPrecondition,
  buildAggregateStatusKindStagingQueryAllowance,
  buildReportRunDuplicateStagingQueryAllowance,
  buildSourceMetadataDuplicateStagingQueryAllowance,
  buildRecipientFingerprintStagingQueryAllowance,
  buildContentFingerprintStagingQueryAllowance,
  buildStatusBucketStagingQueryAllowance,
  buildTimeWindowStagingQueryAllowance,
  buildFailedRetryAmbiguityStagingQueryAllowance,
  buildProcessingStaleAmbiguityStagingQueryAllowance,
  buildDefaultStagingOutputPolicy,
  buildDefaultStagingStopCriteria,
  validateEmailJobDuplicateStagingReadOnlyAuditScope,
  validateEmailJobDuplicateStagingEnvironmentRequirement,
  validateEmailJobDuplicateStagingQueryClassAllowance,
  validateEmailJobDuplicateStagingOutputPolicy,
  validateEmailJobDuplicateStagingStopCriteria,
  validateEmailJobDuplicateStagingApprovalPrecondition,
  buildReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  buildSkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  buildBlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  buildFailedEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  isReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  isSkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  isBlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  isFailedEmailJobDuplicateStagingReadOnlyAuditScopeResult,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeForLog,
  buildSafeEmailJobDuplicateStagingEnvironmentRequirementForLog,
  buildSafeEmailJobDuplicateStagingQueryClassAllowanceForLog,
  buildSafeEmailJobDuplicateStagingOutputPolicyForLog,
  buildSafeEmailJobDuplicateStagingStopCriteriaForLog,
  buildSafeEmailJobDuplicateStagingApprovalPreconditionForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultForAudit,
} = require('../dist/chat/email-job-duplicate-staging-readonly-audit-scope.boundary.js');

test('scope defaults remain documented-only and non-granting', () => {
  const scope = buildDefaultEmailJobDuplicateStagingReadOnlyAuditScope();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditScope(scope).valid, true);
  assert.equal(scope.grantedByBoundary, false);
  assert.equal(scope.allowsStagingDbRead, false);
  assert.equal(scope.allowsProductionDbRead, false);
  assert.equal(scope.allowsSqlExecution, false);
  assert.equal(scope.allowsQueryRunner, false);
  assert.equal(scope.allowsQueryResults, false);
  assert.equal(scope.allowsReportsWithData, false);
  assert.equal(scope.allowsCleanup, false);
  assert.equal(scope.allowsBackfill, false);
  assert.equal(scope.allowsEnforcement, false);

  const approvalAreas = new Set(scope.approvalPreconditions.map((entry) => entry.area));
  assert.equal(approvalAreas.has('db_read_only_audit'), true);
  assert.equal(approvalAreas.has('staging_read'), true);
  assert.equal(approvalAreas.has('production_read'), true);
  assert.equal(scope.approvalPreconditions.every((entry) => entry.currentStatus === 'not_granted'), true);
  assert.equal(scope.approvalPreconditions.every((entry) => entry.grantedByBoundary === false), true);
});

test('environment requirements require confirmed staging and block production-target execution', () => {
  const requirement = buildStagingEnvironmentRequirement();

  assert.equal(validateEmailJobDuplicateStagingEnvironmentRequirement(requirement).valid, true);
  assert.equal(requirement.confirmedStagingEnvironmentRequired, true);
  assert.equal(requirement.blocksProductionTarget, true);
  assert.equal(requirement.requiresReadOnlyRole, true);
  assert.equal(requirement.allowsWritePermissions, false);
  assert.equal(requirement.allowsMigrationRights, false);
  assert.equal(requirement.allowsCleanupRights, false);
  assert.equal(requirement.allowsBackfillRights, false);
  assert.equal(requirement.allowsStagingDbRead, false);
  assert.equal(requirement.allowsProductionDbRead, false);
});

test('approval preconditions remain required and not granted for staging and production reads', () => {
  const stagingRead = buildStagingReadApprovalPrecondition();
  const productionRead = buildProductionReadStillSeparateApprovalPrecondition();

  for (const precondition of [stagingRead, productionRead]) {
    assert.equal(validateEmailJobDuplicateStagingApprovalPrecondition(precondition).valid, true);
    assert.equal(precondition.required, true);
    assert.equal(precondition.currentStatus, 'not_granted');
    assert.equal(precondition.grantedByBoundary, false);
    assert.equal(precondition.allowsStagingDbRead, false);
    assert.equal(precondition.allowsProductionDbRead, false);
    assert.equal(precondition.allowsSqlExecution, false);
    assert.equal(precondition.allowsQueryRunner, false);
    assert.equal(precondition.allowsQueryResults, false);
    assert.equal(precondition.allowsReportsWithData, false);
    assert.equal(precondition.allowsCleanup, false);
    assert.equal(precondition.allowsBackfill, false);
    assert.equal(precondition.allowsEnforcement, false);
  }
});

test('query class allowances remain category-only and never execution-ready', () => {
  const allowances = [
    buildAggregateStatusKindStagingQueryAllowance(),
    buildReportRunDuplicateStagingQueryAllowance(),
    buildSourceMetadataDuplicateStagingQueryAllowance(),
    buildRecipientFingerprintStagingQueryAllowance(),
    buildStatusBucketStagingQueryAllowance(),
    buildTimeWindowStagingQueryAllowance(),
    buildFailedRetryAmbiguityStagingQueryAllowance(),
    buildProcessingStaleAmbiguityStagingQueryAllowance(),
    buildContentFingerprintStagingQueryAllowance(),
  ];

  for (const allowance of allowances) {
    assert.equal(validateEmailJobDuplicateStagingQueryClassAllowance(allowance).valid, true);
    assert.equal(allowance.currentStatus, 'not_granted');
    assert.equal(allowance.grantedByBoundary, false);
    assert.equal(allowance.executionReady, false);
    assert.equal(allowance.allowsStagingDbRead, false);
    assert.equal(allowance.allowsProductionDbRead, false);
    assert.equal(allowance.allowsSqlExecution, false);
    assert.equal(allowance.allowsQueryRunner, false);
    assert.equal(allowance.allowsQueryResults, false);
    assert.equal(allowance.allowsReportsWithData, false);
    assert.equal(allowance.allowsCleanup, false);
    assert.equal(allowance.allowsBackfill, false);
    assert.equal(allowance.allowsEnforcement, false);
    assert.equal(JSON.stringify(allowance).toLowerCase().includes('select *'), false);
  }

  const recipientFingerprint = allowances.find((entry) => (
    entry.queryClass === 'recipient_fingerprint_candidate_counts'
  ));
  const contentFingerprint = allowances.find((entry) => entry.queryClass === 'content_fingerprint_scan');

  assert.equal(recipientFingerprint.requiresSeparatePiiStrategy, true);
  assert.equal(contentFingerprint.piiRisk, 'high');
  assert.equal(contentFingerprint.deferred, true);
  assert.equal(contentFingerprint.blockedWithoutPiiStrategy, true);
  assert.equal(contentFingerprint.status, 'blocked_without_pii_strategy');
});

test('output policy allows only aggregate-safe outputs and blocks raw fields exports and reports', () => {
  const policy = buildDefaultStagingOutputPolicy();

  assert.equal(validateEmailJobDuplicateStagingOutputPolicy(policy).valid, true);
  assert.equal(policy.allowsAggregateCounts, true);
  assert.equal(policy.allowsStatusBuckets, true);
  assert.equal(policy.allowsKindBuckets, true);
  assert.equal(policy.allowsRiskGroupCounts, true);
  assert.equal(policy.allowsReasonCodes, true);
  assert.equal(policy.allowsPseudonymizedFingerprints, false);
  assert.equal(policy.requiresSeparatePiiStrategyForFingerprints, true);
  assert.equal(policy.allowsRawRecipientEmail, false);
  assert.equal(policy.allowsSubject, false);
  assert.equal(policy.allowsHtml, false);
  assert.equal(policy.allowsText, false);
  assert.equal(policy.allowsBody, false);
  assert.equal(policy.allowsPayload, false);
  assert.equal(policy.allowsFullMetadata, false);
  assert.equal(policy.allowsLastError, false);
  assert.equal(policy.allowsProviderErrors, false);
  assert.equal(policy.allowsRowDumps, false);
  assert.equal(policy.allowsCsvExports, false);
  assert.equal(policy.allowsJsonExports, false);
  assert.equal(policy.allowsCommittedReportsWithData, false);
  assert.equal(policy.allowsQueryResults, false);
});

test('stop criteria block unsafe staging audit execution shapes', () => {
  const criteria = buildDefaultStagingStopCriteria();

  assert.equal(validateEmailJobDuplicateStagingStopCriteria(criteria).valid, true);
  assert.equal(criteria.blocksUnclearStagingEnvironment, true);
  assert.equal(criteria.blocksUnknownStagingDbTarget, true);
  assert.equal(criteria.blocksAccidentalProductionTarget, true);
  assert.equal(criteria.blocksMissingReadOnlyRole, true);
  assert.equal(criteria.blocksSelectStar, true);
  assert.equal(criteria.blocksMissingLimit, true);
  assert.equal(criteria.blocksMissingTimeWindow, true);
  assert.equal(criteria.blocksPotentialFullTableScan, true);
  assert.equal(criteria.blocksRawPiiOutput, true);
  assert.equal(criteria.blocksRawContentOutput, true);
  assert.equal(criteria.blocksFullMetadataOutput, true);
  assert.equal(criteria.blocksCommittedQueryResults, true);
  assert.equal(criteria.blocksCommittedReportsWithData, true);
  assert.equal(criteria.blocksCleanupUpdateDelete, true);
  assert.equal(criteria.blocksUnclearLivePiiInStaging, true);
});

test('result builders and classifiers work and ready does not imply DB-read approval', () => {
  const scope = buildDefaultEmailJobDuplicateStagingReadOnlyAuditScope();
  const ready = buildReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult(scope);
  const skipped = buildSkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult('not_in_scope');
  const blocked = buildBlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
    'missing_approval',
    'staging_read_not_granted',
  );
  const failed = buildFailedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
    'projection_failed',
    'unknown_email_job_duplicate_staging_readonly_audit_scope_error',
    true,
  );

  assert.equal(isReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult(ready), true);
  assert.equal(isSkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult(skipped), true);
  assert.equal(isBlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult(blocked), true);
  assert.equal(isFailedEmailJobDuplicateStagingReadOnlyAuditScopeResult(failed), true);
  assert.equal(ready.scope.allowsStagingDbRead, false);
  assert.equal(ready.scope.allowsProductionDbRead, false);
  assert.equal(ready.scope.grantedByBoundary, false);
  assert.equal(failed.retryable, true);
});

test('safe projections remove secrets sql pii query results and report paths without mutating input', () => {
  const scope = buildDefaultEmailJobDuplicateStagingReadOnlyAuditScope();
  const requirement = buildStagingEnvironmentRequirement();
  const allowance = buildRecipientFingerprintStagingQueryAllowance();
  const outputPolicy = buildDefaultStagingOutputPolicy();
  const stopCriteria = buildDefaultStagingStopCriteria();
  const approval = buildStagingReadApprovalPrecondition();

  const unsafeScope = Object.freeze({
    ...scope,
    recipientEmail: 'person@example.com',
    subject: 'unsafe subject',
    html: '<p>unsafe</p>',
    payload: { authorization: 'Bearer demo-token' },
    metadata: { apiKey: 'demo-api-key', signingSecret: 'demo-signing-secret' },
    sql: 'SELECT * FROM email_jobs',
    queryResults: [{ id: 'row-1' }],
    reportPath: '/tmp/report.csv',
  });
  const unsafeRequirement = Object.freeze({
    ...requirement,
    token: 'demo-token',
  });
  const unsafeAllowance = Object.freeze({
    ...allowance,
    sql: 'select * from email_jobs',
    reportPath: '/tmp/report.json',
  });
  const unsafeOutputPolicy = Object.freeze({
    ...outputPolicy,
    metadata: { providerError: 'smtp failed' },
  });
  const unsafeStopCriteria = Object.freeze({
    ...stopCriteria,
    last_error: 'provider failed',
  });
  const unsafeApproval = Object.freeze({
    ...approval,
    authorization: 'Bearer demo-token',
  });

  const safeScope = buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeForLog(unsafeScope);
  const safeRequirement = buildSafeEmailJobDuplicateStagingEnvironmentRequirementForLog(unsafeRequirement);
  const safeAllowance = buildSafeEmailJobDuplicateStagingQueryClassAllowanceForLog(unsafeAllowance);
  const safeOutputPolicy = buildSafeEmailJobDuplicateStagingOutputPolicyForLog(unsafeOutputPolicy);
  const safeStopCriteria = buildSafeEmailJobDuplicateStagingStopCriteriaForLog(unsafeStopCriteria);
  const safeApproval = buildSafeEmailJobDuplicateStagingApprovalPreconditionForLog(unsafeApproval);
  const readyResult = buildReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult(scope);
  const safeReadyLog = buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultForLog(readyResult);
  const safeReadyAudit = buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultForAudit(readyResult);

  for (const projection of [
    safeScope,
    safeRequirement,
    safeAllowance,
    safeOutputPolicy,
    safeStopCriteria,
    safeApproval,
    safeReadyLog,
    safeReadyAudit,
  ]) {
    const serialized = JSON.stringify(projection).toLowerCase();
    assert.equal(serialized.includes('person@example.com'), false);
    assert.equal(serialized.includes('unsafe subject'), false);
    assert.equal(serialized.includes('select * from email_jobs'), false);
    assert.equal(serialized.includes('row-1'), false);
    assert.equal(serialized.includes('/tmp/report.csv'), false);
    assert.equal(serialized.includes('/tmp/report.json'), false);
    assert.equal(serialized.includes('demo-api-key'), false);
    assert.equal(serialized.includes('demo-signing-secret'), false);
    assert.equal(serialized.includes('demo-token'), false);
  }

  assert.equal(unsafeScope.subject, 'unsafe subject');
  assert.equal(unsafeAllowance.sql, 'select * from email_jobs');
});

test('boundary source stays side-effect free and does not wire runtime dependencies', () => {
  const boundaryPath = path.resolve(
    __dirname,
    '../src/chat/email-job-duplicate-staging-readonly-audit-scope.boundary.ts',
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
