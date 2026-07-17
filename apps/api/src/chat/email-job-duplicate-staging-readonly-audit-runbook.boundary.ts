import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

type JsonRecord = Record<string, unknown>;

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

export type EmailJobDuplicateStagingReadOnlyAuditOutputCategory =
  | 'aggregate_counts'
  | 'status_buckets'
  | 'kind_buckets'
  | 'risk_group_counts'
  | 'reason_codes'
  | 'pseudonymized_fingerprints'
  | 'manual_review_summary'
  | 'blocked_output';

export type EmailJobDuplicateStagingReadOnlyAuditRiskLevel = 'low' | 'medium' | 'high';

export type EmailJobDuplicateStagingReadOnlyAuditQueryEnvelopeStatus =
  | 'planned_category_only'
  | 'blocked_without_pii_strategy';

export type EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat = {
  type: 'email_job_duplicate_staging_readonly_audit_human_approval_format';
  version: 'v1';
  scope: 'staging_only';
  exampleOnly: true;
  humanApprovalGranted: false;
  grantedByBoundary: false;
  readOnlyOnlyRequired: true;
  noSqlFilesInRepoRequired: true;
  noReportsWithDataRequired: true;
  noEmailJobWritesRequired: true;
  noCleanupRequired: true;
  noBackfillRequired: true;
  noEnforcementRequired: true;
  requiredScopeBoundaries: readonly string[];
  exampleApprovalText: string;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditPreflightChecklist = {
  type: 'email_job_duplicate_staging_readonly_audit_preflight_checklist';
  version: 'v1';
  confirmedStagingEnvironmentRequired: true;
  confirmedStagingDbTargetRequired: true;
  productionTargetExcluded: true;
  readOnlyRoleRequired: true;
  noWritePermissionsRequired: true;
  noMigrationPermissionsRequired: true;
  noCleanupPermissionsRequired: true;
  noBackfillPermissionsRequired: true;
  allowedQueryClassesCategoryOnly: true;
  safeOutputPolicyRequired: true;
  piiRulesRequired: true;
  performanceAndLoadReviewRequired: true;
  stopAbortProcedureRequired: true;
  noQueryResultsInRepoRequired: true;
  noReportsWithDataRequired: true;
  noCsvJsonExportsRequired: true;
  separateHumanApprovalRequired: true;
  humanApprovalGranted: false;
  grantedByBoundary: false;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope = {
  type: 'email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope';
  version: 'v1';
  queryClass: EmailJobDuplicateStagingReadOnlyAuditQueryClass;
  status: EmailJobDuplicateStagingReadOnlyAuditQueryEnvelopeStatus;
  grantedByBoundary: false;
  dbReadOnlyAuditApproved: false;
  stagingDbReadApproved: false;
  productionDbReadApproved: false;
  sqlExecutionApproved: false;
  queryRunnerApproved: false;
  queryResultsApproved: false;
  reportsWithDataApproved: false;
  cleanupApproved: false;
  backfillApproved: false;
  enforcementApproved: false;
  executionReady: false;
  containsSql: false;
  allowsCategoryPlanningOnly: true;
  outputCategory: EmailJobDuplicateStagingReadOnlyAuditOutputCategory;
  piiRisk: EmailJobDuplicateStagingReadOnlyAuditRiskLevel;
  performanceRisk: EmailJobDuplicateStagingReadOnlyAuditRiskLevel;
  loadRisk: EmailJobDuplicateStagingReadOnlyAuditRiskLevel;
  requiresSeparatePiiStrategy: boolean;
  requiresTimeWindow: boolean;
  requiresLimit: true;
  deferred: boolean;
  blockedWithoutPiiStrategy: boolean;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy = {
  type: 'email_job_duplicate_staging_readonly_audit_safe_output_policy';
  version: 'v1';
  futureApprovedOutputOnly: true;
  allowsAggregateCounts: true;
  allowsStatusBuckets: true;
  allowsKindBuckets: true;
  allowsRiskGroupCounts: true;
  allowsReasonCodes: true;
  allowsPseudonymizedFingerprints: false;
  requiresSeparatePiiApprovalForFingerprints: true;
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

export type EmailJobDuplicateStagingReadOnlyAuditStopCriteria = {
  type: 'email_job_duplicate_staging_readonly_audit_stop_criteria';
  version: 'v1';
  blocksUnclearEnvironment: true;
  blocksProductionTarget: true;
  blocksMissingReadOnlyRole: true;
  blocksWritePermissions: true;
  blocksMissingLimit: true;
  blocksMissingTimeWindow: true;
  blocksPotentialFullTableScan: true;
  blocksRawPiiOutput: true;
  blocksRawContentOutput: true;
  blocksFullMetadataOutput: true;
  blocksCommittedQueryResults: true;
  blocksCommittedReportsWithData: true;
  blocksMissingOperatorApproval: true;
  blocksCleanupUpdateDelete: true;
  blocksUnclearPerformanceRisk: true;
  blocksUnresolvedPiiStrategy: true;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditAbortModel = {
  type: 'email_job_duplicate_staging_readonly_audit_abort_model';
  version: 'v1';
  databaseRollbackRequired: false;
  localArtifactsOnly: true;
  deleteForbiddenOutputsImmediately: true;
  doNotCommitForbiddenOutputs: true;
  documentIncidentAndStop: true;
  abortOnWrongEnvironment: true;
  writesAllowed: false;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditRunbook = {
  type: 'email_job_duplicate_staging_readonly_audit_runbook';
  version: 'v1';
  scope: 'staging_only';
  status: 'planned_only';
  grantedByBoundary: false;
  dbReadOnlyAuditApproved: false;
  stagingDbReadApproved: false;
  productionDbReadApproved: false;
  sqlExecutionApproved: false;
  queryRunnerApproved: false;
  queryResultsApproved: false;
  reportsWithDataApproved: false;
  cleanupApproved: false;
  backfillApproved: false;
  enforcementApproved: false;
  humanApprovalGranted: false;
  readyMeansApproved: false;
  humanApprovalFormat: EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat;
  preflightChecklist: EmailJobDuplicateStagingReadOnlyAuditPreflightChecklist;
  allowedQueryClassEnvelopes: readonly EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope[];
  safeOutputPolicy: EmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy;
  stopCriteria: EmailJobDuplicateStagingReadOnlyAuditStopCriteria;
  abortModel: EmailJobDuplicateStagingReadOnlyAuditAbortModel;
  reasonCode: string;
};

export type ReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult = {
  status: 'ready';
  reasonCode: string;
  runbook: EmailJobDuplicateStagingReadOnlyAuditRunbook;
};

export type SkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobDuplicateStagingReadOnlyAuditRunbookErrorCode;
};

export type FailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobDuplicateStagingReadOnlyAuditRunbookErrorCode;
  retryable: boolean;
};

export type EmailJobDuplicateStagingReadOnlyAuditRunbookResult =
  | ReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult
  | SkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult
  | BlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult
  | FailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult;

export type EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult =
  | { valid: true; reasonCode: string }
  | {
      valid: false;
      reasonCode: string;
      errorCode: EmailJobDuplicateStagingReadOnlyAuditRunbookErrorCode;
    };

export type EmailJobDuplicateStagingReadOnlyAuditRunbookErrorCode =
  | 'invalid_runbook'
  | 'invalid_human_approval_format'
  | 'invalid_preflight_checklist'
  | 'invalid_allowed_query_class_envelope'
  | 'invalid_safe_output_policy'
  | 'invalid_stop_criteria'
  | 'invalid_abort_model'
  | 'invalid_result'
  | 'missing_query_class_envelope'
  | 'duplicate_query_class_envelope'
  | 'content_fingerprint_must_stay_blocked'
  | 'query_class_must_not_contain_sql'
  | 'query_class_must_not_be_execution_ready'
  | 'query_class_must_not_allow_db_read'
  | 'ready_must_not_imply_approval'
  | 'unsafe_projection_input'
  | 'unknown_email_job_duplicate_staging_readonly_audit_runbook_error';

type QueryClassDefinition = {
  outputCategory: EmailJobDuplicateStagingReadOnlyAuditOutputCategory;
  piiRisk: EmailJobDuplicateStagingReadOnlyAuditRiskLevel;
  performanceRisk: EmailJobDuplicateStagingReadOnlyAuditRiskLevel;
  loadRisk: EmailJobDuplicateStagingReadOnlyAuditRiskLevel;
  requiresSeparatePiiStrategy: boolean;
  requiresTimeWindow: boolean;
  deferred: boolean;
  blockedWithoutPiiStrategy: boolean;
  status: EmailJobDuplicateStagingReadOnlyAuditQueryEnvelopeStatus;
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

const OUTPUT_CATEGORIES = new Set<EmailJobDuplicateStagingReadOnlyAuditOutputCategory>([
  'aggregate_counts',
  'status_buckets',
  'kind_buckets',
  'risk_group_counts',
  'reason_codes',
  'pseudonymized_fingerprints',
  'manual_review_summary',
  'blocked_output',
]);

const RISK_LEVELS = new Set<EmailJobDuplicateStagingReadOnlyAuditRiskLevel>(['low', 'medium', 'high']);
const QUERY_ENVELOPE_STATUSES = new Set<EmailJobDuplicateStagingReadOnlyAuditQueryEnvelopeStatus>([
  'planned_category_only',
  'blocked_without_pii_strategy',
]);

const DEFAULT_BLOCKED_REASON = 'email_job_duplicate_staging_readonly_audit_runbook_blocked';
const DEFAULT_FAILED_REASON = 'email_job_duplicate_staging_readonly_audit_runbook_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_duplicate_staging_readonly_audit_runbook_skipped';
const REDACTED = '[redacted]';
const OMITTED = '[omitted]';
const EXAMPLE_ONLY_NOT_GRANTED = '[example-only-not-granted]';

const REQUIRED_SCOPE_BOUNDARIES = [
  'staging only',
  'read-only only',
  'no SQL files in repo',
  'no reports with data',
  'no email_jobs writes',
  'no cleanup',
  'no backfill',
  'no enforcement',
] as const;

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
  'subject',
  'html',
  'text',
  'body',
  'payload',
  'metadata',
  'lasterror',
  'last_error',
  'providererror',
  'provider_error',
  'queryresults',
  'query_results',
  'reportpath',
  'report_path',
  'csvpath',
  'csv_path',
  'jsonpath',
  'json_path',
  'sql',
  'query',
  'statement',
]);

const APPROVAL_TEXT_KEYS = new Set([
  'approvaltext',
  'approval_text',
  'exampleapprovaltext',
  'example_approval_text',
  'humanapprovaltext',
  'human_approval_text',
  'approvedby',
  'approved_by',
  'approver',
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
    reasonCode: 'aggregate_status_kind_counts_category_only',
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
    reasonCode: 'report_run_duplicate_candidate_counts_category_only',
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
    reasonCode: 'source_metadata_duplicate_candidate_counts_category_only',
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
    reasonCode: 'recipient_fingerprint_candidate_counts_category_only',
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
    reasonCode: 'status_bucket_scan_category_only',
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
    reasonCode: 'time_window_scan_category_only',
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
    reasonCode: 'failed_retry_ambiguity_scan_category_only',
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
    reasonCode: 'processing_stale_ambiguity_scan_category_only',
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
    reasonCode: 'content_fingerprint_scan_blocked_without_pii_strategy',
  },
};

export function buildDefaultEmailJobDuplicateStagingReadOnlyAuditRunbook(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_runbook_documented',
): EmailJobDuplicateStagingReadOnlyAuditRunbook {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_runbook',
    version: 'v1',
    scope: 'staging_only',
    status: 'planned_only',
    grantedByBoundary: false,
    dbReadOnlyAuditApproved: false,
    stagingDbReadApproved: false,
    productionDbReadApproved: false,
    sqlExecutionApproved: false,
    queryRunnerApproved: false,
    queryResultsApproved: false,
    reportsWithDataApproved: false,
    cleanupApproved: false,
    backfillApproved: false,
    enforcementApproved: false,
    humanApprovalGranted: false,
    readyMeansApproved: false,
    humanApprovalFormat: buildExampleStagingReadOnlyAuditHumanApprovalFormat(),
    preflightChecklist: buildDefaultStagingReadOnlyAuditPreflightChecklist(),
    allowedQueryClassEnvelopes: buildDefaultAllowedQueryClassEnvelopes(),
    safeOutputPolicy: buildDefaultStagingReadOnlyAuditSafeOutputPolicy(),
    stopCriteria: buildDefaultStagingReadOnlyAuditStopCriteria(),
    abortModel: buildDefaultStagingReadOnlyAuditAbortModel(),
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_runbook_documented',
  };
}

export function buildExampleStagingReadOnlyAuditHumanApprovalFormat(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_human_approval_format_documented',
): EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_human_approval_format',
    version: 'v1',
    scope: 'staging_only',
    exampleOnly: true,
    humanApprovalGranted: false,
    grantedByBoundary: false,
    readOnlyOnlyRequired: true,
    noSqlFilesInRepoRequired: true,
    noReportsWithDataRequired: true,
    noEmailJobWritesRequired: true,
    noCleanupRequired: true,
    noBackfillRequired: true,
    noEnforcementRequired: true,
    requiredScopeBoundaries: [...REQUIRED_SCOPE_BOUNDARIES],
    exampleApprovalText: [
      'Example only, not granted in P1.2B-25B:',
      '"Ich gebe P1.2B-26A Staging DB_READ_ONLY_AUDIT Preflight frei,',
      'ausschließlich für Staging,',
      'ausschließlich read-only,',
      'ohne SQL-Dateien im Repo,',
      'ohne Reports mit Daten,',
      'ohne email_jobs Writes,',
      'ohne Cleanup,',
      'ohne Backfill,',
      'ohne Enforcement."',
    ].join(' '),
    reasonCode: readText(reasonCode)
      || 'email_job_duplicate_staging_readonly_audit_human_approval_format_documented',
  };
}

export function buildDefaultStagingReadOnlyAuditPreflightChecklist(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_preflight_checklist_documented',
): EmailJobDuplicateStagingReadOnlyAuditPreflightChecklist {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_preflight_checklist',
    version: 'v1',
    confirmedStagingEnvironmentRequired: true,
    confirmedStagingDbTargetRequired: true,
    productionTargetExcluded: true,
    readOnlyRoleRequired: true,
    noWritePermissionsRequired: true,
    noMigrationPermissionsRequired: true,
    noCleanupPermissionsRequired: true,
    noBackfillPermissionsRequired: true,
    allowedQueryClassesCategoryOnly: true,
    safeOutputPolicyRequired: true,
    piiRulesRequired: true,
    performanceAndLoadReviewRequired: true,
    stopAbortProcedureRequired: true,
    noQueryResultsInRepoRequired: true,
    noReportsWithDataRequired: true,
    noCsvJsonExportsRequired: true,
    separateHumanApprovalRequired: true,
    humanApprovalGranted: false,
    grantedByBoundary: false,
    reasonCode: readText(reasonCode)
      || 'email_job_duplicate_staging_readonly_audit_preflight_checklist_documented',
  };
}

export function buildAggregateStatusKindAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.aggregate_status_kind_counts.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('aggregate_status_kind_counts', reasonCode);
}

export function buildReportRunDuplicateAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.report_run_duplicate_candidate_counts.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('report_run_duplicate_candidate_counts', reasonCode);
}

export function buildSourceMetadataDuplicateAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.source_metadata_duplicate_candidate_counts.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('source_metadata_duplicate_candidate_counts', reasonCode);
}

export function buildRecipientFingerprintAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.recipient_fingerprint_candidate_counts.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('recipient_fingerprint_candidate_counts', reasonCode);
}

export function buildContentFingerprintDeferredQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.content_fingerprint_scan.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('content_fingerprint_scan', reasonCode);
}

export function buildStatusBucketAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.status_bucket_scan.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('status_bucket_scan', reasonCode);
}

export function buildTimeWindowAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.time_window_scan.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('time_window_scan', reasonCode);
}

export function buildFailedRetryAmbiguityAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.failed_retry_ambiguity_scan.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('failed_retry_ambiguity_scan', reasonCode);
}

export function buildProcessingStaleAmbiguityAllowedQueryClassEnvelope(
  reasonCode = QUERY_CLASS_DEFINITIONS.processing_stale_ambiguity_scan.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  return buildAllowedQueryClassEnvelope('processing_stale_ambiguity_scan', reasonCode);
}

export function buildDefaultStagingReadOnlyAuditSafeOutputPolicy(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_safe_output_policy_documented',
): EmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_safe_output_policy',
    version: 'v1',
    futureApprovedOutputOnly: true,
    allowsAggregateCounts: true,
    allowsStatusBuckets: true,
    allowsKindBuckets: true,
    allowsRiskGroupCounts: true,
    allowsReasonCodes: true,
    allowsPseudonymizedFingerprints: false,
    requiresSeparatePiiApprovalForFingerprints: true,
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
    reasonCode: readText(reasonCode)
      || 'email_job_duplicate_staging_readonly_audit_safe_output_policy_documented',
  };
}

export function buildDefaultStagingReadOnlyAuditStopCriteria(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_stop_criteria_documented',
): EmailJobDuplicateStagingReadOnlyAuditStopCriteria {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_stop_criteria',
    version: 'v1',
    blocksUnclearEnvironment: true,
    blocksProductionTarget: true,
    blocksMissingReadOnlyRole: true,
    blocksWritePermissions: true,
    blocksMissingLimit: true,
    blocksMissingTimeWindow: true,
    blocksPotentialFullTableScan: true,
    blocksRawPiiOutput: true,
    blocksRawContentOutput: true,
    blocksFullMetadataOutput: true,
    blocksCommittedQueryResults: true,
    blocksCommittedReportsWithData: true,
    blocksMissingOperatorApproval: true,
    blocksCleanupUpdateDelete: true,
    blocksUnclearPerformanceRisk: true,
    blocksUnresolvedPiiStrategy: true,
    reasonCode: readText(reasonCode)
      || 'email_job_duplicate_staging_readonly_audit_stop_criteria_documented',
  };
}

export function buildDefaultStagingReadOnlyAuditAbortModel(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_abort_model_documented',
): EmailJobDuplicateStagingReadOnlyAuditAbortModel {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_abort_model',
    version: 'v1',
    databaseRollbackRequired: false,
    localArtifactsOnly: true,
    deleteForbiddenOutputsImmediately: true,
    doNotCommitForbiddenOutputs: true,
    documentIncidentAndStop: true,
    abortOnWrongEnvironment: true,
    writesAllowed: false,
    reasonCode: readText(reasonCode)
      || 'email_job_duplicate_staging_readonly_audit_abort_model_documented',
  };
}

export function validateEmailJobDuplicateStagingReadOnlyAuditRunbook(
  runbook: unknown,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  const record = asRecord(runbook);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_runbook') {
    return invalid('invalid_runbook', 'invalid_email_job_duplicate_staging_readonly_audit_runbook');
  }

  if (
    record.version !== 'v1'
    || record.scope !== 'staging_only'
    || record.status !== 'planned_only'
    || record.grantedByBoundary !== false
    || record.dbReadOnlyAuditApproved !== false
    || record.stagingDbReadApproved !== false
    || record.productionDbReadApproved !== false
    || record.sqlExecutionApproved !== false
    || record.queryRunnerApproved !== false
    || record.queryResultsApproved !== false
    || record.reportsWithDataApproved !== false
    || record.cleanupApproved !== false
    || record.backfillApproved !== false
    || record.enforcementApproved !== false
    || record.humanApprovalGranted !== false
    || record.readyMeansApproved !== false
    || !Array.isArray(record.allowedQueryClassEnvelopes)
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_runbook',
      'invalid_email_job_duplicate_staging_readonly_audit_runbook_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_runbook',
    );
  }

  const approvalFormat = validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat(record.humanApprovalFormat);
  if (!approvalFormat.valid) {
    return approvalFormat;
  }

  const checklist = validateEmailJobDuplicateStagingReadOnlyAuditPreflightChecklist(record.preflightChecklist);
  if (!checklist.valid) {
    return checklist;
  }

  const outputPolicy = validateEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy(record.safeOutputPolicy);
  if (!outputPolicy.valid) {
    return outputPolicy;
  }

  const stopCriteria = validateEmailJobDuplicateStagingReadOnlyAuditStopCriteria(record.stopCriteria);
  if (!stopCriteria.valid) {
    return stopCriteria;
  }

  const abortModel = validateEmailJobDuplicateStagingReadOnlyAuditAbortModel(record.abortModel);
  if (!abortModel.valid) {
    return abortModel;
  }

  const queryClasses = new Set<EmailJobDuplicateStagingReadOnlyAuditQueryClass>();
  for (const envelope of record.allowedQueryClassEnvelopes) {
    const validation = validateEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope(envelope);
    if (!validation.valid) {
      return validation;
    }

    if (queryClasses.has(envelope.queryClass)) {
      return invalid(
        'duplicate_query_class_envelope',
        'duplicate_email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope',
      );
    }
    queryClasses.add(envelope.queryClass);
  }

  for (const queryClass of QUERY_CLASSES) {
    if (!queryClasses.has(queryClass)) {
      return invalid(
        'missing_query_class_envelope',
        'missing_email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope',
      );
    }
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat(
  format: unknown,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  const record = asRecord(format);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_human_approval_format') {
    return invalid(
      'invalid_human_approval_format',
      'invalid_email_job_duplicate_staging_readonly_audit_human_approval_format',
    );
  }

  if (
    record.version !== 'v1'
    || record.scope !== 'staging_only'
    || record.exampleOnly !== true
    || record.humanApprovalGranted !== false
    || record.grantedByBoundary !== false
    || record.readOnlyOnlyRequired !== true
    || record.noSqlFilesInRepoRequired !== true
    || record.noReportsWithDataRequired !== true
    || record.noEmailJobWritesRequired !== true
    || record.noCleanupRequired !== true
    || record.noBackfillRequired !== true
    || record.noEnforcementRequired !== true
    || !Array.isArray(record.requiredScopeBoundaries)
    || !hasText(record.exampleApprovalText)
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_human_approval_format',
      'invalid_email_job_duplicate_staging_readonly_audit_human_approval_format_shape',
    );
  }

  if (!record.exampleApprovalText.toLowerCase().includes('example only')) {
    return invalid(
      'invalid_human_approval_format',
      'email_job_duplicate_staging_readonly_audit_human_approval_format_must_stay_example_only',
    );
  }

  if (record.exampleApprovalText.toLowerCase().includes('granted here')) {
    return invalid(
      'invalid_human_approval_format',
      'email_job_duplicate_staging_readonly_audit_human_approval_format_must_not_claim_granted_here',
    );
  }

  for (const boundary of REQUIRED_SCOPE_BOUNDARIES) {
    if (!record.requiredScopeBoundaries.includes(boundary)) {
      return invalid(
        'invalid_human_approval_format',
        'email_job_duplicate_staging_readonly_audit_human_approval_format_scope_boundary_missing',
      );
    }
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditPreflightChecklist(
  checklist: unknown,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  const record = asRecord(checklist);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_preflight_checklist') {
    return invalid(
      'invalid_preflight_checklist',
      'invalid_email_job_duplicate_staging_readonly_audit_preflight_checklist',
    );
  }

  if (
    record.version !== 'v1'
    || record.confirmedStagingEnvironmentRequired !== true
    || record.confirmedStagingDbTargetRequired !== true
    || record.productionTargetExcluded !== true
    || record.readOnlyRoleRequired !== true
    || record.noWritePermissionsRequired !== true
    || record.noMigrationPermissionsRequired !== true
    || record.noCleanupPermissionsRequired !== true
    || record.noBackfillPermissionsRequired !== true
    || record.allowedQueryClassesCategoryOnly !== true
    || record.safeOutputPolicyRequired !== true
    || record.piiRulesRequired !== true
    || record.performanceAndLoadReviewRequired !== true
    || record.stopAbortProcedureRequired !== true
    || record.noQueryResultsInRepoRequired !== true
    || record.noReportsWithDataRequired !== true
    || record.noCsvJsonExportsRequired !== true
    || record.separateHumanApprovalRequired !== true
    || record.humanApprovalGranted !== false
    || record.grantedByBoundary !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_preflight_checklist',
      'invalid_email_job_duplicate_staging_readonly_audit_preflight_checklist_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_preflight_checklist',
    );
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope(
  envelope: unknown,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  const record = asRecord(envelope);
  if (
    !record
    || record.type !== 'email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope'
  ) {
    return invalid(
      'invalid_allowed_query_class_envelope',
      'invalid_email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope',
    );
  }

  if (
    record.version !== 'v1'
    || !isQueryClass(record.queryClass)
    || !isQueryEnvelopeStatus(record.status)
    || record.grantedByBoundary !== false
    || record.dbReadOnlyAuditApproved !== false
    || record.stagingDbReadApproved !== false
    || record.productionDbReadApproved !== false
    || record.sqlExecutionApproved !== false
    || record.queryRunnerApproved !== false
    || record.queryResultsApproved !== false
    || record.reportsWithDataApproved !== false
    || record.cleanupApproved !== false
    || record.backfillApproved !== false
    || record.enforcementApproved !== false
    || record.executionReady !== false
    || record.containsSql !== false
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
      'invalid_allowed_query_class_envelope',
      'invalid_email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope',
    );
  }

  if (looksLikeSqlText(JSON.stringify(record))) {
    return invalid(
      'query_class_must_not_contain_sql',
      'email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope_must_not_contain_sql',
    );
  }

  if (record.executionReady !== false) {
    return invalid(
      'query_class_must_not_be_execution_ready',
      'email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope_must_not_be_execution_ready',
    );
  }

  if (record.stagingDbReadApproved !== false || record.productionDbReadApproved !== false) {
    return invalid(
      'query_class_must_not_allow_db_read',
      'email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope_must_not_allow_db_read',
    );
  }

  const definition = QUERY_CLASS_DEFINITIONS[record.queryClass];
  if (
    record.status !== definition.status
    || record.outputCategory !== definition.outputCategory
    || record.piiRisk !== definition.piiRisk
    || record.performanceRisk !== definition.performanceRisk
    || record.loadRisk !== definition.loadRisk
    || record.requiresSeparatePiiStrategy !== definition.requiresSeparatePiiStrategy
    || record.requiresTimeWindow !== definition.requiresTimeWindow
    || record.deferred !== definition.deferred
    || record.blockedWithoutPiiStrategy !== definition.blockedWithoutPiiStrategy
  ) {
    return invalid(
      'invalid_allowed_query_class_envelope',
      'email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope_definition_mismatch',
    );
  }

  if (record.queryClass === 'content_fingerprint_scan') {
    if (record.status !== 'blocked_without_pii_strategy' || record.blockedWithoutPiiStrategy !== true) {
      return invalid(
        'content_fingerprint_must_stay_blocked',
        'email_job_duplicate_staging_readonly_audit_content_fingerprint_scan_must_stay_blocked',
      );
    }
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy(
  policy: unknown,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_safe_output_policy') {
    return invalid(
      'invalid_safe_output_policy',
      'invalid_email_job_duplicate_staging_readonly_audit_safe_output_policy',
    );
  }

  if (
    record.version !== 'v1'
    || record.futureApprovedOutputOnly !== true
    || record.allowsAggregateCounts !== true
    || record.allowsStatusBuckets !== true
    || record.allowsKindBuckets !== true
    || record.allowsRiskGroupCounts !== true
    || record.allowsReasonCodes !== true
    || record.allowsPseudonymizedFingerprints !== false
    || record.requiresSeparatePiiApprovalForFingerprints !== true
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
    return invalid(
      'invalid_safe_output_policy',
      'invalid_email_job_duplicate_staging_readonly_audit_safe_output_policy_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_safe_output_policy',
    );
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditStopCriteria(
  criteria: unknown,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  const record = asRecord(criteria);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_stop_criteria') {
    return invalid(
      'invalid_stop_criteria',
      'invalid_email_job_duplicate_staging_readonly_audit_stop_criteria',
    );
  }

  if (
    record.version !== 'v1'
    || record.blocksUnclearEnvironment !== true
    || record.blocksProductionTarget !== true
    || record.blocksMissingReadOnlyRole !== true
    || record.blocksWritePermissions !== true
    || record.blocksMissingLimit !== true
    || record.blocksMissingTimeWindow !== true
    || record.blocksPotentialFullTableScan !== true
    || record.blocksRawPiiOutput !== true
    || record.blocksRawContentOutput !== true
    || record.blocksFullMetadataOutput !== true
    || record.blocksCommittedQueryResults !== true
    || record.blocksCommittedReportsWithData !== true
    || record.blocksMissingOperatorApproval !== true
    || record.blocksCleanupUpdateDelete !== true
    || record.blocksUnclearPerformanceRisk !== true
    || record.blocksUnresolvedPiiStrategy !== true
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_stop_criteria',
      'invalid_email_job_duplicate_staging_readonly_audit_stop_criteria_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_stop_criteria',
    );
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditAbortModel(
  model: unknown,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  const record = asRecord(model);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_abort_model') {
    return invalid(
      'invalid_abort_model',
      'invalid_email_job_duplicate_staging_readonly_audit_abort_model',
    );
  }

  if (
    record.version !== 'v1'
    || record.databaseRollbackRequired !== false
    || record.localArtifactsOnly !== true
    || record.deleteForbiddenOutputsImmediately !== true
    || record.doNotCommitForbiddenOutputs !== true
    || record.documentIncidentAndStop !== true
    || record.abortOnWrongEnvironment !== true
    || record.writesAllowed !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_abort_model',
      'invalid_email_job_duplicate_staging_readonly_audit_abort_model_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_abort_model',
    );
  }

  return valid(record.reasonCode);
}

export function buildReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  runbook: EmailJobDuplicateStagingReadOnlyAuditRunbook,
  reasonCode = 'email_job_duplicate_staging_readonly_audit_runbook_ready',
): EmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  const validation = validateEmailJobDuplicateStagingReadOnlyAuditRunbook(runbook);
  if (!validation.valid) {
    return buildBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
      validation.reasonCode,
      validation.errorCode,
    );
  }

  if (runbook.readyMeansApproved !== false || runbook.humanApprovalGranted !== false) {
    return buildBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
      'email_job_duplicate_staging_readonly_audit_runbook_ready_must_not_grant_approval',
      'ready_must_not_imply_approval',
    );
  }

  return {
    status: 'ready',
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_runbook_ready',
    runbook,
  };
}

export function buildSkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  reasonCode = DEFAULT_SKIPPED_REASON,
): EmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  return {
    status: 'skipped',
    reasonCode: readText(reasonCode) || DEFAULT_SKIPPED_REASON,
  };
}

export function buildBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  reasonCode = DEFAULT_BLOCKED_REASON,
  errorCode: EmailJobDuplicateStagingReadOnlyAuditRunbookErrorCode = 'invalid_result',
): EmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  return {
    status: 'blocked',
    reasonCode: readText(reasonCode) || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  reasonCode = DEFAULT_FAILED_REASON,
  errorCode: EmailJobDuplicateStagingReadOnlyAuditRunbookErrorCode = 'unknown_email_job_duplicate_staging_readonly_audit_runbook_error',
  retryable = false,
): EmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  return {
    status: 'failed',
    reasonCode: readText(reasonCode) || DEFAULT_FAILED_REASON,
    errorCode,
    retryable,
  };
}

export function isReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  result: unknown,
): result is ReadyEmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  result: unknown,
): result is SkippedEmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  result: unknown,
): result is BlockedEmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult(
  result: unknown,
): result is FailedEmailJobDuplicateStagingReadOnlyAuditRunbookResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookForLog(
  runbook: EmailJobDuplicateStagingReadOnlyAuditRunbook,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...runbook,
    humanApprovalFormat: buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog(
      runbook.humanApprovalFormat,
    ),
    preflightChecklist: buildSafeEmailJobDuplicateStagingReadOnlyAuditPreflightChecklistForLog(
      runbook.preflightChecklist,
    ),
    allowedQueryClassEnvelopes: runbook.allowedQueryClassEnvelopes.map((entry) => (
      buildSafeEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelopeForLog(entry)
    )),
    safeOutputPolicy: buildSafeEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicyForLog(
      runbook.safeOutputPolicy,
    ),
    stopCriteria: buildSafeEmailJobDuplicateStagingReadOnlyAuditStopCriteriaForLog(runbook.stopCriteria),
    abortModel: buildSafeEmailJobDuplicateStagingReadOnlyAuditAbortModelForLog(runbook.abortModel),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog(
  format: EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat,
): JsonRecord {
  return sanitizeForSafeProjection(format) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditPreflightChecklistForLog(
  checklist: EmailJobDuplicateStagingReadOnlyAuditPreflightChecklist,
): JsonRecord {
  return sanitizeForSafeProjection(checklist) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelopeForLog(
  envelope: EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope,
): JsonRecord {
  return sanitizeForSafeProjection(envelope) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicyForLog(
  policy: EmailJobDuplicateStagingReadOnlyAuditSafeOutputPolicy,
): JsonRecord {
  return sanitizeForSafeProjection(policy) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditStopCriteriaForLog(
  criteria: EmailJobDuplicateStagingReadOnlyAuditStopCriteria,
): JsonRecord {
  return sanitizeForSafeProjection(criteria) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditAbortModelForLog(
  model: EmailJobDuplicateStagingReadOnlyAuditAbortModel,
): JsonRecord {
  return sanitizeForSafeProjection(model) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookResultForLog(
  result: EmailJobDuplicateStagingReadOnlyAuditRunbookResult,
): JsonRecord {
  return buildSafeRunbookResultProjection(result);
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookResultForAudit(
  result: EmailJobDuplicateStagingReadOnlyAuditRunbookResult,
): JsonRecord {
  return buildSafeRunbookResultProjection(result);
}

function buildAllowedQueryClassEnvelope(
  queryClass: EmailJobDuplicateStagingReadOnlyAuditQueryClass,
  reasonCode: string,
): EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope {
  const definition = QUERY_CLASS_DEFINITIONS[queryClass];
  return {
    type: 'email_job_duplicate_staging_readonly_audit_allowed_query_class_envelope',
    version: 'v1',
    queryClass,
    status: definition.status,
    grantedByBoundary: false,
    dbReadOnlyAuditApproved: false,
    stagingDbReadApproved: false,
    productionDbReadApproved: false,
    sqlExecutionApproved: false,
    queryRunnerApproved: false,
    queryResultsApproved: false,
    reportsWithDataApproved: false,
    cleanupApproved: false,
    backfillApproved: false,
    enforcementApproved: false,
    executionReady: false,
    containsSql: false,
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
    reasonCode: readText(reasonCode) || definition.reasonCode,
  };
}

function buildDefaultAllowedQueryClassEnvelopes(): readonly EmailJobDuplicateStagingReadOnlyAuditAllowedQueryClassEnvelope[] {
  return [
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
}

function buildSafeRunbookResultProjection(
  result: EmailJobDuplicateStagingReadOnlyAuditRunbookResult,
): JsonRecord {
  if (result.status === 'ready') {
    return sanitizeForSafeProjection({
      status: result.status,
      reasonCode: result.reasonCode,
      runbook: buildSafeEmailJobDuplicateStagingReadOnlyAuditRunbookForLog(result.runbook),
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
    return value.map((entry) => sanitizeProjectedValue(entry));
  }

  if (typeof value === 'string') {
    if (looksLikeSqlText(value) || looksLikeSecretValue(value) || looksLikeReportPath(value)) {
      return OMITTED;
    }
    if (looksLikeApprovalGrant(value)) {
      return EXAMPLE_ONLY_NOT_GRANTED;
    }
    if (looksLikeEmailAddress(value)) {
      return REDACTED;
    }
    return value;
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
    if (APPROVAL_TEXT_KEYS.has(normalizedKey)) {
      output[key] = EXAMPLE_ONLY_NOT_GRANTED;
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
    if (typeof rawValue === 'string') {
      if (looksLikeSqlText(rawValue) || looksLikeSecretValue(rawValue) || looksLikeReportPath(rawValue)) {
        output[key] = OMITTED;
        continue;
      }
      if (looksLikeApprovalGrant(rawValue)) {
        output[key] = EXAMPLE_ONLY_NOT_GRANTED;
        continue;
      }
      if (looksLikeEmailAddress(rawValue)) {
        output[key] = REDACTED;
        continue;
      }
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

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function looksLikeSqlText(value: string): boolean {
  return /\bselect\s+.+\s+from\b|\binsert\s+into\b|\bupdate\s+\S+\s+set\b|\bdelete\s+from\b|\bgroup\s+by\b|\bhaving\b|\bjoin\b/i.test(value);
}

function looksLikeSecretValue(value: string): boolean {
  return /bearer\s+[a-z0-9._-]+|api[_-]?key|signing[_-]?secret|authorization|postgres(?:ql)?:\/\/|database_url/i.test(value);
}

function looksLikeReportPath(value: string): boolean {
  return /\/[^"' ]+\.(csv|json)|report[^"' ]*\.(csv|json)/i.test(value);
}

function looksLikeApprovalGrant(value: string): boolean {
  return /\b(i approve|ich gebe|approval granted|human approval granted)\b/i.test(value);
}

function looksLikeEmailAddress(value: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value);
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

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function valid(reasonCode: string): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  return { valid: true, reasonCode };
}

function invalid(
  errorCode: EmailJobDuplicateStagingReadOnlyAuditRunbookErrorCode,
  reasonCode: string,
): EmailJobDuplicateStagingReadOnlyAuditRunbookValidationResult {
  return {
    valid: false,
    errorCode,
    reasonCode,
  };
}

function isQueryClass(value: unknown): value is EmailJobDuplicateStagingReadOnlyAuditQueryClass {
  return typeof value === 'string' && QUERY_CLASSES.has(value as EmailJobDuplicateStagingReadOnlyAuditQueryClass);
}

function isOutputCategory(value: unknown): value is EmailJobDuplicateStagingReadOnlyAuditOutputCategory {
  return typeof value === 'string' && OUTPUT_CATEGORIES.has(value as EmailJobDuplicateStagingReadOnlyAuditOutputCategory);
}

function isRiskLevel(value: unknown): value is EmailJobDuplicateStagingReadOnlyAuditRiskLevel {
  return typeof value === 'string' && RISK_LEVELS.has(value as EmailJobDuplicateStagingReadOnlyAuditRiskLevel);
}

function isQueryEnvelopeStatus(
  value: unknown,
): value is EmailJobDuplicateStagingReadOnlyAuditQueryEnvelopeStatus {
  return (
    typeof value === 'string'
    && QUERY_ENVELOPE_STATUSES.has(value as EmailJobDuplicateStagingReadOnlyAuditQueryEnvelopeStatus)
  );
}
