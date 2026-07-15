import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobDuplicateReadOnlyAuditApprovalArea =
  | 'docs_only'
  | 'staging_read'
  | 'production_read'
  | 'pii_fingerprinting'
  | 'report_generation'
  | 'manual_review_pack'
  | 'cleanup'
  | 'backfill'
  | 'migration_index'
  | 'enforcement';

export type EmailJobDuplicateReadOnlyAuditApprovalCurrentStatus = 'not_granted';

export type EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName =
  | 'docs_only_decision_gate'
  | 'approval_boundary'
  | 'staging_read_only_audit_proposal'
  | 'staging_read_only_audit_execution'
  | 'production_read_only_audit_proposal'
  | 'production_read_only_audit_execution'
  | 'report_review'
  | 'cleanup_planning'
  | 'enforcement_planning';

export type EmailJobDuplicateReadOnlyAuditApprovalDecision = {
  type: 'email_job_duplicate_readonly_audit_approval_decision';
  version: 'v1';
  area: EmailJobDuplicateReadOnlyAuditApprovalArea;
  required: boolean;
  currentStatus: EmailJobDuplicateReadOnlyAuditApprovalCurrentStatus;
  grantedByBoundary: false;
  allowsDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyAuditApprovalMatrixEntry = {
  type: 'email_job_duplicate_readonly_audit_approval_matrix_entry';
  version: 'v1';
  area: EmailJobDuplicateReadOnlyAuditApprovalArea;
  required: boolean;
  currentStatus: EmailJobDuplicateReadOnlyAuditApprovalCurrentStatus;
  grantedByBoundary: false;
  allowsDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  whoWhatMustApprove: string;
  notes: string;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyAuditApprovalMatrix = {
  type: 'email_job_duplicate_readonly_audit_approval_matrix';
  version: 'v1';
  entries: readonly EmailJobDuplicateReadOnlyAuditApprovalMatrixEntry[];
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyAuditEnvironmentSequenceStep = {
  type: 'email_job_duplicate_readonly_audit_environment_sequence_step';
  version: 'v1';
  step: EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName;
  order: number;
  status: 'planned_only';
  requiredApprovalAreas: readonly EmailJobDuplicateReadOnlyAuditApprovalArea[];
  requiresExplicitHumanApproval: true;
  allowsDbRead: false;
  allowsSqlExecution: false;
  allowsQueryRunner: false;
  allowsReportsWithData: false;
  allowsCleanup: false;
  allowsBackfill: false;
  allowsEnforcement: false;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyAuditEnvironmentSequence = {
  type: 'email_job_duplicate_readonly_audit_environment_sequence';
  version: 'v1';
  steps: readonly EmailJobDuplicateReadOnlyAuditEnvironmentSequenceStep[];
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyAuditStopCriteria = {
  type: 'email_job_duplicate_readonly_audit_stop_criteria';
  version: 'v1';
  requiresExplicitDbReadOnlyAuditAssignment: true;
  blocksUnknownDbTarget: true;
  requiresChatbotDbTarget: true;
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
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyAuditOutputPolicy = {
  type: 'email_job_duplicate_readonly_audit_output_policy';
  version: 'v1';
  allowsAggregateCounts: true;
  allowsStatusBuckets: true;
  allowsKindBuckets: true;
  allowsRiskGroupCounts: true;
  allowsReasonCodes: true;
  allowsPseudonymizedIdentifiers: false;
  allowsRawRecipientEmail: false;
  allowsSubject: false;
  allowsHtml: false;
  allowsText: false;
  allowsBody: false;
  allowsFullMetadata: false;
  allowsRowDump: false;
  allowsCsvExport: false;
  allowsJsonExport: false;
  allowsCommittedReportsWithData: false;
  allowsQueryResults: false;
  reasonCode: string;
};

export type EmailJobDuplicateReadOnlyAuditApprovalPlanItem =
  | EmailJobDuplicateReadOnlyAuditApprovalDecision
  | EmailJobDuplicateReadOnlyAuditApprovalMatrix
  | EmailJobDuplicateReadOnlyAuditEnvironmentSequence
  | EmailJobDuplicateReadOnlyAuditStopCriteria
  | EmailJobDuplicateReadOnlyAuditOutputPolicy;

export type ReadyEmailJobDuplicateReadOnlyAuditApprovalResult = {
  status: 'ready';
  reasonCode: string;
  plan: EmailJobDuplicateReadOnlyAuditApprovalPlanItem;
};

export type SkippedEmailJobDuplicateReadOnlyAuditApprovalResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobDuplicateReadOnlyAuditApprovalResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobDuplicateReadOnlyAuditApprovalErrorCode;
};

export type FailedEmailJobDuplicateReadOnlyAuditApprovalResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobDuplicateReadOnlyAuditApprovalErrorCode;
  retryable: boolean;
};

export type EmailJobDuplicateReadOnlyAuditApprovalResult =
  | ReadyEmailJobDuplicateReadOnlyAuditApprovalResult
  | SkippedEmailJobDuplicateReadOnlyAuditApprovalResult
  | BlockedEmailJobDuplicateReadOnlyAuditApprovalResult
  | FailedEmailJobDuplicateReadOnlyAuditApprovalResult;

export type EmailJobDuplicateReadOnlyAuditApprovalValidationResult =
  | { valid: true; reasonCode: string }
  | {
      valid: false;
      reasonCode: string;
      errorCode: EmailJobDuplicateReadOnlyAuditApprovalErrorCode;
    };

export type EmailJobDuplicateReadOnlyAuditApprovalErrorCode =
  | 'missing_plan'
  | 'missing_reason_code'
  | 'invalid_area'
  | 'invalid_required_flag'
  | 'invalid_current_status'
  | 'invalid_decision'
  | 'decision_granted_not_allowed'
  | 'db_read_not_allowed'
  | 'sql_execution_not_allowed'
  | 'query_runner_not_allowed'
  | 'reports_not_allowed'
  | 'cleanup_not_allowed'
  | 'backfill_not_allowed'
  | 'enforcement_not_allowed'
  | 'invalid_matrix_entry'
  | 'invalid_matrix'
  | 'missing_matrix_area'
  | 'duplicate_matrix_area'
  | 'invalid_sequence_step'
  | 'invalid_sequence'
  | 'invalid_sequence_order'
  | 'invalid_stop_criteria'
  | 'invalid_output_policy'
  | 'invalid_result'
  | 'unsupported_plan_type'
  | 'unknown_email_job_duplicate_readonly_audit_approval_error';

type JsonRecord = Record<string, unknown>;

type ApprovalAreaDefinition = {
  required: boolean;
  whoWhatMustApprove: string;
  notes: string;
  reasonCode: string;
};

type SequenceDefinition = {
  order: number;
  requiredApprovalAreas: readonly EmailJobDuplicateReadOnlyAuditApprovalArea[];
  reasonCode: string;
};

const APPROVAL_AREAS = new Set<EmailJobDuplicateReadOnlyAuditApprovalArea>([
  'docs_only',
  'staging_read',
  'production_read',
  'pii_fingerprinting',
  'report_generation',
  'manual_review_pack',
  'cleanup',
  'backfill',
  'migration_index',
  'enforcement',
]);
const ENVIRONMENT_SEQUENCE_NAMES = new Set<EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName>([
  'docs_only_decision_gate',
  'approval_boundary',
  'staging_read_only_audit_proposal',
  'staging_read_only_audit_execution',
  'production_read_only_audit_proposal',
  'production_read_only_audit_execution',
  'report_review',
  'cleanup_planning',
  'enforcement_planning',
]);
const DEFAULT_BLOCKED_REASON = 'email_job_duplicate_readonly_audit_approval_blocked';
const DEFAULT_FAILED_REASON = 'email_job_duplicate_readonly_audit_approval_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_duplicate_readonly_audit_approval_skipped';
const REDACTED = '[redacted]';
const OMITTED = '[omitted]';

const APPROVAL_AREA_DEFINITIONS: Record<
  EmailJobDuplicateReadOnlyAuditApprovalArea,
  ApprovalAreaDefinition
> = {
  docs_only: {
    required: false,
    whoWhatMustApprove: 'current docs-only assignment',
    notes: 'documentation only and never a DB-read grant',
    reasonCode: 'docs_only_decision_documented',
  },
  staging_read: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'separate staging DB-read approval remains required',
    reasonCode: 'staging_read_not_granted',
  },
  production_read: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'separate production DB-read approval remains required',
    reasonCode: 'production_read_not_granted',
  },
  pii_fingerprinting: {
    required: true,
    whoWhatMustApprove: 'explicit privacy and human approval',
    notes: 'fingerprinting remains blocked without separate approval',
    reasonCode: 'pii_fingerprinting_not_granted',
  },
  report_generation: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'reports with data remain out of scope',
    reasonCode: 'report_generation_not_granted',
  },
  manual_review_pack: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'manual review packs with customer data remain blocked',
    reasonCode: 'manual_review_pack_not_granted',
  },
  cleanup: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'cleanup remains separate from any read-only audit',
    reasonCode: 'cleanup_not_granted',
  },
  backfill: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'backfill remains separate from any read-only audit',
    reasonCode: 'backfill_not_granted',
  },
  migration_index: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'index or migration work remains a separate line',
    reasonCode: 'migration_index_not_granted',
  },
  enforcement: {
    required: true,
    whoWhatMustApprove: 'explicit later human assignment',
    notes: 'idempotency enforcement remains a separate line',
    reasonCode: 'enforcement_not_granted',
  },
};

const ENVIRONMENT_SEQUENCE_DEFINITIONS: Record<
  EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName,
  SequenceDefinition
> = {
  docs_only_decision_gate: {
    order: 1,
    requiredApprovalAreas: ['docs_only'],
    reasonCode: 'docs_only_decision_gate_planned_only',
  },
  approval_boundary: {
    order: 2,
    requiredApprovalAreas: ['docs_only'],
    reasonCode: 'approval_boundary_planned_only',
  },
  staging_read_only_audit_proposal: {
    order: 3,
    requiredApprovalAreas: ['staging_read'],
    reasonCode: 'staging_read_only_audit_proposal_planned_only',
  },
  staging_read_only_audit_execution: {
    order: 4,
    requiredApprovalAreas: ['staging_read'],
    reasonCode: 'staging_read_only_audit_execution_planned_only',
  },
  production_read_only_audit_proposal: {
    order: 5,
    requiredApprovalAreas: ['staging_read', 'production_read'],
    reasonCode: 'production_read_only_audit_proposal_planned_only',
  },
  production_read_only_audit_execution: {
    order: 6,
    requiredApprovalAreas: ['staging_read', 'production_read'],
    reasonCode: 'production_read_only_audit_execution_planned_only',
  },
  report_review: {
    order: 7,
    requiredApprovalAreas: ['report_generation', 'manual_review_pack'],
    reasonCode: 'report_review_planned_only',
  },
  cleanup_planning: {
    order: 8,
    requiredApprovalAreas: ['cleanup', 'backfill', 'migration_index'],
    reasonCode: 'cleanup_planning_planned_only',
  },
  enforcement_planning: {
    order: 9,
    requiredApprovalAreas: ['enforcement'],
    reasonCode: 'enforcement_planning_planned_only',
  },
};

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
  'csvpath',
  'csv_path',
  'jsonpath',
  'json_path',
  'sql',
]);
const IDENTIFIER_KEYS = new Set([
  'reportrunid',
  'report_run_id',
  'reportrun_id',
  'leadid',
  'lead_id',
  'contactrequestid',
  'contact_request_id',
  'conversationid',
  'conversation_id',
  'sessionid',
  'session_id',
]);

export function buildDocsOnlyApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.docs_only.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('docs_only', reasonCode);
}

export function buildStagingReadApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.staging_read.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('staging_read', reasonCode);
}

export function buildProductionReadApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.production_read.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('production_read', reasonCode);
}

export function buildPiiFingerprintingApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.pii_fingerprinting.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('pii_fingerprinting', reasonCode);
}

export function buildReportGenerationApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.report_generation.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('report_generation', reasonCode);
}

export function buildManualReviewPackApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.manual_review_pack.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('manual_review_pack', reasonCode);
}

export function buildCleanupApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.cleanup.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('cleanup', reasonCode);
}

export function buildBackfillApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.backfill.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('backfill', reasonCode);
}

export function buildMigrationIndexApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.migration_index.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('migration_index', reasonCode);
}

export function buildEnforcementApprovalDecision(
  reasonCode = APPROVAL_AREA_DEFINITIONS.enforcement.reasonCode,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  return buildApprovalDecision('enforcement', reasonCode);
}

export function validateEmailJobDuplicateReadOnlyAuditApprovalDecision(
  decision: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(decision);
  if (!record) {
    return invalid('invalid_decision', 'invalid_email_job_duplicate_readonly_audit_approval_decision');
  }

  if (record.type !== 'email_job_duplicate_readonly_audit_approval_decision' || record.version !== 'v1') {
    return invalid('invalid_decision', 'invalid_email_job_duplicate_readonly_audit_approval_decision');
  }
  if (!isApprovalArea(record.area)) {
    return invalid('invalid_area', 'invalid_email_job_duplicate_readonly_audit_approval_area');
  }
  if (record.currentStatus !== 'not_granted') {
    return invalid('invalid_current_status', 'email_job_duplicate_readonly_audit_approval_status_must_stay_not_granted');
  }
  if (typeof record.required !== 'boolean') {
    return invalid('invalid_required_flag', 'email_job_duplicate_readonly_audit_approval_required_flag_invalid');
  }

  const definition = APPROVAL_AREA_DEFINITIONS[record.area];
  if (record.required !== definition.required) {
    return invalid('invalid_required_flag', 'email_job_duplicate_readonly_audit_approval_required_flag_mismatch');
  }

  if (record.grantedByBoundary !== false) {
    return invalid('decision_granted_not_allowed', 'email_job_duplicate_readonly_audit_approval_grant_not_allowed');
  }
  if (record.allowsDbRead !== false) {
    return invalid('db_read_not_allowed', 'email_job_duplicate_readonly_audit_approval_db_read_not_allowed');
  }
  if (record.allowsSqlExecution !== false) {
    return invalid('sql_execution_not_allowed', 'email_job_duplicate_readonly_audit_approval_sql_execution_not_allowed');
  }
  if (record.allowsQueryRunner !== false) {
    return invalid('query_runner_not_allowed', 'email_job_duplicate_readonly_audit_approval_query_runner_not_allowed');
  }
  if (record.allowsReportsWithData !== false) {
    return invalid('reports_not_allowed', 'email_job_duplicate_readonly_audit_approval_reports_not_allowed');
  }
  if (record.allowsCleanup !== false) {
    return invalid('cleanup_not_allowed', 'email_job_duplicate_readonly_audit_approval_cleanup_not_allowed');
  }
  if (record.allowsBackfill !== false) {
    return invalid('backfill_not_allowed', 'email_job_duplicate_readonly_audit_approval_backfill_not_allowed');
  }
  if (record.allowsEnforcement !== false) {
    return invalid('enforcement_not_allowed', 'email_job_duplicate_readonly_audit_approval_enforcement_not_allowed');
  }
  if (!readText(record.reasonCode)) {
    return invalid('missing_reason_code', 'email_job_duplicate_readonly_audit_approval_reason_code_required');
  }

  return valid(readText(record.reasonCode) || 'email_job_duplicate_readonly_audit_approval_decision_valid');
}

export function buildDefaultEmailJobDuplicateReadOnlyAuditApprovalMatrix(
  reasonCode = 'email_job_duplicate_readonly_audit_approval_matrix_default',
): EmailJobDuplicateReadOnlyAuditApprovalMatrix {
  const decisions = [
    buildDocsOnlyApprovalDecision(),
    buildStagingReadApprovalDecision(),
    buildProductionReadApprovalDecision(),
    buildPiiFingerprintingApprovalDecision(),
    buildReportGenerationApprovalDecision(),
    buildManualReviewPackApprovalDecision(),
    buildCleanupApprovalDecision(),
    buildBackfillApprovalDecision(),
    buildMigrationIndexApprovalDecision(),
    buildEnforcementApprovalDecision(),
  ];

  return {
    type: 'email_job_duplicate_readonly_audit_approval_matrix',
    version: 'v1',
    entries: decisions.map((decision) => buildApprovalMatrixEntry(decision)),
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_audit_approval_matrix_default',
  };
}

export function validateEmailJobDuplicateReadOnlyAuditApprovalMatrix(
  matrix: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(matrix);
  if (!record) {
    return invalid('invalid_matrix', 'invalid_email_job_duplicate_readonly_audit_approval_matrix');
  }
  if (record.type !== 'email_job_duplicate_readonly_audit_approval_matrix' || record.version !== 'v1') {
    return invalid('invalid_matrix', 'invalid_email_job_duplicate_readonly_audit_approval_matrix');
  }
  if (!Array.isArray(record.entries)) {
    return invalid('invalid_matrix', 'email_job_duplicate_readonly_audit_approval_matrix_entries_required');
  }
  if (!readText(record.reasonCode)) {
    return invalid('missing_reason_code', 'email_job_duplicate_readonly_audit_approval_matrix_reason_code_required');
  }

  const seen = new Set<EmailJobDuplicateReadOnlyAuditApprovalArea>();
  for (const entry of record.entries) {
    const validation = validateApprovalMatrixEntry(entry);
    if (!validation.valid) {
      return validation;
    }
    const area = (entry as EmailJobDuplicateReadOnlyAuditApprovalMatrixEntry).area;
    if (seen.has(area)) {
      return invalid('duplicate_matrix_area', 'email_job_duplicate_readonly_audit_approval_matrix_area_must_be_unique');
    }
    seen.add(area);
  }

  for (const area of APPROVAL_AREAS) {
    if (!seen.has(area)) {
      return invalid('missing_matrix_area', 'email_job_duplicate_readonly_audit_approval_matrix_area_missing');
    }
  }

  return valid(readText(record.reasonCode) || 'email_job_duplicate_readonly_audit_approval_matrix_valid');
}

export function buildDefaultEmailJobDuplicateReadOnlyAuditEnvironmentSequence(
  reasonCode = 'email_job_duplicate_readonly_audit_environment_sequence_default',
): EmailJobDuplicateReadOnlyAuditEnvironmentSequence {
  return {
    type: 'email_job_duplicate_readonly_audit_environment_sequence',
    version: 'v1',
    steps: [
      buildEnvironmentSequenceStep('docs_only_decision_gate'),
      buildEnvironmentSequenceStep('approval_boundary'),
      buildEnvironmentSequenceStep('staging_read_only_audit_proposal'),
      buildEnvironmentSequenceStep('staging_read_only_audit_execution'),
      buildEnvironmentSequenceStep('production_read_only_audit_proposal'),
      buildEnvironmentSequenceStep('production_read_only_audit_execution'),
      buildEnvironmentSequenceStep('report_review'),
      buildEnvironmentSequenceStep('cleanup_planning'),
      buildEnvironmentSequenceStep('enforcement_planning'),
    ],
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_audit_environment_sequence_default',
  };
}

export function validateEmailJobDuplicateReadOnlyAuditEnvironmentSequence(
  sequence: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(sequence);
  if (!record) {
    return invalid('invalid_sequence', 'invalid_email_job_duplicate_readonly_audit_environment_sequence');
  }
  if (record.type !== 'email_job_duplicate_readonly_audit_environment_sequence' || record.version !== 'v1') {
    return invalid('invalid_sequence', 'invalid_email_job_duplicate_readonly_audit_environment_sequence');
  }
  if (!Array.isArray(record.steps)) {
    return invalid('invalid_sequence', 'email_job_duplicate_readonly_audit_environment_sequence_steps_required');
  }
  if (!readText(record.reasonCode)) {
    return invalid('missing_reason_code', 'email_job_duplicate_readonly_audit_environment_sequence_reason_code_required');
  }
  if (record.steps.length !== Object.keys(ENVIRONMENT_SEQUENCE_DEFINITIONS).length) {
    return invalid('invalid_sequence', 'email_job_duplicate_readonly_audit_environment_sequence_length_invalid');
  }

  let expectedOrder = 1;
  const seen = new Set<EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName>();
  for (const step of record.steps) {
    const validation = validateEnvironmentSequenceStep(step);
    if (!validation.valid) {
      return validation;
    }
    const stepName = (step as EmailJobDuplicateReadOnlyAuditEnvironmentSequenceStep).step;
    if (seen.has(stepName)) {
      return invalid('invalid_sequence_order', 'email_job_duplicate_readonly_audit_environment_sequence_step_duplicated');
    }
    seen.add(stepName);
    if ((step as EmailJobDuplicateReadOnlyAuditEnvironmentSequenceStep).order !== expectedOrder) {
      return invalid('invalid_sequence_order', 'email_job_duplicate_readonly_audit_environment_sequence_order_invalid');
    }
    expectedOrder += 1;
  }

  for (const stepName of ENVIRONMENT_SEQUENCE_NAMES) {
    if (!seen.has(stepName)) {
      return invalid('invalid_sequence', 'email_job_duplicate_readonly_audit_environment_sequence_step_missing');
    }
  }

  return valid(readText(record.reasonCode) || 'email_job_duplicate_readonly_audit_environment_sequence_valid');
}

export function buildDefaultEmailJobDuplicateReadOnlyAuditStopCriteria(
  reasonCode = 'email_job_duplicate_readonly_audit_stop_criteria_default',
): EmailJobDuplicateReadOnlyAuditStopCriteria {
  return {
    type: 'email_job_duplicate_readonly_audit_stop_criteria',
    version: 'v1',
    requiresExplicitDbReadOnlyAuditAssignment: true,
    blocksUnknownDbTarget: true,
    requiresChatbotDbTarget: true,
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
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_audit_stop_criteria_default',
  };
}

export function validateEmailJobDuplicateReadOnlyAuditStopCriteria(
  stopCriteria: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(stopCriteria);
  if (!record) {
    return invalid('invalid_stop_criteria', 'invalid_email_job_duplicate_readonly_audit_stop_criteria');
  }
  if (record.type !== 'email_job_duplicate_readonly_audit_stop_criteria' || record.version !== 'v1') {
    return invalid('invalid_stop_criteria', 'invalid_email_job_duplicate_readonly_audit_stop_criteria');
  }
  if (!readText(record.reasonCode)) {
    return invalid('missing_reason_code', 'email_job_duplicate_readonly_audit_stop_criteria_reason_code_required');
  }

  const expectedKeys = [
    'requiresExplicitDbReadOnlyAuditAssignment',
    'blocksUnknownDbTarget',
    'requiresChatbotDbTarget',
    'blocksMissingReadOnlyRole',
    'blocksSelectStar',
    'blocksMissingLimit',
    'blocksMissingTimeWindow',
    'blocksPotentialFullTableScan',
    'blocksRawPiiOutput',
    'blocksRawContentOutput',
    'blocksFullMetadataOutput',
    'blocksCommittedQueryResults',
    'blocksCommittedReportsWithData',
    'blocksCleanupUpdateDelete',
  ] as const;

  for (const key of expectedKeys) {
    if (record[key] !== true) {
      return invalid('invalid_stop_criteria', 'email_job_duplicate_readonly_audit_stop_criteria_must_block_risky_shapes');
    }
  }

  return valid(readText(record.reasonCode) || 'email_job_duplicate_readonly_audit_stop_criteria_valid');
}

export function buildDefaultEmailJobDuplicateReadOnlyAuditOutputPolicy(
  reasonCode = 'email_job_duplicate_readonly_audit_output_policy_default',
): EmailJobDuplicateReadOnlyAuditOutputPolicy {
  return {
    type: 'email_job_duplicate_readonly_audit_output_policy',
    version: 'v1',
    allowsAggregateCounts: true,
    allowsStatusBuckets: true,
    allowsKindBuckets: true,
    allowsRiskGroupCounts: true,
    allowsReasonCodes: true,
    allowsPseudonymizedIdentifiers: false,
    allowsRawRecipientEmail: false,
    allowsSubject: false,
    allowsHtml: false,
    allowsText: false,
    allowsBody: false,
    allowsFullMetadata: false,
    allowsRowDump: false,
    allowsCsvExport: false,
    allowsJsonExport: false,
    allowsCommittedReportsWithData: false,
    allowsQueryResults: false,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_audit_output_policy_default',
  };
}

export function validateEmailJobDuplicateReadOnlyAuditOutputPolicy(
  outputPolicy: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(outputPolicy);
  if (!record) {
    return invalid('invalid_output_policy', 'invalid_email_job_duplicate_readonly_audit_output_policy');
  }
  if (record.type !== 'email_job_duplicate_readonly_audit_output_policy' || record.version !== 'v1') {
    return invalid('invalid_output_policy', 'invalid_email_job_duplicate_readonly_audit_output_policy');
  }
  if (!readText(record.reasonCode)) {
    return invalid('missing_reason_code', 'email_job_duplicate_readonly_audit_output_policy_reason_code_required');
  }

  if (
    record.allowsAggregateCounts !== true
    || record.allowsStatusBuckets !== true
    || record.allowsKindBuckets !== true
    || record.allowsRiskGroupCounts !== true
    || record.allowsReasonCodes !== true
  ) {
    return invalid('invalid_output_policy', 'email_job_duplicate_readonly_audit_output_policy_missing_safe_outputs');
  }

  const blockedKeys = [
    'allowsPseudonymizedIdentifiers',
    'allowsRawRecipientEmail',
    'allowsSubject',
    'allowsHtml',
    'allowsText',
    'allowsBody',
    'allowsFullMetadata',
    'allowsRowDump',
    'allowsCsvExport',
    'allowsJsonExport',
    'allowsCommittedReportsWithData',
    'allowsQueryResults',
  ] as const;

  for (const key of blockedKeys) {
    if (record[key] !== false) {
      return invalid('invalid_output_policy', 'email_job_duplicate_readonly_audit_output_policy_blocks_must_remain_false');
    }
  }

  return valid(readText(record.reasonCode) || 'email_job_duplicate_readonly_audit_output_policy_valid');
}

export function buildReadyEmailJobDuplicateReadOnlyAuditApprovalResult(
  plan: EmailJobDuplicateReadOnlyAuditApprovalPlanItem,
  reasonCode = 'email_job_duplicate_readonly_audit_approval_ready',
): ReadyEmailJobDuplicateReadOnlyAuditApprovalResult {
  return {
    status: 'ready',
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_audit_approval_ready',
    plan,
  };
}

export function buildSkippedEmailJobDuplicateReadOnlyAuditApprovalResult(
  reasonCode = DEFAULT_SKIPPED_REASON,
): SkippedEmailJobDuplicateReadOnlyAuditApprovalResult {
  return {
    status: 'skipped',
    reasonCode: readText(reasonCode) || DEFAULT_SKIPPED_REASON,
  };
}

export function buildBlockedEmailJobDuplicateReadOnlyAuditApprovalResult(
  reasonCode = DEFAULT_BLOCKED_REASON,
  errorCode: EmailJobDuplicateReadOnlyAuditApprovalErrorCode = 'invalid_result',
): BlockedEmailJobDuplicateReadOnlyAuditApprovalResult {
  return {
    status: 'blocked',
    reasonCode: readText(reasonCode) || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobDuplicateReadOnlyAuditApprovalResult(
  reasonCode = DEFAULT_FAILED_REASON,
  errorCode: EmailJobDuplicateReadOnlyAuditApprovalErrorCode = 'unknown_email_job_duplicate_readonly_audit_approval_error',
  retryable = false,
): FailedEmailJobDuplicateReadOnlyAuditApprovalResult {
  return {
    status: 'failed',
    reasonCode: readText(reasonCode) || DEFAULT_FAILED_REASON,
    errorCode,
    retryable,
  };
}

export function isReadyEmailJobDuplicateReadOnlyAuditApprovalResult(
  result: unknown,
): result is ReadyEmailJobDuplicateReadOnlyAuditApprovalResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobDuplicateReadOnlyAuditApprovalResult(
  result: unknown,
): result is SkippedEmailJobDuplicateReadOnlyAuditApprovalResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobDuplicateReadOnlyAuditApprovalResult(
  result: unknown,
): result is BlockedEmailJobDuplicateReadOnlyAuditApprovalResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobDuplicateReadOnlyAuditApprovalResult(
  result: unknown,
): result is FailedEmailJobDuplicateReadOnlyAuditApprovalResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobDuplicateReadOnlyAuditApprovalDecisionForLog(
  decision: unknown,
): JsonRecord {
  return sanitizeForSafeProjection(decision) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyAuditApprovalMatrixForLog(
  matrix: EmailJobDuplicateReadOnlyAuditApprovalMatrix,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...matrix,
    entries: matrix.entries.map((entry) => buildSafeEmailJobDuplicateReadOnlyAuditApprovalMatrixEntryForLog(entry)),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyAuditEnvironmentSequenceForLog(
  sequence: EmailJobDuplicateReadOnlyAuditEnvironmentSequence,
): JsonRecord {
  return sanitizeForSafeProjection({
    ...sequence,
    steps: sequence.steps.map((step) => buildSafeEmailJobDuplicateReadOnlyAuditEnvironmentSequenceStepForLog(step)),
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyAuditStopCriteriaForLog(
  stopCriteria: unknown,
): JsonRecord {
  return sanitizeForSafeProjection(stopCriteria) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyAuditOutputPolicyForLog(
  outputPolicy: unknown,
): JsonRecord {
  return sanitizeForSafeProjection(outputPolicy) as JsonRecord;
}

export function buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultForLog(
  result: EmailJobDuplicateReadOnlyAuditApprovalResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultProjection(result);
}

export function buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultForAudit(
  result: EmailJobDuplicateReadOnlyAuditApprovalResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultProjection(result);
}

export function validateEmailJobDuplicateReadOnlyAuditApprovalPlanItem(
  plan: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(plan);
  if (!record) {
    return invalid('missing_plan', 'email_job_duplicate_readonly_audit_approval_plan_required');
  }

  if (record.type === 'email_job_duplicate_readonly_audit_approval_decision') {
    return validateEmailJobDuplicateReadOnlyAuditApprovalDecision(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_audit_approval_matrix') {
    return validateEmailJobDuplicateReadOnlyAuditApprovalMatrix(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_audit_environment_sequence') {
    return validateEmailJobDuplicateReadOnlyAuditEnvironmentSequence(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_audit_stop_criteria') {
    return validateEmailJobDuplicateReadOnlyAuditStopCriteria(plan);
  }
  if (record.type === 'email_job_duplicate_readonly_audit_output_policy') {
    return validateEmailJobDuplicateReadOnlyAuditOutputPolicy(plan);
  }

  return invalid(
    'unsupported_plan_type',
    'unsupported_email_job_duplicate_readonly_audit_approval_plan_item',
  );
}

function buildApprovalDecision(
  area: EmailJobDuplicateReadOnlyAuditApprovalArea,
  reasonCode: string,
): EmailJobDuplicateReadOnlyAuditApprovalDecision {
  const definition = APPROVAL_AREA_DEFINITIONS[area];
  return {
    type: 'email_job_duplicate_readonly_audit_approval_decision',
    version: 'v1',
    area,
    required: definition.required,
    currentStatus: 'not_granted',
    grantedByBoundary: false,
    allowsDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    reasonCode: readText(reasonCode) || definition.reasonCode,
  };
}

function buildApprovalMatrixEntry(
  decision: EmailJobDuplicateReadOnlyAuditApprovalDecision,
): EmailJobDuplicateReadOnlyAuditApprovalMatrixEntry {
  const definition = APPROVAL_AREA_DEFINITIONS[decision.area];
  return {
    type: 'email_job_duplicate_readonly_audit_approval_matrix_entry',
    version: 'v1',
    area: decision.area,
    required: decision.required,
    currentStatus: decision.currentStatus,
    grantedByBoundary: false,
    allowsDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    whoWhatMustApprove: definition.whoWhatMustApprove,
    notes: definition.notes,
    reasonCode: decision.reasonCode,
  };
}

function validateApprovalMatrixEntry(
  entry: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(entry);
  if (!record) {
    return invalid('invalid_matrix_entry', 'invalid_email_job_duplicate_readonly_audit_approval_matrix_entry');
  }
  if (record.type !== 'email_job_duplicate_readonly_audit_approval_matrix_entry' || record.version !== 'v1') {
    return invalid('invalid_matrix_entry', 'invalid_email_job_duplicate_readonly_audit_approval_matrix_entry');
  }

  const decisionValidation = validateEmailJobDuplicateReadOnlyAuditApprovalDecision({
    type: 'email_job_duplicate_readonly_audit_approval_decision',
    version: 'v1',
    area: record.area,
    required: record.required,
    currentStatus: record.currentStatus,
    grantedByBoundary: record.grantedByBoundary,
    allowsDbRead: record.allowsDbRead,
    allowsSqlExecution: record.allowsSqlExecution,
    allowsQueryRunner: record.allowsQueryRunner,
    allowsReportsWithData: record.allowsReportsWithData,
    allowsCleanup: record.allowsCleanup,
    allowsBackfill: record.allowsBackfill,
    allowsEnforcement: record.allowsEnforcement,
    reasonCode: record.reasonCode,
  });
  if (!decisionValidation.valid) {
    return invalid('invalid_matrix_entry', decisionValidation.reasonCode);
  }
  if (!readText(record.whoWhatMustApprove) || !readText(record.notes)) {
    return invalid('invalid_matrix_entry', 'email_job_duplicate_readonly_audit_approval_matrix_entry_metadata_required');
  }

  return valid(readText(record.reasonCode) || 'email_job_duplicate_readonly_audit_approval_matrix_entry_valid');
}

function buildEnvironmentSequenceStep(
  step: EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName,
  reasonCode = ENVIRONMENT_SEQUENCE_DEFINITIONS[step].reasonCode,
): EmailJobDuplicateReadOnlyAuditEnvironmentSequenceStep {
  const definition = ENVIRONMENT_SEQUENCE_DEFINITIONS[step];
  return {
    type: 'email_job_duplicate_readonly_audit_environment_sequence_step',
    version: 'v1',
    step,
    order: definition.order,
    status: 'planned_only',
    requiredApprovalAreas: definition.requiredApprovalAreas,
    requiresExplicitHumanApproval: true,
    allowsDbRead: false,
    allowsSqlExecution: false,
    allowsQueryRunner: false,
    allowsReportsWithData: false,
    allowsCleanup: false,
    allowsBackfill: false,
    allowsEnforcement: false,
    reasonCode: readText(reasonCode) || definition.reasonCode,
  };
}

function validateEnvironmentSequenceStep(
  step: unknown,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  const record = asRecord(step);
  if (!record) {
    return invalid('invalid_sequence_step', 'invalid_email_job_duplicate_readonly_audit_environment_sequence_step');
  }
  if (
    record.type !== 'email_job_duplicate_readonly_audit_environment_sequence_step'
    || record.version !== 'v1'
  ) {
    return invalid('invalid_sequence_step', 'invalid_email_job_duplicate_readonly_audit_environment_sequence_step');
  }
  if (!isEnvironmentSequenceName(record.step)) {
    return invalid('invalid_sequence_step', 'invalid_email_job_duplicate_readonly_audit_environment_sequence_name');
  }
  if (record.status !== 'planned_only') {
    return invalid('invalid_sequence_step', 'email_job_duplicate_readonly_audit_environment_sequence_status_must_stay_planned_only');
  }
  if (record.order !== ENVIRONMENT_SEQUENCE_DEFINITIONS[record.step].order) {
    return invalid('invalid_sequence_order', 'email_job_duplicate_readonly_audit_environment_sequence_order_mismatch');
  }
  if (!Array.isArray(record.requiredApprovalAreas)) {
    return invalid('invalid_sequence_step', 'email_job_duplicate_readonly_audit_environment_sequence_required_areas_required');
  }
  for (const area of record.requiredApprovalAreas) {
    if (!isApprovalArea(area)) {
      return invalid('invalid_sequence_step', 'email_job_duplicate_readonly_audit_environment_sequence_area_invalid');
    }
  }
  if (
    record.requiresExplicitHumanApproval !== true
    || record.allowsDbRead !== false
    || record.allowsSqlExecution !== false
    || record.allowsQueryRunner !== false
    || record.allowsReportsWithData !== false
    || record.allowsCleanup !== false
    || record.allowsBackfill !== false
    || record.allowsEnforcement !== false
  ) {
    return invalid('invalid_sequence_step', 'email_job_duplicate_readonly_audit_environment_sequence_risky_flags_not_allowed');
  }
  if (!readText(record.reasonCode)) {
    return invalid('missing_reason_code', 'email_job_duplicate_readonly_audit_environment_sequence_reason_code_required');
  }

  return valid(readText(record.reasonCode) || 'email_job_duplicate_readonly_audit_environment_sequence_step_valid');
}

function buildSafeEmailJobDuplicateReadOnlyAuditApprovalMatrixEntryForLog(
  entry: unknown,
): JsonRecord {
  return sanitizeForSafeProjection(entry) as JsonRecord;
}

function buildSafeEmailJobDuplicateReadOnlyAuditEnvironmentSequenceStepForLog(
  step: unknown,
): JsonRecord {
  return sanitizeForSafeProjection(step) as JsonRecord;
}

function buildSafeEmailJobDuplicateReadOnlyAuditApprovalResultProjection(
  result: EmailJobDuplicateReadOnlyAuditApprovalResult,
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

function buildSafePlanProjection(plan: EmailJobDuplicateReadOnlyAuditApprovalPlanItem): unknown {
  if (plan.type === 'email_job_duplicate_readonly_audit_approval_decision') {
    return buildSafeEmailJobDuplicateReadOnlyAuditApprovalDecisionForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_readonly_audit_approval_matrix') {
    return buildSafeEmailJobDuplicateReadOnlyAuditApprovalMatrixForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_readonly_audit_environment_sequence') {
    return buildSafeEmailJobDuplicateReadOnlyAuditEnvironmentSequenceForLog(plan);
  }
  if (plan.type === 'email_job_duplicate_readonly_audit_stop_criteria') {
    return buildSafeEmailJobDuplicateReadOnlyAuditStopCriteriaForLog(plan);
  }
  return buildSafeEmailJobDuplicateReadOnlyAuditOutputPolicyForLog(plan);
}

function sanitizeForSafeProjection(value: unknown): unknown {
  const sanitized = sanitizeNotificationPayloadForAudit(value);
  return sanitizeProjectedValue(sanitized);
}

function sanitizeProjectedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProjectedValue(item));
  }

  if (typeof value === 'string' && (looksLikeSqlText(value) || looksLikeSecretValue(value))) {
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
    if (typeof rawValue === 'string' && (looksLikeSqlText(rawValue) || looksLikeSecretValue(rawValue))) {
      output[key] = OMITTED;
      continue;
    }
    output[key] = sanitizeProjectedValue(rawValue);
  }

  return output;
}

function looksLikeSqlText(value: string): boolean {
  return /\b(select|insert|update|delete|from|where)\b/i.test(value);
}

function looksLikeSecretValue(value: string): boolean {
  return /(token|api[-_ ]?key|signing[-_ ]?secret|authorization|bearer|dummy[-_ ]?secret)/i.test(value);
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

function isApprovalArea(value: unknown): value is EmailJobDuplicateReadOnlyAuditApprovalArea {
  return typeof value === 'string' && APPROVAL_AREAS.has(value as EmailJobDuplicateReadOnlyAuditApprovalArea);
}

function isEnvironmentSequenceName(
  value: unknown,
): value is EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName {
  return (
    typeof value === 'string'
    && ENVIRONMENT_SEQUENCE_NAMES.has(value as EmailJobDuplicateReadOnlyAuditEnvironmentSequenceName)
  );
}

function valid(reasonCode: string): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  return {
    valid: true,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_audit_approval_valid',
  };
}

function invalid(
  errorCode: EmailJobDuplicateReadOnlyAuditApprovalErrorCode,
  reasonCode: string,
): EmailJobDuplicateReadOnlyAuditApprovalValidationResult {
  return {
    valid: false,
    errorCode,
    reasonCode: readText(reasonCode) || 'email_job_duplicate_readonly_audit_approval_invalid',
  };
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? (value as JsonRecord) : undefined;
}
