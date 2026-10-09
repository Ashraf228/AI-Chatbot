import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobDuplicateStagingApprovalArea =
  | 'db_read_only_audit'
  | 'staging_read'
  | 'production_read'
  | 'sql_execution'
  | 'query_runner'
  | 'query_results'
  | 'reports_with_data'
  | 'cleanup'
  | 'backfill'
  | 'enforcement'
  | 'pii_fingerprinting';

export type EmailJobDuplicateStagingApprovalCurrentStatus = 'not_granted';

export type EmailJobDuplicateStagingReadOnlyAuditQueryClass =
  | 'aggregate_status_kind_counts'
  | 'report_run_duplicate_candidate_counts'
  | 'source_metadata_duplicate_candidate_counts'
  | 'recipient_fingerprint_candidate_counts'
  | 'status_bucket_scan'
  | 'time_window_scan'
  | 'failed_retry_ambiguity_scan'
  | 'processing_stale_ambiguity_scan'
  | 'content_fingerprint_scan';

export type EmailJobDuplicateStagingAuditOutputCategory =
  | 'aggregate_counts'
  | 'status_buckets'
  | 'kind_buckets'
  | 'risk_group_counts'
  | 'reason_codes'
  | 'manual_review_summary'
  | 'pseudonymized_fingerprints'
  | 'blocked_output';

export type EmailJobDuplicateStagingAuditRiskLevel = 'low' | 'medium' | 'high';

export type EmailJobDuplicateStagingQueryAllowanceStatus =
  | 'planned_category_only'
  | 'blocked_without_pii_strategy';

export type EmailJobDuplicateStagingReadOnlyAuditScope = {
  type: 'email_job_duplicate_staging_readonly_audit_scope';
  version: 'v1';
  scope: 'staging_only';
  status: 'planned_only';
  grantedByBoundary: false;
  allowsStagingDbRead: false;
  allowsProductionDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsQueryResults: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  environmentRequirement: EmailJobDuplicateStagingEnvironmentRequirement;
  queryClassAllowances: readonly EmailJobDuplicateStagingQueryClassAllowance[];
  outputPolicy: EmailJobDuplicateStagingOutputPolicy;
  stopCriteria: EmailJobDuplicateStagingStopCriteria;
  approvalPreconditions: readonly EmailJobDuplicateStagingApprovalPrecondition[];
  reasonCode: string;
};

export type EmailJobDuplicateStagingEnvironmentRequirement = {
  type: 'email_job_duplicate_staging_environment_requirement';
  version: 'v1';
  targetEnvironment: 'staging_only';
  confirmedStagingEnvironmentRequired: true;
  blocksUnknownEnvironment: true;
  blocksProductionTarget: true;
  requiresReadOnlyRole: true;
  allowsWritePermissions: false;
  allowsMigrationRights: false;
  allowsCleanupRights: false;
  allowsBackfillRights: false;
  requiresQueryLimit: true;
  requiresTimeWindow: true;
  requiresQueryTimeout: true;
  requiresSanitizedOutputReview: true;
  requiresNoCommittedQueryResults: true;
  requiresNoCommittedReportsWithData: true;
  allowsStagingDbRead: false;
  allowsProductionDbRead: false;
  reasonCode: string;
};

export type EmailJobDuplicateStagingQueryClassAllowance = {
  type: 'email_job_duplicate_staging_query_class_allowance';
  version: 'v1';
  queryClass: EmailJobDuplicateStagingReadOnlyAuditQueryClass;
  status: EmailJobDuplicateStagingQueryAllowanceStatus;
  currentStatus: EmailJobDuplicateStagingApprovalCurrentStatus;
  grantedByBoundary: false;
  allowsStagingDbRead: false;
  allowsProductionDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsQueryResults: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  executionReady: false;
  allowsCategoryPlanningOnly: true;
  outputCategory: EmailJobDuplicateStagingAuditOutputCategory;
  piiRisk: EmailJobDuplicateStagingAuditRiskLevel;
  performanceRisk: EmailJobDuplicateStagingAuditRiskLevel;
  loadRisk: EmailJobDuplicateStagingAuditRiskLevel;
  requiresSeparatePiiStrategy: boolean;
  requiresTimeWindow: boolean;
  requiresLimit: true;
  deferred: boolean;
  blockedWithoutPiiStrategy: boolean;
  reasonCode: string;
};

export type EmailJobDuplicateStagingOutputPolicy = {
  type: 'email_job_duplicate_staging_output_policy';
  version: 'v1';
  allowsAggregateCounts: true;
  allowsStatusBuckets: true;
  allowsKindBuckets: true;
  allowsRiskGroupCounts: true;
  allowsReasonCodes: true;
  allowsPseudonymizedFingerprints: false;
  requiresSeparatePiiStrategyForFingerprints: true;
  allowsRawRecipientEmail: false;
  allowsSubject: false;
  allowsHtml: false;
  allowsText: false;
  allowsBody: false;
  allowsPayload: false;
  allowsFullMetadata: false;
  allowsLastError: false;
  allowsProviderErrors: false;
  allowsRowDumps: false;
  allowsCsvExports: false;
  allowsJsonExports: false;
  allowsCommittedReportsWithData: false;
  allowsQueryResults: false;
  reasonCode: string;
};

export type EmailJobDuplicateStagingStopCriteria = {
  type: 'email_job_duplicate_staging_stop_criteria';
  version: 'v1';
  blocksUnclearStagingEnvironment: true;
  blocksUnknownStagingDbTarget: true;
  blocksAccidentalProductionTarget: true;
  blocksMissingReadOnlyRole: true;
  blocksSelectStar: true;
  blocksMissingLimit: true;
  blocksMissingTimeWindow: true;
  blocksPotentialFullTableScan: true;
  blocksRawPiiOutput: true;
  blocksRawContentOutput: true;
  blocksFullMetadataOutput: true;
  blocksCommittedQueryResults: true;
  blocksCommittedReportsWithData: true;
  blocksCleanupUpdateDelete: true;
  blocksUnclearLivePiiInStaging: true;
  reasonCode: string;
};

export type EmailJobDuplicateStagingApprovalPrecondition = {
  type: 'email_job_duplicate_staging_approval_precondition';
  version: 'v1';
  area: EmailJobDuplicateStagingApprovalArea;
  required: true;
  currentStatus: EmailJobDuplicateStagingApprovalCurrentStatus;
  grantedByBoundary: false;
  allowsStagingDbRead: false;
  allowsProductionDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsQueryResults: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  notes: string;
  reasonCode: string;
};

export type ReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult = {
  status: 'ready';
  reasonCode: string;
  scope: EmailJobDuplicateStagingReadOnlyAuditScope;
};

export type SkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobDuplicateStagingReadOnlyAuditScopeErrorCode;
};

export type FailedEmailJobDuplicateStagingReadOnlyAuditScopeResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobDuplicateStagingReadOnlyAuditScopeErrorCode;
  retryable: boolean;
};

export type EmailJobDuplicateStagingReadOnlyAuditScopeResult =
  | ReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult
  | SkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult
  | BlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult
  | FailedEmailJobDuplicateStagingReadOnlyAuditScopeResult;

export type EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult =
  | { valid: true; reasonCode: string }
  | {
      valid: false;
      reasonCode: string;
      errorCode: EmailJobDuplicateStagingReadOnlyAuditScopeErrorCode;
    };

export type EmailJobDuplicateStagingReadOnlyAuditScopeErrorCode =
  | 'missing_scope'
  | 'missing_reason_code'
  | 'invalid_scope'
  | 'invalid_environment_requirement'
  | 'invalid_query_class_allowance'
  | 'invalid_output_policy'
  | 'invalid_stop_criteria'
  | 'invalid_approval_precondition'
  | 'invalid_result'
  | 'missing_query_class'
  | 'duplicate_query_class'
  | 'missing_approval_precondition'
  | 'duplicate_approval_precondition'
  | 'staging_read_not_granted'
  | 'production_read_not_granted'
  | 'db_read_only_audit_not_granted'
  | 'sql_execution_not_allowed'
  | 'query_runner_not_allowed'
  | 'query_results_not_allowed'
  | 'reports_with_data_not_allowed'
  | 'cleanup_not_allowed'
  | 'backfill_not_allowed'
  | 'enforcement_not_allowed'
  | 'content_fingerprint_must_stay_blocked'
  | 'query_class_must_not_contain_sql'
  | 'query_class_must_not_be_execution_ready'
  | 'query_class_must_not_allow_db_read'
  | 'unsafe_projection_input'
  | 'unknown_email_job_duplicate_staging_readonly_audit_scope_error';

type JsonRecord = Record<string, unknown>;

type QueryClassDefinition = {
  outputCategory: EmailJobDuplicateStagingAuditOutputCategory;
  piiRisk: EmailJobDuplicateStagingAuditRiskLevel;
  performanceRisk: EmailJobDuplicateStagingAuditRiskLevel;
  loadRisk: EmailJobDuplicateStagingAuditRiskLevel;
  requiresSeparatePiiStrategy: boolean;
  requiresTimeWindow: boolean;
  deferred: boolean;
  blockedWithoutPiiStrategy: boolean;
  status: EmailJobDuplicateStagingQueryAllowanceStatus;
  reasonCode: string;
};

type ApprovalPreconditionDefinition = {
  notes: string;
  reasonCode: string;
};

const QUERY_CLASSES = new Set<EmailJobDuplicateStagingReadOnlyAuditQueryClass>([
  'aggregate_status_kind_counts',
  'report_run_duplicate_candidate_counts',
  'source_metadata_duplicate_candidate_counts',
  'recipient_fingerprint_candidate_counts',
  'status_bucket_scan',
  'time_window_scan',
  'failed_retry_ambiguity_scan',
  'processing_stale_ambiguity_scan',
  'content_fingerprint_scan',
]);

const APPROVAL_AREAS = new Set<EmailJobDuplicateStagingApprovalArea>([
  'db_read_only_audit',
  'staging_read',
  'production_read',
  'sql_execution',
  'query_runner',
  'query_results',
  'reports_with_data',
  'cleanup',
  'backfill',
  'enforcement',
  'pii_fingerprinting',
]);

const OUTPUT_CATEGORIES = new Set<EmailJobDuplicateStagingAuditOutputCategory>([
  'aggregate_counts',
  'status_buckets',
  'kind_buckets',
  'risk_group_counts',
  'reason_codes',
  'manual_review_summary',
  'pseudonymized_fingerprints',
  'blocked_output',
]);

const RISK_LEVELS = new Set<EmailJobDuplicateStagingAuditRiskLevel>(['low', 'medium', 'high']);
const QUERY_ALLOWANCE_STATUSES = new Set<EmailJobDuplicateStagingQueryAllowanceStatus>([
  'planned_category_only',
  'blocked_without_pii_strategy',
]);

const DEFAULT_BLOCKED_REASON = 'email_job_duplicate_staging_readonly_audit_scope_blocked';
const DEFAULT_FAILED_REASON = 'email_job_duplicate_staging_readonly_audit_scope_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_duplicate_staging_readonly_audit_scope_skipped';
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
  'sql',
  'query',
  'statement',
  'queryresults',
  'query_results',
  'reportpath',
  'report_path',
  'csvpath',
  'csv_path',
  'jsonpath',
  'json_path',
]);

const IDENTIFIER_KEYS = new Set([
  'reportrunid',
  'report_run_id',
  'leadid',
  'lead_id',
  'contactid',
  'contact_id',
  'conversationid',
  'conversation_id',
  'sessionid',
  'session_id',
  'tenantid',
  'tenant_id',
  'siteid',
  'site_id',
]);

const QUERY_CLASS_DEFINITIONS: Record<
  EmailJobDuplicateStagingReadOnlyAuditQueryClass,
  QueryClassDefinition
> = {
  aggregate_status_kind_counts: {
    outputCategory: 'aggregate_counts',
    piiRisk: 'low',
    performanceRisk: 'low',
    loadRisk: 'low',
    requiresSeparatePiiStrategy: false,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'aggregate_status_kind_staging_query_allowance',
  },
  report_run_duplicate_candidate_counts: {
    outputCategory: 'aggregate_counts',
    piiRisk: 'medium',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresSeparatePiiStrategy: false,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'report_run_duplicate_staging_query_allowance',
  },
  source_metadata_duplicate_candidate_counts: {
    outputCategory: 'risk_group_counts',
    piiRisk: 'medium',
    performanceRisk: 'high',
    loadRisk: 'high',
    requiresSeparatePiiStrategy: false,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'source_metadata_duplicate_staging_query_allowance',
  },
  recipient_fingerprint_candidate_counts: {
    outputCategory: 'pseudonymized_fingerprints',
    piiRisk: 'high',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresSeparatePiiStrategy: true,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'recipient_fingerprint_staging_query_allowance',
  },
  status_bucket_scan: {
    outputCategory: 'status_buckets',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'low',
    requiresSeparatePiiStrategy: false,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'status_bucket_staging_query_allowance',
  },
  time_window_scan: {
    outputCategory: 'aggregate_counts',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresSeparatePiiStrategy: false,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'time_window_staging_query_allowance',
  },
  failed_retry_ambiguity_scan: {
    outputCategory: 'manual_review_summary',
    piiRisk: 'medium',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresSeparatePiiStrategy: false,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'failed_retry_ambiguity_staging_query_allowance',
  },
  processing_stale_ambiguity_scan: {
    outputCategory: 'manual_review_summary',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresSeparatePiiStrategy: false,
    requiresTimeWindow: true,
    deferred: false,
    blockedWithoutPiiStrategy: false,
    status: 'planned_category_only',
    reasonCode: 'processing_stale_ambiguity_staging_query_allowance',
  },
  content_fingerprint_scan: {
    outputCategory: 'blocked_output',
    piiRisk: 'high',
    performanceRisk: 'high',
    loadRisk: 'high',
    requiresSeparatePiiStrategy: true,
    requiresTimeWindow: true,
    deferred: true,
    blockedWithoutPiiStrategy: true,
    status: 'blocked_without_pii_strategy',
    reasonCode: 'content_fingerprint_staging_query_allowance_blocked',
  },
};

const APPROVAL_PRECONDITION_DEFINITIONS: Record<
  EmailJobDuplicateStagingApprovalArea,
  ApprovalPreconditionDefinition
> = {
  db_read_only_audit: {
    notes: 'a real DB_READ_ONLY_AUDIT remains separate and explicitly not granted',
    reasonCode: 'db_read_only_audit_not_granted',
  },
  staging_read: {
    notes: 'staging DB read remains separate and explicitly not granted',
    reasonCode: 'staging_read_not_granted',
  },
  production_read: {
    notes: 'production DB read remains separate and explicitly not granted',
    reasonCode: 'production_read_not_granted',
  },
  sql_execution: {
    notes: 'SQL execution remains blocked by this boundary',
    reasonCode: 'sql_execution_not_allowed',
  },
  query_runner: {
    notes: 'query runners remain out of scope',
    reasonCode: 'query_runner_not_allowed',
  },
  query_results: {
    notes: 'query results remain blocked from generation and storage',
    reasonCode: 'query_results_not_allowed',
  },
  reports_with_data: {
    notes: 'reports with data remain blocked',
    reasonCode: 'reports_with_data_not_allowed',
  },
  cleanup: {
    notes: 'cleanup remains a later separate line',
    reasonCode: 'cleanup_not_allowed',
  },
  backfill: {
    notes: 'backfill remains a later separate line',
    reasonCode: 'backfill_not_allowed',
  },
  enforcement: {
    notes: 'enforcement remains a later separate line',
    reasonCode: 'enforcement_not_allowed',
  },
  pii_fingerprinting: {
    notes: 'fingerprinting remains blocked without separate PII strategy approval',
    reasonCode: 'pii_fingerprinting_not_granted',
  },
};

export function buildDefaultEmailJobDuplicateStagingReadOnlyAuditScope(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_scope_documented',
): EmailJobDuplicateStagingReadOnlyAuditScope {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_scope',
    version: 'v1',
    scope: 'staging_only',
    status: 'planned_only',
    grantedByBoundary: false,
    allowsStagingDbRead: false,
    allowsProductionDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsQueryResults: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    environmentRequirement: buildStagingEnvironmentRequirement(),
    queryClassAllowances: buildDefaultQueryClassAllowances(),
    outputPolicy: buildDefaultStagingOutputPolicy(),
    stopCriteria: buildDefaultStagingStopCriteria(),
    approvalPreconditions: buildDefaultApprovalPreconditions(),
    reasonCode,
  };
}

export function buildStagingEnvironmentRequirement(
  reasonCode = 'staging_environment_requirement_documented',
): EmailJobDuplicateStagingEnvironmentRequirement {
  return {
    type: 'email_job_duplicate_staging_environment_requirement',
    version: 'v1',
    targetEnvironment: 'staging_only',
    confirmedStagingEnvironmentRequired: true,
    blocksUnknownEnvironment: true,
    blocksProductionTarget: true,
    requiresReadOnlyRole: true,
    allowsWritePermissions: false,
    allowsMigrationRights: false,
    allowsCleanupRights: false,
    allowsBackfillRights: false,
    requiresQueryLimit: true,
    requiresTimeWindow: true,
    requiresQueryTimeout: true,
    requiresSanitizedOutputReview: true,
    requiresNoCommittedQueryResults: true,
    requiresNoCommittedReportsWithData: true,
    allowsStagingDbRead: false,
    allowsProductionDbRead: false,
    reasonCode,
  };
}

export function buildStagingReadApprovalPrecondition(
  reasonCode = APPROVAL_PRECONDITION_DEFINITIONS.staging_read.reasonCode,
): EmailJobDuplicateStagingApprovalPrecondition {
  return buildApprovalPrecondition('staging_read', reasonCode);
}

export function buildProductionReadStillSeparateApprovalPrecondition(
  reasonCode = APPROVAL_PRECONDITION_DEFINITIONS.production_read.reasonCode,
): EmailJobDuplicateStagingApprovalPrecondition {
  return buildApprovalPrecondition('production_read', reasonCode);
}

export function buildAggregateStatusKindStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.aggregate_status_kind_counts.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('aggregate_status_kind_counts', reasonCode);
}

export function buildReportRunDuplicateStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.report_run_duplicate_candidate_counts.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('report_run_duplicate_candidate_counts', reasonCode);
}

export function buildSourceMetadataDuplicateStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.source_metadata_duplicate_candidate_counts.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('source_metadata_duplicate_candidate_counts', reasonCode);
}

export function buildRecipientFingerprintStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.recipient_fingerprint_candidate_counts.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('recipient_fingerprint_candidate_counts', reasonCode);
}

export function buildContentFingerprintStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.content_fingerprint_scan.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('content_fingerprint_scan', reasonCode);
}

export function buildStatusBucketStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.status_bucket_scan.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('status_bucket_scan', reasonCode);
}

export function buildTimeWindowStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.time_window_scan.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('time_window_scan', reasonCode);
}

export function buildFailedRetryAmbiguityStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.failed_retry_ambiguity_scan.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('failed_retry_ambiguity_scan', reasonCode);
}

export function buildProcessingStaleAmbiguityStagingQueryAllowance(
  reasonCode = QUERY_CLASS_DEFINITIONS.processing_stale_ambiguity_scan.reasonCode,
): EmailJobDuplicateStagingQueryClassAllowance {
  return buildQueryAllowance('processing_stale_ambiguity_scan', reasonCode);
}

export function buildDefaultStagingOutputPolicy(
  reasonCode = 'staging_output_policy_documented',
): EmailJobDuplicateStagingOutputPolicy {
  return {
    type: 'email_job_duplicate_staging_output_policy',
    version: 'v1',
    allowsAggregateCounts: true,
    allowsStatusBuckets: true,
    allowsKindBuckets: true,
    allowsRiskGroupCounts: true,
    allowsReasonCodes: true,
    allowsPseudonymizedFingerprints: false,
    requiresSeparatePiiStrategyForFingerprints: true,
    allowsRawRecipientEmail: false,
    allowsSubject: false,
    allowsHtml: false,
    allowsText: false,
    allowsBody: false,
    allowsPayload: false,
    allowsFullMetadata: false,
    allowsLastError: false,
    allowsProviderErrors: false,
    allowsRowDumps: false,
    allowsCsvExports: false,
    allowsJsonExports: false,
    allowsCommittedReportsWithData: false,
    allowsQueryResults: false,
    reasonCode,
  };
}

export function buildDefaultStagingStopCriteria(
  reasonCode = 'staging_stop_criteria_documented',
): EmailJobDuplicateStagingStopCriteria {
  return {
    type: 'email_job_duplicate_staging_stop_criteria',
    version: 'v1',
    blocksUnclearStagingEnvironment: true,
    blocksUnknownStagingDbTarget: true,
    blocksAccidentalProductionTarget: true,
    blocksMissingReadOnlyRole: true,
    blocksSelectStar: true,
    blocksMissingLimit: true,
    blocksMissingTimeWindow: true,
    blocksPotentialFullTableScan: true,
    blocksRawPiiOutput: true,
    blocksRawContentOutput: true,
    blocksFullMetadataOutput: true,
    blocksCommittedQueryResults: true,
    blocksCommittedReportsWithData: true,
    blocksCleanupUpdateDelete: true,
    blocksUnclearLivePiiInStaging: true,
    reasonCode,
  };
}

export function validateEmailJobDuplicateStagingReadOnlyAuditScope(
  scope: unknown,
): EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult {
  const record = asRecord(scope);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_scope') {
    return invalid('invalid_scope', 'invalid_email_job_duplicate_staging_readonly_audit_scope');
  }

  if (
    record.version !== 'v1'
    || record.scope !== 'staging_only'
    || record.status !== 'planned_only'
    || record.grantedByBoundary !== false
    || record.allowsStagingDbRead !== false
    || record.allowsProductionDbRead !== false
    || record.allowsSqlExecution !== false
    || record.allowsQueryRunner !== false
    || record.allowsQueryResults !== false
    || record.allowsReportsWithData !== false
    || record.allowsCleanup !== false
    || record.allowsBackfill !== false
    || record.allowsEnforcement !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_scope', 'invalid_email_job_duplicate_staging_readonly_audit_scope_shape');
  }

  const environmentValidation = validateEmailJobDuplicateStagingEnvironmentRequirement(
    record.environmentRequirement,
  );
  if (!environmentValidation.valid) {
    return environmentValidation;
  }

  if (!Array.isArray(record.queryClassAllowances) || record.queryClassAllowances.length !== QUERY_CLASSES.size) {
    return invalid('missing_query_class', 'staging_query_class_allowances_must_cover_all_documented_categories');
  }

  const seenQueryClasses = new Set<EmailJobDuplicateStagingReadOnlyAuditQueryClass>();
  for (const allowance of record.queryClassAllowances) {
    const validation = validateEmailJobDuplicateStagingQueryClassAllowance(allowance);
    if (!validation.valid) {
      return validation;
    }
    const queryClass = (allowance as EmailJobDuplicateStagingQueryClassAllowance).queryClass;
    if (seenQueryClasses.has(queryClass)) {
      return invalid('duplicate_query_class', 'duplicate_staging_query_class_allowance_detected');
    }
    seenQueryClasses.add(queryClass);
  }

  for (const queryClass of QUERY_CLASSES) {
    if (!seenQueryClasses.has(queryClass)) {
      return invalid('missing_query_class', 'missing_documented_staging_query_class_allowance');
    }
  }

  const outputPolicyValidation = validateEmailJobDuplicateStagingOutputPolicy(record.outputPolicy);
  if (!outputPolicyValidation.valid) {
    return outputPolicyValidation;
  }

  const stopCriteriaValidation = validateEmailJobDuplicateStagingStopCriteria(record.stopCriteria);
  if (!stopCriteriaValidation.valid) {
    return stopCriteriaValidation;
  }

  if (
    !Array.isArray(record.approvalPreconditions)
    || record.approvalPreconditions.length !== APPROVAL_AREAS.size
  ) {
    return invalid(
      'missing_approval_precondition',
      'staging_approval_preconditions_must_cover_all_documented_risky_areas',
    );
  }

  const seenApprovalAreas = new Set<EmailJobDuplicateStagingApprovalArea>();
  for (const precondition of record.approvalPreconditions) {
    const validation = validateEmailJobDuplicateStagingApprovalPrecondition(precondition);
    if (!validation.valid) {
      return validation;
    }
    const area = (precondition as EmailJobDuplicateStagingApprovalPrecondition).area;
    if (seenApprovalAreas.has(area)) {
      return invalid('duplicate_approval_precondition', 'duplicate_staging_approval_precondition_detected');
    }
    seenApprovalAreas.add(area);
  }

  for (const area of APPROVAL_AREAS) {
    if (!seenApprovalAreas.has(area)) {
      return invalid('missing_approval_precondition', 'missing_documented_staging_approval_precondition');
    }
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function validateEmailJobDuplicateStagingEnvironmentRequirement(
  requirement: unknown,
): EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult {
  const record = asRecord(requirement);
  if (!record || record.type !== 'email_job_duplicate_staging_environment_requirement') {
    return invalid(
      'invalid_environment_requirement',
      'invalid_email_job_duplicate_staging_environment_requirement',
    );
  }

  if (
    record.version !== 'v1'
    || record.targetEnvironment !== 'staging_only'
    || record.confirmedStagingEnvironmentRequired !== true
    || record.blocksUnknownEnvironment !== true
    || record.blocksProductionTarget !== true
    || record.requiresReadOnlyRole !== true
    || record.allowsWritePermissions !== false
    || record.allowsMigrationRights !== false
    || record.allowsCleanupRights !== false
    || record.allowsBackfillRights !== false
    || record.requiresQueryLimit !== true
    || record.requiresTimeWindow !== true
    || record.requiresQueryTimeout !== true
    || record.requiresSanitizedOutputReview !== true
    || record.requiresNoCommittedQueryResults !== true
    || record.requiresNoCommittedReportsWithData !== true
    || record.allowsStagingDbRead !== false
    || record.allowsProductionDbRead !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_environment_requirement',
      'invalid_email_job_duplicate_staging_environment_requirement_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid('unsafe_projection_input', 'unsafe_surface_detected_in_staging_environment_requirement');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function validateEmailJobDuplicateStagingQueryClassAllowance(
  allowance: unknown,
): EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult {
  const record = asRecord(allowance);
  if (!record || record.type !== 'email_job_duplicate_staging_query_class_allowance') {
    return invalid(
      'invalid_query_class_allowance',
      'invalid_email_job_duplicate_staging_query_class_allowance',
    );
  }

  if (
    record.version !== 'v1'
    || !isQueryClass(record.queryClass)
    || !isQueryAllowanceStatus(record.status)
    || record.currentStatus !== 'not_granted'
    || record.grantedByBoundary !== false
    || record.allowsStagingDbRead !== false
    || record.allowsProductionDbRead !== false
    || record.allowsSqlExecution !== false
    || record.allowsQueryRunner !== false
    || record.allowsQueryResults !== false
    || record.allowsReportsWithData !== false
    || record.allowsCleanup !== false
    || record.allowsBackfill !== false
    || record.allowsEnforcement !== false
    || record.executionReady !== false
    || record.allowsCategoryPlanningOnly !== true
    || !isOutputCategory(record.outputCategory)
    || !isRiskLevel(record.piiRisk)
    || !isRiskLevel(record.performanceRisk)
    || !isRiskLevel(record.loadRisk)
    || typeof record.requiresSeparatePiiStrategy !== 'boolean'
    || typeof record.requiresTimeWindow !== 'boolean'
    || record.requiresLimit !== true
    || typeof record.deferred !== 'boolean'
    || typeof record.blockedWithoutPiiStrategy !== 'boolean'
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_query_class_allowance',
      'invalid_email_job_duplicate_staging_query_class_allowance_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid('query_class_must_not_contain_sql', 'staging_query_class_allowance_contains_forbidden_surface');
  }

  const typedRecord = record as EmailJobDuplicateStagingQueryClassAllowance;
  if (!matchesQueryClassDefinition(typedRecord)) {
    return invalid(
      'invalid_query_class_allowance',
      'staging_query_class_allowance_does_not_match_documented_boundary',
    );
  }

  if (typedRecord.executionReady !== false) {
    return invalid(
      'query_class_must_not_be_execution_ready',
      'staging_query_class_allowance_must_stay_non_executable',
    );
  }

  if (typedRecord.allowsStagingDbRead !== false || typedRecord.allowsProductionDbRead !== false) {
    return invalid('query_class_must_not_allow_db_read', 'staging_query_class_allowance_must_not_allow_db_reads');
  }

  if (typedRecord.queryClass === 'content_fingerprint_scan') {
    if (
      typedRecord.status !== 'blocked_without_pii_strategy'
      || typedRecord.deferred !== true
      || typedRecord.blockedWithoutPiiStrategy !== true
      || typedRecord.requiresSeparatePiiStrategy !== true
      || typedRecord.outputCategory !== 'blocked_output'
      || typedRecord.piiRisk !== 'high'
    ) {
      return invalid(
        'content_fingerprint_must_stay_blocked',
        'content_fingerprint_scan_must_stay_high_risk_deferred_and_blocked',
      );
    }
  }

  return {
    valid: true,
    reasonCode: typedRecord.reasonCode,
  };
}

export function validateEmailJobDuplicateStagingOutputPolicy(
  policy: unknown,
): EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_duplicate_staging_output_policy') {
    return invalid('invalid_output_policy', 'invalid_email_job_duplicate_staging_output_policy');
  }

  if (
    record.version !== 'v1'
    || record.allowsAggregateCounts !== true
    || record.allowsStatusBuckets !== true
    || record.allowsKindBuckets !== true
    || record.allowsRiskGroupCounts !== true
    || record.allowsReasonCodes !== true
    || record.allowsPseudonymizedFingerprints !== false
    || record.requiresSeparatePiiStrategyForFingerprints !== true
    || record.allowsRawRecipientEmail !== false
    || record.allowsSubject !== false
    || record.allowsHtml !== false
    || record.allowsText !== false
    || record.allowsBody !== false
    || record.allowsPayload !== false
    || record.allowsFullMetadata !== false
    || record.allowsLastError !== false
    || record.allowsProviderErrors !== false
    || record.allowsRowDumps !== false
    || record.allowsCsvExports !== false
    || record.allowsJsonExports !== false
    || record.allowsCommittedReportsWithData !== false
    || record.allowsQueryResults !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_output_policy', 'invalid_email_job_duplicate_staging_output_policy_shape');
  }

  if (containsForbiddenSurface(record)) {
    return invalid('unsafe_projection_input', 'unsafe_surface_detected_in_staging_output_policy');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function validateEmailJobDuplicateStagingStopCriteria(
  criteria: unknown,
): EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult {
  const record = asRecord(criteria);
  if (!record || record.type !== 'email_job_duplicate_staging_stop_criteria') {
    return invalid('invalid_stop_criteria', 'invalid_email_job_duplicate_staging_stop_criteria');
  }

  if (
    record.version !== 'v1'
    || record.blocksUnclearStagingEnvironment !== true
    || record.blocksUnknownStagingDbTarget !== true
    || record.blocksAccidentalProductionTarget !== true
    || record.blocksMissingReadOnlyRole !== true
    || record.blocksSelectStar !== true
    || record.blocksMissingLimit !== true
    || record.blocksMissingTimeWindow !== true
    || record.blocksPotentialFullTableScan !== true
    || record.blocksRawPiiOutput !== true
    || record.blocksRawContentOutput !== true
    || record.blocksFullMetadataOutput !== true
    || record.blocksCommittedQueryResults !== true
    || record.blocksCommittedReportsWithData !== true
    || record.blocksCleanupUpdateDelete !== true
    || record.blocksUnclearLivePiiInStaging !== true
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_stop_criteria', 'invalid_email_job_duplicate_staging_stop_criteria_shape');
  }

  if (containsForbiddenSurface(record)) {
    return invalid('unsafe_projection_input', 'unsafe_surface_detected_in_staging_stop_criteria');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function validateEmailJobDuplicateStagingApprovalPrecondition(
  precondition: unknown,
): EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult {
  const record = asRecord(precondition);
  if (!record || record.type !== 'email_job_duplicate_staging_approval_precondition') {
    return invalid(
      'invalid_approval_precondition',
      'invalid_email_job_duplicate_staging_approval_precondition',
    );
  }

  if (
    record.version !== 'v1'
    || !isApprovalArea(record.area)
    || record.required !== true
    || record.currentStatus !== 'not_granted'
    || record.grantedByBoundary !== false
    || record.allowsStagingDbRead !== false
    || record.allowsProductionDbRead !== false
    || record.allowsSqlExecution !== false
    || record.allowsQueryRunner !== false
    || record.allowsQueryResults !== false
    || record.allowsReportsWithData !== false
    || record.allowsCleanup !== false
    || record.allowsBackfill !== false
    || record.allowsEnforcement !== false
    || !hasText(record.notes)
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_approval_precondition',
      'invalid_email_job_duplicate_staging_approval_precondition_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid('unsafe_projection_input', 'unsafe_surface_detected_in_staging_approval_precondition');
  }

  const definition = APPROVAL_PRECONDITION_DEFINITIONS[record.area];
  if (record.reasonCode !== definition.reasonCode || record.notes !== definition.notes) {
    return invalid(
      'invalid_approval_precondition',
      'staging_approval_precondition_must_match_documented_risky_area_definition',
    );
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  scope: EmailJobDuplicateStagingReadOnlyAuditScope,
  reasonCode = 'email_job_duplicate_staging_readonly_audit_scope_ready',
): EmailJobDuplicateStagingReadOnlyAuditScopeResult {
  const validation = validateEmailJobDuplicateStagingReadOnlyAuditScope(scope);
  if (!validation.valid) {
    return buildBlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
      validation.reasonCode,
      validation.errorCode,
    );
  }

  return {
    status: 'ready',
    reasonCode,
    scope,
  };
}

export function buildSkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  reasonCode = DEFAULT_SKIPPED_REASON,
): EmailJobDuplicateStagingReadOnlyAuditScopeResult {
  return {
    status: 'skipped',
    reasonCode,
  };
}

export function buildBlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  reasonCode = DEFAULT_BLOCKED_REASON,
  errorCode: EmailJobDuplicateStagingReadOnlyAuditScopeErrorCode = 'unknown_email_job_duplicate_staging_readonly_audit_scope_error',
): EmailJobDuplicateStagingReadOnlyAuditScopeResult {
  return {
    status: 'blocked',
    reasonCode,
    errorCode,
  };
}

export function buildFailedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  reasonCode = DEFAULT_FAILED_REASON,
  errorCode: EmailJobDuplicateStagingReadOnlyAuditScopeErrorCode = 'unknown_email_job_duplicate_staging_readonly_audit_scope_error',
  retryable = false,
): EmailJobDuplicateStagingReadOnlyAuditScopeResult {
  return {
    status: 'failed',
    reasonCode,
    errorCode,
    retryable,
  };
}

export function isReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  result: EmailJobDuplicateStagingReadOnlyAuditScopeResult,
): result is ReadyEmailJobDuplicateStagingReadOnlyAuditScopeResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  result: EmailJobDuplicateStagingReadOnlyAuditScopeResult,
): result is SkippedEmailJobDuplicateStagingReadOnlyAuditScopeResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  result: EmailJobDuplicateStagingReadOnlyAuditScopeResult,
): result is BlockedEmailJobDuplicateStagingReadOnlyAuditScopeResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobDuplicateStagingReadOnlyAuditScopeResult(
  result: EmailJobDuplicateStagingReadOnlyAuditScopeResult,
): result is FailedEmailJobDuplicateStagingReadOnlyAuditScopeResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeForLog(
  scope: EmailJobDuplicateStagingReadOnlyAuditScope,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...scope,
    environmentRequirement: buildSafeEmailJobDuplicateStagingEnvironmentRequirementForLog(
      scope.environmentRequirement,
    ),
    queryClassAllowances: scope.queryClassAllowances.map((allowance) => (
      buildSafeEmailJobDuplicateStagingQueryClassAllowanceForLog(allowance)
    )),
    outputPolicy: buildSafeEmailJobDuplicateStagingOutputPolicyForLog(scope.outputPolicy),
    stopCriteria: buildSafeEmailJobDuplicateStagingStopCriteriaForLog(scope.stopCriteria),
    approvalPreconditions: scope.approvalPreconditions.map((precondition) => (
      buildSafeEmailJobDuplicateStagingApprovalPreconditionForLog(precondition)
    )),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingEnvironmentRequirementForLog(
  requirement: EmailJobDuplicateStagingEnvironmentRequirement,
): JsonRecord {
  return sanitizeForSafeProjection(requirement) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingQueryClassAllowanceForLog(
  allowance: EmailJobDuplicateStagingQueryClassAllowance,
): JsonRecord {
  return sanitizeForSafeProjection(allowance) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingOutputPolicyForLog(
  policy: EmailJobDuplicateStagingOutputPolicy,
): JsonRecord {
  return sanitizeForSafeProjection(policy) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingStopCriteriaForLog(
  criteria: EmailJobDuplicateStagingStopCriteria,
): JsonRecord {
  return sanitizeForSafeProjection(criteria) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingApprovalPreconditionForLog(
  precondition: EmailJobDuplicateStagingApprovalPrecondition,
): JsonRecord {
  return sanitizeForSafeProjection(precondition) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultForLog(
  result: EmailJobDuplicateStagingReadOnlyAuditScopeResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultProjection(result);
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultForAudit(
  result: EmailJobDuplicateStagingReadOnlyAuditScopeResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultProjection(result);
}

function buildApprovalPrecondition(
  area: EmailJobDuplicateStagingApprovalArea,
  reasonCode: string,
): EmailJobDuplicateStagingApprovalPrecondition {
  const definition = APPROVAL_PRECONDITION_DEFINITIONS[area];
  return {
    type: 'email_job_duplicate_staging_approval_precondition',
    version: 'v1',
    area,
    required: true,
    currentStatus: 'not_granted',
    grantedByBoundary: false,
    allowsStagingDbRead: false,
    allowsProductionDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsQueryResults: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    notes: definition.notes,
    reasonCode,
  };
}

function buildQueryAllowance(
  queryClass: EmailJobDuplicateStagingReadOnlyAuditQueryClass,
  reasonCode: string,
): EmailJobDuplicateStagingQueryClassAllowance {
  const definition = QUERY_CLASS_DEFINITIONS[queryClass];
  return {
    type: 'email_job_duplicate_staging_query_class_allowance',
    version: 'v1',
    queryClass,
    status: definition.status,
    currentStatus: 'not_granted',
    grantedByBoundary: false,
    allowsStagingDbRead: false,
    allowsProductionDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsQueryResults: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    executionReady: false,
    allowsCategoryPlanningOnly: true,
    outputCategory: definition.outputCategory,
    piiRisk: definition.piiRisk,
    performanceRisk: definition.performanceRisk,
    loadRisk: definition.loadRisk,
    requiresSeparatePiiStrategy: definition.requiresSeparatePiiStrategy,
    requiresTimeWindow: definition.requiresTimeWindow,
    requiresLimit: true,
    deferred: definition.deferred,
    blockedWithoutPiiStrategy: definition.blockedWithoutPiiStrategy,
    reasonCode,
  };
}

function buildDefaultQueryClassAllowances(): readonly EmailJobDuplicateStagingQueryClassAllowance[] {
  return [
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
}

function buildDefaultApprovalPreconditions(): readonly EmailJobDuplicateStagingApprovalPrecondition[] {
  return [
    buildApprovalPrecondition('db_read_only_audit', APPROVAL_PRECONDITION_DEFINITIONS.db_read_only_audit.reasonCode),
    buildStagingReadApprovalPrecondition(),
    buildProductionReadStillSeparateApprovalPrecondition(),
    buildApprovalPrecondition('sql_execution', APPROVAL_PRECONDITION_DEFINITIONS.sql_execution.reasonCode),
    buildApprovalPrecondition('query_runner', APPROVAL_PRECONDITION_DEFINITIONS.query_runner.reasonCode),
    buildApprovalPrecondition('query_results', APPROVAL_PRECONDITION_DEFINITIONS.query_results.reasonCode),
    buildApprovalPrecondition(
      'reports_with_data',
      APPROVAL_PRECONDITION_DEFINITIONS.reports_with_data.reasonCode,
    ),
    buildApprovalPrecondition('cleanup', APPROVAL_PRECONDITION_DEFINITIONS.cleanup.reasonCode),
    buildApprovalPrecondition('backfill', APPROVAL_PRECONDITION_DEFINITIONS.backfill.reasonCode),
    buildApprovalPrecondition('enforcement', APPROVAL_PRECONDITION_DEFINITIONS.enforcement.reasonCode),
    buildApprovalPrecondition(
      'pii_fingerprinting',
      APPROVAL_PRECONDITION_DEFINITIONS.pii_fingerprinting.reasonCode,
    ),
  ];
}

function buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeResultProjection(
  result: EmailJobDuplicateStagingReadOnlyAuditScopeResult,
): JsonRecord {
  if (result.status === 'ready') {
    return sanitizeForSafeProjection({
      status: result.status,
      reasonCode: result.reasonCode,
      scope: buildSafeEmailJobDuplicateStagingReadOnlyAuditScopeForLog(result.scope),
    }) as JsonRecord;
  }

  return sanitizeForSafeProjection(result) as JsonRecord;
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

function containsForbiddenSurface(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenSurface(entry));
  }

  if (typeof value === 'string') {
    return looksLikeSqlText(value);
  }

  const record = asRecord(value);
  if (!record) {
    return false;
  }

  for (const [key, rawValue] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);
    if (RAW_CONTENT_KEYS.has(normalizedKey) && normalizedKey !== 'metadata') {
      return true;
    }
    if (normalizedKey === 'metadata' && asRecord(rawValue)) {
      return true;
    }
    if (normalizedKey === 'queryresults' || normalizedKey === 'query_results') {
      return true;
    }
    if (normalizedKey === 'reportpath' || normalizedKey === 'report_path') {
      return true;
    }
    if (containsForbiddenSurface(rawValue)) {
      return true;
    }
  }

  return false;
}

function matchesQueryClassDefinition(
  allowance: EmailJobDuplicateStagingQueryClassAllowance,
): boolean {
  const definition = QUERY_CLASS_DEFINITIONS[allowance.queryClass];
  return (
    allowance.status === definition.status
    && allowance.outputCategory === definition.outputCategory
    && allowance.piiRisk === definition.piiRisk
    && allowance.performanceRisk === definition.performanceRisk
    && allowance.loadRisk === definition.loadRisk
    && allowance.requiresSeparatePiiStrategy === definition.requiresSeparatePiiStrategy
    && allowance.requiresTimeWindow === definition.requiresTimeWindow
    && allowance.deferred === definition.deferred
    && allowance.blockedWithoutPiiStrategy === definition.blockedWithoutPiiStrategy
  );
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function looksLikeSqlText(value: string): boolean {
  return /\bselect\s+.+\s+from\b|\binsert\s+into\b|\bupdate\s+\S+\s+set\b|\bdelete\s+from\b|\bgroup\s+by\b|\bhaving\b|\bjoin\b/i.test(value);
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function invalid(
  errorCode: EmailJobDuplicateStagingReadOnlyAuditScopeErrorCode,
  reasonCode: string,
): EmailJobDuplicateStagingReadOnlyAuditScopeValidationResult {
  return {
    valid: false,
    errorCode,
    reasonCode,
  };
}

function isQueryClass(value: unknown): value is EmailJobDuplicateStagingReadOnlyAuditQueryClass {
  return typeof value === 'string' && QUERY_CLASSES.has(value as EmailJobDuplicateStagingReadOnlyAuditQueryClass);
}

function isApprovalArea(value: unknown): value is EmailJobDuplicateStagingApprovalArea {
  return typeof value === 'string' && APPROVAL_AREAS.has(value as EmailJobDuplicateStagingApprovalArea);
}

function isOutputCategory(value: unknown): value is EmailJobDuplicateStagingAuditOutputCategory {
  return typeof value === 'string' && OUTPUT_CATEGORIES.has(value as EmailJobDuplicateStagingAuditOutputCategory);
}

function isRiskLevel(value: unknown): value is EmailJobDuplicateStagingAuditRiskLevel {
  return typeof value === 'string' && RISK_LEVELS.has(value as EmailJobDuplicateStagingAuditRiskLevel);
}

function isQueryAllowanceStatus(value: unknown): value is EmailJobDuplicateStagingQueryAllowanceStatus {
  return (
    typeof value === 'string'
    && QUERY_ALLOWANCE_STATUSES.has(value as EmailJobDuplicateStagingQueryAllowanceStatus)
  );
}
