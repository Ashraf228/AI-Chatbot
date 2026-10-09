import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobDuplicateReadOnlyQueryClass =
  | 'aggregate_by_status_kind'
  | 'duplicate_by_report_run'
  | 'duplicate_by_source_metadata'
  | 'duplicate_by_recipient_fingerprint'
  | 'duplicate_by_content_fingerprint'
  | 'status_bucket_scan'
  | 'time_window_scan'
  | 'failed_retry_ambiguity'
  | 'processing_stale_ambiguity';

export type EmailJobDuplicateQueryOutputShape =
  | 'aggregate_counts'
  | 'status_buckets'
  | 'kind_buckets'
  | 'risk_group_counts'
  | 'pseudonymized_fingerprints'
  | 'manual_review_summary'
  | 'blocked_raw_rows';

export type EmailJobDuplicateQueryRiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type EmailJobDuplicateQuerySafetyGateName =
  | 'read_only_role'
  | 'no_select_star'
  | 'limit_required'
  | 'time_window_required'
  | 'timeout_required'
  | 'sanitized_output_review'
  | 'no_committed_results'
  | 'db_target_confirmed';

export type EmailJobDuplicateQueryApprovalType =
  | 'docs_only'
  | 'staging_read'
  | 'production_read'
  | 'pii_fingerprinting'
  | 'report_generation'
  | 'cleanup'
  | 'backfill'
  | 'migration_index'
  | 'enforcement';

export type EmailJobDuplicateReadOnlyQueryClassPlan = {
  type: 'email_job_duplicate_readonly_query_class_plan';
  version: 'v1';
  queryClass: EmailJobDuplicateReadOnlyQueryClass;
  status: 'proposed_only';
  outputShape: EmailJobDuplicateQueryOutputShape;
  piiRisk: EmailJobDuplicateQueryRiskLevel;
  performanceRisk: EmailJobDuplicateQueryRiskLevel;
  requiresProductionReadApproval: boolean;
  requiresPiiStrategy: boolean;
  requiresTimeWindow: boolean;
  requiresLimit: true;
  reasonCode: string;
};

export type EmailJobDuplicateQuerySafetyGate = {
  type: 'email_job_duplicate_query_safety_gate';
  version: 'v1';
  gate: EmailJobDuplicateQuerySafetyGateName;
  required: true;
  blocksExecutionWithoutApproval: true;
  reasonCode: string;
};

export type EmailJobDuplicateQueryOutputPolicy = {
  type: 'email_job_duplicate_query_output_policy';
  version: 'v1';
  allowsAggregateCounts: boolean;
  allowsPseudonymizedFingerprints: boolean;
  allowsRawRecipientEmail: false;
  allowsSubject: false;
  allowsHtml: false;
  allowsText: false;
  allowsFullMetadata: false;
  allowsRowDump: false;
  allowsCommittedReport: false;
  reasonCode: string;
};

export type EmailJobDuplicateQueryApprovalRequirement = {
  type: 'email_job_duplicate_query_approval_requirement';
  version: 'v1';
  approvalType: EmailJobDuplicateQueryApprovalType;
  required: boolean;
  reasonCode: string;
};

export type EmailJobDuplicateQueryRiskAssessment = {
  type: 'email_job_duplicate_query_risk_assessment';
  version: 'v1';
  queryClass: EmailJobDuplicateReadOnlyQueryClass;
  piiRisk: EmailJobDuplicateQueryRiskLevel;
  performanceRisk: EmailJobDuplicateQueryRiskLevel;
  loadRisk: EmailJobDuplicateQueryRiskLevel;
  requiresTimeWindow: boolean;
  requiresLimit: boolean;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyQueryPlanItem =
  | EmailJobDuplicateReadOnlyQueryClassPlan
  | EmailJobDuplicateQuerySafetyGate
  | EmailJobDuplicateQueryOutputPolicy
  | EmailJobDuplicateQueryApprovalRequirement
  | EmailJobDuplicateQueryRiskAssessment;

export type ReadyEmailJobDuplicateReadOnlyQueryPlanResult = {
  status: 'ready';
  reasonCode: string;
  plan: EmailJobDuplicateReadOnlyQueryPlanItem;
};

export type SkippedEmailJobDuplicateReadOnlyQueryPlanResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobDuplicateReadOnlyQueryPlanResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobDuplicateReadOnlyQueryPlanErrorCode;
};

export type FailedEmailJobDuplicateReadOnlyQueryPlanResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobDuplicateReadOnlyQueryPlanErrorCode;
  retryable: boolean;
};

export type EmailJobDuplicateReadOnlyQueryPlanResult =
  | ReadyEmailJobDuplicateReadOnlyQueryPlanResult
  | SkippedEmailJobDuplicateReadOnlyQueryPlanResult
  | BlockedEmailJobDuplicateReadOnlyQueryPlanResult
  | FailedEmailJobDuplicateReadOnlyQueryPlanResult;

export type EmailJobDuplicateReadOnlyQueryPlanValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobDuplicateReadOnlyQueryPlanErrorCode };

export type EmailJobDuplicateReadOnlyQueryPlanErrorCode =
  | 'missing_plan'
  | 'missing_reason_code'
  | 'invalid_query_class'
  | 'invalid_output_shape'
  | 'invalid_risk_level'
  | 'invalid_query_class_plan'
  | 'invalid_safety_gate'
  | 'invalid_output_policy'
  | 'invalid_approval_requirement'
  | 'invalid_risk_assessment'
  | 'invalid_result'
  | 'unsupported_plan_type'
  | 'content_fingerprint_requires_pii_strategy'
  | 'recipient_fingerprint_requires_pii_strategy'
  | 'time_window_required'
  | 'limit_required'
  | 'unknown_email_job_duplicate_readonly_query_plan_error';

type JsonRecord = Record<string, unknown>;

type QueryClassDefinition = {
  outputShape: EmailJobDuplicateQueryOutputShape;
  piiRisk: EmailJobDuplicateQueryRiskLevel;
  performanceRisk: EmailJobDuplicateQueryRiskLevel;
  loadRisk: EmailJobDuplicateQueryRiskLevel;
  requiresProductionReadApproval: boolean;
  requiresPiiStrategy: boolean;
  requiresTimeWindow: boolean;
  reasonCode: string;
};

const QUERY_CLASSES = new Set<EmailJobDuplicateReadOnlyQueryClass>([
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
const OUTPUT_SHAPES = new Set<EmailJobDuplicateQueryOutputShape>([
  'aggregate_counts',
  'status_buckets',
  'kind_buckets',
  'risk_group_counts',
  'pseudonymized_fingerprints',
  'manual_review_summary',
  'blocked_raw_rows',
]);
const RISK_LEVELS = new Set<EmailJobDuplicateQueryRiskLevel>([
  'low',
  'medium',
  'high',
  'blocked',
]);
const SAFETY_GATES = new Set<EmailJobDuplicateQuerySafetyGateName>([
  'read_only_role',
  'no_select_star',
  'limit_required',
  'time_window_required',
  'timeout_required',
  'sanitized_output_review',
  'no_committed_results',
  'db_target_confirmed',
]);
const APPROVAL_TYPES = new Set<EmailJobDuplicateQueryApprovalType>([
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
const DEFAULT_BLOCKED_REASON = 'email_job_duplicate_readonly_query_plan_blocked';
const DEFAULT_FAILED_REASON = 'email_job_duplicate_readonly_query_plan_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_duplicate_readonly_query_plan_skipped';
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
  'sql',
  'queryresults',
  'query_results',
  'reportpath',
  'report_path',
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

const QUERY_CLASS_DEFINITIONS: Record<EmailJobDuplicateReadOnlyQueryClass, QueryClassDefinition> = {
  aggregate_by_status_kind: {
    outputShape: 'aggregate_counts',
    piiRisk: 'low',
    performanceRisk: 'low',
    loadRisk: 'low',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: false,
    requiresTimeWindow: true,
    reasonCode: 'aggregate_status_kind_query_class_plan',
  },
  duplicate_by_report_run: {
    outputShape: 'aggregate_counts',
    piiRisk: 'medium',
    performanceRisk: 'high',
    loadRisk: 'medium',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: false,
    requiresTimeWindow: true,
    reasonCode: 'report_run_duplicate_query_class_plan',
  },
  duplicate_by_source_metadata: {
    outputShape: 'risk_group_counts',
    piiRisk: 'medium',
    performanceRisk: 'high',
    loadRisk: 'high',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: false,
    requiresTimeWindow: true,
    reasonCode: 'source_metadata_duplicate_query_class_plan',
  },
  duplicate_by_recipient_fingerprint: {
    outputShape: 'pseudonymized_fingerprints',
    piiRisk: 'high',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: true,
    requiresTimeWindow: true,
    reasonCode: 'recipient_fingerprint_duplicate_query_class_plan',
  },
  duplicate_by_content_fingerprint: {
    outputShape: 'blocked_raw_rows',
    piiRisk: 'blocked',
    performanceRisk: 'blocked',
    loadRisk: 'blocked',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: true,
    requiresTimeWindow: true,
    reasonCode: 'content_fingerprint_duplicate_query_class_plan',
  },
  status_bucket_scan: {
    outputShape: 'status_buckets',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'low',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: false,
    requiresTimeWindow: true,
    reasonCode: 'status_bucket_query_class_plan',
  },
  time_window_scan: {
    outputShape: 'aggregate_counts',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: false,
    requiresTimeWindow: true,
    reasonCode: 'time_window_duplicate_query_class_plan',
  },
  failed_retry_ambiguity: {
    outputShape: 'manual_review_summary',
    piiRisk: 'medium',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: false,
    requiresTimeWindow: true,
    reasonCode: 'failed_retry_ambiguity_query_class_plan',
  },
  processing_stale_ambiguity: {
    outputShape: 'manual_review_summary',
    piiRisk: 'low',
    performanceRisk: 'medium',
    loadRisk: 'medium',
    requiresProductionReadApproval: true,
    requiresPiiStrategy: false,
    requiresTimeWindow: true,
    reasonCode: 'processing_stale_ambiguity_query_class_plan',
  },
};

export function buildAggregateStatusKindQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.aggregate_by_status_kind.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('aggregate_by_status_kind', reasonCode);
}

export function buildReportRunDuplicateQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.duplicate_by_report_run.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('duplicate_by_report_run', reasonCode);
}

export function buildSourceMetadataDuplicateQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.duplicate_by_source_metadata.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('duplicate_by_source_metadata', reasonCode);
}

export function buildRecipientFingerprintDuplicateQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.duplicate_by_recipient_fingerprint.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('duplicate_by_recipient_fingerprint', reasonCode);
}

export function buildContentFingerprintDuplicateQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.duplicate_by_content_fingerprint.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('duplicate_by_content_fingerprint', reasonCode);
}

export function buildStatusBucketQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.status_bucket_scan.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('status_bucket_scan', reasonCode);
}

export function buildTimeWindowDuplicateQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.time_window_scan.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('time_window_scan', reasonCode);
}

export function buildFailedRetryAmbiguityQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.failed_retry_ambiguity.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('failed_retry_ambiguity', reasonCode);
}

export function buildProcessingStaleAmbiguityQueryClassPlan(
  reasonCode = QUERY_CLASS_DEFINITIONS.processing_stale_ambiguity.reasonCode,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  return buildQueryClassPlan('processing_stale_ambiguity', reasonCode);
}

export function validateEmailJobDuplicateReadOnlyQueryClassPlan(
  plan: unknown,
): EmailJobDuplicateReadOnlyQueryPlanValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_duplicate_readonly_query_class_plan') {
    return invalid('invalid_query_class_plan', 'invalid_email_job_duplicate_readonly_query_class_plan');
  }

  if (
    record.version !== 'v1'
    || record.status !== 'proposed_only'
    || !isQueryClass(record.queryClass)
    || !isOutputShape(record.outputShape)
    || !isRiskLevel(record.piiRisk)
    || !isRiskLevel(record.performanceRisk)
    || typeof record.requiresProductionReadApproval !== 'boolean'
    || typeof record.requiresPiiStrategy !== 'boolean'
    || typeof record.requiresTimeWindow !== 'boolean'
    || record.requiresLimit !== true
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_query_class_plan', 'invalid_email_job_duplicate_readonly_query_class_plan_shape');
  }

  if (!matchesQueryClassDefinition(record as EmailJobDuplicateReadOnlyQueryClassPlan)) {
    return invalid('invalid_query_class_plan', 'query_class_plan_does_not_match_documented_boundary');
  }

  if (
    record.queryClass === 'duplicate_by_recipient_fingerprint'
    && record.requiresPiiStrategy !== true
  ) {
    return invalid('recipient_fingerprint_requires_pii_strategy', 'recipient_fingerprint_query_requires_pii_strategy');
  }

  if (
    record.queryClass === 'duplicate_by_content_fingerprint'
    && (record.requiresPiiStrategy !== true || record.outputShape !== 'blocked_raw_rows')
  ) {
    return invalid('content_fingerprint_requires_pii_strategy', 'content_fingerprint_query_requires_blocked_plan');
  }

  if (record.queryClass === 'time_window_scan' && record.requiresTimeWindow !== true) {
    return invalid('time_window_required', 'time_window_query_requires_time_window');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildReadOnlyRoleSafetyGate(
  reasonCode = 'read_only_role_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('read_only_role', reasonCode);
}

export function buildNoSelectStarSafetyGate(
  reasonCode = 'no_select_star_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('no_select_star', reasonCode);
}

export function buildLimitRequiredSafetyGate(
  reasonCode = 'query_limit_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('limit_required', reasonCode);
}

export function buildTimeWindowRequiredSafetyGate(
  reasonCode = 'time_window_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('time_window_required', reasonCode);
}

export function buildTimeoutRequiredSafetyGate(
  reasonCode = 'query_timeout_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('timeout_required', reasonCode);
}

export function buildSanitizedOutputReviewSafetyGate(
  reasonCode = 'sanitized_output_review_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('sanitized_output_review', reasonCode);
}

export function buildNoCommittedResultsSafetyGate(
  reasonCode = 'no_committed_results_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('no_committed_results', reasonCode);
}

export function buildDbTargetConfirmedSafetyGate(
  reasonCode = 'db_target_confirmation_required',
): EmailJobDuplicateQuerySafetyGate {
  return buildSafetyGate('db_target_confirmed', reasonCode);
}

export function validateEmailJobDuplicateQuerySafetyGate(
  gate: unknown,
): EmailJobDuplicateReadOnlyQueryPlanValidationResult {
  const record = asRecord(gate);
  if (!record || record.type !== 'email_job_duplicate_query_safety_gate') {
    return invalid('invalid_safety_gate', 'invalid_email_job_duplicate_query_safety_gate');
  }

  if (
    record.version !== 'v1'
    || !isSafetyGate(record.gate)
    || record.required !== true
    || record.blocksExecutionWithoutApproval !== true
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_safety_gate', 'invalid_email_job_duplicate_query_safety_gate_shape');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildAggregateOnlyQueryOutputPolicy(
  reasonCode = 'aggregate_only_query_output_policy',
): EmailJobDuplicateQueryOutputPolicy {
  return buildOutputPolicy(true, false, reasonCode);
}

export function buildPseudonymizedFingerprintQueryOutputPolicy(
  reasonCode = 'pseudonymized_fingerprint_query_output_policy',
): EmailJobDuplicateQueryOutputPolicy {
  return buildOutputPolicy(true, true, reasonCode);
}

export function buildBlockedRawRowsQueryOutputPolicy(
  reasonCode = 'blocked_raw_rows_query_output_policy',
): EmailJobDuplicateQueryOutputPolicy {
  return buildOutputPolicy(false, false, reasonCode);
}

export function validateEmailJobDuplicateQueryOutputPolicy(
  policy: unknown,
): EmailJobDuplicateReadOnlyQueryPlanValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_duplicate_query_output_policy') {
    return invalid('invalid_output_policy', 'invalid_email_job_duplicate_query_output_policy');
  }

  if (
    record.version !== 'v1'
    || typeof record.allowsAggregateCounts !== 'boolean'
    || typeof record.allowsPseudonymizedFingerprints !== 'boolean'
    || record.allowsRawRecipientEmail !== false
    || record.allowsSubject !== false
    || record.allowsHtml !== false
    || record.allowsText !== false
    || record.allowsFullMetadata !== false
    || record.allowsRowDump !== false
    || record.allowsCommittedReport !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_output_policy', 'invalid_email_job_duplicate_query_output_policy_shape');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildDocsOnlyApprovalRequirement(
  reasonCode = 'docs_only_query_planning_does_not_require_db_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('docs_only', false, reasonCode);
}

export function buildStagingReadApprovalRequirement(
  reasonCode = 'staging_read_requires_separate_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('staging_read', true, reasonCode);
}

export function buildProductionReadApprovalRequirement(
  reasonCode = 'production_read_requires_explicit_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('production_read', true, reasonCode);
}

export function buildPiiFingerprintingApprovalRequirement(
  reasonCode = 'pii_fingerprinting_requires_separate_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('pii_fingerprinting', true, reasonCode);
}

export function buildReportGenerationApprovalRequirement(
  reasonCode = 'report_generation_requires_separate_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('report_generation', true, reasonCode);
}

export function buildCleanupApprovalRequirement(
  reasonCode = 'cleanup_requires_separate_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('cleanup', true, reasonCode);
}

export function buildBackfillApprovalRequirement(
  reasonCode = 'backfill_requires_separate_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('backfill', true, reasonCode);
}

export function buildMigrationIndexApprovalRequirement(
  reasonCode = 'migration_index_requires_separate_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('migration_index', true, reasonCode);
}

export function buildEnforcementApprovalRequirement(
  reasonCode = 'enforcement_requires_separate_approval',
): EmailJobDuplicateQueryApprovalRequirement {
  return buildApprovalRequirement('enforcement', true, reasonCode);
}

export function validateEmailJobDuplicateQueryApprovalRequirement(
  requirement: unknown,
): EmailJobDuplicateReadOnlyQueryPlanValidationResult {
  const record = asRecord(requirement);
  if (!record || record.type !== 'email_job_duplicate_query_approval_requirement') {
    return invalid('invalid_approval_requirement', 'invalid_email_job_duplicate_query_approval_requirement');
  }

  if (
    record.version !== 'v1'
    || !isApprovalType(record.approvalType)
    || typeof record.required !== 'boolean'
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_approval_requirement', 'invalid_email_job_duplicate_query_approval_requirement_shape');
  }

  if (record.approvalType !== 'docs_only' && record.required !== true) {
    return invalid('invalid_approval_requirement', 'non_docs_query_approval_must_be_required');
  }

  if (record.approvalType === 'docs_only' && record.required !== false) {
    return invalid('invalid_approval_requirement', 'docs_only_query_approval_must_not_be_granted');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildEmailJobDuplicateQueryRiskAssessment(
  queryClass: EmailJobDuplicateReadOnlyQueryClass,
  reasonCode?: string,
): EmailJobDuplicateQueryRiskAssessment {
  const definition = QUERY_CLASS_DEFINITIONS[queryClass];
  return {
    type: 'email_job_duplicate_query_risk_assessment',
    version: 'v1',
    queryClass,
    piiRisk: definition.piiRisk,
    performanceRisk: definition.performanceRisk,
    loadRisk: definition.loadRisk,
    requiresTimeWindow: definition.requiresTimeWindow,
    requiresLimit: true,
    reasonCode: readText(reasonCode) || `${definition.reasonCode}_risk_assessment`,
  };
}

export function validateEmailJobDuplicateQueryRiskAssessment(
  assessment: unknown,
): EmailJobDuplicateReadOnlyQueryPlanValidationResult {
  const record = asRecord(assessment);
  if (!record || record.type !== 'email_job_duplicate_query_risk_assessment') {
    return invalid('invalid_risk_assessment', 'invalid_email_job_duplicate_query_risk_assessment');
  }

  if (
    record.version !== 'v1'
    || !isQueryClass(record.queryClass)
    || !isRiskLevel(record.piiRisk)
    || !isRiskLevel(record.performanceRisk)
    || !isRiskLevel(record.loadRisk)
    || typeof record.requiresTimeWindow !== 'boolean'
    || typeof record.requiresLimit !== 'boolean'
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_risk_assessment', 'invalid_email_job_duplicate_query_risk_assessment_shape');
  }

  if (record.requiresLimit !== true) {
    return invalid('limit_required', 'query_risk_assessment_requires_limit');
  }

  const definition = QUERY_CLASS_DEFINITIONS[record.queryClass];
  if (
    record.piiRisk !== definition.piiRisk
    || record.performanceRisk !== definition.performanceRisk
    || record.loadRisk !== definition.loadRisk
  ) {
    return invalid('invalid_risk_assessment', 'query_risk_assessment_does_not_match_documented_risks');
  }

  if (record.queryClass === 'aggregate_by_status_kind' && record.piiRisk !== 'low') {
    return invalid('invalid_risk_level', 'aggregate_status_kind_query_must_be_low_pii');
  }

  if (
    record.queryClass === 'duplicate_by_recipient_fingerprint'
    && record.piiRisk !== 'high'
  ) {
    return invalid('recipient_fingerprint_requires_pii_strategy', 'recipient_fingerprint_query_must_be_high_pii');
  }

  if (
    record.queryClass === 'duplicate_by_content_fingerprint'
    && (record.piiRisk !== 'blocked' || record.performanceRisk !== 'blocked')
  ) {
    return invalid('content_fingerprint_requires_pii_strategy', 'content_fingerprint_query_must_remain_blocked');
  }

  if (record.queryClass === 'time_window_scan' && record.requiresTimeWindow !== true) {
    return invalid('time_window_required', 'time_window_query_risk_assessment_requires_time_window');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildReadyEmailJobDuplicateReadOnlyQueryPlanResult(
  plan: EmailJobDuplicateReadOnlyQueryPlanItem | unknown,
): EmailJobDuplicateReadOnlyQueryPlanResult {
  const validation = validateEmailJobDuplicateReadOnlyQueryPlanItem(plan);
  if (!validation.valid) {
    return buildBlockedEmailJobDuplicateReadOnlyQueryPlanResult(validation.reasonCode, validation.errorCode);
  }

  return {
    status: 'ready',
    reasonCode: validation.reasonCode,
    plan: plan as EmailJobDuplicateReadOnlyQueryPlanItem,
  };
}

export function buildSkippedEmailJobDuplicateReadOnlyQueryPlanResult(
  reasonCode: string,
): SkippedEmailJobDuplicateReadOnlyQueryPlanResult {
  return {
    status: 'skipped',
    reasonCode: readText(reasonCode) || DEFAULT_SKIPPED_REASON,
  };
}

export function buildBlockedEmailJobDuplicateReadOnlyQueryPlanResult(
  reasonCode: string,
  errorCode: EmailJobDuplicateReadOnlyQueryPlanErrorCode,
): BlockedEmailJobDuplicateReadOnlyQueryPlanResult {
  return {
    status: 'blocked',
    reasonCode: readText(reasonCode) || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobDuplicateReadOnlyQueryPlanResult(
  reasonCode: string,
  errorCode: EmailJobDuplicateReadOnlyQueryPlanErrorCode,
  retryable: boolean,
): FailedEmailJobDuplicateReadOnlyQueryPlanResult {
  return {
    status: 'failed',
    reasonCode: readText(reasonCode) || DEFAULT_FAILED_REASON,
    errorCode,
    retryable: Boolean(retryable),
  };
}

export function isReadyEmailJobDuplicateReadOnlyQueryPlanResult(
  result: unknown,
): result is ReadyEmailJobDuplicateReadOnlyQueryPlanResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobDuplicateReadOnlyQueryPlanResult(
  result: unknown,
): result is SkippedEmailJobDuplicateReadOnlyQueryPlanResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobDuplicateReadOnlyQueryPlanResult(
  result: unknown,
): result is BlockedEmailJobDuplicateReadOnlyQueryPlanResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobDuplicateReadOnlyQueryPlanResult(
  result: unknown,
): result is FailedEmailJobDuplicateReadOnlyQueryPlanResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobDuplicateReadOnlyQueryClassPlanForLog(
  plan: EmailJobDuplicateReadOnlyQueryClassPlan,
): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobDuplicateQuerySafetyGateForLog(
  gate: EmailJobDuplicateQuerySafetyGate,
): JsonRecord {
  return sanitizeForSafeProjection(gate) as JsonRecord;
}

export function buildSafeEmailJobDuplicateQueryOutputPolicyForLog(
  policy: EmailJobDuplicateQueryOutputPolicy,
): JsonRecord {
  return sanitizeForSafeProjection(policy) as JsonRecord;
}

export function buildSafeEmailJobDuplicateQueryApprovalRequirementForLog(
  requirement: EmailJobDuplicateQueryApprovalRequirement,
): JsonRecord {
  return sanitizeForSafeProjection(requirement) as JsonRecord;
}

export function buildSafeEmailJobDuplicateQueryRiskAssessmentForLog(
  assessment: EmailJobDuplicateQueryRiskAssessment,
): JsonRecord {
  return sanitizeForSafeProjection(assessment) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyQueryPlanResultForLog(
  result: EmailJobDuplicateReadOnlyQueryPlanResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateReadOnlyQueryPlanResultProjection(result);
}

export function buildSafeEmailJobDuplicateReadOnlyQueryPlanResultForAudit(
  result: EmailJobDuplicateReadOnlyQueryPlanResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateReadOnlyQueryPlanResultProjection(result);
}

export function validateEmailJobDuplicateReadOnlyQueryPlanItem(
  plan: unknown,
): EmailJobDuplicateReadOnlyQueryPlanValidationResult {
  const record = asRecord(plan);
  if (!record || !hasText(record.type)) {
    return invalid('missing_plan', 'missing_email_job_duplicate_readonly_query_plan_item');
  }

  if (record.type === 'email_job_duplicate_readonly_query_class_plan') {
    return validateEmailJobDuplicateReadOnlyQueryClassPlan(plan);
  }
  if (record.type === 'email_job_duplicate_query_safety_gate') {
    return validateEmailJobDuplicateQuerySafetyGate(plan);
  }
  if (record.type === 'email_job_duplicate_query_output_policy') {
    return validateEmailJobDuplicateQueryOutputPolicy(plan);
  }
  if (record.type === 'email_job_duplicate_query_approval_requirement') {
    return validateEmailJobDuplicateQueryApprovalRequirement(plan);
  }
  if (record.type === 'email_job_duplicate_query_risk_assessment') {
    return validateEmailJobDuplicateQueryRiskAssessment(plan);
  }

  return invalid('unsupported_plan_type', 'unsupported_email_job_duplicate_readonly_query_plan_item');
}

function buildQueryClassPlan(
  queryClass: EmailJobDuplicateReadOnlyQueryClass,
  reasonCode: string,
): EmailJobDuplicateReadOnlyQueryClassPlan {
  const definition = QUERY_CLASS_DEFINITIONS[queryClass];
  return {
    type: 'email_job_duplicate_readonly_query_class_plan',
    version: 'v1',
    queryClass,
    status: 'proposed_only',
    outputShape: definition.outputShape,
    piiRisk: definition.piiRisk,
    performanceRisk: definition.performanceRisk,
    requiresProductionReadApproval: definition.requiresProductionReadApproval,
    requiresPiiStrategy: definition.requiresPiiStrategy,
    requiresTimeWindow: definition.requiresTimeWindow,
    requiresLimit: true,
    reasonCode: readText(reasonCode) || definition.reasonCode,
  };
}

function buildSafetyGate(
  gate: EmailJobDuplicateQuerySafetyGateName,
  reasonCode: string,
): EmailJobDuplicateQuerySafetyGate {
  return {
    type: 'email_job_duplicate_query_safety_gate',
    version: 'v1',
    gate,
    required: true,
    blocksExecutionWithoutApproval: true,
    reasonCode: readText(reasonCode) || `${gate}_required`,
  };
}

function buildOutputPolicy(
  allowsAggregateCounts: boolean,
  allowsPseudonymizedFingerprints: boolean,
  reasonCode: string,
): EmailJobDuplicateQueryOutputPolicy {
  return {
    type: 'email_job_duplicate_query_output_policy',
    version: 'v1',
    allowsAggregateCounts,
    allowsPseudonymizedFingerprints,
    allowsRawRecipientEmail: false,
    allowsSubject: false,
    allowsHtml: false,
    allowsText: false,
    allowsFullMetadata: false,
    allowsRowDump: false,
    allowsCommittedReport: false,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_query_output_policy',
  };
}

function buildApprovalRequirement(
  approvalType: EmailJobDuplicateQueryApprovalType,
  required: boolean,
  reasonCode: string,
): EmailJobDuplicateQueryApprovalRequirement {
  return {
    type: 'email_job_duplicate_query_approval_requirement',
    version: 'v1',
    approvalType,
    required,
    reasonCode: readText(reasonCode) || `${approvalType}_approval_requirement`,
  };
}

function buildSafeEmailJobDuplicateReadOnlyQueryPlanResultProjection(
  result: EmailJobDuplicateReadOnlyQueryPlanResult,
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

function buildSafePlanProjection(plan: EmailJobDuplicateReadOnlyQueryPlanItem): unknown {
  if (plan.type === 'email_job_duplicate_readonly_query_class_plan') {
    return buildSafeEmailJobDuplicateReadOnlyQueryClassPlanForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_query_safety_gate') {
    return buildSafeEmailJobDuplicateQuerySafetyGateForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_query_output_policy') {
    return buildSafeEmailJobDuplicateQueryOutputPolicyForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_query_approval_requirement') {
    return buildSafeEmailJobDuplicateQueryApprovalRequirementForLog(plan);
  }
  return buildSafeEmailJobDuplicateQueryRiskAssessmentForLog(plan);
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

function matchesQueryClassDefinition(plan: EmailJobDuplicateReadOnlyQueryClassPlan): boolean {
  const definition = QUERY_CLASS_DEFINITIONS[plan.queryClass];
  return (
    plan.outputShape === definition.outputShape
    && plan.piiRisk === definition.piiRisk
    && plan.performanceRisk === definition.performanceRisk
    && plan.requiresProductionReadApproval === definition.requiresProductionReadApproval
    && plan.requiresPiiStrategy === definition.requiresPiiStrategy
    && plan.requiresTimeWindow === definition.requiresTimeWindow
  );
}

function looksLikeSqlText(value: string): boolean {
  return /\b(select|insert|update|delete|from|where)\b/i.test(value);
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

function isQueryClass(value: unknown): value is EmailJobDuplicateReadOnlyQueryClass {
  return typeof value === 'string' && QUERY_CLASSES.has(value as EmailJobDuplicateReadOnlyQueryClass);
}

function isOutputShape(value: unknown): value is EmailJobDuplicateQueryOutputShape {
  return typeof value === 'string' && OUTPUT_SHAPES.has(value as EmailJobDuplicateQueryOutputShape);
}

function isRiskLevel(value: unknown): value is EmailJobDuplicateQueryRiskLevel {
  return typeof value === 'string' && RISK_LEVELS.has(value as EmailJobDuplicateQueryRiskLevel);
}

function isSafetyGate(value: unknown): value is EmailJobDuplicateQuerySafetyGateName {
  return typeof value === 'string' && SAFETY_GATES.has(value as EmailJobDuplicateQuerySafetyGateName);
}

function isApprovalType(value: unknown): value is EmailJobDuplicateQueryApprovalType {
  return typeof value === 'string' && APPROVAL_TYPES.has(value as EmailJobDuplicateQueryApprovalType);
}

function invalid(
  errorCode: EmailJobDuplicateReadOnlyQueryPlanErrorCode,
  reasonCode: string,
): EmailJobDuplicateReadOnlyQueryPlanValidationResult {
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
