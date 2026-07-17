const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDefaultEmailJobDuplicateStagingReadOnlyAuditRunbook,
  buildExampleStagingReadOnlyAuditHumanApprovalFormat,
  buildDefaultStagingReadOnlyAuditPreflightChecklist,
  buildAggregateStatusKindAllowedQueryClassEnvelope,
  buildReportRunDuplicateAllowedQueryClassEnvelope,
  buildSourceMetadataDuplicateAllowedQueryClassEnvelope,
  buildRecipientFingerprintAllowedQueryClassEnvelope,
  buildContentFingerprintDeferredQueryClassEnvelope,
  buildStatusBucketAllowedQueryClassEnvelope,
  buildTimeWindowAllowedQueryClassEnvelope,
  buildFailedRetryAmbiguityAllowedQueryClassEnvelope,
  buildProcessingStaleAmbiguityAllowedQueryClassEnvelope,
  buildDefaultStagingReadOnlyAuditSafeOutputPolicy,
  buildDefaultStagingReadOnlyAuditStopCriteria,
  buildDefaultStagingReadOnlyAuditAbortModel,
  validateEmailJobDuplicateStagingReadOnlyAuditRunbook,
  validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat,
  validateEmailJobDuplicateStagingReadOnlyAuditPreflightChecklist,
  validateEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope,
  validateEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy,
  validateEmailJobDuplicateStagingReadOnlyAuditStopCriteria,
  validateEmailJobDuplicateStagingReadOnlyAuditAbortModel,
  buildReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  buildSkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  buildBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  buildFailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  isReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  isSkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  isBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  isFailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditPreflightChecklistForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelopeForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicyForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditStopCriteriaForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditAbortModelForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookResultForLog,
  buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookResultForAudit,
} = require('../dist/chat/email-job-duplicate-staging-readonly-audit-runbook.boundary.js');

test('runbook defaults remain documented-only and non-granting', () => {
  const runbook = buildDefaultEmailJobDuplicateStagingReadOnlyAuditRunbook();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditRunbook(runbook).valid, true);
  assert.equal(runbook.dbReadOnlyAuditApproved, false);
  assert.equal(runbook.stagingDbReadApproved, false);
  assert.equal(runbook.productionDbReadApproved, false);
  assert.equal(runbook.sqlExecutionApproved, false);
  assert.equal(runbook.queryRunnerApproved, false);
  assert.equal(runbook.queryResultsApproved, false);
  assert.equal(runbook.reportsWithDataApproved, false);
  assert.equal(runbook.cleanupApproved, false);
  assert.equal(runbook.backfillApproved, false);
  assert.equal(runbook.enforcementApproved, false);
  assert.equal(runbook.humanApprovalGranted, false);
  assert.equal(runbook.readyMeansApproved, false);
  assert.equal(runbook.grantedByBoundary, false);
});

test('human approval format stays example-only and explicitly not granted', () => {
  const format = buildExampleStagingReadOnlyAuditHumanApprovalFormat();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat(format).valid, true);
  assert.equal(format.exampleOnly, true);
  assert.equal(format.humanApprovalGranted, false);
  assert.equal(format.grantedByBoundary, false);
  assert.match(format.exampleApprovalText, /example only/i);
  assert.match(format.exampleApprovalText, /staging/i);
  assert.match(format.exampleApprovalText, /read-only/i);
  assert.match(format.exampleApprovalText, /sql-dateien im repo/i);
  assert.match(format.exampleApprovalText, /reports mit daten/i);
  assert.match(format.exampleApprovalText, /email_jobs writes/i);
  assert.match(format.exampleApprovalText, /ohne cleanup/i);
  assert.match(format.exampleApprovalText, /ohne backfill/i);
  assert.match(format.exampleApprovalText, /ohne enforcement/i);
});

test('preflight checklist requires staging-only setup and separate human approval', () => {
  const checklist = buildDefaultStagingReadOnlyAuditPreflightChecklist();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditPreflightChecklist(checklist).valid, true);
  assert.equal(checklist.confirmedStagingEnvironmentRequired, true);
  assert.equal(checklist.confirmedStagingDbTargetRequired, true);
  assert.equal(checklist.productionTargetExcluded, true);
  assert.equal(checklist.readOnlyRoleRequired, true);
  assert.equal(checklist.noWritePermissionsRequired, true);
  assert.equal(checklist.noMigrationPermissionsRequired, true);
  assert.equal(checklist.noCleanupPermissionsRequired, true);
  assert.equal(checklist.noBackfillPermissionsRequired, true);
  assert.equal(checklist.noQueryResultsInRepoRequired, true);
  assert.equal(checklist.noReportsWithDataRequired, true);
  assert.equal(checklist.noCsvJsonExportsRequired, true);
  assert.equal(checklist.separateHumanApprovalRequired, true);
  assert.equal(checklist.humanApprovalGranted, false);
});

test('query class envelopes stay category-only and never execution-ready or DB-read-approved', () => {
  const envelopes = [
    buildAggregateStatusKindAllowedQueryClassEnvelope(),
    buildReportRunDuplicateAllowedQueryClassEnvelope(),
    buildSourceMetadataDuplicateAllowedQueryClassEnvelope(),
    buildRecipientFingerprintAllowedQueryClassEnvelope(),
    buildStatusBucketAllowedQueryClassEnvelope(),
    buildTimeWindowAllowedQueryClassEnvelope(),
    buildFailedRetryAmbiguityAllowedQueryClassEnvelope(),
    buildProcessingStaleAmbiguityAllowedQueryClassEnvelope(),
    buildContentFingerprintDeferredQueryClassEnvelope(),
  ];

  const seen = new Set();
  for (const envelope of envelopes) {
    assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope(envelope).valid, true);
    seen.add(envelope.queryClass);
    assert.equal(envelope.containsSql, false);
    assert.equal(envelope.executionReady, false);
    assert.equal(envelope.dbReadOnlyAuditApproved, false);
    assert.equal(envelope.stagingDbReadApproved, false);
    assert.equal(envelope.productionDbReadApproved, false);
    assert.equal(envelope.sqlExecutionApproved, false);
    assert.equal(envelope.queryRunnerApproved, false);
    assert.equal(envelope.queryResultsApproved, false);
    assert.equal(envelope.reportsWithDataApproved, false);
    assert.equal(envelope.cleanupApproved, false);
    assert.equal(envelope.backfillApproved, false);
    assert.equal(envelope.enforcementApproved, false);
    assert.equal(JSON.stringify(envelope).toLowerCase().includes('select *'), false);
  }

  assert.equal(seen.size, 9);

  const recipientFingerprint = envelopes.find((entry) => (
    entry.queryClass === 'recipient_fingerprint_candidate_counts'
  ));
  const contentFingerprint = envelopes.find((entry) => entry.queryClass === 'content_fingerprint_scan');

  assert.equal(recipientFingerprint.requiresSeparatePiiStrategy, true);
  assert.equal(contentFingerprint.status, 'blocked_without_pii_strategy');
  assert.equal(contentFingerprint.deferred, true);
  assert.equal(contentFingerprint.blockedWithoutPiiStrategy, true);
  assert.equal(contentFingerprint.piiRisk, 'high');
});

test('safe output policy allows only future aggregate-safe outputs and blocks raw fields exports and reports', () => {
  const policy = buildDefaultStagingReadOnlyAuditSafeOutputPolicy();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy(policy).valid, true);
  assert.equal(policy.futureApprovedOutputOnly, true);
  assert.equal(policy.allowsAggregateCounts, true);
  assert.equal(policy.allowsStatusBuckets, true);
  assert.equal(policy.allowsKindBuckets, true);
  assert.equal(policy.allowsRiskGroupCounts, true);
  assert.equal(policy.allowsReasonCodes, true);
  assert.equal(policy.allowsPseudonymizedFingerprints, false);
  assert.equal(policy.requiresSeparatePiiApprovalForFingerprints, true);
  assert.equal(policy.allowsRawRecipientEmail, false);
  assert.equal(policy.allowsSubject, false);
  assert.equal(policy.allowsHtml, false);
  assert.equal(policy.allowsText, false);
  assert.equal(policy.allowsBody, false);
  assert.equal(policy.allowsFullMetadata, false);
  assert.equal(policy.allowsRowDumps, false);
  assert.equal(policy.allowsCsvExports, false);
  assert.equal(policy.allowsJsonExports, false);
  assert.equal(policy.allowsCommittedReportsWithData, false);
  assert.equal(policy.allowsQueryResults, false);
});

test('stop criteria block unsafe execution shapes and missing operator approval', () => {
  const criteria = buildDefaultStagingReadOnlyAuditStopCriteria();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditStopCriteria(criteria).valid, true);
  assert.equal(criteria.blocksUnclearEnvironment, true);
  assert.equal(criteria.blocksProductionTarget, true);
  assert.equal(criteria.blocksMissingReadOnlyRole, true);
  assert.equal(criteria.blocksWritePermissions, true);
  assert.equal(criteria.blocksMissingLimit, true);
  assert.equal(criteria.blocksMissingTimeWindow, true);
  assert.equal(criteria.blocksPotentialFullTableScan, true);
  assert.equal(criteria.blocksRawPiiOutput, true);
  assert.equal(criteria.blocksRawContentOutput, true);
  assert.equal(criteria.blocksFullMetadataOutput, true);
  assert.equal(criteria.blocksCommittedQueryResults, true);
  assert.equal(criteria.blocksCommittedReportsWithData, true);
  assert.equal(criteria.blocksMissingOperatorApproval, true);
  assert.equal(criteria.blocksCleanupUpdateDelete, true);
});

test('abort model keeps rollback local-only and aborts on wrong environment', () => {
  const abortModel = buildDefaultStagingReadOnlyAuditAbortModel();

  assert.equal(validateEmailJobDuplicateStagingReadOnlyAuditAbortModel(abortModel).valid, true);
  assert.equal(abortModel.databaseRollbackRequired, false);
  assert.equal(abortModel.localArtifactsOnly, true);
  assert.equal(abortModel.deleteForbiddenOutputsImmediately, true);
  assert.equal(abortModel.doNotCommitForbiddenOutputs, true);
  assert.equal(abortModel.documentIncidentAndStop, true);
  assert.equal(abortModel.abortOnWrongEnvironment, true);
  assert.equal(abortModel.writesAllowed, false);
});

test('result builders and classifiers work while ready still does not imply approval', () => {
  const runbook = buildDefaultEmailJobDuplicateStagingReadOnlyAuditRunbook();
  const ready = buildReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult(runbook);
  const skipped = buildSkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult('not_in_scope');
  const blocked = buildBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
    'missing_operator_approval',
    'ready_must_not_imply_approval',
  );
  const failed = buildFailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
    'projection_failed',
    'unknown_email_job_duplicate_staging_readonly_audit_runbook_error',
    true,
  );

  assert.equal(isReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult(ready), true);
  assert.equal(isSkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(skipped), true);
  assert.equal(isBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(blocked), true);
  assert.equal(isFailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(failed), true);
  assert.equal(ready.runbook.humanApprovalGranted, false);
  assert.equal(ready.runbook.readyMeansApproved, false);
  assert.equal(ready.runbook.stagingDbReadApproved, false);
  assert.equal(ready.runbook.grantedByBoundary, false);
  assert.equal(failed.retryable, true);
});

test('safe projections remove secrets sql query results report paths pii and false approval signals without mutating input', () => {
  const runbook = buildDefaultEmailJobDuplicateStagingReadOnlyAuditRunbook();
  const format = buildExampleStagingReadOnlyAuditHumanApprovalFormat();
  const checklist = buildDefaultStagingReadOnlyAuditPreflightChecklist();
  const envelope = buildRecipientFingerprintAllowedQueryClassEnvelope();
  const policy = buildDefaultStagingReadOnlyAuditSafeOutputPolicy();
  const criteria = buildDefaultStagingReadOnlyAuditStopCriteria();
  const abortModel = buildDefaultStagingReadOnlyAuditAbortModel();

  const unsafeRunbook = Object.freeze({
    ...runbook,
    recipientEmail: 'person@example.com',
    subject: 'unsafe subject',
    payload: { authorization: 'Bearer demo-token' },
    metadata: { apiKey: 'demo-api-key', signingSecret: 'demo-signing-secret' },
    sql: 'SELECT * FROM email_jobs',
    queryResults: [{ id: 'row-1' }],
    reportPath: '/tmp/report.csv',
  });
  const unsafeFormat = Object.freeze({
    ...format,
    exampleApprovalText: 'Ich gebe person@example.com SELECT * /tmp/report.csv frei',
  });
  const unsafeChecklist = Object.freeze({
    ...checklist,
    token: 'demo-token',
  });
  const unsafeEnvelope = Object.freeze({
    ...envelope,
    sql: 'select * from email_jobs',
    reportPath: '/tmp/report.json',
  });
  const unsafePolicy = Object.freeze({
    ...policy,
    metadata: { providerError: 'smtp failed' },
  });
  const unsafeCriteria = Object.freeze({
    ...criteria,
    last_error: 'provider failed',
  });
  const unsafeAbortModel = Object.freeze({
    ...abortModel,
    authorization: 'Bearer demo-token',
  });

  const safeRunbook = buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookForLog(unsafeRunbook);
  const safeFormat = buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog(unsafeFormat);
  const safeChecklist = buildSafeEmailJobDuplicateStagingReadOnlyAuditPreflightChecklistForLog(unsafeChecklist);
  const safeEnvelope = buildSafeEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelopeForLog(unsafeEnvelope);
  const safePolicy = buildSafeEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicyForLog(unsafePolicy);
  const safeCriteria = buildSafeEmailJobDuplicateStagingReadOnlyAuditStopCriteriaForLog(unsafeCriteria);
  const safeAbortModel = buildSafeEmailJobDuplicateStagingReadOnlyAuditAbortModelForLog(unsafeAbortModel);
  const ready = buildReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult(runbook);
  const safeReadyLog = buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookResultForLog(ready);
  const safeReadyAudit = buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookResultForAudit(ready);

  for (const projection of [
    safeRunbook,
    safeFormat,
    safeChecklist,
    safeEnvelope,
    safePolicy,
    safeCriteria,
    safeAbortModel,
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
    assert.equal(serialized.includes('"humanapprovalgranted":true'), false);
  }

  assert.equal(unsafeRunbook.subject, 'unsafe subject');
  assert.equal(unsafeEnvelope.sql, 'select * from email_jobs');
  assert.equal(unsafeFormat.exampleApprovalText.includes('Ich gebe'), true);
});

test('boundary source stays side-effect free and does not wire runtime dependencies', () => {
  const boundaryPath = path.resolve(
    __dirname,
    '../src/chat/email-job-duplicate-staging-readonly-audit-runbook.boundary.ts',
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
