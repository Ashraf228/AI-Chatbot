export type EmailJobIdempotencyEnforcementPoint =
  | 'before_enqueue_caller'
  | 'email_jobs_service_enqueue'
  | 'direct_internal_lead_notification_insert'
  | 'report_delivery_enqueue'
  | 'process_pending_jobs'
  | 'database_unique_constraint';

export type EmailJobIdempotencyEnforcementPointRecommendation =
  | 'preferred'
  | 'supporting'
  | 'unsafe_primary'
  | 'deferred';

export type EmailJobIdempotencyEnforcementPointPlan = {
  type: 'email_job_idempotency_enforcement_point_plan';
  enforcementPoint: EmailJobIdempotencyEnforcementPoint;
  recommendation: EmailJobIdempotencyEnforcementPointRecommendation;
  reasonCode: string;
  risks: readonly string[];
  requiredPreconditions: readonly string[];
};

export type EmailJobIdempotencyMigrationPhaseName =
  | 'audit_only'
  | 'shadow_key_generation'
  | 'nullable_column'
  | 'write_new_keys'
  | 'duplicate_audit'
  | 'backfill_plan'
  | 'service_level_noop'
  | 'unique_index_plan'
  | 'db_enforcement'
  | 'rollback_plan';

export type EmailJobIdempotencyMigrationPhase = {
  type: 'email_job_idempotency_migration_phase';
  phase: EmailJobIdempotencyMigrationPhaseName;
  status: 'proposed_only';
  order: number;
  reasonCode: string;
  requiresRollbackPlan: boolean;
  requiresDbMigration: boolean;
  requiresDuplicateAudit: boolean;
};

export type EmailJobIdempotencyUniqueIndexScope =
  | 'all_email_jobs'
  | 'by_kind'
  | 'report_only'
  | 'partial_by_kind'
  | 'app_only_no_db_index';

export type EmailJobIdempotencyUniqueIndexPlan = {
  type: 'email_job_idempotency_unique_index_plan';
  indexScope: EmailJobIdempotencyUniqueIndexScope;
  status: 'proposed_only';
  requiresDuplicateCleanup: boolean;
  requiresBackfill: boolean;
  requiresRollbackPlan: boolean;
  reasonCode: string;
};

export type EmailJobIdempotencyBackfillTargetRows =
  | 'legacy_email_jobs'
  | 'report_jobs_only'
  | 'lead_jobs_only'
  | 'unknown_until_db_audit';

export type EmailJobIdempotencyBackfillPlan = {
  type: 'email_job_idempotency_backfill_plan';
  status: 'proposed_only';
  targetRows: EmailJobIdempotencyBackfillTargetRows;
  requiresDbAudit: boolean;
  requiresPiiHashingPlan: boolean;
  requiresDuplicateCleanup: boolean;
  blocksEnforcement: boolean;
  reasonCode: string;
};

export type EmailJobDuplicateStatus = 'queued' | 'processing' | 'sent' | 'failed' | 'unknown';

export type EmailJobDuplicateConflictPolicy = {
  type: 'email_job_duplicate_conflict_policy';
  duplicateStatus: EmailJobDuplicateStatus;
  decision: 'skip_noop' | 'allow_recreate' | 'block' | 'manual_review_required';
  reasonCode: string;
};

export type EmailJobIdempotencyRollbackScope =
  | 'api_only'
  | 'db_migration'
  | 'index_drop'
  | 'backfill_reversal'
  | 'manual_recovery';

export type EmailJobIdempotencyRollbackPlan = {
  type: 'email_job_idempotency_rollback_plan';
  rollbackScope: EmailJobIdempotencyRollbackScope;
  status: 'proposed_only';
  requiresDbRollback: boolean;
  requiresBackup: boolean;
  reasonCode: string;
};

export type EmailJobIdempotencyMigrationPlanItem =
  | EmailJobIdempotencyEnforcementPointPlan
  | EmailJobIdempotencyMigrationPhase
  | EmailJobIdempotencyUniqueIndexPlan
  | EmailJobIdempotencyBackfillPlan
  | EmailJobDuplicateConflictPolicy
  | EmailJobIdempotencyRollbackPlan;

export type EmailJobIdempotencyMigrationPlanResult =
  | {
      status: 'ready';
      reasonCode: string;
      plan: EmailJobIdempotencyMigrationPlanItem;
    }
  | {
      status: 'skipped';
      reasonCode: string;
    }
  | {
      status: 'blocked';
      reasonCode: string;
      errorCode: EmailJobIdempotencyMigrationPlanErrorCode;
    }
  | {
      status: 'failed';
      reasonCode: string;
      errorCode: EmailJobIdempotencyMigrationPlanErrorCode;
      retryable: boolean;
    };

export type EmailJobIdempotencyMigrationPlanValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobIdempotencyMigrationPlanErrorCode };

export type EmailJobIdempotencyMigrationPlanErrorCode =
  | 'missing_plan'
  | 'missing_reason_code'
  | 'invalid_enforcement_point'
  | 'invalid_recommendation'
  | 'invalid_migration_phase'
  | 'invalid_phase_order'
  | 'invalid_unique_index_plan'
  | 'invalid_backfill_plan'
  | 'invalid_duplicate_conflict_policy'
  | 'invalid_rollback_plan'
  | 'db_enforcement_preconditions_missing'
  | 'unknown_email_job_idempotency_migration_plan_error';

type JsonRecord = Record<string, unknown>;

const ENFORCEMENT_POINTS = new Set<EmailJobIdempotencyEnforcementPoint>([
  'before_enqueue_caller',
  'email_jobs_service_enqueue',
  'direct_internal_lead_notification_insert',
  'report_delivery_enqueue',
  'process_pending_jobs',
  'database_unique_constraint',
]);
const RECOMMENDATIONS = new Set<EmailJobIdempotencyEnforcementPointRecommendation>([
  'preferred',
  'supporting',
  'unsafe_primary',
  'deferred',
]);
const MIGRATION_PHASES = new Set<EmailJobIdempotencyMigrationPhaseName>([
  'audit_only',
  'shadow_key_generation',
  'nullable_column',
  'write_new_keys',
  'duplicate_audit',
  'backfill_plan',
  'service_level_noop',
  'unique_index_plan',
  'db_enforcement',
  'rollback_plan',
]);
const UNIQUE_INDEX_SCOPES = new Set<EmailJobIdempotencyUniqueIndexScope>([
  'all_email_jobs',
  'by_kind',
  'report_only',
  'partial_by_kind',
  'app_only_no_db_index',
]);
const BACKFILL_TARGETS = new Set<EmailJobIdempotencyBackfillTargetRows>([
  'legacy_email_jobs',
  'report_jobs_only',
  'lead_jobs_only',
  'unknown_until_db_audit',
]);
const DUPLICATE_STATUSES = new Set<EmailJobDuplicateStatus>([
  'queued',
  'processing',
  'sent',
  'failed',
  'unknown',
]);
const ROLLBACK_SCOPES = new Set<EmailJobIdempotencyRollbackScope>([
  'api_only',
  'db_migration',
  'index_drop',
  'backfill_reversal',
  'manual_recovery',
]);
const PHASE_ORDER: Record<EmailJobIdempotencyMigrationPhaseName, number> = {
  audit_only: 10,
  shadow_key_generation: 20,
  nullable_column: 30,
  write_new_keys: 40,
  duplicate_audit: 50,
  backfill_plan: 60,
  service_level_noop: 70,
  unique_index_plan: 80,
  rollback_plan: 90,
  db_enforcement: 100,
};
const REDACTED = '[redacted]';
const OMITTED = '[omitted]';
const SENSITIVE_KEYS = new Set([
  'authorization',
  'bearer',
  'bearertoken',
  'apikey',
  'api_key',
  'xapikey',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'secret',
  'signingsecret',
  'signing_secret',
  'password',
  'privatekey',
  'private_key',
  'xwebhooksecret',
]);
const PRIVATE_CONTENT_KEYS = new Set([
  'recipientemail',
  'recipient_email',
  'email',
  'to',
  'subject',
  'html',
  'text',
  'body',
  'payload',
  'message',
  'usermessage',
  'user_message',
  'sql',
]);

export function buildEmailJobEnforcementPointPlan(
  enforcementPoint: EmailJobIdempotencyEnforcementPoint,
): EmailJobIdempotencyEnforcementPointPlan {
  if (enforcementPoint === 'email_jobs_service_enqueue') {
    return buildPreferredEmailJobsServiceEnqueueEnforcementPlan();
  }
  if (enforcementPoint === 'before_enqueue_caller') {
    return buildSupportingCallerEnforcementPlan();
  }
  if (enforcementPoint === 'direct_internal_lead_notification_insert') {
    return buildDirectInsertRiskEnforcementPlan();
  }
  if (enforcementPoint === 'process_pending_jobs') {
    return buildProcessPendingJobsUnsafePrimaryEnforcementPlan();
  }
  if (enforcementPoint === 'database_unique_constraint') {
    return {
      type: 'email_job_idempotency_enforcement_point_plan',
      enforcementPoint,
      recommendation: 'deferred',
      reasonCode: 'database_constraint_deferred_until_schema_rollout',
      risks: ['requires_schema_change', 'requires_duplicate_cleanup', 'requires_rollback_plan'],
      requiredPreconditions: ['nullable_column_plan', 'duplicate_audit', 'backfill_plan', 'rollback_plan'],
    };
  }
  return {
    type: 'email_job_idempotency_enforcement_point_plan',
    enforcementPoint: 'report_delivery_enqueue',
    recommendation: 'supporting',
    reasonCode: 'report_delivery_enqueue_supporting_shadow_scope',
    risks: ['caller_specific_policy_drift'],
    requiredPreconditions: ['hashed_recipient_policy', 'source_identity_policy'],
  };
}

export function buildPreferredEmailJobsServiceEnqueueEnforcementPlan(): EmailJobIdempotencyEnforcementPointPlan {
  return {
    type: 'email_job_idempotency_enforcement_point_plan',
    enforcementPoint: 'email_jobs_service_enqueue',
    recommendation: 'preferred',
    reasonCode: 'email_jobs_service_enqueue_preferred_service_boundary',
    risks: ['direct_insert_bypass_until_all_writers_use_service', 'race_condition_until_db_constraint'],
    requiredPreconditions: ['all_write_paths_identified', 'hashed_recipient_policy', 'duplicate_conflict_policy'],
  };
}

export function buildSupportingCallerEnforcementPlan(): EmailJobIdempotencyEnforcementPointPlan {
  return {
    type: 'email_job_idempotency_enforcement_point_plan',
    enforcementPoint: 'before_enqueue_caller',
    recommendation: 'supporting',
    reasonCode: 'caller_prevalidation_supporting_only',
    risks: ['policy_drift_between_callers', 'does_not_protect_direct_insert_paths'],
    requiredPreconditions: ['shared_candidate_builder', 'safe_noop_result_policy'],
  };
}

export function buildDirectInsertRiskEnforcementPlan(): EmailJobIdempotencyEnforcementPointPlan {
  return {
    type: 'email_job_idempotency_enforcement_point_plan',
    enforcementPoint: 'direct_internal_lead_notification_insert',
    recommendation: 'unsafe_primary',
    reasonCode: 'direct_insert_bypasses_service_boundary',
    risks: ['service_level_enforcement_bypass', 'duplicated_write_policy', 'harder_rollback'],
    requiredPreconditions: ['wrap_or_remove_direct_insert', 'unified_email_queue_write_path'],
  };
}

export function buildProcessPendingJobsUnsafePrimaryEnforcementPlan(): EmailJobIdempotencyEnforcementPointPlan {
  return {
    type: 'email_job_idempotency_enforcement_point_plan',
    enforcementPoint: 'process_pending_jobs',
    recommendation: 'unsafe_primary',
    reasonCode: 'process_pending_jobs_sees_duplicate_after_persistence',
    risks: ['duplicate_already_persisted', 'report_state_can_drift', 'retry_status_responsibility_mixing'],
    requiredPreconditions: ['keep_worker_status_focused', 'dedupe_before_persistence'],
  };
}

export function validateEmailJobEnforcementPointPlan(
  plan: unknown,
): EmailJobIdempotencyMigrationPlanValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_idempotency_enforcement_point_plan') {
    return invalid('invalid_enforcement_point', 'invalid_email_job_enforcement_point_plan');
  }
  if (!ENFORCEMENT_POINTS.has(record.enforcementPoint as EmailJobIdempotencyEnforcementPoint)) {
    return invalid('invalid_enforcement_point', 'invalid_email_job_enforcement_point');
  }
  if (!RECOMMENDATIONS.has(record.recommendation as EmailJobIdempotencyEnforcementPointRecommendation)) {
    return invalid('invalid_recommendation', 'invalid_email_job_enforcement_point_recommendation');
  }
  if (!hasText(record.reasonCode)) {
    return invalid('missing_reason_code', 'missing_email_job_enforcement_point_reason');
  }
  return { valid: true, reasonCode: record.reasonCode };
}

export function buildEmailJobIdempotencyMigrationPhase(
  phase: EmailJobIdempotencyMigrationPhaseName,
): EmailJobIdempotencyMigrationPhase {
  const selected = MIGRATION_PHASES.has(phase) ? phase : 'audit_only';
  const requiresDbMigration = ['nullable_column', 'unique_index_plan', 'db_enforcement'].includes(selected);
  const requiresDuplicateAudit = ['backfill_plan', 'unique_index_plan', 'db_enforcement'].includes(selected);
  const requiresRollbackPlan = ['unique_index_plan', 'db_enforcement', 'backfill_plan'].includes(selected);
  return {
    type: 'email_job_idempotency_migration_phase',
    phase: selected,
    status: 'proposed_only',
    order: PHASE_ORDER[selected],
    reasonCode: `email_job_idempotency_${selected}_proposed_only`,
    requiresRollbackPlan,
    requiresDbMigration,
    requiresDuplicateAudit,
  };
}

export function buildEmailJobIdempotencyMigrationPlan(): readonly EmailJobIdempotencyMigrationPhase[] {
  return [
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
  ].map((phase) => buildEmailJobIdempotencyMigrationPhase(phase as EmailJobIdempotencyMigrationPhaseName));
}

export function validateEmailJobIdempotencyMigrationPhase(
  phase: unknown,
): EmailJobIdempotencyMigrationPlanValidationResult {
  const record = asRecord(phase);
  if (!record || record.type !== 'email_job_idempotency_migration_phase') {
    return invalid('invalid_migration_phase', 'invalid_email_job_idempotency_migration_phase');
  }
  if (!MIGRATION_PHASES.has(record.phase as EmailJobIdempotencyMigrationPhaseName)) {
    return invalid('invalid_migration_phase', 'unknown_email_job_idempotency_migration_phase');
  }
  if (record.status !== 'proposed_only') {
    return invalid('invalid_migration_phase', 'email_job_idempotency_phase_must_be_proposed_only');
  }
  if (!isNonNegativeNumber(record.order) || record.order !== PHASE_ORDER[record.phase as EmailJobIdempotencyMigrationPhaseName]) {
    return invalid('invalid_migration_phase', 'invalid_email_job_idempotency_phase_order');
  }
  if (!hasText(record.reasonCode)) {
    return invalid('missing_reason_code', 'missing_email_job_idempotency_phase_reason');
  }
  return { valid: true, reasonCode: record.reasonCode };
}

export function validateEmailJobIdempotencyMigrationPhaseOrder(
  phases: readonly EmailJobIdempotencyMigrationPhase[],
): EmailJobIdempotencyMigrationPlanValidationResult {
  if (!Array.isArray(phases) || phases.length === 0) {
    return invalid('invalid_phase_order', 'missing_email_job_idempotency_phase_order');
  }
  for (const phase of phases) {
    const validation = validateEmailJobIdempotencyMigrationPhase(phase);
    if (!validation.valid) {
      return validation;
    }
  }
  const orderByPhase = new Map(phases.map((phase) => [phase.phase, phase.order]));
  const hasBefore = (
    earlier: EmailJobIdempotencyMigrationPhaseName,
    later: EmailJobIdempotencyMigrationPhaseName,
  ) => (orderByPhase.get(earlier) ?? Number.POSITIVE_INFINITY) < (orderByPhase.get(later) ?? Number.NEGATIVE_INFINITY);
  if (!hasBefore('audit_only', 'shadow_key_generation')) {
    return invalid('invalid_phase_order', 'audit_must_precede_shadow_key_generation');
  }
  if (!hasBefore('shadow_key_generation', 'write_new_keys')) {
    return invalid('invalid_phase_order', 'shadow_key_generation_must_precede_write_new_keys');
  }
  if (!hasBefore('duplicate_audit', 'unique_index_plan')) {
    return invalid('invalid_phase_order', 'duplicate_audit_must_precede_unique_index_plan');
  }
  if (!hasBefore('rollback_plan', 'db_enforcement')) {
    return invalid('db_enforcement_preconditions_missing', 'rollback_plan_must_precede_db_enforcement');
  }
  if (!orderByPhase.has('duplicate_audit') || !orderByPhase.has('rollback_plan')) {
    return invalid('db_enforcement_preconditions_missing', 'db_enforcement_requires_duplicate_audit_and_rollback_plan');
  }
  return { valid: true, reasonCode: 'email_job_idempotency_phase_order_valid' };
}

export function buildEmailJobUniqueIndexPlan(
  indexScope: EmailJobIdempotencyUniqueIndexScope,
): EmailJobIdempotencyUniqueIndexPlan {
  const scope = UNIQUE_INDEX_SCOPES.has(indexScope) ? indexScope : 'app_only_no_db_index';
  const usesDbIndex = scope !== 'app_only_no_db_index';
  return {
    type: 'email_job_idempotency_unique_index_plan',
    indexScope: scope,
    status: 'proposed_only',
    requiresDuplicateCleanup: usesDbIndex,
    requiresBackfill: scope === 'all_email_jobs' || scope === 'by_kind' || scope === 'partial_by_kind',
    requiresRollbackPlan: usesDbIndex,
    reasonCode: `email_job_idempotency_${scope}_unique_index_plan_proposed_only`,
  };
}

export function validateEmailJobUniqueIndexPlan(
  plan: unknown,
): EmailJobIdempotencyMigrationPlanValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_idempotency_unique_index_plan') {
    return invalid('invalid_unique_index_plan', 'invalid_email_job_unique_index_plan');
  }
  if (!UNIQUE_INDEX_SCOPES.has(record.indexScope as EmailJobIdempotencyUniqueIndexScope) || record.status !== 'proposed_only') {
    return invalid('invalid_unique_index_plan', 'invalid_email_job_unique_index_scope');
  }
  if (!hasText(record.reasonCode)) {
    return invalid('missing_reason_code', 'missing_email_job_unique_index_reason');
  }
  if (
    record.indexScope !== 'app_only_no_db_index'
    && (
      record.requiresDuplicateCleanup !== true
      || record.requiresRollbackPlan !== true
    )
  ) {
    return invalid('invalid_unique_index_plan', 'db_index_requires_cleanup_and_rollback_plan');
  }
  return { valid: true, reasonCode: record.reasonCode };
}

export function buildEmailJobBackfillPlan(
  targetRows: EmailJobIdempotencyBackfillTargetRows,
): EmailJobIdempotencyBackfillPlan {
  const target = BACKFILL_TARGETS.has(targetRows) ? targetRows : 'unknown_until_db_audit';
  const targetUnknown = target === 'unknown_until_db_audit';
  const legacyOrUnknown = target === 'legacy_email_jobs' || targetUnknown;
  return {
    type: 'email_job_idempotency_backfill_plan',
    status: 'proposed_only',
    targetRows: target,
    requiresDbAudit: true,
    requiresPiiHashingPlan: legacyOrUnknown || target === 'lead_jobs_only' || target === 'report_jobs_only',
    requiresDuplicateCleanup: legacyOrUnknown,
    blocksEnforcement: targetUnknown,
    reasonCode: `email_job_idempotency_${target}_backfill_plan_proposed_only`,
  };
}

export function validateEmailJobBackfillPlan(
  plan: unknown,
): EmailJobIdempotencyMigrationPlanValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_idempotency_backfill_plan') {
    return invalid('invalid_backfill_plan', 'invalid_email_job_backfill_plan');
  }
  if (!BACKFILL_TARGETS.has(record.targetRows as EmailJobIdempotencyBackfillTargetRows) || record.status !== 'proposed_only') {
    return invalid('invalid_backfill_plan', 'invalid_email_job_backfill_target');
  }
  if (!hasText(record.reasonCode)) {
    return invalid('missing_reason_code', 'missing_email_job_backfill_reason');
  }
  if (record.requiresDbAudit !== true || record.requiresPiiHashingPlan !== true) {
    return invalid('invalid_backfill_plan', 'backfill_requires_db_audit_and_pii_hashing_plan');
  }
  if (record.targetRows === 'unknown_until_db_audit' && record.blocksEnforcement !== true) {
    return invalid('invalid_backfill_plan', 'unknown_backfill_scope_must_block_enforcement');
  }
  return { valid: true, reasonCode: record.reasonCode };
}

export function buildEmailJobDuplicateConflictPolicy(
  duplicateStatus: EmailJobDuplicateStatus,
): EmailJobDuplicateConflictPolicy {
  const status = DUPLICATE_STATUSES.has(duplicateStatus) ? duplicateStatus : 'unknown';
  if (status === 'queued' || status === 'processing' || status === 'sent') {
    return {
      type: 'email_job_duplicate_conflict_policy',
      duplicateStatus: status,
      decision: 'skip_noop',
      reasonCode: `email_job_duplicate_${status}_skip_noop`,
    };
  }
  if (status === 'failed') {
    return {
      type: 'email_job_duplicate_conflict_policy',
      duplicateStatus: status,
      decision: 'manual_review_required',
      reasonCode: 'email_job_duplicate_failed_requires_manual_review',
    };
  }
  return {
    type: 'email_job_duplicate_conflict_policy',
    duplicateStatus: 'unknown',
    decision: 'block',
    reasonCode: 'email_job_duplicate_unknown_blocks_enforcement',
  };
}

export function validateEmailJobDuplicateConflictPolicy(
  policy: unknown,
): EmailJobIdempotencyMigrationPlanValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_duplicate_conflict_policy') {
    return invalid('invalid_duplicate_conflict_policy', 'invalid_email_job_duplicate_conflict_policy');
  }
  if (!DUPLICATE_STATUSES.has(record.duplicateStatus as EmailJobDuplicateStatus)) {
    return invalid('invalid_duplicate_conflict_policy', 'invalid_email_job_duplicate_status');
  }
  if (!['skip_noop', 'allow_recreate', 'block', 'manual_review_required'].includes(String(record.decision))) {
    return invalid('invalid_duplicate_conflict_policy', 'invalid_email_job_duplicate_decision');
  }
  if (!hasText(record.reasonCode)) {
    return invalid('missing_reason_code', 'missing_email_job_duplicate_conflict_reason');
  }
  if (record.duplicateStatus === 'unknown' && record.decision !== 'block' && record.decision !== 'manual_review_required') {
    return invalid('invalid_duplicate_conflict_policy', 'unknown_duplicate_must_block_or_require_manual_review');
  }
  return { valid: true, reasonCode: record.reasonCode };
}

export function buildEmailJobRollbackPlan(
  rollbackScope: EmailJobIdempotencyRollbackScope,
): EmailJobIdempotencyRollbackPlan {
  const scope = ROLLBACK_SCOPES.has(rollbackScope) ? rollbackScope : 'manual_recovery';
  const requiresDbRollback = scope === 'db_migration' || scope === 'index_drop' || scope === 'backfill_reversal';
  const requiresBackup = requiresDbRollback || scope === 'manual_recovery';
  return {
    type: 'email_job_idempotency_rollback_plan',
    rollbackScope: scope,
    status: 'proposed_only',
    requiresDbRollback,
    requiresBackup,
    reasonCode: `email_job_idempotency_${scope}_rollback_plan_proposed_only`,
  };
}

export function validateEmailJobRollbackPlan(
  plan: unknown,
): EmailJobIdempotencyMigrationPlanValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_idempotency_rollback_plan') {
    return invalid('invalid_rollback_plan', 'invalid_email_job_rollback_plan');
  }
  if (!ROLLBACK_SCOPES.has(record.rollbackScope as EmailJobIdempotencyRollbackScope) || record.status !== 'proposed_only') {
    return invalid('invalid_rollback_plan', 'invalid_email_job_rollback_scope');
  }
  if (!hasText(record.reasonCode)) {
    return invalid('missing_reason_code', 'missing_email_job_rollback_reason');
  }
  if (
    ['db_migration', 'index_drop', 'backfill_reversal'].includes(String(record.rollbackScope))
    && record.requiresDbRollback !== true
  ) {
    return invalid('invalid_rollback_plan', 'db_rollback_scope_requires_db_rollback_plan');
  }
  return { valid: true, reasonCode: record.reasonCode };
}

export function buildReadyEmailJobIdempotencyMigrationPlanResult(
  plan: EmailJobIdempotencyMigrationPlanItem,
): EmailJobIdempotencyMigrationPlanResult {
  const validation = validateEmailJobIdempotencyMigrationPlanItem(plan);
  if (!validation.valid) {
    return buildBlockedEmailJobIdempotencyMigrationPlanResult(validation.reasonCode, validation.errorCode);
  }
  return {
    status: 'ready',
    reasonCode: validation.reasonCode,
    plan,
  };
}

export function buildSkippedEmailJobIdempotencyMigrationPlanResult(
  reasonCode: string,
): EmailJobIdempotencyMigrationPlanResult {
  return {
    status: 'skipped',
    reasonCode: reasonCode || 'email_job_idempotency_migration_plan_skipped',
  };
}

export function buildBlockedEmailJobIdempotencyMigrationPlanResult(
  reasonCode: string,
  errorCode: EmailJobIdempotencyMigrationPlanErrorCode = 'unknown_email_job_idempotency_migration_plan_error',
): EmailJobIdempotencyMigrationPlanResult {
  return {
    status: 'blocked',
    reasonCode: reasonCode || 'email_job_idempotency_migration_plan_blocked',
    errorCode,
  };
}

export function buildFailedEmailJobIdempotencyMigrationPlanResult(
  reasonCode: string,
  errorCode: EmailJobIdempotencyMigrationPlanErrorCode = 'unknown_email_job_idempotency_migration_plan_error',
  retryable = false,
): EmailJobIdempotencyMigrationPlanResult {
  return {
    status: 'failed',
    reasonCode: reasonCode || 'email_job_idempotency_migration_plan_failed',
    errorCode,
    retryable: Boolean(retryable),
  };
}

export function isReadyEmailJobIdempotencyMigrationPlanResult(
  result: unknown,
): result is Extract<EmailJobIdempotencyMigrationPlanResult, { status: 'ready' }> {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobIdempotencyMigrationPlanResult(
  result: unknown,
): result is Extract<EmailJobIdempotencyMigrationPlanResult, { status: 'skipped' }> {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobIdempotencyMigrationPlanResult(
  result: unknown,
): result is Extract<EmailJobIdempotencyMigrationPlanResult, { status: 'blocked' }> {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobIdempotencyMigrationPlanResult(
  result: unknown,
): result is Extract<EmailJobIdempotencyMigrationPlanResult, { status: 'failed' }> {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobEnforcementPointPlanForLog(
  plan: EmailJobIdempotencyEnforcementPointPlan,
): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobMigrationPhaseForLog(
  phase: EmailJobIdempotencyMigrationPhase,
): JsonRecord {
  return sanitizeForSafeProjection(phase) as JsonRecord;
}

export function buildSafeEmailJobUniqueIndexPlanForLog(
  plan: EmailJobIdempotencyUniqueIndexPlan,
): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobBackfillPlanForLog(
  plan: EmailJobIdempotencyBackfillPlan,
): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobDuplicateConflictPolicyForLog(
  policy: EmailJobDuplicateConflictPolicy,
): JsonRecord {
  return sanitizeForSafeProjection(policy) as JsonRecord;
}

export function buildSafeEmailJobRollbackPlanForLog(
  plan: EmailJobIdempotencyRollbackPlan,
): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobIdempotencyMigrationPlanResultForLog(
  result: EmailJobIdempotencyMigrationPlanResult,
): JsonRecord {
  return sanitizeForSafeProjection(result) as JsonRecord;
}

export function buildSafeEmailJobIdempotencyMigrationPlanResultForAudit(
  result: EmailJobIdempotencyMigrationPlanResult,
): JsonRecord {
  return sanitizeForSafeProjection(result) as JsonRecord;
}

export function validateEmailJobIdempotencyMigrationPlanItem(
  plan: unknown,
): EmailJobIdempotencyMigrationPlanValidationResult {
  const record = asRecord(plan);
  if (!record || !hasText(record.type)) {
    return invalid('missing_plan', 'missing_email_job_idempotency_migration_plan_item');
  }
  if (record.type === 'email_job_idempotency_enforcement_point_plan') {
    return validateEmailJobEnforcementPointPlan(plan);
  }
  if (record.type === 'email_job_idempotency_migration_phase') {
    return validateEmailJobIdempotencyMigrationPhase(plan);
  }
  if (record.type === 'email_job_idempotency_unique_index_plan') {
    return validateEmailJobUniqueIndexPlan(plan);
  }
  if (record.type === 'email_job_idempotency_backfill_plan') {
    return validateEmailJobBackfillPlan(plan);
  }
  if (record.type === 'email_job_duplicate_conflict_policy') {
    return validateEmailJobDuplicateConflictPolicy(plan);
  }
  if (record.type === 'email_job_idempotency_rollback_plan') {
    return validateEmailJobRollbackPlan(plan);
  }
  return invalid('missing_plan', 'unknown_email_job_idempotency_migration_plan_item');
}

function readStatus(result: unknown): string | undefined {
  return asRecord(result)?.status as string | undefined;
}

function invalid(
  errorCode: EmailJobIdempotencyMigrationPlanErrorCode,
  reasonCode: string,
): EmailJobIdempotencyMigrationPlanValidationResult {
  return { valid: false, reasonCode, errorCode };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function sanitizeForSafeProjection(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForSafeProjection(item));
  }
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  const output: JsonRecord = {};
  for (const [key, rawValue] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (SENSITIVE_KEYS.has(normalized)) {
      output[key] = rawValue ? REDACTED : rawValue;
      continue;
    }
    if (PRIVATE_CONTENT_KEYS.has(normalized)) {
      output[key] = OMITTED;
      continue;
    }
    output[key] = sanitizeForSafeProjection(rawValue);
  }
  return output;
}
