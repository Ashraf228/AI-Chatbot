import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobDuplicateReadOnlyDbAuditTarget =
  | 'staging'
  | 'production'
  | 'unknown';

export type EmailJobDuplicateReadOnlyDbAuditQueryClass =
  | 'aggregate_by_status_kind'
  | 'duplicate_by_report_run'
  | 'duplicate_by_source_metadata'
  | 'duplicate_by_recipient_fingerprint'
  | 'duplicate_by_content_fingerprint'
  | 'status_bucket_scan'
  | 'time_window_scan'
  | 'failed_retry_ambiguity'
  | 'processing_stale_ambiguity';

export type EmailJobDuplicateReadOnlyDbAuditPreconditionName =
  | 'db_target_confirmed'
  | 'read_only_role_required'
  | 'production_read_approval_required'
  | 'no_select_star'
  | 'limit_required'
  | 'time_window_required'
  | 'query_timeout_required'
  | 'sanitized_output_review_required'
  | 'no_committed_results'
  | 'no_raw_pii_output'
  | 'no_cleanup_or_write_actions';

export type EmailJobDuplicateReadOnlyDbAuditRiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type EmailJobDuplicateReadOnlyDbAuditOutputMode =
  | 'aggregate_counts_only'
  | 'status_buckets_only'
  | 'risk_group_counts_only'
  | 'pseudonymized_fingerprints_only'
  | 'manual_review_summary_only'
  | 'blocked_raw_output';

export type EmailJobDuplicateReadOnlyDbAuditApprovalType =
  | 'docs_only'
  | 'staging_read'
  | 'production_read'
  | 'pii_fingerprinting'
  | 'report_generation'
  | 'cleanup'
  | 'backfill'
  | 'migration_index'
  | 'enforcement';

export type EmailJobDuplicateReadOnlyDbAuditPrecondition = {
  type: 'email_job_duplicate_readonly_db_audit_precondition';
  version: 'v1';
  name: EmailJobDuplicateReadOnlyDbAuditPreconditionName;
  required: true;
  blocksExecutionWithoutApproval: true;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyDbAuditQueryStep = {
  type: 'email_job_duplicate_readonly_db_audit_query_step';
  version: 'v1';
  queryClass: EmailJobDuplicateReadOnlyDbAuditQueryClass;
  status: 'proposed_only';
  order: number;
  target: EmailJobDuplicateReadOnlyDbAuditTarget;
  outputMode: EmailJobDuplicateReadOnlyDbAuditOutputMode;
  piiRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  performanceRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  requiresExplicitApproval: true;
  requiresTimeWindow: boolean;
  requiresLimit: true;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyDbAuditApprovalGate = {
  type: 'email_job_duplicate_readonly_db_audit_approval_gate';
  version: 'v1';
  approvalType: EmailJobDuplicateReadOnlyDbAuditApprovalType;
  required: boolean;
  grantedByBoundary: false;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyDbAuditOutputPolicy = {
  type: 'email_job_duplicate_readonly_db_audit_output_policy';
  version: 'v1';
  mode: EmailJobDuplicateReadOnlyDbAuditOutputMode;
  allowsAggregateCounts: boolean;
  allowsPseudonymizedFingerprints: boolean;
  allowsRawRecipientEmail: false;
  allowsSubject: false;
  allowsHtml: false;
  allowsText: false;
  allowsBody: false;
  allowsFullMetadata: false;
  allowsLastError: false;
  allowsRowDump: false;
  allowsCsvExport: false;
  allowsJsonExport: false;
  allowsCommittedReport: false;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyDbAuditRiskAssessment = {
  type: 'email_job_duplicate_readonly_db_audit_risk_assessment';
  version: 'v1';
  queryClass: EmailJobDuplicateReadOnlyDbAuditQueryClass;
  piiRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  performanceRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  loadRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  requiresManualApproval: true;
  requiresTimeWindow: boolean;
  requiresLimit: true;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyDbAuditExecutionPlan = {
  type: 'email_job_duplicate_readonly_db_audit_execution_plan';
  version: 'v1';
  status: 'proposed_only';
  target: EmailJobDuplicateReadOnlyDbAuditTarget;
  steps: readonly EmailJobDuplicateReadOnlyDbAuditQueryStep[];
  preconditions: readonly EmailJobDuplicateReadOnlyDbAuditPrecondition[];
  approvalGates: readonly EmailJobDuplicateReadOnlyDbAuditApprovalGate[];
  outputPolicy: EmailJobDuplicateReadOnlyDbAuditOutputPolicy;
  riskAssessment: EmailJobDuplicateReadOnlyDbAuditRiskAssessment;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyDbAuditExecutionPlanItem =
  | EmailJobDuplicateReadOnlyDbAuditExecutionPlan
  | EmailJobDuplicateReadOnlyDbAuditPrecondition
  | EmailJobDuplicateReadOnlyDbAuditQueryStep
  | EmailJobDuplicateReadOnlyDbAuditApprovalGate
  | EmailJobDuplicateReadOnlyDbAuditOutputPolicy
  | EmailJobDuplicateReadOnlyDbAuditRiskAssessment;

export type ReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult = {
  status: 'ready';
  reasonCode: string;
  plan: EmailJobDuplicateReadOnlyDbAuditExecutionPlanItem;
};

export type SkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobDuplicateReadOnlyDbAuditExecutionErrorCode;
};

export type FailedEmailJobDuplicateReadOnlyDbAuditExecutionResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobDuplicateReadOnlyDbAuditExecutionErrorCode;
  retryable: boolean;
};

export type EmailJobDuplicateReadOnlyDbAuditExecutionResult =
  | ReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult
  | SkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult
  | BlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult
  | FailedEmailJobDuplicateReadOnlyDbAuditExecutionResult;

export type EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult =
  | { valid: true; reasonCode: string }
  | {
      valid: false;
      reasonCode: string;
      errorCode: EmailJobDuplicateReadOnlyDbAuditExecutionErrorCode;
    };

export type EmailJobDuplicateReadOnlyDbAuditExecutionErrorCode =
  | 'missing_plan'
  | 'missing_reason_code'
  | 'invalid_target'
  | 'invalid_query_class'
  | 'invalid_precondition'
  | 'invalid_precondition_name'
  | 'invalid_query_step'
  | 'invalid_query_step_order'
  | 'invalid_approval_gate'
  | 'invalid_output_policy'
  | 'invalid_risk_assessment'
  | 'invalid_execution_plan'
  | 'invalid_result'
  | 'unsupported_plan_type'
  | 'invalid_output_mode'
  | 'invalid_risk_level'
  | 'production_target_requires_production_read_approval'
  | 'recipient_fingerprint_requires_pii_approval'
  | 'content_fingerprint_remains_blocked'
  | 'time_window_required'
  | 'limit_required'
  | 'unknown_email_job_duplicate_readonly_db_audit_execution_error';

type JsonRecord = Record<string, unknown>;

type QueryStepDefinition = {
  order: number;
  outputMode: EmailJobDuplicateReadOnlyDbAuditOutputMode;
  piiRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  performanceRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  loadRisk: EmailJobDuplicateReadOnlyDbAuditRiskLevel;
  requiresTimeWindow: boolean;
  reasonCode: string;
};

const TARGETS = new Set<EmailJobDuplicateReadOnlyDbAuditTarget>([
  'staging',
  'production',
  'unknown',
]);
const QUERY_CLASSES = new Set<EmailJobDuplicateReadOnlyDbAuditQueryClass>([
  'aggregate_by_status_kind',
  'duplicate_by_report_run',
  'duplicate_by_source_metadata',
  'duplicate_by_recipient_fingerprint',
  'duplicate_by_content_fingerprint',
  'status_bucket_scan',
  'time_window_scan',
  'failed_retry_ambiguity',
  'processing_stale_ambiguity',
]);
const PRECONDITION_NAMES = new Set<EmailJobDuplicateReadOnlyDbAuditPreconditionName>([
  'db_target_confirmed',
  'read_only_role_required',
  'production_read_approval_required',
  'no_select_star',
  'limit_required',
  'time_window_required',
  'query_timeout_required',
  'sanitized_output_review_required',
  'no_committed_results',
  'no_raw_pii_output',
  'no_cleanup_or_write_actions',
]);
const RISK_LEVELS = new Set<EmailJobDuplicateReadOnlyDbAuditRiskLevel>([
  'low',
  'medium',
  'high',
  'blocked',
]);
const OUTPUT_MODES = new Set<EmailJobDuplicateReadOnlyDbAuditOutputMode>([
  'aggregate_counts_only',
  'status_buckets_only',
  'risk_group_counts_only',
  'pseudonymized_fingerprints_only',
  'manual_review_summary_only',
  'blocked_raw_output',
]);
const APPROVAL_TYPES = new Set<EmailJobDuplicateReadOnlyDbAuditApprovalType>([
  'docs_only',
  'staging_read',
  'production_read',
  'pii_fingerprinting',
  'report_generation',
  'cleanup',
  'backfill',
  'migration_index',
  'enforcement',
]);
const DEFAULT_BLOCKED_REASON = 'email_job_duplicate_readonly_db_audit_execution_blocked';
const DEFAULT_FAILED_REASON = 'email_job_duplicate_readonly_db_audit_execution_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_duplicate_readonly_db_audit_execution_skipped';
const REDACTED = '[redacted]';
const OMITTED = '[omitted]';
const SECRET_KEYS = new Set([
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
const RAW_CONTENT_KEYS = new Set([
  'recipientemail',
  'recipient_email',
  'email',
  'to',
  'subject',
  'html',
  'text',
  'body',
  'payload',
  'metadata',
  'rowdump',
  'row_dump',
  'lasterror',
  'last_error',
  'providererror',
  'provider_error',
  'errormessage',
  'error_message',
  'queryresults',
  'query_results',
  'reportpath',
  'report_path',
  'csvexport',
  'csv_export',
  'jsonexport',
  'json_export',
  'sql',
]);
const IDENTIFIER_KEYS = new Set([
  'tenantid',
  'siteid',
  'conversationid',
  'sessionid',
  'leadid',
  'contactrequestid',
  'reportrunid',
]);

const QUERY_STEP_DEFINITIONS: Record<EmailJobDuplicateReadOnlyDbAuditQueryClass, QueryStepDefinition> = {
  aggregate_by_status_kind: {
    order: 1,
    outputMode: 'aggregate_counts_only',
    piiRisk: 'low',
    performanceRisk: 'low',
    loadRisk: 'low',
    requiresTimeWindow: true,
    reasonCode: 'aggregate_status_kind_db_audit_query_step',
  },
  status_bucket_scan: {
    order: 2,
    outputMode: 'status_buckets_only',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'low',
    requiresTimeWindow: true,
    reasonCode: 'status_bucket_db_audit_query_step',
  },
  time_window_scan: {
    order: 3,
    outputMode: 'aggregate_counts_only',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresTimeWindow: true,
    reasonCode: 'time_window_db_audit_query_step',
  },
  duplicate_by_report_run: {
    order: 4,
    outputMode: 'aggregate_counts_only',
    piiRisk: 'medium',
    performanceRisk: 'high',
    loadRisk: 'medium',
    requiresTimeWindow: true,
    reasonCode: 'report_run_duplicate_db_audit_query_step',
  },
  duplicate_by_source_metadata: {
    order: 5,
    outputMode: 'risk_group_counts_only',
    piiRisk: 'medium',
    performanceRisk: 'high',
    loadRisk: 'high',
    requiresTimeWindow: true,
    reasonCode: 'source_metadata_duplicate_db_audit_query_step',
  },
  failed_retry_ambiguity: {
    order: 6,
    outputMode: 'manual_review_summary_only',
    piiRisk: 'medium',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresTimeWindow: true,
    reasonCode: 'failed_retry_ambiguity_db_audit_query_step',
  },
  processing_stale_ambiguity: {
    order: 7,
    outputMode: 'manual_review_summary_only',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresTimeWindow: true,
    reasonCode: 'processing_stale_ambiguity_db_audit_query_step',
  },
  duplicate_by_recipient_fingerprint: {
    order: 8,
    outputMode: 'pseudonymized_fingerprints_only',
    piiRisk: 'high',
    performanceRisk: 'medium',
    loadRisk: 'high',
    requiresTimeWindow: true,
    reasonCode: 'recipient_fingerprint_duplicate_db_audit_query_step',
  },
  duplicate_by_content_fingerprint: {
    order: 9,
    outputMode: 'blocked_raw_output',
    piiRisk: 'blocked',
    performanceRisk: 'blocked',
    loadRisk: 'blocked',
    requiresTimeWindow: true,
    reasonCode: 'content_fingerprint_duplicate_db_audit_query_step',
  },
};

export function buildDbTargetConfirmedPrecondition(
  reasonCode = 'db_target_confirmation_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('db_target_confirmed', reasonCode);
}

export function buildReadOnlyRoleRequiredPrecondition(
  reasonCode = 'read_only_role_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('read_only_role_required', reasonCode);
}

export function buildProductionReadApprovalRequiredPrecondition(
  reasonCode = 'production_read_approval_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('production_read_approval_required', reasonCode);
}

export function buildNoSelectStarPrecondition(
  reasonCode = 'no_select_star_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('no_select_star', reasonCode);
}

export function buildLimitRequiredPrecondition(
  reasonCode = 'query_limit_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('limit_required', reasonCode);
}

export function buildTimeWindowRequiredPrecondition(
  reasonCode = 'time_window_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('time_window_required', reasonCode);
}

export function buildQueryTimeoutRequiredPrecondition(
  reasonCode = 'query_timeout_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('query_timeout_required', reasonCode);
}

export function buildSanitizedOutputReviewRequiredPrecondition(
  reasonCode = 'sanitized_output_review_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('sanitized_output_review_required', reasonCode);
}

export function buildNoCommittedResultsPrecondition(
  reasonCode = 'no_committed_results_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('no_committed_results', reasonCode);
}

export function buildNoRawPiiOutputPrecondition(
  reasonCode = 'no_raw_pii_output_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('no_raw_pii_output', reasonCode);
}

export function buildNoCleanupOrWriteActionsPrecondition(
  reasonCode = 'no_cleanup_or_write_actions_required',
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return buildPrecondition('no_cleanup_or_write_actions', reasonCode);
}

export function validateEmailJobDuplicateReadOnlyDbAuditPrecondition(
  precondition: unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  const record = asRecord(precondition);
  if (!record || record.type !== 'email_job_duplicate_readonly_db_audit_precondition') {
    return invalid('invalid_precondition', 'invalid_email_job_duplicate_readonly_db_audit_precondition');
  }

  if (
    record.version !== 'v1'
    || !isPreconditionName(record.name)
    || record.required !== true
    || record.blocksExecutionWithoutApproval !== true
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_precondition',
      'invalid_email_job_duplicate_readonly_db_audit_precondition_shape',
    );
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildAggregateStatusKindDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.aggregate_by_status_kind.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('aggregate_by_status_kind', target, reasonCode);
}

export function buildReportRunDuplicateDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.duplicate_by_report_run.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('duplicate_by_report_run', target, reasonCode);
}

export function buildSourceMetadataDuplicateDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.duplicate_by_source_metadata.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('duplicate_by_source_metadata', target, reasonCode);
}

export function buildRecipientFingerprintDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.duplicate_by_recipient_fingerprint.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('duplicate_by_recipient_fingerprint', target, reasonCode);
}

export function buildContentFingerprintDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.duplicate_by_content_fingerprint.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('duplicate_by_content_fingerprint', target, reasonCode);
}

export function buildStatusBucketDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.status_bucket_scan.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('status_bucket_scan', target, reasonCode);
}

export function buildTimeWindowDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.time_window_scan.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('time_window_scan', target, reasonCode);
}

export function buildFailedRetryAmbiguityDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.failed_retry_ambiguity.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('failed_retry_ambiguity', target, reasonCode);
}

export function buildProcessingStaleAmbiguityDbAuditQueryStep(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = QUERY_STEP_DEFINITIONS.processing_stale_ambiguity.reasonCode,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  return buildQueryStep('processing_stale_ambiguity', target, reasonCode);
}

export function validateEmailJobDuplicateReadOnlyDbAuditQueryStep(
  step: unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  const record = asRecord(step);
  if (!record || record.type !== 'email_job_duplicate_readonly_db_audit_query_step') {
    return invalid('invalid_query_step', 'invalid_email_job_duplicate_readonly_db_audit_query_step');
  }

  if (
    record.version !== 'v1'
    || record.status !== 'proposed_only'
    || !isQueryClass(record.queryClass)
    || !isTarget(record.target)
    || !isOutputMode(record.outputMode)
    || !isRiskLevel(record.piiRisk)
    || !isRiskLevel(record.performanceRisk)
    || !isValidPositiveInteger(record.order)
    || record.requiresExplicitApproval !== true
    || typeof record.requiresTimeWindow !== 'boolean'
    || record.requiresLimit !== true
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_query_step',
      'invalid_email_job_duplicate_readonly_db_audit_query_step_shape',
    );
  }

  if (!matchesQueryStepDefinition(record as EmailJobDuplicateReadOnlyDbAuditQueryStep)) {
    return invalid(
      'invalid_query_step',
      'db_audit_query_step_does_not_match_documented_boundary',
    );
  }

  if (
    record.queryClass === 'duplicate_by_content_fingerprint'
    && (
      record.outputMode !== 'blocked_raw_output'
      || record.piiRisk !== 'blocked'
      || record.performanceRisk !== 'blocked'
    )
  ) {
    return invalid(
      'content_fingerprint_remains_blocked',
      'content_fingerprint_db_audit_query_step_must_remain_blocked',
    );
  }

  if (
    record.queryClass === 'duplicate_by_recipient_fingerprint'
    && record.piiRisk !== 'high'
  ) {
    return invalid(
      'recipient_fingerprint_requires_pii_approval',
      'recipient_fingerprint_db_audit_query_step_must_be_high_pii',
    );
  }

  if (record.requiresTimeWindow !== true) {
    return invalid('time_window_required', 'db_audit_query_step_requires_time_window');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildDocsOnlyDbAuditApprovalGate(
  reasonCode = 'docs_only_db_audit_planning_does_not_grant_runtime_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('docs_only', false, reasonCode);
}

export function buildStagingReadDbAuditApprovalGate(
  reasonCode = 'staging_read_requires_separate_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('staging_read', true, reasonCode);
}

export function buildProductionReadDbAuditApprovalGate(
  reasonCode = 'production_read_requires_explicit_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('production_read', true, reasonCode);
}

export function buildPiiFingerprintingDbAuditApprovalGate(
  reasonCode = 'pii_fingerprinting_requires_separate_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('pii_fingerprinting', true, reasonCode);
}

export function buildReportGenerationDbAuditApprovalGate(
  reasonCode = 'report_generation_requires_separate_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('report_generation', true, reasonCode);
}

export function buildCleanupDbAuditApprovalGate(
  reasonCode = 'cleanup_requires_separate_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('cleanup', true, reasonCode);
}

export function buildBackfillDbAuditApprovalGate(
  reasonCode = 'backfill_requires_separate_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('backfill', true, reasonCode);
}

export function buildMigrationIndexDbAuditApprovalGate(
  reasonCode = 'migration_index_requires_separate_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('migration_index', true, reasonCode);
}

export function buildEnforcementDbAuditApprovalGate(
  reasonCode = 'enforcement_requires_separate_approval',
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return buildApprovalGate('enforcement', true, reasonCode);
}

export function validateEmailJobDuplicateReadOnlyDbAuditApprovalGate(
  gate: unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  const record = asRecord(gate);
  if (!record || record.type !== 'email_job_duplicate_readonly_db_audit_approval_gate') {
    return invalid('invalid_approval_gate', 'invalid_email_job_duplicate_readonly_db_audit_approval_gate');
  }

  if (
    record.version !== 'v1'
    || !isApprovalType(record.approvalType)
    || typeof record.required !== 'boolean'
    || record.grantedByBoundary !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_approval_gate',
      'invalid_email_job_duplicate_readonly_db_audit_approval_gate_shape',
    );
  }

  if (record.approvalType !== 'docs_only' && record.required !== true) {
    return invalid(
      'invalid_approval_gate',
      'non_docs_db_audit_approval_gate_must_remain_required',
    );
  }

  if (record.approvalType === 'docs_only' && record.required !== false) {
    return invalid(
      'invalid_approval_gate',
      'docs_only_db_audit_approval_gate_must_not_be_required',
    );
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildAggregateCountsOnlyDbAuditOutputPolicy(
  reasonCode = 'aggregate_counts_only_db_audit_output_policy',
): EmailJobDuplicateReadOnlyDbAuditOutputPolicy {
  return buildOutputPolicy('aggregate_counts_only', true, false, reasonCode);
}

export function buildPseudonymizedFingerprintOnlyDbAuditOutputPolicy(
  reasonCode = 'pseudonymized_fingerprint_only_db_audit_output_policy',
): EmailJobDuplicateReadOnlyDbAuditOutputPolicy {
  return buildOutputPolicy('pseudonymized_fingerprints_only', true, true, reasonCode);
}

export function buildManualReviewSummaryOnlyDbAuditOutputPolicy(
  reasonCode = 'manual_review_summary_only_db_audit_output_policy',
): EmailJobDuplicateReadOnlyDbAuditOutputPolicy {
  return buildOutputPolicy('manual_review_summary_only', false, false, reasonCode);
}

export function buildBlockedRawOutputDbAuditOutputPolicy(
  reasonCode = 'blocked_raw_output_db_audit_output_policy',
): EmailJobDuplicateReadOnlyDbAuditOutputPolicy {
  return buildOutputPolicy('blocked_raw_output', false, false, reasonCode);
}

export function validateEmailJobDuplicateReadOnlyDbAuditOutputPolicy(
  policy: unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_duplicate_readonly_db_audit_output_policy') {
    return invalid(
      'invalid_output_policy',
      'invalid_email_job_duplicate_readonly_db_audit_output_policy',
    );
  }

  if (
    record.version !== 'v1'
    || !isOutputMode(record.mode)
    || typeof record.allowsAggregateCounts !== 'boolean'
    || typeof record.allowsPseudonymizedFingerprints !== 'boolean'
    || record.allowsRawRecipientEmail !== false
    || record.allowsSubject !== false
    || record.allowsHtml !== false
    || record.allowsText !== false
    || record.allowsBody !== false
    || record.allowsFullMetadata !== false
    || record.allowsLastError !== false
    || record.allowsRowDump !== false
    || record.allowsCsvExport !== false
    || record.allowsJsonExport !== false
    || record.allowsCommittedReport !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_output_policy',
      'invalid_email_job_duplicate_readonly_db_audit_output_policy_shape',
    );
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment(
  queryClass: EmailJobDuplicateReadOnlyDbAuditQueryClass,
  reasonCode?: string,
): EmailJobDuplicateReadOnlyDbAuditRiskAssessment {
  const definition = QUERY_STEP_DEFINITIONS[queryClass];
  return {
    type: 'email_job_duplicate_readonly_db_audit_risk_assessment',
    version: 'v1',
    queryClass,
    piiRisk: definition.piiRisk,
    performanceRisk: definition.performanceRisk,
    loadRisk: definition.loadRisk,
    requiresManualApproval: true,
    requiresTimeWindow: definition.requiresTimeWindow,
    requiresLimit: true,
    reasonCode: readText(reasonCode) || `${definition.reasonCode}_risk_assessment`,
  };
}

export function validateEmailJobDuplicateReadOnlyDbAuditRiskAssessment(
  assessment: unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  const record = asRecord(assessment);
  if (!record || record.type !== 'email_job_duplicate_readonly_db_audit_risk_assessment') {
    return invalid(
      'invalid_risk_assessment',
      'invalid_email_job_duplicate_readonly_db_audit_risk_assessment',
    );
  }

  if (
    record.version !== 'v1'
    || !isQueryClass(record.queryClass)
    || !isRiskLevel(record.piiRisk)
    || !isRiskLevel(record.performanceRisk)
    || !isRiskLevel(record.loadRisk)
    || record.requiresManualApproval !== true
    || typeof record.requiresTimeWindow !== 'boolean'
    || record.requiresLimit !== true
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_risk_assessment',
      'invalid_email_job_duplicate_readonly_db_audit_risk_assessment_shape',
    );
  }

  const definition = QUERY_STEP_DEFINITIONS[record.queryClass];
  if (
    record.piiRisk !== definition.piiRisk
    || record.performanceRisk !== definition.performanceRisk
    || record.loadRisk !== definition.loadRisk
    || record.requiresTimeWindow !== definition.requiresTimeWindow
  ) {
    return invalid(
      'invalid_risk_assessment',
      'db_audit_risk_assessment_does_not_match_documented_risks',
    );
  }

  if (record.queryClass === 'duplicate_by_recipient_fingerprint' && record.piiRisk !== 'high') {
    return invalid(
      'recipient_fingerprint_requires_pii_approval',
      'recipient_fingerprint_db_audit_risk_assessment_must_be_high_pii',
    );
  }

  if (
    record.queryClass === 'duplicate_by_content_fingerprint'
    && (record.piiRisk !== 'blocked' || record.performanceRisk !== 'blocked')
  ) {
    return invalid(
      'content_fingerprint_remains_blocked',
      'content_fingerprint_db_audit_risk_assessment_must_remain_blocked',
    );
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildProposedEmailJobDuplicateReadOnlyDbAuditExecutionPlan(
  target: EmailJobDuplicateReadOnlyDbAuditTarget = 'unknown',
  reasonCode = 'proposed_email_job_duplicate_readonly_db_audit_execution_plan',
): EmailJobDuplicateReadOnlyDbAuditExecutionPlan {
  const plan: EmailJobDuplicateReadOnlyDbAuditExecutionPlan = {
    type: 'email_job_duplicate_readonly_db_audit_execution_plan',
    version: 'v1',
    status: 'proposed_only',
    target: isTarget(target) ? target : 'unknown',
    steps: buildDefaultQuerySteps(isTarget(target) ? target : 'unknown'),
    preconditions: buildDefaultPreconditions(),
    approvalGates: buildDefaultApprovalGates(),
    outputPolicy: buildPseudonymizedFingerprintOnlyDbAuditOutputPolicy(),
    riskAssessment: buildEmailJobDuplicateReadOnlyDbAuditRiskAssessment('aggregate_by_status_kind'),
    reasonCode: readText(reasonCode) || 'proposed_email_job_duplicate_readonly_db_audit_execution_plan',
  };

  return plan;
}

export function validateEmailJobDuplicateReadOnlyDbAuditExecutionPlan(
  plan: unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_duplicate_readonly_db_audit_execution_plan') {
    return invalid(
      'invalid_execution_plan',
      'invalid_email_job_duplicate_readonly_db_audit_execution_plan',
    );
  }

  if (
    record.version !== 'v1'
    || record.status !== 'proposed_only'
    || !isTarget(record.target)
    || !Array.isArray(record.steps)
    || !Array.isArray(record.preconditions)
    || !Array.isArray(record.approvalGates)
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_execution_plan',
      'invalid_email_job_duplicate_readonly_db_audit_execution_plan_shape',
    );
  }

  if (record.steps.length === 0 || record.preconditions.length === 0 || record.approvalGates.length === 0) {
    return invalid(
      'invalid_execution_plan',
      'db_audit_execution_plan_requires_steps_preconditions_and_approval_gates',
    );
  }

  for (const step of record.steps) {
    const validation = validateEmailJobDuplicateReadOnlyDbAuditQueryStep(step);
    if (!validation.valid) {
      return validation;
    }
    if ((step as EmailJobDuplicateReadOnlyDbAuditQueryStep).target !== record.target) {
      return invalid(
        'invalid_execution_plan',
        'db_audit_execution_plan_step_target_must_match_plan_target',
      );
    }
  }

  const orderedSteps = [...record.steps]
    .map((step) => step as EmailJobDuplicateReadOnlyDbAuditQueryStep)
    .sort((left, right) => left.order - right.order);
  for (let index = 0; index < orderedSteps.length; index += 1) {
    if (orderedSteps[index]?.order !== index + 1) {
      return invalid('invalid_query_step_order', 'db_audit_execution_plan_step_order_must_be_contiguous');
    }
  }

  for (const precondition of record.preconditions) {
    const validation = validateEmailJobDuplicateReadOnlyDbAuditPrecondition(precondition);
    if (!validation.valid) {
      return validation;
    }
  }

  for (const gate of record.approvalGates) {
    const validation = validateEmailJobDuplicateReadOnlyDbAuditApprovalGate(gate);
    if (!validation.valid) {
      return validation;
    }
  }

  const outputPolicyValidation = validateEmailJobDuplicateReadOnlyDbAuditOutputPolicy(record.outputPolicy);
  if (!outputPolicyValidation.valid) {
    return outputPolicyValidation;
  }

  const riskAssessmentValidation = validateEmailJobDuplicateReadOnlyDbAuditRiskAssessment(record.riskAssessment);
  if (!riskAssessmentValidation.valid) {
    return riskAssessmentValidation;
  }

  const hasLimitPrecondition = hasPrecondition(record.preconditions, 'limit_required');
  if (!hasLimitPrecondition) {
    return invalid('limit_required', 'db_audit_execution_plan_requires_limit_precondition');
  }

  const hasTimeWindowPrecondition = hasPrecondition(record.preconditions, 'time_window_required');
  if (!hasTimeWindowPrecondition) {
    return invalid('time_window_required', 'db_audit_execution_plan_requires_time_window_precondition');
  }

  const hasProductionGate = hasApprovalGate(record.approvalGates, 'production_read', true);
  if (!hasProductionGate) {
    return invalid(
      'production_target_requires_production_read_approval',
      'db_audit_execution_plan_requires_production_read_approval_gate',
    );
  }

  const includesRecipientFingerprint = record.steps.some(
    (step) => (step as EmailJobDuplicateReadOnlyDbAuditQueryStep).queryClass === 'duplicate_by_recipient_fingerprint',
  );
  if (
    includesRecipientFingerprint
    && !hasApprovalGate(record.approvalGates, 'pii_fingerprinting', true)
  ) {
    return invalid(
      'recipient_fingerprint_requires_pii_approval',
      'db_audit_execution_plan_requires_pii_fingerprinting_approval_gate',
    );
  }

  if (
    record.target === 'production'
    && !hasPrecondition(record.preconditions, 'production_read_approval_required')
  ) {
    return invalid(
      'production_target_requires_production_read_approval',
      'production_db_audit_target_requires_production_read_precondition',
    );
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  plan: EmailJobDuplicateReadOnlyDbAuditExecutionPlanItem | unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionResult {
  const validation = validateEmailJobDuplicateReadOnlyDbAuditExecutionPlanItem(plan);
  if (!validation.valid) {
    return buildBlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
      validation.reasonCode,
      validation.errorCode,
    );
  }

  return {
    status: 'ready',
    reasonCode: validation.reasonCode,
    plan: plan as EmailJobDuplicateReadOnlyDbAuditExecutionPlanItem,
  };
}

export function buildSkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  reasonCode: string,
): SkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult {
  return {
    status: 'skipped',
    reasonCode: readText(reasonCode) || DEFAULT_SKIPPED_REASON,
  };
}

export function buildBlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  reasonCode: string,
  errorCode: EmailJobDuplicateReadOnlyDbAuditExecutionErrorCode,
): BlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult {
  return {
    status: 'blocked',
    reasonCode: readText(reasonCode) || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  reasonCode: string,
  errorCode: EmailJobDuplicateReadOnlyDbAuditExecutionErrorCode,
  retryable: boolean,
): FailedEmailJobDuplicateReadOnlyDbAuditExecutionResult {
  return {
    status: 'failed',
    reasonCode: readText(reasonCode) || DEFAULT_FAILED_REASON,
    errorCode,
    retryable: Boolean(retryable),
  };
}

export function isReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  result: unknown,
): result is ReadyEmailJobDuplicateReadOnlyDbAuditExecutionResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  result: unknown,
): result is SkippedEmailJobDuplicateReadOnlyDbAuditExecutionResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  result: unknown,
): result is BlockedEmailJobDuplicateReadOnlyDbAuditExecutionResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobDuplicateReadOnlyDbAuditExecutionResult(
  result: unknown,
): result is FailedEmailJobDuplicateReadOnlyDbAuditExecutionResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditPreconditionForLog(
  precondition: EmailJobDuplicateReadOnlyDbAuditPrecondition,
): JsonRecord {
  return sanitizeForSafeProjection(precondition) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditQueryStepForLog(
  step: EmailJobDuplicateReadOnlyDbAuditQueryStep,
): JsonRecord {
  return sanitizeForSafeProjection(step) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditApprovalGateForLog(
  gate: EmailJobDuplicateReadOnlyDbAuditApprovalGate,
): JsonRecord {
  return sanitizeForSafeProjection(gate) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditOutputPolicyForLog(
  policy: EmailJobDuplicateReadOnlyDbAuditOutputPolicy,
): JsonRecord {
  return sanitizeForSafeProjection(policy) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditRiskAssessmentForLog(
  assessment: EmailJobDuplicateReadOnlyDbAuditRiskAssessment,
): JsonRecord {
  return sanitizeForSafeProjection(assessment) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionPlanForLog(
  plan: EmailJobDuplicateReadOnlyDbAuditExecutionPlan,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...plan,
    steps: plan.steps.map((step) => buildSafeEmailJobDuplicateReadOnlyDbAuditQueryStepForLog(step)),
    preconditions: plan.preconditions.map((precondition) => (
      buildSafeEmailJobDuplicateReadOnlyDbAuditPreconditionForLog(precondition)
    )),
    approvalGates: plan.approvalGates.map((gate) => (
      buildSafeEmailJobDuplicateReadOnlyDbAuditApprovalGateForLog(gate)
    )),
    outputPolicy: buildSafeEmailJobDuplicateReadOnlyDbAuditOutputPolicyForLog(plan.outputPolicy),
    riskAssessment: buildSafeEmailJobDuplicateReadOnlyDbAuditRiskAssessmentForLog(plan.riskAssessment),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultForLog(
  result: EmailJobDuplicateReadOnlyDbAuditExecutionResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultProjection(result);
}

export function buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultForAudit(
  result: EmailJobDuplicateReadOnlyDbAuditExecutionResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultProjection(result);
}

export function validateEmailJobDuplicateReadOnlyDbAuditExecutionPlanItem(
  plan: unknown,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  const record = asRecord(plan);
  if (!record || !hasText(record.type)) {
    return invalid('missing_plan', 'missing_email_job_duplicate_readonly_db_audit_execution_plan_item');
  }

  if (record.type === 'email_job_duplicate_readonly_db_audit_execution_plan') {
    return validateEmailJobDuplicateReadOnlyDbAuditExecutionPlan(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_db_audit_precondition') {
    return validateEmailJobDuplicateReadOnlyDbAuditPrecondition(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_db_audit_query_step') {
    return validateEmailJobDuplicateReadOnlyDbAuditQueryStep(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_db_audit_approval_gate') {
    return validateEmailJobDuplicateReadOnlyDbAuditApprovalGate(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_db_audit_output_policy') {
    return validateEmailJobDuplicateReadOnlyDbAuditOutputPolicy(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_db_audit_risk_assessment') {
    return validateEmailJobDuplicateReadOnlyDbAuditRiskAssessment(plan);
  }

  return invalid(
    'unsupported_plan_type',
    'unsupported_email_job_duplicate_readonly_db_audit_execution_plan_item',
  );
}

function buildPrecondition(
  name: EmailJobDuplicateReadOnlyDbAuditPreconditionName,
  reasonCode: string,
): EmailJobDuplicateReadOnlyDbAuditPrecondition {
  return {
    type: 'email_job_duplicate_readonly_db_audit_precondition',
    version: 'v1',
    name,
    required: true,
    blocksExecutionWithoutApproval: true,
    reasonCode: readText(reasonCode) || `${name}_required`,
  };
}

function buildQueryStep(
  queryClass: EmailJobDuplicateReadOnlyDbAuditQueryClass,
  target: EmailJobDuplicateReadOnlyDbAuditTarget,
  reasonCode: string,
): EmailJobDuplicateReadOnlyDbAuditQueryStep {
  const definition = QUERY_STEP_DEFINITIONS[queryClass];
  return {
    type: 'email_job_duplicate_readonly_db_audit_query_step',
    version: 'v1',
    queryClass,
    status: 'proposed_only',
    order: definition.order,
    target: isTarget(target) ? target : 'unknown',
    outputMode: definition.outputMode,
    piiRisk: definition.piiRisk,
    performanceRisk: definition.performanceRisk,
    requiresExplicitApproval: true,
    requiresTimeWindow: definition.requiresTimeWindow,
    requiresLimit: true,
    reasonCode: readText(reasonCode) || definition.reasonCode,
  };
}

function buildApprovalGate(
  approvalType: EmailJobDuplicateReadOnlyDbAuditApprovalType,
  required: boolean,
  reasonCode: string,
): EmailJobDuplicateReadOnlyDbAuditApprovalGate {
  return {
    type: 'email_job_duplicate_readonly_db_audit_approval_gate',
    version: 'v1',
    approvalType,
    required,
    grantedByBoundary: false,
    reasonCode: readText(reasonCode) || `${approvalType}_approval_gate`,
  };
}

function buildOutputPolicy(
  mode: EmailJobDuplicateReadOnlyDbAuditOutputMode,
  allowsAggregateCounts: boolean,
  allowsPseudonymizedFingerprints: boolean,
  reasonCode: string,
): EmailJobDuplicateReadOnlyDbAuditOutputPolicy {
  return {
    type: 'email_job_duplicate_readonly_db_audit_output_policy',
    version: 'v1',
    mode,
    allowsAggregateCounts,
    allowsPseudonymizedFingerprints,
    allowsRawRecipientEmail: false,
    allowsSubject: false,
    allowsHtml: false,
    allowsText: false,
    allowsBody: false,
    allowsFullMetadata: false,
    allowsLastError: false,
    allowsRowDump: false,
    allowsCsvExport: false,
    allowsJsonExport: false,
    allowsCommittedReport: false,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_db_audit_output_policy',
  };
}

function buildDefaultPreconditions(): readonly EmailJobDuplicateReadOnlyDbAuditPrecondition[] {
  return [
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
}

function buildDefaultQuerySteps(
  target: EmailJobDuplicateReadOnlyDbAuditTarget,
): readonly EmailJobDuplicateReadOnlyDbAuditQueryStep[] {
  return [
    buildAggregateStatusKindDbAuditQueryStep(target),
    buildStatusBucketDbAuditQueryStep(target),
    buildTimeWindowDbAuditQueryStep(target),
    buildReportRunDuplicateDbAuditQueryStep(target),
    buildSourceMetadataDuplicateDbAuditQueryStep(target),
    buildFailedRetryAmbiguityDbAuditQueryStep(target),
    buildProcessingStaleAmbiguityDbAuditQueryStep(target),
    buildRecipientFingerprintDbAuditQueryStep(target),
    buildContentFingerprintDbAuditQueryStep(target),
  ];
}

function buildDefaultApprovalGates(): readonly EmailJobDuplicateReadOnlyDbAuditApprovalGate[] {
  return [
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
}

function buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionResultProjection(
  result: EmailJobDuplicateReadOnlyDbAuditExecutionResult,
): JsonRecord {
  if (result.status === 'ready') {
    return sanitizeForSafeProjection({
      status: result.status,
      reasonCode: result.reasonCode,
      plan: buildSafePlanProjection(result.plan),
    }) as JsonRecord;
  }

  return sanitizeForSafeProjection(result) as JsonRecord;
}

function buildSafePlanProjection(plan: EmailJobDuplicateReadOnlyDbAuditExecutionPlanItem): unknown {
  if (plan.type === 'email_job_duplicate_readonly_db_audit_execution_plan') {
    return buildSafeEmailJobDuplicateReadOnlyDbAuditExecutionPlanForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_readonly_db_audit_precondition') {
    return buildSafeEmailJobDuplicateReadOnlyDbAuditPreconditionForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_readonly_db_audit_query_step') {
    return buildSafeEmailJobDuplicateReadOnlyDbAuditQueryStepForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_readonly_db_audit_approval_gate') {
    return buildSafeEmailJobDuplicateReadOnlyDbAuditApprovalGateForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_readonly_db_audit_output_policy') {
    return buildSafeEmailJobDuplicateReadOnlyDbAuditOutputPolicyForLog(plan);
  }
  return buildSafeEmailJobDuplicateReadOnlyDbAuditRiskAssessmentForLog(plan);
}

function sanitizeForSafeProjection(value: unknown): unknown {
  const sanitized = sanitizeNotificationPayloadForAudit(value);
  return sanitizeProjectedValue(sanitized);
}

function sanitizeProjectedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProjectedValue(item));
  }

  if (typeof value === 'string' && looksLikeSqlText(value)) {
    return OMITTED;
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const output: JsonRecord = {};
  for (const [key, rawValue] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);
    if (SECRET_KEYS.has(normalizedKey)) {
      output[key] = REDACTED;
      continue;
    }
    if (RAW_CONTENT_KEYS.has(normalizedKey)) {
      output[key] = normalizedKey === 'metadata' ? OMITTED : REDACTED;
      continue;
    }
    if (IDENTIFIER_KEYS.has(normalizedKey) && typeof rawValue === 'string') {
      output[key] = maskSensitiveValue(rawValue);
      continue;
    }
    if (typeof rawValue === 'string' && looksLikeSqlText(rawValue)) {
      output[key] = OMITTED;
      continue;
    }
    output[key] = sanitizeProjectedValue(rawValue);
  }

  return output;
}

function hasPrecondition(
  preconditions: readonly unknown[],
  name: EmailJobDuplicateReadOnlyDbAuditPreconditionName,
): boolean {
  return preconditions.some((precondition) => (
    asRecord(precondition)?.name === name
  ));
}

function hasApprovalGate(
  approvalGates: readonly unknown[],
  approvalType: EmailJobDuplicateReadOnlyDbAuditApprovalType,
  required: boolean,
): boolean {
  return approvalGates.some((gate) => {
    const record = asRecord(gate);
    return record?.approvalType === approvalType && record.required === required;
  });
}

function matchesQueryStepDefinition(step: EmailJobDuplicateReadOnlyDbAuditQueryStep): boolean {
  const definition = QUERY_STEP_DEFINITIONS[step.queryClass];
  return (
    step.order === definition.order
    && step.outputMode === definition.outputMode
    && step.piiRisk === definition.piiRisk
    && step.performanceRisk === definition.performanceRisk
    && step.requiresTimeWindow === definition.requiresTimeWindow
  );
}

function looksLikeSqlText(value: string): boolean {
  return /\b(select|insert|update|delete|from|where|group\s+by)\b/i.test(value);
}

function maskSensitiveValue(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function readStatus(result: unknown): unknown {
  return asRecord(result)?.status;
}

function isTarget(value: unknown): value is EmailJobDuplicateReadOnlyDbAuditTarget {
  return typeof value === 'string' && TARGETS.has(value as EmailJobDuplicateReadOnlyDbAuditTarget);
}

function isQueryClass(value: unknown): value is EmailJobDuplicateReadOnlyDbAuditQueryClass {
  return typeof value === 'string' && QUERY_CLASSES.has(value as EmailJobDuplicateReadOnlyDbAuditQueryClass);
}

function isPreconditionName(value: unknown): value is EmailJobDuplicateReadOnlyDbAuditPreconditionName {
  return (
    typeof value === 'string'
    && PRECONDITION_NAMES.has(value as EmailJobDuplicateReadOnlyDbAuditPreconditionName)
  );
}

function isRiskLevel(value: unknown): value is EmailJobDuplicateReadOnlyDbAuditRiskLevel {
  return typeof value === 'string' && RISK_LEVELS.has(value as EmailJobDuplicateReadOnlyDbAuditRiskLevel);
}

function isOutputMode(value: unknown): value is EmailJobDuplicateReadOnlyDbAuditOutputMode {
  return typeof value === 'string' && OUTPUT_MODES.has(value as EmailJobDuplicateReadOnlyDbAuditOutputMode);
}

function isApprovalType(value: unknown): value is EmailJobDuplicateReadOnlyDbAuditApprovalType {
  return typeof value === 'string' && APPROVAL_TYPES.has(value as EmailJobDuplicateReadOnlyDbAuditApprovalType);
}

function invalid(
  errorCode: EmailJobDuplicateReadOnlyDbAuditExecutionErrorCode,
  reasonCode: string,
): EmailJobDuplicateReadOnlyDbAuditExecutionValidationResult {
  return {
    valid: false,
    reasonCode,
    errorCode,
  };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readText(value: unknown): string | undefined {
  return hasText(value) ? value.trim() : undefined;
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function isValidPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}
