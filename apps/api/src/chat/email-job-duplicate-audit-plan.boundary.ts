export type EmailJobDuplicateSourceType =
  | 'lead_notification'
  | 'contact_request_notification'
  | 'conversation_delivery'
  | 'report_delivery'
  | 'recipient_content_fingerprint'
  | 'metadata_report_run'
  | 'unknown';

export type EmailJobDuplicateStatusValue =
  | 'queued'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'unknown';

export type EmailJobDuplicateRecipientIdentity =
  | {
      type: 'recipient_hash';
      value: string;
    }
  | {
      type: 'recipient_fingerprint';
      value: string;
    }
  | {
      type: 'missing_recipient';
      reasonCode: string;
    };

export type EmailJobDuplicateCandidate = {
  type: 'email_job_duplicate_candidate';
  version: 'v1';
  sourceType: EmailJobDuplicateSourceType;
  status?: EmailJobDuplicateStatusValue;
  parts: {
    tenantId?: string;
    siteId?: string;
    conversationId?: string;
    sessionId?: string;
    leadId?: string;
    contactRequestId?: string;
    reportRunId?: string;
    deliveryType?: string;
    notificationType?: string;
    contentFingerprint?: string;
    recipient: EmailJobDuplicateRecipientIdentity;
  };
  reasonCode: string;
};

export type EmailJobDuplicateRiskGroup = {
  type: 'email_job_duplicate_risk_group';
  status: EmailJobDuplicateStatusValue;
  riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  duplicateCategory: EmailJobDuplicateSourceType;
  requiresManualReview: boolean;
  reasonCode: string;
};

export type EmailJobCleanupEligibilityDecision =
  | 'not_cleanup_eligible'
  | 'manual_review_required'
  | 'audit_only'
  | 'blocked';

export type EmailJobCleanupEligibilityPolicy = {
  type: 'email_job_cleanup_eligibility_policy';
  status: EmailJobDuplicateStatusValue;
  decision: EmailJobCleanupEligibilityDecision;
  autoCleanupAllowed: false;
  reasonCode: string;
  requiredEvidence?: readonly string[];
};

export type EmailJobDuplicateAuditPlan = {
  type: 'email_job_duplicate_audit_plan';
  status: 'proposed_only';
  scope: 'aggregate_only' | 'pii_safe_candidates' | 'manual_review_pack' | 'unknown_until_db_audit';
  requiresDbReadApproval: boolean;
  requiresPiiRedaction: true;
  allowsRawRecipientEmail: false;
  reasonCode: string;
};

export type EmailJobCleanupPlan = {
  type: 'email_job_cleanup_plan';
  status: 'proposed_only';
  cleanupMode: 'no_cleanup' | 'manual_review_only' | 'queued_only_candidate' | 'sent_mark_only' | 'blocked';
  destructiveActionAllowed: false;
  requiresBackup: boolean;
  requiresRollbackPlan: boolean;
  reasonCode: string;
};

export type EmailJobManualReviewDecision = {
  type: 'email_job_manual_review_decision';
  status: EmailJobDuplicateStatusValue;
  decision: 'review_required' | 'not_required' | 'blocked';
  reasonCode: string;
  reviewerNotesRequired: boolean;
};

export type EmailJobDuplicateAuditPlanItem =
  | EmailJobDuplicateCandidate
  | EmailJobDuplicateRiskGroup
  | EmailJobCleanupEligibilityPolicy
  | EmailJobDuplicateAuditPlan
  | EmailJobCleanupPlan
  | EmailJobManualReviewDecision;

export type ReadyEmailJobDuplicateAuditPlanResult = {
  status: 'ready';
  reasonCode: string;
  plan: EmailJobDuplicateAuditPlanItem;
};

export type SkippedEmailJobDuplicateAuditPlanResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobDuplicateAuditPlanResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobDuplicateAuditPlanErrorCode;
};

export type FailedEmailJobDuplicateAuditPlanResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobDuplicateAuditPlanErrorCode;
  retryable: boolean;
};

export type EmailJobDuplicateAuditPlanResult =
  | ReadyEmailJobDuplicateAuditPlanResult
  | SkippedEmailJobDuplicateAuditPlanResult
  | BlockedEmailJobDuplicateAuditPlanResult
  | FailedEmailJobDuplicateAuditPlanResult;

export type EmailJobDuplicateAuditPlanValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobDuplicateAuditPlanErrorCode };

export type EmailJobDuplicateAuditPlanErrorCode =
  | 'missing_candidate'
  | 'invalid_candidate'
  | 'invalid_source_type'
  | 'invalid_version'
  | 'missing_reason_code'
  | 'missing_required_part'
  | 'missing_recipient_identity'
  | 'raw_recipient_not_allowed'
  | 'invalid_status'
  | 'invalid_risk_group'
  | 'invalid_cleanup_policy'
  | 'invalid_audit_plan'
  | 'invalid_cleanup_plan'
  | 'invalid_manual_review_decision'
  | 'invalid_result'
  | 'unsupported_plan_type'
  | 'unsafe_content_fingerprint'
  | 'unknown_email_job_duplicate_audit_plan_error';

type JsonRecord = Record<string, unknown>;

type RecipientInput = {
  recipientHash?: unknown;
  recipientFingerprint?: unknown;
  recipientIdentity?: unknown;
  recipientEmail?: unknown;
};

type CandidateInput = RecipientInput & {
  tenantId?: unknown;
  siteId?: unknown;
  conversationId?: unknown;
  sessionId?: unknown;
  leadId?: unknown;
  contactRequestId?: unknown;
  reportRunId?: unknown;
  deliveryType?: unknown;
  notificationType?: unknown;
  contentFingerprint?: unknown;
  status?: unknown;
  reasonCode?: unknown;
};

const SOURCE_TYPES = new Set<EmailJobDuplicateSourceType>([
  'lead_notification',
  'contact_request_notification',
  'conversation_delivery',
  'report_delivery',
  'recipient_content_fingerprint',
  'metadata_report_run',
  'unknown',
]);
const STATUSES = new Set<EmailJobDuplicateStatusValue>([
  'queued',
  'processing',
  'sent',
  'failed',
  'unknown',
]);
const RISK_LEVELS = new Set<EmailJobDuplicateRiskGroup['riskLevel']>([
  'low',
  'medium',
  'high',
  'blocked',
]);
const CLEANUP_DECISIONS = new Set<EmailJobCleanupEligibilityDecision>([
  'not_cleanup_eligible',
  'manual_review_required',
  'audit_only',
  'blocked',
]);
const AUDIT_SCOPES = new Set<EmailJobDuplicateAuditPlan['scope']>([
  'aggregate_only',
  'pii_safe_candidates',
  'manual_review_pack',
  'unknown_until_db_audit',
]);
const CLEANUP_MODES = new Set<EmailJobCleanupPlan['cleanupMode']>([
  'no_cleanup',
  'manual_review_only',
  'queued_only_candidate',
  'sent_mark_only',
  'blocked',
]);
const MANUAL_REVIEW_DECISIONS = new Set<EmailJobManualReviewDecision['decision']>([
  'review_required',
  'not_required',
  'blocked',
]);
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
const RAW_RECIPIENT_KEYS = new Set([
  'recipientemail',
  'recipient_email',
  'email',
  'to',
]);
const BODY_KEYS = new Set([
  'subject',
  'html',
  'text',
  'body',
  'payload',
  'message',
  'usermessage',
  'user_message',
]);
const MESSAGE_KEYS = new Set([
  'providererror',
  'provider_error',
  'lasterror',
  'last_error',
  'errormessage',
  'error_message',
]);
const REQUIRED_PARTS_BY_SOURCE: Record<Exclude<EmailJobDuplicateSourceType, 'unknown'>, readonly string[]> = {
  lead_notification: ['siteId', 'leadId', 'notificationType', 'recipient'],
  contact_request_notification: ['siteId', 'contactRequestId', 'notificationType', 'recipient'],
  conversation_delivery: ['siteId', 'conversationId', 'sessionId', 'deliveryType', 'recipient'],
  report_delivery: ['reportRunId', 'deliveryType', 'recipient'],
  recipient_content_fingerprint: ['contentFingerprint', 'recipient'],
  metadata_report_run: ['reportRunId', 'recipient'],
};
const DEFAULT_BLOCKED_REASON = 'email_job_duplicate_audit_plan_blocked';
const DEFAULT_FAILED_REASON = 'email_job_duplicate_audit_plan_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_duplicate_audit_plan_skipped';
const REDACTED = '[redacted]';
const OMITTED = '[omitted]';

export function buildLeadNotificationDuplicateCandidate(input: CandidateInput): EmailJobDuplicateCandidate {
  return buildDuplicateCandidate('lead_notification', input, 'lead_notification_duplicate_candidate');
}

export function buildContactRequestDuplicateCandidate(input: CandidateInput): EmailJobDuplicateCandidate {
  return buildDuplicateCandidate('contact_request_notification', input, 'contact_request_duplicate_candidate');
}

export function buildConversationDeliveryDuplicateCandidate(input: CandidateInput): EmailJobDuplicateCandidate {
  return buildDuplicateCandidate('conversation_delivery', input, 'conversation_delivery_duplicate_candidate');
}

export function buildReportDeliveryDuplicateCandidate(input: CandidateInput): EmailJobDuplicateCandidate {
  return buildDuplicateCandidate('report_delivery', input, 'report_delivery_duplicate_candidate');
}

export function buildRecipientContentDuplicateCandidate(input: CandidateInput): EmailJobDuplicateCandidate {
  return buildDuplicateCandidate('recipient_content_fingerprint', input, 'recipient_content_duplicate_candidate');
}

export function buildMetadataReportRunDuplicateCandidate(input: CandidateInput): EmailJobDuplicateCandidate {
  return buildDuplicateCandidate('metadata_report_run', input, 'metadata_report_run_duplicate_candidate');
}

export function validateEmailJobDuplicateCandidate(
  candidate: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(candidate);
  const parts = asRecord(record?.parts);
  if (!record || !parts || record.type !== 'email_job_duplicate_candidate') {
    return invalid('missing_candidate', 'missing_email_job_duplicate_candidate');
  }

  if (record.version !== 'v1') {
    return invalid('invalid_version', 'invalid_email_job_duplicate_candidate_version');
  }

  if (!hasText(record.reasonCode)) {
    return invalid('missing_reason_code', 'missing_email_job_duplicate_candidate_reason');
  }

  if (!isSourceType(record.sourceType)) {
    return invalid('invalid_source_type', 'invalid_email_job_duplicate_source_type');
  }

  if (record.status !== undefined && !isStatusValue(record.status)) {
    return invalid('invalid_status', 'invalid_email_job_duplicate_candidate_status');
  }

  const recipientValidation = validateRecipientIdentity(parts.recipient);
  if (!recipientValidation.valid) {
    return recipientValidation;
  }

  if (record.sourceType === 'unknown') {
    return invalid('invalid_source_type', 'unknown_duplicate_source_requires_manual_modeling');
  }

  const missingPart = findMissingRequiredPart(record.sourceType, parts);
  if (missingPart) {
    return missingPart;
  }

  if (parts.contentFingerprint !== undefined && !isSafeContentFingerprint(parts.contentFingerprint)) {
    return invalid('unsafe_content_fingerprint', 'unsafe_duplicate_content_fingerprint');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildEmailJobDuplicateRiskGroup(
  status: EmailJobDuplicateStatusValue,
  duplicateCategory: EmailJobDuplicateSourceType,
): EmailJobDuplicateRiskGroup {
  if (status === 'queued') {
    return {
      type: 'email_job_duplicate_risk_group',
      status,
      riskLevel: 'medium',
      duplicateCategory,
      requiresManualReview: true,
      reasonCode: 'queued_duplicate_requires_manual_evidence',
    };
  }

  if (status === 'processing') {
    return {
      type: 'email_job_duplicate_risk_group',
      status,
      riskLevel: 'blocked',
      duplicateCategory,
      requiresManualReview: true,
      reasonCode: 'processing_duplicate_cleanup_blocked',
    };
  }

  if (status === 'sent') {
    return {
      type: 'email_job_duplicate_risk_group',
      status,
      riskLevel: 'blocked',
      duplicateCategory,
      requiresManualReview: true,
      reasonCode: 'sent_duplicate_requires_manual_review',
    };
  }

  if (status === 'failed') {
    return {
      type: 'email_job_duplicate_risk_group',
      status,
      riskLevel: 'high',
      duplicateCategory,
      requiresManualReview: true,
      reasonCode: 'failed_duplicate_requires_manual_review',
    };
  }

  return {
    type: 'email_job_duplicate_risk_group',
    status: 'unknown',
    riskLevel: 'blocked',
    duplicateCategory,
    requiresManualReview: true,
    reasonCode: 'unknown_duplicate_status_blocked',
  };
}

export function validateEmailJobDuplicateRiskGroup(
  group: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(group);
  if (!record || record.type !== 'email_job_duplicate_risk_group') {
    return invalid('invalid_risk_group', 'invalid_email_job_duplicate_risk_group');
  }

  if (!isStatusValue(record.status) || !isSourceType(record.duplicateCategory)) {
    return invalid('invalid_risk_group', 'invalid_email_job_duplicate_risk_group_values');
  }

  if (!RISK_LEVELS.has(record.riskLevel as EmailJobDuplicateRiskGroup['riskLevel'])) {
    return invalid('invalid_risk_group', 'invalid_email_job_duplicate_risk_level');
  }

  if (typeof record.requiresManualReview !== 'boolean' || !hasText(record.reasonCode)) {
    return invalid('invalid_risk_group', 'invalid_email_job_duplicate_risk_group_shape');
  }

  if (record.status === 'unknown' && record.riskLevel !== 'blocked') {
    return invalid('invalid_risk_group', 'unknown_duplicate_status_must_block');
  }

  if ((record.status === 'processing' || record.status === 'sent') && record.riskLevel !== 'blocked') {
    return invalid('invalid_risk_group', 'processing_or_sent_duplicate_must_block');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildEmailJobCleanupEligibilityPolicy(
  status: EmailJobDuplicateStatusValue,
): EmailJobCleanupEligibilityPolicy {
  if (status === 'queued') {
    return {
      type: 'email_job_cleanup_eligibility_policy',
      status,
      decision: 'manual_review_required',
      autoCleanupAllowed: false,
      reasonCode: 'queued_duplicate_requires_strong_evidence',
      requiredEvidence: [
        'matching_duplicate_identity',
        'matching_recipient_fingerprint',
        'matching_source_identifier',
      ],
    };
  }

  if (status === 'processing') {
    return {
      type: 'email_job_cleanup_eligibility_policy',
      status,
      decision: 'not_cleanup_eligible',
      autoCleanupAllowed: false,
      reasonCode: 'processing_duplicate_not_cleanup_eligible',
      requiredEvidence: ['manual_review'],
    };
  }

  if (status === 'sent') {
    return {
      type: 'email_job_cleanup_eligibility_policy',
      status,
      decision: 'not_cleanup_eligible',
      autoCleanupAllowed: false,
      reasonCode: 'sent_duplicate_not_cleanup_eligible',
      requiredEvidence: ['manual_review', 'business_decision'],
    };
  }

  if (status === 'failed') {
    return {
      type: 'email_job_cleanup_eligibility_policy',
      status,
      decision: 'manual_review_required',
      autoCleanupAllowed: false,
      reasonCode: 'failed_duplicate_requires_manual_review',
      requiredEvidence: ['manual_review', 'delivery_history_review'],
    };
  }

  return {
    type: 'email_job_cleanup_eligibility_policy',
    status: 'unknown',
    decision: 'blocked',
    autoCleanupAllowed: false,
    reasonCode: 'unknown_duplicate_cleanup_policy_blocked',
    requiredEvidence: ['status_normalization', 'manual_review'],
  };
}

export function validateEmailJobCleanupEligibilityPolicy(
  policy: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_cleanup_eligibility_policy') {
    return invalid('invalid_cleanup_policy', 'invalid_email_job_cleanup_eligibility_policy');
  }

  if (!isStatusValue(record.status) || !CLEANUP_DECISIONS.has(record.decision as EmailJobCleanupEligibilityDecision)) {
    return invalid('invalid_cleanup_policy', 'invalid_email_job_cleanup_policy_values');
  }

  if (record.autoCleanupAllowed !== false || !hasText(record.reasonCode)) {
    return invalid('invalid_cleanup_policy', 'invalid_email_job_cleanup_policy_shape');
  }

  if (record.status === 'sent' && record.decision !== 'not_cleanup_eligible') {
    return invalid('invalid_cleanup_policy', 'sent_duplicate_must_not_be_cleanup_eligible');
  }

  if (record.status === 'unknown' && record.decision !== 'blocked') {
    return invalid('invalid_cleanup_policy', 'unknown_duplicate_cleanup_policy_must_block');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildAggregateOnlyDuplicateAuditPlan(reasonCode = 'aggregate_only_duplicate_audit_plan'): EmailJobDuplicateAuditPlan {
  return buildDuplicateAuditPlan('aggregate_only', reasonCode, true);
}

export function buildPiiSafeCandidateDuplicateAuditPlan(
  reasonCode = 'pii_safe_candidate_duplicate_audit_plan',
): EmailJobDuplicateAuditPlan {
  return buildDuplicateAuditPlan('pii_safe_candidates', reasonCode, true);
}

export function buildManualReviewPackDuplicateAuditPlan(
  reasonCode = 'manual_review_pack_duplicate_audit_plan',
): EmailJobDuplicateAuditPlan {
  return buildDuplicateAuditPlan('manual_review_pack', reasonCode, true);
}

export function buildUnknownUntilDbAuditPlan(
  reasonCode = 'unknown_until_db_audit_duplicate_audit_plan',
): EmailJobDuplicateAuditPlan {
  return buildDuplicateAuditPlan('unknown_until_db_audit', reasonCode, true);
}

export function validateEmailJobDuplicateAuditPlan(
  plan: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_duplicate_audit_plan') {
    return invalid('invalid_audit_plan', 'invalid_email_job_duplicate_audit_plan');
  }

  if (
    record.status !== 'proposed_only'
    || !AUDIT_SCOPES.has(record.scope as EmailJobDuplicateAuditPlan['scope'])
    || typeof record.requiresDbReadApproval !== 'boolean'
    || record.requiresPiiRedaction !== true
    || record.allowsRawRecipientEmail !== false
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_audit_plan', 'invalid_email_job_duplicate_audit_plan_shape');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildNoCleanupPlan(reasonCode = 'no_cleanup_plan_recommended'): EmailJobCleanupPlan {
  return buildCleanupPlan('no_cleanup', reasonCode, false, false);
}

export function buildManualReviewOnlyCleanupPlan(
  reasonCode = 'manual_review_only_cleanup_plan',
): EmailJobCleanupPlan {
  return buildCleanupPlan('manual_review_only', reasonCode, true, true);
}

export function buildQueuedOnlyCandidateCleanupPlan(
  reasonCode = 'queued_only_candidate_cleanup_plan',
): EmailJobCleanupPlan {
  return buildCleanupPlan('queued_only_candidate', reasonCode, true, true);
}

export function buildSentMarkOnlyCleanupPlan(
  reasonCode = 'sent_mark_only_cleanup_plan',
): EmailJobCleanupPlan {
  return buildCleanupPlan('sent_mark_only', reasonCode, true, true);
}

export function buildBlockedCleanupPlan(reasonCode = 'blocked_cleanup_plan'): EmailJobCleanupPlan {
  return buildCleanupPlan('blocked', reasonCode, true, true);
}

export function validateEmailJobCleanupPlan(
  plan: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_cleanup_plan') {
    return invalid('invalid_cleanup_plan', 'invalid_email_job_cleanup_plan');
  }

  if (
    record.status !== 'proposed_only'
    || !CLEANUP_MODES.has(record.cleanupMode as EmailJobCleanupPlan['cleanupMode'])
    || record.destructiveActionAllowed !== false
    || typeof record.requiresBackup !== 'boolean'
    || typeof record.requiresRollbackPlan !== 'boolean'
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_cleanup_plan', 'invalid_email_job_cleanup_plan_shape');
  }

  if (record.cleanupMode === 'no_cleanup' && (record.requiresBackup || record.requiresRollbackPlan)) {
    return invalid('invalid_cleanup_plan', 'no_cleanup_plan_must_not_require_backup');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildEmailJobManualReviewDecision(
  status: EmailJobDuplicateStatusValue,
): EmailJobManualReviewDecision {
  if (status === 'unknown') {
    return {
      type: 'email_job_manual_review_decision',
      status,
      decision: 'blocked',
      reasonCode: 'unknown_duplicate_manual_review_blocked',
      reviewerNotesRequired: true,
    };
  }

  return {
    type: 'email_job_manual_review_decision',
    status,
    decision: 'review_required',
    reasonCode: `${status}_duplicate_requires_manual_review`,
    reviewerNotesRequired: true,
  };
}

export function validateEmailJobManualReviewDecision(
  decision: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(decision);
  if (!record || record.type !== 'email_job_manual_review_decision') {
    return invalid('invalid_manual_review_decision', 'invalid_email_job_manual_review_decision');
  }

  if (
    !isStatusValue(record.status)
    || !MANUAL_REVIEW_DECISIONS.has(record.decision as EmailJobManualReviewDecision['decision'])
    || typeof record.reviewerNotesRequired !== 'boolean'
    || !hasText(record.reasonCode)
  ) {
    return invalid('invalid_manual_review_decision', 'invalid_email_job_manual_review_decision_shape');
  }

  if (record.status === 'unknown' && record.decision !== 'blocked') {
    return invalid('invalid_manual_review_decision', 'unknown_duplicate_manual_review_must_block');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildReadyEmailJobDuplicateAuditPlanResult(
  plan: EmailJobDuplicateAuditPlanItem | unknown,
): EmailJobDuplicateAuditPlanResult {
  const validation = validateEmailJobDuplicateAuditPlanItem(plan);
  if (!validation.valid) {
    return buildBlockedEmailJobDuplicateAuditPlanResult(validation.reasonCode, validation.errorCode);
  }

  return {
    status: 'ready',
    reasonCode: validation.reasonCode,
    plan: plan as EmailJobDuplicateAuditPlanItem,
  };
}

export function buildSkippedEmailJobDuplicateAuditPlanResult(
  reasonCode: string,
): SkippedEmailJobDuplicateAuditPlanResult {
  return {
    status: 'skipped',
    reasonCode: readText(reasonCode) || DEFAULT_SKIPPED_REASON,
  };
}

export function buildBlockedEmailJobDuplicateAuditPlanResult(
  reasonCode: string,
  errorCode: EmailJobDuplicateAuditPlanErrorCode,
): BlockedEmailJobDuplicateAuditPlanResult {
  return {
    status: 'blocked',
    reasonCode: readText(reasonCode) || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobDuplicateAuditPlanResult(
  reasonCode: string,
  errorCode: EmailJobDuplicateAuditPlanErrorCode,
  retryable: boolean,
): FailedEmailJobDuplicateAuditPlanResult {
  return {
    status: 'failed',
    reasonCode: readText(reasonCode) || DEFAULT_FAILED_REASON,
    errorCode,
    retryable,
  };
}

export function isReadyEmailJobDuplicateAuditPlanResult(
  result: unknown,
): result is ReadyEmailJobDuplicateAuditPlanResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobDuplicateAuditPlanResult(
  result: unknown,
): result is SkippedEmailJobDuplicateAuditPlanResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobDuplicateAuditPlanResult(
  result: unknown,
): result is BlockedEmailJobDuplicateAuditPlanResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobDuplicateAuditPlanResult(
  result: unknown,
): result is FailedEmailJobDuplicateAuditPlanResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobDuplicateCandidateForLog(
  candidate: EmailJobDuplicateCandidate,
): JsonRecord {
  return sanitizeForSafeProjection({
    type: candidate.type,
    version: candidate.version,
    sourceType: candidate.sourceType,
    status: candidate.status,
    reasonCode: candidate.reasonCode,
    parts: {
      ...candidate.parts,
      ...(candidate.parts.contentFingerprint
        ? { contentFingerprint: maskSensitiveValue(candidate.parts.contentFingerprint) }
        : {}),
      recipient: buildSafeRecipientIdentity(candidate.parts.recipient),
    },
  }) as JsonRecord;
}

export function buildSafeEmailJobDuplicateRiskGroupForLog(
  group: EmailJobDuplicateRiskGroup,
): JsonRecord {
  return sanitizeForSafeProjection(group) as JsonRecord;
}

export function buildSafeEmailJobCleanupEligibilityPolicyForLog(
  policy: EmailJobCleanupEligibilityPolicy,
): JsonRecord {
  return sanitizeForSafeProjection(policy) as JsonRecord;
}

export function buildSafeEmailJobDuplicateAuditPlanForLog(
  plan: EmailJobDuplicateAuditPlan,
): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobCleanupPlanForLog(plan: EmailJobCleanupPlan): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobManualReviewDecisionForLog(
  decision: EmailJobManualReviewDecision,
): JsonRecord {
  return sanitizeForSafeProjection(decision) as JsonRecord;
}

export function buildSafeEmailJobDuplicateAuditPlanResultForLog(
  result: EmailJobDuplicateAuditPlanResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateAuditPlanResultProjection(result);
}

export function buildSafeEmailJobDuplicateAuditPlanResultForAudit(
  result: EmailJobDuplicateAuditPlanResult,
): JsonRecord {
  return buildSafeEmailJobDuplicateAuditPlanResultProjection(result);
}

export function validateEmailJobDuplicateAuditPlanItem(
  plan: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(plan);
  if (!record || !hasText(record.type)) {
    return invalid('missing_candidate', 'missing_email_job_duplicate_audit_plan_item');
  }

  if (record.type === 'email_job_duplicate_candidate') {
    return validateEmailJobDuplicateCandidate(plan);
  }
  if (record.type === 'email_job_duplicate_risk_group') {
    return validateEmailJobDuplicateRiskGroup(plan);
  }
  if (record.type === 'email_job_cleanup_eligibility_policy') {
    return validateEmailJobCleanupEligibilityPolicy(plan);
  }
  if (record.type === 'email_job_duplicate_audit_plan') {
    return validateEmailJobDuplicateAuditPlan(plan);
  }
  if (record.type === 'email_job_cleanup_plan') {
    return validateEmailJobCleanupPlan(plan);
  }
  if (record.type === 'email_job_manual_review_decision') {
    return validateEmailJobManualReviewDecision(plan);
  }

  return invalid('unsupported_plan_type', 'unsupported_email_job_duplicate_audit_plan_item');
}

function buildDuplicateCandidate(
  sourceType: EmailJobDuplicateSourceType,
  input: CandidateInput,
  defaultReasonCode: string,
): EmailJobDuplicateCandidate {
  const parts: EmailJobDuplicateCandidate['parts'] = {
    recipient: buildRecipientIdentity(input),
  };

  copyTextPart(parts, 'tenantId', input.tenantId);
  copyTextPart(parts, 'siteId', input.siteId);
  copyTextPart(parts, 'conversationId', input.conversationId);
  copyTextPart(parts, 'sessionId', input.sessionId);
  copyTextPart(parts, 'leadId', input.leadId);
  copyTextPart(parts, 'contactRequestId', input.contactRequestId);
  copyTextPart(parts, 'reportRunId', input.reportRunId);
  copyTextPart(parts, 'deliveryType', input.deliveryType);
  copyTextPart(parts, 'notificationType', input.notificationType);
  copyTextPart(parts, 'contentFingerprint', safeContentFingerprint(input.contentFingerprint));

  const status = readStatusValue(input.status);
  return {
    type: 'email_job_duplicate_candidate',
    version: 'v1',
    sourceType,
    ...(status ? { status } : {}),
    parts,
    reasonCode: readText(input.reasonCode) || defaultReasonCode,
  };
}

function buildDuplicateAuditPlan(
  scope: EmailJobDuplicateAuditPlan['scope'],
  reasonCode: string,
  requiresDbReadApproval: boolean,
): EmailJobDuplicateAuditPlan {
  return {
    type: 'email_job_duplicate_audit_plan',
    status: 'proposed_only',
    scope,
    requiresDbReadApproval,
    requiresPiiRedaction: true,
    allowsRawRecipientEmail: false,
    reasonCode,
  };
}

function buildCleanupPlan(
  cleanupMode: EmailJobCleanupPlan['cleanupMode'],
  reasonCode: string,
  requiresBackup: boolean,
  requiresRollbackPlan: boolean,
): EmailJobCleanupPlan {
  return {
    type: 'email_job_cleanup_plan',
    status: 'proposed_only',
    cleanupMode,
    destructiveActionAllowed: false,
    requiresBackup,
    requiresRollbackPlan,
    reasonCode,
  };
}

function buildRecipientIdentity(input: RecipientInput): EmailJobDuplicateRecipientIdentity {
  const identity = asRecord(input.recipientIdentity);
  if (identity?.type === 'recipient_hash' && hasText(identity.value)) {
    return {
      type: 'recipient_hash',
      value: String(identity.value).trim(),
    };
  }

  if (identity?.type === 'recipient_fingerprint' && hasText(identity.value)) {
    return {
      type: 'recipient_fingerprint',
      value: String(identity.value).trim(),
    };
  }

  const recipientHash = readText(input.recipientHash);
  if (recipientHash) {
    return {
      type: 'recipient_hash',
      value: recipientHash,
    };
  }

  const recipientFingerprint = readText(input.recipientFingerprint);
  if (recipientFingerprint) {
    return {
      type: 'recipient_fingerprint',
      value: recipientFingerprint,
    };
  }

  return {
    type: 'missing_recipient',
    reasonCode: hasText(input.recipientEmail)
      ? 'raw_recipient_email_not_accepted'
      : 'missing_duplicate_recipient_identity',
  };
}

function validateRecipientIdentity(
  recipient: unknown,
): EmailJobDuplicateAuditPlanValidationResult {
  const record = asRecord(recipient);
  if (!record || !hasText(record.type)) {
    return invalid('missing_recipient_identity', 'missing_duplicate_recipient_identity');
  }

  if (record.type === 'missing_recipient') {
    const reasonCode = readText(record.reasonCode) || 'missing_duplicate_recipient_identity';
    return invalid(
      reasonCode === 'raw_recipient_email_not_accepted'
        ? 'raw_recipient_not_allowed'
        : 'missing_recipient_identity',
      reasonCode,
    );
  }

  if (
    (record.type === 'recipient_hash' || record.type === 'recipient_fingerprint')
    && hasText(record.value)
  ) {
    return {
      valid: true,
      reasonCode: 'duplicate_recipient_identity_valid',
    };
  }

  return invalid('missing_recipient_identity', 'missing_duplicate_recipient_identity');
}

function findMissingRequiredPart(
  sourceType: Exclude<EmailJobDuplicateSourceType, 'unknown'>,
  parts: JsonRecord,
): EmailJobDuplicateAuditPlanValidationResult | null {
  const requiredParts = REQUIRED_PARTS_BY_SOURCE[sourceType];
  for (const part of requiredParts) {
    if (part === 'recipient') {
      const recipientRecord = asRecord(parts.recipient);
      if (!recipientRecord || recipientRecord.type === 'missing_recipient') {
        return invalid('missing_recipient_identity', 'missing_duplicate_recipient_identity');
      }
      continue;
    }

    if (part === 'contentFingerprint') {
      if (!hasText(parts.contentFingerprint)) {
        return invalid('missing_required_part', 'missing_contentFingerprint');
      }
      continue;
    }

    if (!hasText(parts[part])) {
      return invalid('missing_required_part', `missing_${part}`);
    }
  }

  return null;
}

function buildSafeEmailJobDuplicateAuditPlanResultProjection(
  result: EmailJobDuplicateAuditPlanResult,
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

function buildSafePlanProjection(plan: EmailJobDuplicateAuditPlanItem): unknown {
  if (plan.type === 'email_job_duplicate_candidate') {
    return buildSafeEmailJobDuplicateCandidateForLog(plan);
  }
  return sanitizeForSafeProjection(plan);
}

function buildSafeRecipientIdentity(
  recipient: EmailJobDuplicateRecipientIdentity,
): EmailJobDuplicateRecipientIdentity {
  if (recipient.type === 'recipient_hash' || recipient.type === 'recipient_fingerprint') {
    return {
      type: recipient.type,
      value: maskSensitiveValue(recipient.value),
    };
  }

  return { ...recipient };
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
    const normalizedKey = normalizeKey(key);
    if (SECRET_KEYS.has(normalizedKey) || RAW_RECIPIENT_KEYS.has(normalizedKey)) {
      output[key] = REDACTED;
      continue;
    }
    if (BODY_KEYS.has(normalizedKey)) {
      output[key] = OMITTED;
      continue;
    }
    if (MESSAGE_KEYS.has(normalizedKey)) {
      output[key] = REDACTED;
      continue;
    }
    if (
      (normalizedKey === 'recipienthash'
        || normalizedKey === 'recipientfingerprint'
        || normalizedKey === 'contentfingerprint')
      && typeof rawValue === 'string'
    ) {
      output[key] = maskSensitiveValue(rawValue);
      continue;
    }
    output[key] = sanitizeForSafeProjection(rawValue);
  }

  return output;
}

function safeContentFingerprint(value: unknown): string | undefined {
  const text = readText(value);
  return text && isSafeContentFingerprint(text) ? text : undefined;
}

function isSafeContentFingerprint(value: unknown): value is string {
  if (!hasText(value)) {
    return false;
  }

  const text = value.trim();
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(text)) {
    return false;
  }

  return !/(html|text|body|payload|message)/i.test(text);
}

function maskSensitiveValue(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function copyTextPart(
  target: EmailJobDuplicateCandidate['parts'],
  key: keyof Omit<EmailJobDuplicateCandidate['parts'], 'recipient'>,
  value: unknown,
): void {
  const text = readText(value);
  if (text) {
    target[key] = text;
  }
}

function readStatus(result: unknown): unknown {
  return asRecord(result)?.status;
}

function readStatusValue(value: unknown): EmailJobDuplicateStatusValue | undefined {
  return isStatusValue(value) ? value : undefined;
}

function isSourceType(value: unknown): value is EmailJobDuplicateSourceType {
  return typeof value === 'string' && SOURCE_TYPES.has(value as EmailJobDuplicateSourceType);
}

function isStatusValue(value: unknown): value is EmailJobDuplicateStatusValue {
  return typeof value === 'string' && STATUSES.has(value as EmailJobDuplicateStatusValue);
}

function invalid(
  errorCode: EmailJobDuplicateAuditPlanErrorCode,
  reasonCode: string,
): EmailJobDuplicateAuditPlanValidationResult {
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
