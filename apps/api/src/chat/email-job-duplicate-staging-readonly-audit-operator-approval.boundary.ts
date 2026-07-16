import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

type JsonRecord = Record<string, unknown>;

export type EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea =
  | 'db_readonly_audit'
  | 'staging_db_read'
  | 'production_db_read'
  | 'sql_execution'
  | 'query_runner'
  | 'query_results'
  | 'reports_with_data'
  | 'pii_fingerprinting'
  | 'manual_review_pack'
  | 'cleanup'
  | 'backfill'
  | 'migration_index'
  | 'idempotency_enforcement';

export type EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionState =
  | 'not_approved'
  | 'not_allowed';

export type EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey =
  | 'confirmed_staging_environment'
  | 'confirmed_staging_db_target'
  | 'confirmed_read_only_role'
  | 'confirmed_no_write_permissions'
  | 'confirmed_query_classes'
  | 'confirmed_output_policy'
  | 'confirmed_pii_rules'
  | 'confirmed_performance_review'
  | 'confirmed_stop_abort_procedure'
  | 'confirmed_human_operator_approval'
  | 'confirmed_no_committed_query_results'
  | 'confirmed_no_reports_with_data';

export type EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision = {
  type: 'email_job_duplicate_staging_readonly_audit_operator_approval_decision';
  version: 'v1';
  area: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea;
  currentDecision: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionState;
  requiredBeforeApproval: true;
  grantedByBoundary: false;
  allowsDbRead: false;
  allowsStagingDbRead: false;
  allowsProductionDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsQueryResults: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceItem = {
  type: 'email_job_duplicate_staging_readonly_audit_required_evidence_item';
  version: 'v1';
  evidence: EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey;
  requiredBeforeApproval: true;
  currentlyConfirmed: false;
  grantedByBoundary: false;
  note: string;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditRequiredEvidence = {
  type: 'email_job_duplicate_staging_readonly_audit_required_evidence';
  version: 'v1';
  items: readonly EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceItem[];
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditDecisionMatrixEntry = {
  type: 'email_job_duplicate_staging_readonly_audit_decision_matrix_entry';
  version: 'v1';
  area: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea;
  currentDecision: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionState;
  requiredBeforeApproval: true;
  requiredEvidence: readonly EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey[];
  grantedByBoundary: false;
  allowsDbRead: false;
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

export type EmailJobDuplicateStagingReadOnlyAuditDecisionMatrix = {
  type: 'email_job_duplicate_staging_readonly_audit_decision_matrix';
  version: 'v1';
  entries: readonly EmailJobDuplicateStagingReadOnlyAuditDecisionMatrixEntry[];
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditNonApprovalClause = {
  type: 'email_job_duplicate_staging_readonly_audit_non_approval_clause';
  version: 'v1';
  area: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea;
  currentDecision: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionState;
  requiredBeforeApproval: true;
  grantedByBoundary: false;
  allowsDbRead: false;
  allowsStagingDbRead: false;
  allowsProductionDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsQueryResults: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  clause: string;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses = {
  type: 'email_job_duplicate_staging_readonly_audit_non_approval_clauses';
  version: 'v1';
  clauses: readonly EmailJobDuplicateStagingReadOnlyAuditNonApprovalClause[];
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat = {
  type: 'email_job_duplicate_staging_readonly_audit_human_approval_format';
  version: 'v1';
  scope: 'staging_only';
  currentDecision: 'not_approved';
  exampleOnly: true;
  humanApprovalGranted: false;
  requiredBeforeApproval: true;
  grantedByBoundary: false;
  allowsDbRead: false;
  allowsStagingDbRead: false;
  allowsProductionDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsQueryResults: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  requiredScopeBoundaries: readonly string[];
  exampleApprovalText: string;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria = {
  type: 'email_job_duplicate_staging_readonly_audit_operator_stop_criteria';
  version: 'v1';
  blocksUnclearStagingEnvironment: true;
  blocksAccidentalProductionTarget: true;
  blocksMissingReadOnlyRole: true;
  blocksWritePermissionsPresent: true;
  blocksMissingLimit: true;
  blocksMissingTimeWindow: true;
  blocksPotentialFullTableScan: true;
  blocksRawPiiOutput: true;
  blocksRawContentOutput: true;
  blocksFullMetadataOutput: true;
  blocksCommittedQueryResults: true;
  blocksCommittedReportsWithData: true;
  blocksMissingHumanOperatorApproval: true;
  blocksCleanupBackfillEnforcementRequests: true;
  blocksUnclearPerformanceRisk: true;
  blocksUnresolvedPiiStrategy: true;
  reasonCode: string;
};

export type EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalPlanItem =
  | EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision
  | EmailJobDuplicateStagingReadOnlyAuditRequiredEvidence
  | EmailJobDuplicateStagingReadOnlyAuditDecisionMatrix
  | EmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses
  | EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat
  | EmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria;

export type ReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult = {
  status: 'ready';
  reasonCode: string;
  plan: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalPlanItem;
};

export type SkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalErrorCode;
};

export type FailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalErrorCode;
  retryable: boolean;
};

export type EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult =
  | ReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult
  | SkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult
  | BlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult
  | FailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult;

export type EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult =
  | { valid: true; reasonCode: string }
  | {
      valid: false;
      reasonCode: string;
      errorCode: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalErrorCode;
    };

export type EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalErrorCode =
  | 'invalid_decision'
  | 'invalid_area'
  | 'invalid_current_decision'
  | 'invalid_required_evidence'
  | 'missing_required_evidence'
  | 'duplicate_required_evidence'
  | 'invalid_decision_matrix'
  | 'missing_decision_matrix_area'
  | 'duplicate_decision_matrix_area'
  | 'invalid_non_approval_clauses'
  | 'missing_non_approval_clause'
  | 'duplicate_non_approval_clause'
  | 'invalid_human_approval_format'
  | 'invalid_stop_criteria'
  | 'invalid_result'
  | 'unsupported_plan_item'
  | 'unsafe_projection_input'
  | 'unknown_email_job_duplicate_staging_readonly_audit_operator_approval_error';

type AreaDefinition = {
  currentDecision: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionState;
  notes: string;
  clause: string;
  requiredEvidence: readonly EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey[];
  reasonCode: string;
};

type EvidenceDefinition = {
  note: string;
  reasonCode: string;
};

const APPROVAL_AREAS = new Set<EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea>([
  'db_readonly_audit',
  'staging_db_read',
  'production_db_read',
  'sql_execution',
  'query_runner',
  'query_results',
  'reports_with_data',
  'pii_fingerprinting',
  'manual_review_pack',
  'cleanup',
  'backfill',
  'migration_index',
  'idempotency_enforcement',
]);

const REQUIRED_EVIDENCE_KEYS = new Set<EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey>([
  'confirmed_staging_environment',
  'confirmed_staging_db_target',
  'confirmed_read_only_role',
  'confirmed_no_write_permissions',
  'confirmed_query_classes',
  'confirmed_output_policy',
  'confirmed_pii_rules',
  'confirmed_performance_review',
  'confirmed_stop_abort_procedure',
  'confirmed_human_operator_approval',
  'confirmed_no_committed_query_results',
  'confirmed_no_reports_with_data',
]);

const DEFAULT_BLOCKED_REASON = 'email_job_duplicate_staging_readonly_audit_operator_approval_blocked';
const DEFAULT_FAILED_REASON = 'email_job_duplicate_staging_readonly_audit_operator_approval_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_duplicate_staging_readonly_audit_operator_approval_skipped';
const REDACTED = '[redacted]';
const OMITTED = '[omitted]';
const EXAMPLE_ONLY_NOT_GRANTED = '[example-only-not-granted]';

const AREA_DEFINITIONS: Record<
  EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea,
  AreaDefinition
> = {
  db_readonly_audit: {
    currentDecision: 'not_approved',
    notes: 'DB_READ_ONLY_AUDIT remains a later separate explicit approval line.',
    clause: 'This boundary does not approve a real DB_READ_ONLY_AUDIT.',
    requiredEvidence: ['confirmed_human_operator_approval', 'confirmed_query_classes', 'confirmed_output_policy'],
    reasonCode: 'db_readonly_audit_not_approved',
  },
  staging_db_read: {
    currentDecision: 'not_approved',
    notes: 'Staging DB read remains explicitly unapproved until a later human task grants it.',
    clause: 'This boundary does not approve a staging DB read.',
    requiredEvidence: [
      'confirmed_staging_environment',
      'confirmed_staging_db_target',
      'confirmed_read_only_role',
      'confirmed_no_write_permissions',
      'confirmed_human_operator_approval',
    ],
    reasonCode: 'staging_db_read_not_approved',
  },
  production_db_read: {
    currentDecision: 'not_approved',
    notes: 'Production DB read remains a separately blocked later decision.',
    clause: 'This boundary does not approve a Production DB read.',
    requiredEvidence: ['confirmed_human_operator_approval'],
    reasonCode: 'production_db_read_not_approved',
  },
  sql_execution: {
    currentDecision: 'not_allowed',
    notes: 'SQL execution remains out of scope for this pure boundary.',
    clause: 'This boundary does not allow SQL execution.',
    requiredEvidence: ['confirmed_query_classes'],
    reasonCode: 'sql_execution_not_allowed',
  },
  query_runner: {
    currentDecision: 'not_allowed',
    notes: 'Query runner use remains outside this task.',
    clause: 'This boundary does not allow a query runner.',
    requiredEvidence: ['confirmed_query_classes'],
    reasonCode: 'query_runner_not_allowed',
  },
  query_results: {
    currentDecision: 'not_allowed',
    notes: 'Query results remain blocked from generation, storage, and commit.',
    clause: 'This boundary does not allow query results with row data.',
    requiredEvidence: ['confirmed_no_committed_query_results', 'confirmed_output_policy'],
    reasonCode: 'query_results_not_allowed',
  },
  reports_with_data: {
    currentDecision: 'not_allowed',
    notes: 'Reports with data remain blocked by default.',
    clause: 'This boundary does not allow reports with data.',
    requiredEvidence: ['confirmed_no_reports_with_data', 'confirmed_output_policy'],
    reasonCode: 'reports_with_data_not_allowed',
  },
  pii_fingerprinting: {
    currentDecision: 'not_approved',
    notes: 'Recipient or content fingerprinting remains blocked without a separate PII strategy.',
    clause: 'This boundary does not approve PII fingerprinting.',
    requiredEvidence: ['confirmed_pii_rules', 'confirmed_human_operator_approval'],
    reasonCode: 'pii_fingerprinting_not_approved',
  },
  manual_review_pack: {
    currentDecision: 'not_approved',
    notes: 'Manual review packs remain a later human-controlled output line only.',
    clause: 'This boundary does not approve a manual review pack.',
    requiredEvidence: ['confirmed_output_policy', 'confirmed_human_operator_approval'],
    reasonCode: 'manual_review_pack_not_approved',
  },
  cleanup: {
    currentDecision: 'not_allowed',
    notes: 'Cleanup work must not be bundled into a read-only audit approval step.',
    clause: 'This boundary does not allow cleanup work.',
    requiredEvidence: ['confirmed_stop_abort_procedure'],
    reasonCode: 'cleanup_not_allowed',
  },
  backfill: {
    currentDecision: 'not_allowed',
    notes: 'Backfill work remains a separate later line only.',
    clause: 'This boundary does not allow backfill work.',
    requiredEvidence: ['confirmed_stop_abort_procedure'],
    reasonCode: 'backfill_not_allowed',
  },
  migration_index: {
    currentDecision: 'not_allowed',
    notes: 'Schema changes and index work remain out of scope.',
    clause: 'This boundary does not allow migration or index work.',
    requiredEvidence: ['confirmed_stop_abort_procedure'],
    reasonCode: 'migration_index_not_allowed',
  },
  idempotency_enforcement: {
    currentDecision: 'not_allowed',
    notes: 'Idempotency enforcement remains a later runtime and schema line only.',
    clause: 'This boundary does not allow idempotency enforcement.',
    requiredEvidence: ['confirmed_stop_abort_procedure'],
    reasonCode: 'idempotency_enforcement_not_allowed',
  },
};

const EVIDENCE_DEFINITIONS: Record<
  EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey,
  EvidenceDefinition
> = {
  confirmed_staging_environment: {
    note: 'A future approval must confirm that the target environment is staging only.',
    reasonCode: 'confirmed_staging_environment_required',
  },
  confirmed_staging_db_target: {
    note: 'A future approval must confirm the concrete staging DB target and exclude Production.',
    reasonCode: 'confirmed_staging_db_target_required',
  },
  confirmed_read_only_role: {
    note: 'A future approval must confirm a read-only DB role.',
    reasonCode: 'confirmed_read_only_role_required',
  },
  confirmed_no_write_permissions: {
    note: 'A future approval must confirm absence of write, schema-change, cleanup, and backfill privileges.',
    reasonCode: 'confirmed_no_write_permissions_required',
  },
  confirmed_query_classes: {
    note: 'A future approval must confirm only category-level allowed query classes.',
    reasonCode: 'confirmed_query_classes_required',
  },
  confirmed_output_policy: {
    note: 'A future approval must confirm safe aggregate-only output policy.',
    reasonCode: 'confirmed_output_policy_required',
  },
  confirmed_pii_rules: {
    note: 'A future approval must confirm PII handling and the blocked state for unresolved fingerprinting risk.',
    reasonCode: 'confirmed_pii_rules_required',
  },
  confirmed_performance_review: {
    note: 'A future approval must confirm performance and load review before any live read.',
    reasonCode: 'confirmed_performance_review_required',
  },
  confirmed_stop_abort_procedure: {
    note: 'A future approval must confirm stop and abort procedure coverage.',
    reasonCode: 'confirmed_stop_abort_procedure_required',
  },
  confirmed_human_operator_approval: {
    note: 'A future approval must include explicit human operator approval and it is not granted here.',
    reasonCode: 'confirmed_human_operator_approval_required',
  },
  confirmed_no_committed_query_results: {
    note: 'A future approval must confirm that query results are not committed or stored as reports.',
    reasonCode: 'confirmed_no_committed_query_results_required',
  },
  confirmed_no_reports_with_data: {
    note: 'A future approval must confirm that reports with data are not generated or committed.',
    reasonCode: 'confirmed_no_reports_with_data_required',
  },
};

const REQUIRED_SCOPE_BOUNDARIES = [
  'staging only',
  'read-only only',
  'no reports with data',
  'no cleanup',
  'no backfill',
  'no enforcement',
  'no Production DB read',
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
]);

const APPROVAL_TEXT_KEYS = new Set([
  'approvaltext',
  'approval_text',
  'exampleapprovaltext',
  'example_approval_text',
  'approvedby',
  'approved_by',
  'approver',
  'operatorapproval',
  'operator_approval',
]);

const IDENTIFIER_KEYS = new Set([
  'reportrunid',
  'report_run_id',
  'conversationid',
  'conversation_id',
  'sessionid',
  'session_id',
  'leadid',
  'lead_id',
]);

export function buildDbReadOnlyAuditOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.db_readonly_audit.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('db_readonly_audit', reasonCode);
}

export function buildStagingDbReadOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.staging_db_read.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('staging_db_read', reasonCode);
}

export function buildProductionDbReadOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.production_db_read.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('production_db_read', reasonCode);
}

export function buildSqlExecutionOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.sql_execution.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('sql_execution', reasonCode);
}

export function buildQueryRunnerOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.query_runner.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('query_runner', reasonCode);
}

export function buildQueryResultsOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.query_results.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('query_results', reasonCode);
}

export function buildReportsWithDataOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.reports_with_data.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('reports_with_data', reasonCode);
}

export function buildPiiFingerprintingOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.pii_fingerprinting.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('pii_fingerprinting', reasonCode);
}

export function buildManualReviewPackOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.manual_review_pack.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('manual_review_pack', reasonCode);
}

export function buildCleanupOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.cleanup.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('cleanup', reasonCode);
}

export function buildBackfillOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.backfill.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('backfill', reasonCode);
}

export function buildMigrationIndexOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.migration_index.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('migration_index', reasonCode);
}

export function buildIdempotencyEnforcementOperatorApprovalDecision(
  reasonCode = AREA_DEFINITIONS.idempotency_enforcement.reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  return buildDecision('idempotency_enforcement', reasonCode);
}

export function buildDefaultStagingReadOnlyAuditRequiredEvidence(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_required_evidence_documented',
): EmailJobDuplicateStagingReadOnlyAuditRequiredEvidence {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_required_evidence',
    version: 'v1',
    items: Array.from(REQUIRED_EVIDENCE_KEYS, (evidence) => buildRequiredEvidenceItem(evidence)),
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_required_evidence_documented',
  };
}

export function buildDefaultStagingReadOnlyAuditDecisionMatrix(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_decision_matrix_documented',
): EmailJobDuplicateStagingReadOnlyAuditDecisionMatrix {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_decision_matrix',
    version: 'v1',
    entries: Array.from(APPROVAL_AREAS, (area) => buildDecisionMatrixEntry(area)),
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_decision_matrix_documented',
  };
}

export function buildDefaultStagingReadOnlyAuditNonApprovalClauses(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_non_approval_clauses_documented',
): EmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_non_approval_clauses',
    version: 'v1',
    clauses: Array.from(APPROVAL_AREAS, (area) => buildNonApprovalClause(area)),
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_non_approval_clauses_documented',
  };
}

export function buildExampleHumanApprovalFormat(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_human_approval_format_documented',
): EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_human_approval_format',
    version: 'v1',
    scope: 'staging_only',
    currentDecision: 'not_approved',
    exampleOnly: true,
    humanApprovalGranted: false,
    requiredBeforeApproval: true,
    grantedByBoundary: false,
    allowsDbRead: false,
    allowsStagingDbRead: false,
    allowsProductionDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsQueryResults: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    requiredScopeBoundaries: [...REQUIRED_SCOPE_BOUNDARIES],
    exampleApprovalText: [
      'Example only, not granted in P1.2B-24B:',
      '"I approve a future staging-only read-only duplicate audit preflight,',
      'read-only only,',
      'no reports with data,',
      'no cleanup,',
      'no backfill,',
      'no enforcement,',
      'no Production DB read."',
    ].join(' '),
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_human_approval_format_documented',
  };
}

export function buildDefaultStagingReadOnlyAuditOperatorStopCriteria(
  reasonCode = 'email_job_duplicate_staging_readonly_audit_operator_stop_criteria_documented',
): EmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria {
  return {
    type: 'email_job_duplicate_staging_readonly_audit_operator_stop_criteria',
    version: 'v1',
    blocksUnclearStagingEnvironment: true,
    blocksAccidentalProductionTarget: true,
    blocksMissingReadOnlyRole: true,
    blocksWritePermissionsPresent: true,
    blocksMissingLimit: true,
    blocksMissingTimeWindow: true,
    blocksPotentialFullTableScan: true,
    blocksRawPiiOutput: true,
    blocksRawContentOutput: true,
    blocksFullMetadataOutput: true,
    blocksCommittedQueryResults: true,
    blocksCommittedReportsWithData: true,
    blocksMissingHumanOperatorApproval: true,
    blocksCleanupBackfillEnforcementRequests: true,
    blocksUnclearPerformanceRisk: true,
    blocksUnresolvedPiiStrategy: true,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_operator_stop_criteria_documented',
  };
}

export function validateEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision(
  decision: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(decision);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_operator_approval_decision') {
    return invalid('invalid_decision', 'invalid_email_job_duplicate_staging_readonly_audit_operator_approval_decision');
  }

  if (
    record.version !== 'v1'
    || !isApprovalArea(record.area)
    || !isDecisionState(record.currentDecision)
    || record.requiredBeforeApproval !== true
    || record.grantedByBoundary !== false
    || record.allowsDbRead !== false
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
    return invalid(
      'invalid_decision',
      'invalid_email_job_duplicate_staging_readonly_audit_operator_approval_decision_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_operator_approval_decision',
    );
  }

  const definition = AREA_DEFINITIONS[record.area];
  if (record.currentDecision !== definition.currentDecision) {
    return invalid(
      'invalid_current_decision',
      'email_job_duplicate_staging_readonly_audit_operator_approval_decision_state_mismatch',
    );
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditRequiredEvidence(
  evidence: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(evidence);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_required_evidence') {
    return invalid('invalid_required_evidence', 'invalid_email_job_duplicate_staging_readonly_audit_required_evidence');
  }

  if (
    record.version !== 'v1'
    || !Array.isArray(record.items)
    || record.items.length !== REQUIRED_EVIDENCE_KEYS.size
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_required_evidence',
      'invalid_email_job_duplicate_staging_readonly_audit_required_evidence_shape',
    );
  }

  const seen = new Set<EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey>();
  for (const item of record.items) {
    const validation = validateRequiredEvidenceItem(item);
    if (!validation.valid) {
      return validation;
    }
    const evidenceKey = (item as EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceItem).evidence;
    if (seen.has(evidenceKey)) {
      return invalid(
        'duplicate_required_evidence',
        'duplicate_email_job_duplicate_staging_readonly_audit_required_evidence_detected',
      );
    }
    seen.add(evidenceKey);
  }

  for (const evidenceKey of REQUIRED_EVIDENCE_KEYS) {
    if (!seen.has(evidenceKey)) {
      return invalid(
        'missing_required_evidence',
        'missing_email_job_duplicate_staging_readonly_audit_required_evidence',
      );
    }
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditDecisionMatrix(
  matrix: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(matrix);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_decision_matrix') {
    return invalid('invalid_decision_matrix', 'invalid_email_job_duplicate_staging_readonly_audit_decision_matrix');
  }

  if (
    record.version !== 'v1'
    || !Array.isArray(record.entries)
    || record.entries.length !== APPROVAL_AREAS.size
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_decision_matrix',
      'invalid_email_job_duplicate_staging_readonly_audit_decision_matrix_shape',
    );
  }

  const seen = new Set<EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea>();
  for (const entry of record.entries) {
    const validation = validateDecisionMatrixEntry(entry);
    if (!validation.valid) {
      return validation;
    }
    const area = (entry as EmailJobDuplicateStagingReadOnlyAuditDecisionMatrixEntry).area;
    if (seen.has(area)) {
      return invalid(
        'duplicate_decision_matrix_area',
        'duplicate_email_job_duplicate_staging_readonly_audit_decision_matrix_area_detected',
      );
    }
    seen.add(area);
  }

  for (const area of APPROVAL_AREAS) {
    if (!seen.has(area)) {
      return invalid(
        'missing_decision_matrix_area',
        'missing_email_job_duplicate_staging_readonly_audit_decision_matrix_area',
      );
    }
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses(
  clauses: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(clauses);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_non_approval_clauses') {
    return invalid(
      'invalid_non_approval_clauses',
      'invalid_email_job_duplicate_staging_readonly_audit_non_approval_clauses',
    );
  }

  if (
    record.version !== 'v1'
    || !Array.isArray(record.clauses)
    || record.clauses.length !== APPROVAL_AREAS.size
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_non_approval_clauses',
      'invalid_email_job_duplicate_staging_readonly_audit_non_approval_clauses_shape',
    );
  }

  const seen = new Set<EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea>();
  for (const clause of record.clauses) {
    const validation = validateNonApprovalClause(clause);
    if (!validation.valid) {
      return validation;
    }
    const area = (clause as EmailJobDuplicateStagingReadOnlyAuditNonApprovalClause).area;
    if (seen.has(area)) {
      return invalid(
        'duplicate_non_approval_clause',
        'duplicate_email_job_duplicate_staging_readonly_audit_non_approval_clause_detected',
      );
    }
    seen.add(area);
  }

  for (const area of APPROVAL_AREAS) {
    if (!seen.has(area)) {
      return invalid(
        'missing_non_approval_clause',
        'missing_email_job_duplicate_staging_readonly_audit_non_approval_clause',
      );
    }
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat(
  format: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
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
    || record.currentDecision !== 'not_approved'
    || record.exampleOnly !== true
    || record.humanApprovalGranted !== false
    || record.requiredBeforeApproval !== true
    || record.grantedByBoundary !== false
    || record.allowsDbRead !== false
    || record.allowsStagingDbRead !== false
    || record.allowsProductionDbRead !== false
    || record.allowsSqlExecution !== false
    || record.allowsQueryRunner !== false
    || record.allowsQueryResults !== false
    || record.allowsReportsWithData !== false
    || record.allowsCleanup !== false
    || record.allowsBackfill !== false
    || record.allowsEnforcement !== false
    || !Array.isArray(record.requiredScopeBoundaries)
    || !hasText(record.exampleApprovalText)
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_human_approval_format',
      'invalid_email_job_duplicate_staging_readonly_audit_human_approval_format_shape',
    );
  }

  if (containsForbiddenSurface({ ...record, exampleApprovalText: undefined })) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_human_approval_format',
    );
  }

  const boundaries = new Set(record.requiredScopeBoundaries.filter((value): value is string => hasText(value)));
  for (const boundary of REQUIRED_SCOPE_BOUNDARIES) {
    if (!boundaries.has(boundary)) {
      return invalid(
        'invalid_human_approval_format',
        'email_job_duplicate_staging_readonly_audit_human_approval_format_missing_scope_boundary',
      );
    }
  }

  const text = readText(record.exampleApprovalText) || '';
  if (!/example only/i.test(text) || !/not granted/i.test(text)) {
    return invalid(
      'invalid_human_approval_format',
      'email_job_duplicate_staging_readonly_audit_human_approval_format_must_stay_example_only',
    );
  }

  return valid(record.reasonCode);
}

export function validateEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria(
  criteria: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(criteria);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_operator_stop_criteria') {
    return invalid(
      'invalid_stop_criteria',
      'invalid_email_job_duplicate_staging_readonly_audit_operator_stop_criteria',
    );
  }

  if (!hasText(record.reasonCode) || record.version !== 'v1') {
    return invalid(
      'invalid_stop_criteria',
      'invalid_email_job_duplicate_staging_readonly_audit_operator_stop_criteria_shape',
    );
  }

  const requiredTrueKeys = [
    'blocksUnclearStagingEnvironment',
    'blocksAccidentalProductionTarget',
    'blocksMissingReadOnlyRole',
    'blocksWritePermissionsPresent',
    'blocksMissingLimit',
    'blocksMissingTimeWindow',
    'blocksPotentialFullTableScan',
    'blocksRawPiiOutput',
    'blocksRawContentOutput',
    'blocksFullMetadataOutput',
    'blocksCommittedQueryResults',
    'blocksCommittedReportsWithData',
    'blocksMissingHumanOperatorApproval',
    'blocksCleanupBackfillEnforcementRequests',
    'blocksUnclearPerformanceRisk',
    'blocksUnresolvedPiiStrategy',
  ] as const;

  for (const key of requiredTrueKeys) {
    if (record[key] !== true) {
      return invalid(
        'invalid_stop_criteria',
        'email_job_duplicate_staging_readonly_audit_operator_stop_criteria_must_block_risky_shapes',
      );
    }
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_operator_stop_criteria',
    );
  }

  return valid(record.reasonCode);
}

export function buildReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  plan: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalPlanItem,
  reasonCode = 'email_job_duplicate_staging_readonly_audit_operator_approval_ready',
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  const validation = validatePlanItem(plan);
  if (!validation.valid) {
    return buildBlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
      validation.reasonCode,
      validation.errorCode,
    );
  }

  return {
    status: 'ready',
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_operator_approval_ready',
    plan,
  };
}

export function buildSkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  reasonCode = DEFAULT_SKIPPED_REASON,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  return {
    status: 'skipped',
    reasonCode: readText(reasonCode) || DEFAULT_SKIPPED_REASON,
  };
}

export function buildBlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  reasonCode = DEFAULT_BLOCKED_REASON,
  errorCode: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalErrorCode = 'invalid_result',
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  return {
    status: 'blocked',
    reasonCode: readText(reasonCode) || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  reasonCode = DEFAULT_FAILED_REASON,
  errorCode: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalErrorCode = 'unknown_email_job_duplicate_staging_readonly_audit_operator_approval_error',
  retryable = false,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  return {
    status: 'failed',
    reasonCode: readText(reasonCode) || DEFAULT_FAILED_REASON,
    errorCode,
    retryable,
  };
}

export function isReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  result: unknown,
): result is ReadyEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  result: unknown,
): result is SkippedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  result: unknown,
): result is BlockedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult(
  result: unknown,
): result is FailedEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionForLog(
  decision: unknown,
): JsonRecord {
  return sanitizeForSafeProjection(decision) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceForLog(
  evidence: EmailJobDuplicateStagingReadOnlyAuditRequiredEvidence,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...evidence,
    items: evidence.items.map((item) => sanitizeForSafeProjection(item)),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditDecisionMatrixForLog(
  matrix: EmailJobDuplicateStagingReadOnlyAuditDecisionMatrix,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...matrix,
    entries: matrix.entries.map((entry) => sanitizeForSafeProjection(entry)),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditNonApprovalClausesForLog(
  clauses: EmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...clauses,
    clauses: clauses.clauses.map((clause) => sanitizeForSafeProjection(clause)),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog(
  format: EmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat,
): JsonRecord {
  return sanitizeForSafeProjection(format) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteriaForLog(
  criteria: EmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria,
): JsonRecord {
  return sanitizeForSafeProjection(criteria) as JsonRecord;
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResultForLog(
  result: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
): JsonRecord {
  return buildSafeOperatorApprovalResultProjection(result);
}

export function buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResultForAudit(
  result: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
): JsonRecord {
  return buildSafeOperatorApprovalResultProjection(result);
}

function buildDecision(
  area: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea,
  reasonCode: string,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision {
  const definition = AREA_DEFINITIONS[area];
  return {
    type: 'email_job_duplicate_staging_readonly_audit_operator_approval_decision',
    version: 'v1',
    area,
    currentDecision: definition.currentDecision,
    requiredBeforeApproval: true,
    grantedByBoundary: false,
    allowsDbRead: false,
    allowsStagingDbRead: false,
    allowsProductionDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsQueryResults: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    reasonCode: readText(reasonCode) || definition.reasonCode,
  };
}

function buildRequiredEvidenceItem(
  evidence: EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey,
  reasonCode = EVIDENCE_DEFINITIONS[evidence].reasonCode,
): EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceItem {
  const definition = EVIDENCE_DEFINITIONS[evidence];
  return {
    type: 'email_job_duplicate_staging_readonly_audit_required_evidence_item',
    version: 'v1',
    evidence,
    requiredBeforeApproval: true,
    currentlyConfirmed: false,
    grantedByBoundary: false,
    note: definition.note,
    reasonCode: readText(reasonCode) || definition.reasonCode,
  };
}

function buildDecisionMatrixEntry(
  area: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea,
): EmailJobDuplicateStagingReadOnlyAuditDecisionMatrixEntry {
  const definition = AREA_DEFINITIONS[area];
  return {
    type: 'email_job_duplicate_staging_readonly_audit_decision_matrix_entry',
    version: 'v1',
    area,
    currentDecision: definition.currentDecision,
    requiredBeforeApproval: true,
    requiredEvidence: [...definition.requiredEvidence],
    grantedByBoundary: false,
    allowsDbRead: false,
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
    reasonCode: definition.reasonCode,
  };
}

function buildNonApprovalClause(
  area: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea,
): EmailJobDuplicateStagingReadOnlyAuditNonApprovalClause {
  const definition = AREA_DEFINITIONS[area];
  return {
    type: 'email_job_duplicate_staging_readonly_audit_non_approval_clause',
    version: 'v1',
    area,
    currentDecision: definition.currentDecision,
    requiredBeforeApproval: true,
    grantedByBoundary: false,
    allowsDbRead: false,
    allowsStagingDbRead: false,
    allowsProductionDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsQueryResults: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    clause: definition.clause,
    reasonCode: definition.reasonCode,
  };
}

function validateRequiredEvidenceItem(
  item: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(item);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_required_evidence_item') {
    return invalid(
      'invalid_required_evidence',
      'invalid_email_job_duplicate_staging_readonly_audit_required_evidence_item',
    );
  }

  if (
    record.version !== 'v1'
    || !isRequiredEvidenceKey(record.evidence)
    || record.requiredBeforeApproval !== true
    || record.currentlyConfirmed !== false
    || record.grantedByBoundary !== false
    || !hasText(record.note)
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_required_evidence',
      'invalid_email_job_duplicate_staging_readonly_audit_required_evidence_item_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_required_evidence_item',
    );
  }

  const definition = EVIDENCE_DEFINITIONS[record.evidence];
  if (record.note !== definition.note) {
    return invalid(
      'invalid_required_evidence',
      'email_job_duplicate_staging_readonly_audit_required_evidence_item_must_match_documented_note',
    );
  }

  return valid(record.reasonCode);
}

function validateDecisionMatrixEntry(
  entry: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(entry);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_decision_matrix_entry') {
    return invalid(
      'invalid_decision_matrix',
      'invalid_email_job_duplicate_staging_readonly_audit_decision_matrix_entry',
    );
  }

  if (
    record.version !== 'v1'
    || !isApprovalArea(record.area)
    || !isDecisionState(record.currentDecision)
    || record.requiredBeforeApproval !== true
    || !Array.isArray(record.requiredEvidence)
    || record.grantedByBoundary !== false
    || record.allowsDbRead !== false
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
      'invalid_decision_matrix',
      'invalid_email_job_duplicate_staging_readonly_audit_decision_matrix_entry_shape',
    );
  }

  const definition = AREA_DEFINITIONS[record.area];
  if (record.currentDecision !== definition.currentDecision || record.notes !== definition.notes) {
    return invalid(
      'invalid_decision_matrix',
      'email_job_duplicate_staging_readonly_audit_decision_matrix_entry_definition_mismatch',
    );
  }

  const requiredEvidence = new Set<EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey>();
  for (const evidence of record.requiredEvidence) {
    if (!isRequiredEvidenceKey(evidence)) {
      return invalid(
        'invalid_decision_matrix',
        'email_job_duplicate_staging_readonly_audit_decision_matrix_entry_evidence_invalid',
      );
    }
    requiredEvidence.add(evidence);
  }

  if (requiredEvidence.size !== definition.requiredEvidence.length) {
    return invalid(
      'invalid_decision_matrix',
      'email_job_duplicate_staging_readonly_audit_decision_matrix_entry_evidence_length_mismatch',
    );
  }

  for (const evidence of definition.requiredEvidence) {
    if (!requiredEvidence.has(evidence)) {
      return invalid(
        'invalid_decision_matrix',
        'email_job_duplicate_staging_readonly_audit_decision_matrix_entry_evidence_missing',
      );
    }
  }

  return valid(record.reasonCode);
}

function validateNonApprovalClause(
  clause: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(clause);
  if (!record || record.type !== 'email_job_duplicate_staging_readonly_audit_non_approval_clause') {
    return invalid(
      'invalid_non_approval_clauses',
      'invalid_email_job_duplicate_staging_readonly_audit_non_approval_clause',
    );
  }

  if (
    record.version !== 'v1'
    || !isApprovalArea(record.area)
    || !isDecisionState(record.currentDecision)
    || record.requiredBeforeApproval !== true
    || record.grantedByBoundary !== false
    || record.allowsDbRead !== false
    || record.allowsStagingDbRead !== false
    || record.allowsProductionDbRead !== false
    || record.allowsSqlExecution !== false
    || record.allowsQueryRunner !== false
    || record.allowsQueryResults !== false
    || record.allowsReportsWithData !== false
    || record.allowsCleanup !== false
    || record.allowsBackfill !== false
    || record.allowsEnforcement !== false
    || !hasText(record.clause)
    || !hasText(record.reasonCode)
  ) {
    return invalid(
      'invalid_non_approval_clauses',
      'invalid_email_job_duplicate_staging_readonly_audit_non_approval_clause_shape',
    );
  }

  if (containsForbiddenSurface(record)) {
    return invalid(
      'unsafe_projection_input',
      'unsafe_surface_detected_in_email_job_duplicate_staging_readonly_audit_non_approval_clause',
    );
  }

  const definition = AREA_DEFINITIONS[record.area];
  if (record.currentDecision !== definition.currentDecision || record.clause !== definition.clause) {
    return invalid(
      'invalid_non_approval_clauses',
      'email_job_duplicate_staging_readonly_audit_non_approval_clause_definition_mismatch',
    );
  }

  return valid(record.reasonCode);
}

function validatePlanItem(
  plan: unknown,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  const record = asRecord(plan);
  if (!record) {
    return invalid(
      'unsupported_plan_item',
      'email_job_duplicate_staging_readonly_audit_operator_approval_plan_item_required',
    );
  }

  switch (record.type) {
    case 'email_job_duplicate_staging_readonly_audit_operator_approval_decision':
      return validateEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecision(plan);
    case 'email_job_duplicate_staging_readonly_audit_required_evidence':
      return validateEmailJobDuplicateStagingReadOnlyAuditRequiredEvidence(plan);
    case 'email_job_duplicate_staging_readonly_audit_decision_matrix':
      return validateEmailJobDuplicateStagingReadOnlyAuditDecisionMatrix(plan);
    case 'email_job_duplicate_staging_readonly_audit_non_approval_clauses':
      return validateEmailJobDuplicateStagingReadOnlyAuditNonApprovalClauses(plan);
    case 'email_job_duplicate_staging_readonly_audit_human_approval_format':
      return validateEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormat(plan);
    case 'email_job_duplicate_staging_readonly_audit_operator_stop_criteria':
      return validateEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteria(plan);
    default:
      return invalid(
        'unsupported_plan_item',
        'unsupported_email_job_duplicate_staging_readonly_audit_operator_approval_plan_item',
      );
  }
}

function buildSafeOperatorApprovalResultProjection(
  result: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalResult,
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

function buildSafePlanProjection(plan: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalPlanItem): unknown {
  switch (plan.type) {
    case 'email_job_duplicate_staging_readonly_audit_operator_approval_decision':
      return buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionForLog(plan);
    case 'email_job_duplicate_staging_readonly_audit_required_evidence':
      return buildSafeEmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceForLog(plan);
    case 'email_job_duplicate_staging_readonly_audit_decision_matrix':
      return buildSafeEmailJobDuplicateStagingReadOnlyAuditDecisionMatrixForLog(plan);
    case 'email_job_duplicate_staging_readonly_audit_non_approval_clauses':
      return buildSafeEmailJobDuplicateStagingReadOnlyAuditNonApprovalClausesForLog(plan);
    case 'email_job_duplicate_staging_readonly_audit_human_approval_format':
      return buildSafeEmailJobDuplicateStagingReadOnlyAuditHumanApprovalFormatForLog(plan);
    default:
      return buildSafeEmailJobDuplicateStagingReadOnlyAuditOperatorStopCriteriaForLog(plan);
  }
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
    return looksLikeSqlText(value) || looksLikeSecretValue(value) || looksLikeReportPath(value) || looksLikeEmailAddress(value);
  }

  const record = asRecord(value);
  if (!record) {
    return false;
  }

  for (const [key, rawValue] of Object.entries(record)) {
    if (APPROVAL_TEXT_KEYS.has(normalizeKey(key))) {
      continue;
    }
    if (containsForbiddenSurface(rawValue)) {
      return true;
    }
  }

  return false;
}

function looksLikeSqlText(value: string): boolean {
  return /\b(select|insert|update|delete|from|where|join|returning)\b/i.test(value);
}

function looksLikeSecretValue(value: string): boolean {
  return /(token|api[-_ ]?key|signing[-_ ]?secret|authorization|bearer|dummy[-_ ]?secret)/i.test(value);
}

function looksLikeReportPath(value: string): boolean {
  return /\/[^/\s]+\.(csv|json|tsv)\b/i.test(value);
}

function looksLikeEmailAddress(value: string): boolean {
  return /\b[^@\s]+@[^@\s]+\.[^@\s]+\b/.test(value);
}

function looksLikeApprovalGrant(value: string): boolean {
  return /\bi approve\b/i.test(value) || /\bapproved\b/i.test(value);
}

function maskSensitiveValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function isApprovalArea(value: unknown): value is EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea {
  return (
    typeof value === 'string'
    && APPROVAL_AREAS.has(value as EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalArea)
  );
}

function isDecisionState(value: unknown): value is EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalDecisionState {
  return value === 'not_approved' || value === 'not_allowed';
}

function isRequiredEvidenceKey(value: unknown): value is EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey {
  return (
    typeof value === 'string'
    && REQUIRED_EVIDENCE_KEYS.has(value as EmailJobDuplicateStagingReadOnlyAuditRequiredEvidenceKey)
  );
}

function readStatus(result: unknown): unknown {
  return asRecord(result)?.status;
}

function valid(reasonCode: string): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  return {
    valid: true,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_operator_approval_valid',
  };
}

function invalid(
  errorCode: EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalErrorCode,
  reasonCode: string,
): EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalValidationResult {
  return {
    valid: false,
    errorCode,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_staging_readonly_audit_operator_approval_invalid',
  };
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readText(value: unknown): string | undefined {
  return hasText(value) ? value.trim() : undefined;
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? value as JsonRecord : undefined;
}
