const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildBlockedEmailJobIdempotencyMigrationPlanResult,
  buildDirectInsertRiskEnforcementPlan,
  buildEmailJobBackfillPlan,
  buildEmailJobDuplicateConflictPolicy,
  buildEmailJobEnforcementPointPlan,
  buildEmailJobIdempotencyMigrationPhase,
  buildEmailJobIdempotencyMigrationPlan,
  buildEmailJobRollbackPlan,
  buildEmailJobUniqueIndexPlan,
  buildFailedEmailJobIdempotencyMigrationPlanResult,
  buildPreferredEmailJobsServiceEnqueueEnforcementPlan,
  buildProcessPendingJobsUnsafePrimaryEnforcementPlan,
  buildReadyEmailJobIdempotencyMigrationPlanResult,
  buildSafeEmailJobBackfillPlanForLog,
  buildSafeEmailJobDuplicateConflictPolicyForLog,
  buildSafeEmailJobEnforcementPointPlanForLog,
  buildSafeEmailJobIdempotencyMigrationPlanResultForAudit,
  buildSafeEmailJobIdempotencyMigrationPlanResultForLog,
  buildSafeEmailJobMigrationPhaseForLog,
  buildSafeEmailJobRollbackPlanForLog,
  buildSafeEmailJobUniqueIndexPlanForLog,
  buildSkippedEmailJobIdempotencyMigrationPlanResult,
  buildSupportingCallerEnforcementPlan,
  isBlockedEmailJobIdempotencyMigrationPlanResult,
  isFailedEmailJobIdempotencyMigrationPlanResult,
  isReadyEmailJobIdempotencyMigrationPlanResult,
  isSkippedEmailJobIdempotencyMigrationPlanResult,
  validateEmailJobBackfillPlan,
  validateEmailJobDuplicateConflictPolicy,
  validateEmailJobEnforcementPointPlan,
  validateEmailJobIdempotencyMigrationPhase,
  validateEmailJobIdempotencyMigrationPhaseOrder,
  validateEmailJobRollbackPlan,
  validateEmailJobUniqueIndexPlan,
} = require('../dist/chat/email-job-idempotency-migration-plan.boundary.js');

test('email job idempotency migration plan boundary models enforcement points only as plans', () => {
  const service = buildPreferredEmailJobsServiceEnqueueEnforcementPlan();
  const caller = buildSupportingCallerEnforcementPlan();
  const directInsert = buildDirectInsertRiskEnforcementPlan();
  const processPending = buildProcessPendingJobsUnsafePrimaryEnforcementPlan();
  const dbConstraint = buildEmailJobEnforcementPointPlan('database_unique_constraint');

  assert.equal(service.recommendation, 'preferred');
  assert.equal(service.enforcementPoint, 'email_jobs_service_enqueue');
  assert.equal(validateEmailJobEnforcementPointPlan(service).valid, true);
  assert.equal(caller.recommendation, 'supporting');
  assert.equal(directInsert.recommendation, 'unsafe_primary');
  assert.match(directInsert.reasonCode, /bypasses_service_boundary/);
  assert.equal(processPending.recommendation, 'unsafe_primary');
  assert.match(processPending.reasonCode, /after_persistence/);
  assert.equal(dbConstraint.recommendation, 'deferred');
  assert.deepEqual(dbConstraint.requiredPreconditions, [
    'nullable_column_plan',
    'duplicate_audit',
    'backfill_plan',
    'rollback_plan',
  ]);
  assert.equal(JSON.stringify(dbConstraint).includes('CREATE INDEX'), false);
  assert.equal(JSON.stringify(dbConstraint).includes('ALTER TABLE'), false);
});

test('email job idempotency migration phases remain proposed-only and validate required order', () => {
  const phases = buildEmailJobIdempotencyMigrationPlan();
  const phaseNames = phases.map((phase) => phase.phase);

  assert.deepEqual(phaseNames, [
    'audit_only',
    'shadow_key_generation',
    'nullable_column',
    'write_new_keys',
    'duplicate_audit',
    'backfill_plan',
    'service_level_noop',
    'unique_index_plan',
    'rollback_plan',
    'db_enforcement',
  ]);
  assert.equal(phases.every((phase) => phase.status === 'proposed_only'), true);
  assert.equal(validateEmailJobIdempotencyMigrationPhaseOrder(phases).valid, true);
  assert.equal(validateEmailJobIdempotencyMigrationPhase(buildEmailJobIdempotencyMigrationPhase('db_enforcement')).valid, true);

  const rollbackBeforeDuplicateAudit = [
    buildEmailJobIdempotencyMigrationPhase('audit_only'),
    buildEmailJobIdempotencyMigrationPhase('shadow_key_generation'),
    buildEmailJobIdempotencyMigrationPhase('rollback_plan'),
    buildEmailJobIdempotencyMigrationPhase('db_enforcement'),
  ];
  assert.deepEqual(validateEmailJobIdempotencyMigrationPhaseOrder(rollbackBeforeDuplicateAudit), {
    valid: false,
    reasonCode: 'shadow_key_generation_must_precede_write_new_keys',
    errorCode: 'invalid_phase_order',
  });

  const dbBeforeRollback = [
    buildEmailJobIdempotencyMigrationPhase('audit_only'),
    buildEmailJobIdempotencyMigrationPhase('shadow_key_generation'),
    buildEmailJobIdempotencyMigrationPhase('duplicate_audit'),
    buildEmailJobIdempotencyMigrationPhase('unique_index_plan'),
    {
      ...buildEmailJobIdempotencyMigrationPhase('db_enforcement'),
      order: 85,
    },
    buildEmailJobIdempotencyMigrationPhase('rollback_plan'),
  ];
  assert.deepEqual(validateEmailJobIdempotencyMigrationPhaseOrder(dbBeforeRollback), {
    valid: false,
    reasonCode: 'invalid_email_job_idempotency_phase_order',
    errorCode: 'invalid_migration_phase',
  });
});

test('email job unique index plans are proposed-only and never generate executable statements', () => {
  const all = buildEmailJobUniqueIndexPlan('all_email_jobs');
  const byKind = buildEmailJobUniqueIndexPlan('by_kind');
  const partial = buildEmailJobUniqueIndexPlan('partial_by_kind');
  const reportOnly = buildEmailJobUniqueIndexPlan('report_only');
  const appOnly = buildEmailJobUniqueIndexPlan('app_only_no_db_index');

  assert.equal(all.status, 'proposed_only');
  assert.equal(all.requiresDuplicateCleanup, true);
  assert.equal(all.requiresBackfill, true);
  assert.equal(all.requiresRollbackPlan, true);
  assert.equal(validateEmailJobUniqueIndexPlan(all).valid, true);
  assert.equal(validateEmailJobUniqueIndexPlan(byKind).valid, true);
  assert.equal(validateEmailJobUniqueIndexPlan(partial).valid, true);
  assert.equal(validateEmailJobUniqueIndexPlan(reportOnly).valid, true);
  assert.equal(validateEmailJobUniqueIndexPlan(appOnly).valid, true);
  assert.equal(appOnly.requiresDuplicateCleanup, false);
  assert.equal(appOnly.requiresBackfill, false);
  assert.equal(appOnly.requiresRollbackPlan, false);
  assert.equal(JSON.stringify([all, byKind, partial, reportOnly, appOnly]).includes('CREATE'), false);
  assert.equal(JSON.stringify([all, byKind, partial, reportOnly, appOnly]).includes('UNIQUE'), false);
});

test('email job backfill plans require audit and block enforcement when scope is unknown', () => {
  const legacy = buildEmailJobBackfillPlan('legacy_email_jobs');
  const reports = buildEmailJobBackfillPlan('report_jobs_only');
  const leads = buildEmailJobBackfillPlan('lead_jobs_only');
  const unknown = buildEmailJobBackfillPlan('unknown_until_db_audit');

  assert.equal(legacy.requiresDbAudit, true);
  assert.equal(legacy.requiresPiiHashingPlan, true);
  assert.equal(legacy.requiresDuplicateCleanup, true);
  assert.equal(legacy.blocksEnforcement, false);
  assert.equal(reports.requiresDbAudit, true);
  assert.equal(reports.requiresPiiHashingPlan, true);
  assert.equal(leads.requiresPiiHashingPlan, true);
  assert.equal(unknown.blocksEnforcement, true);
  assert.equal(validateEmailJobBackfillPlan(legacy).valid, true);
  assert.equal(validateEmailJobBackfillPlan(unknown).valid, true);
  assert.equal(JSON.stringify([legacy, reports, leads, unknown]).includes('backfill script'), false);
});

test('email job duplicate conflict policies are data-only decisions without lookup', () => {
  const queued = buildEmailJobDuplicateConflictPolicy('queued');
  const processing = buildEmailJobDuplicateConflictPolicy('processing');
  const sent = buildEmailJobDuplicateConflictPolicy('sent');
  const failed = buildEmailJobDuplicateConflictPolicy('failed');
  const unknown = buildEmailJobDuplicateConflictPolicy('unknown');

  assert.equal(queued.decision, 'skip_noop');
  assert.equal(processing.decision, 'skip_noop');
  assert.equal(sent.decision, 'skip_noop');
  assert.equal(failed.decision, 'manual_review_required');
  assert.equal(unknown.decision, 'block');
  for (const policy of [queued, processing, sent, failed, unknown]) {
    assert.equal(validateEmailJobDuplicateConflictPolicy(policy).valid, true);
  }
});

test('email job rollback plans are proposed-only and classify DB rollback needs', () => {
  const apiOnly = buildEmailJobRollbackPlan('api_only');
  const dbMigration = buildEmailJobRollbackPlan('db_migration');
  const indexDrop = buildEmailJobRollbackPlan('index_drop');
  const backfillReversal = buildEmailJobRollbackPlan('backfill_reversal');
  const manualRecovery = buildEmailJobRollbackPlan('manual_recovery');

  assert.equal(apiOnly.requiresDbRollback, false);
  assert.equal(apiOnly.requiresBackup, false);
  assert.equal(dbMigration.requiresDbRollback, true);
  assert.equal(dbMigration.requiresBackup, true);
  assert.equal(indexDrop.requiresDbRollback, true);
  assert.equal(backfillReversal.requiresDbRollback, true);
  assert.equal(backfillReversal.requiresBackup, true);
  assert.equal(manualRecovery.requiresBackup, true);
  for (const plan of [apiOnly, dbMigration, indexDrop, backfillReversal, manualRecovery]) {
    assert.equal(plan.status, 'proposed_only');
    assert.equal(validateEmailJobRollbackPlan(plan).valid, true);
  }
});

test('email job migration plan results and classifiers are stable data objects', () => {
  const ready = buildReadyEmailJobIdempotencyMigrationPlanResult(buildEmailJobUniqueIndexPlan('report_only'));
  const skipped = buildSkippedEmailJobIdempotencyMigrationPlanResult('not_in_scope');
  const blocked = buildBlockedEmailJobIdempotencyMigrationPlanResult('missing_duplicate_audit', 'db_enforcement_preconditions_missing');
  const failed = buildFailedEmailJobIdempotencyMigrationPlanResult('projection_failed', 'unknown_email_job_idempotency_migration_plan_error', true);

  assert.equal(isReadyEmailJobIdempotencyMigrationPlanResult(ready), true);
  assert.equal(isSkippedEmailJobIdempotencyMigrationPlanResult(skipped), true);
  assert.equal(isBlockedEmailJobIdempotencyMigrationPlanResult(blocked), true);
  assert.equal(isFailedEmailJobIdempotencyMigrationPlanResult(failed), true);
  assert.equal(ready.status, 'ready');
  assert.equal(skipped.status, 'skipped');
  assert.equal(blocked.status, 'blocked');
  assert.equal(failed.retryable, true);
});

test('email job idempotency migration plan safe projections redact sensitive fields and do not mutate input', () => {
  const unsafe = Object.freeze({
    ...buildEmailJobEnforcementPointPlan('email_jobs_service_enqueue'),
    recipientEmail: 'person@example.test',
    subject: 'Full subject should not appear',
    html: '<p>Full body should not appear</p>',
    text: 'Full text should not appear',
    payload: { authorization: 'Bearer dummy-token-secret', apiKey: 'dummy-api-key' },
    signingSecret: 'dummy-signing-secret',
    sql: 'SELECT * FROM email_jobs',
  });
  const result = buildReadyEmailJobIdempotencyMigrationPlanResult(unsafe);

  const projections = [
    buildSafeEmailJobEnforcementPointPlanForLog(unsafe),
    buildSafeEmailJobMigrationPhaseForLog(buildEmailJobIdempotencyMigrationPhase('audit_only')),
    buildSafeEmailJobUniqueIndexPlanForLog(buildEmailJobUniqueIndexPlan('report_only')),
    buildSafeEmailJobBackfillPlanForLog(buildEmailJobBackfillPlan('legacy_email_jobs')),
    buildSafeEmailJobDuplicateConflictPolicyForLog(buildEmailJobDuplicateConflictPolicy('queued')),
    buildSafeEmailJobRollbackPlanForLog(buildEmailJobRollbackPlan('db_migration')),
    buildSafeEmailJobIdempotencyMigrationPlanResultForLog(result),
    buildSafeEmailJobIdempotencyMigrationPlanResultForAudit(result),
  ];
  const serialized = JSON.stringify(projections);

  assert.equal(serialized.includes('person@example.test'), false);
  assert.equal(serialized.includes('Full subject should not appear'), false);
  assert.equal(serialized.includes('Full body should not appear'), false);
  assert.equal(serialized.includes('Full text should not appear'), false);
  assert.equal(serialized.includes('dummy-token-secret'), false);
  assert.equal(serialized.includes('dummy-api-key'), false);
  assert.equal(serialized.includes('dummy-signing-secret'), false);
  assert.equal(serialized.includes('SELECT * FROM email_jobs'), false);
  assert.equal(unsafe.recipientEmail, 'person@example.test');
  assert.equal(unsafe.payload.authorization, 'Bearer dummy-token-secret');
});

test('email job idempotency migration plan boundary stays side-effect free and unwired', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-job-idempotency-migration-plan.boundary.ts'),
    'utf8',
  );
  const orchestrator = fs.readFileSync(
    path.join(__dirname, '../src/chat/chat-agent-orchestrator.service.ts'),
    'utf8',
  );
  const emailJobsService = fs.readFileSync(
    path.join(__dirname, '../src/modules/widget/services/email-jobs.service.ts'),
    'utf8',
  );
  const migrationsDir = path.join(__dirname, '../migrations');
  const migrationNames = fs.readdirSync(migrationsDir);

  assert.doesNotMatch(source, /^import\s/m);
  assert.doesNotMatch(source, /\basync\b|await\s|process\.env|console\.|Logger|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bCREATE\s+(TABLE|INDEX)\b/i);
  assert.doesNotMatch(source, /EmailJobsService\.enqueue|EmailJobsService\.processPendingJobs|processPendingJobs\(|enqueue\(|report_runs|webhook_jobs|agent_tickets|widget_leads/);
  assert.doesNotMatch(source, /NOLIS|nolis|kommune|municipality/);
  assert.equal(orchestrator.includes('email-job-idempotency-migration-plan.boundary'), false);
  assert.equal(emailJobsService.includes('email-job-idempotency-migration-plan.boundary'), false);
  assert.equal(migrationNames.some((name) => /idempotency|email_job.*migration/i.test(name)), false);
});
