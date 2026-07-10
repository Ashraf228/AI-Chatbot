export type EmailJobIdempotencySourceType =
  | 'lead_notification'
  | 'contact_request'
  | 'conversation_delivery'
  | 'report_delivery'
  | 'generic_email_delivery';

export type EmailJobRecipientIdentity =
  | {
      type: 'recipient_hash';
      value: string;
    }
  | {
      type: 'missing_recipient';
      reasonCode: string;
    };

export type EmailJobIdempotencyKeyCandidate = {
  type: 'email_job_idempotency_key_candidate';
  version: 'v1';
  sourceType: EmailJobIdempotencySourceType;
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
    recipient: EmailJobRecipientIdentity;
  };
  reasonCode: string;
};

export type EmailJobIdempotencyKeyPolicy = {
  type: 'email_job_idempotency_key_policy';
  version: 'v1';
  sourceType: EmailJobIdempotencySourceType;
  requiredParts: readonly string[];
  piiMode: 'hashed_recipient_only';
  allowsRawRecipientEmail: false;
  reasonCode: string;
};

export type EmailJobDuplicateStatus = 'queued' | 'processing' | 'sent' | 'failed' | 'unknown';

export type EmailJobDedupeDecision =
  | {
      decision: 'allow_create';
      reasonCode: string;
      candidate: EmailJobIdempotencyKeyCandidate;
    }
  | {
      decision: 'skip_duplicate';
      reasonCode: string;
      duplicateStatus?: EmailJobDuplicateStatus;
    }
  | {
      decision: 'blocked';
      reasonCode: string;
      errorCode: EmailJobIdempotencyErrorCode;
    }
  | {
      decision: 'failed';
      reasonCode: string;
      errorCode: EmailJobIdempotencyErrorCode;
      retryable: boolean;
    };

export type EmailJobSchemaPlan = {
  type: 'email_job_schema_plan';
  planType: 'idempotency_column' | 'partial_unique_index' | 'backfill_plan' | 'duplicate_cleanup_plan';
  status: 'proposed_only';
  reasonCode: string;
  notes?: readonly string[];
};

export type EmailJobBackfillRisk = {
  type: 'email_job_backfill_risk';
  riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  reasonCode: string;
  requiresDbAudit: boolean;
  requiresDuplicateCleanup: boolean;
  requiresRollbackPlan: boolean;
};

export type EmailJobIdempotencyErrorCode =
  | 'missing_candidate'
  | 'invalid_candidate'
  | 'invalid_source_type'
  | 'invalid_version'
  | 'missing_reason_code'
  | 'missing_required_part'
  | 'missing_recipient_hash'
  | 'raw_recipient_not_allowed'
  | 'invalid_policy'
  | 'invalid_dedupe_decision'
  | 'invalid_schema_plan'
  | 'invalid_backfill_risk'
  | 'unknown_email_job_idempotency_error';

export type EmailJobIdempotencyValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobIdempotencyErrorCode };

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
  reasonCode?: unknown;
};

const SOURCE_TYPES = new Set<EmailJobIdempotencySourceType>([
  'lead_notification',
  'contact_request',
  'conversation_delivery',
  'report_delivery',
  'generic_email_delivery',
]);
const DUPLICATE_STATUSES = new Set<EmailJobDuplicateStatus>([
  'queued',
  'processing',
  'sent',
  'failed',
  'unknown',
]);
const SCHEMA_PLAN_TYPES = new Set<EmailJobSchemaPlan['planType']>([
  'idempotency_column',
  'partial_unique_index',
  'backfill_plan',
  'duplicate_cleanup_plan',
]);
const BACKFILL_RISK_LEVELS = new Set<EmailJobBackfillRisk['riskLevel']>([
  'low',
  'medium',
  'high',
  'blocked',
]);
const REQUIRED_PARTS_BY_SOURCE: Record<EmailJobIdempotencySourceType, readonly string[]> = {
  lead_notification: ['siteId', 'leadId', 'recipientHash', 'notificationType'],
  contact_request: ['siteId', 'contactRequestId', 'recipientHash', 'notificationType'],
  conversation_delivery: ['siteId', 'conversationId', 'sessionId', 'recipientHash', 'deliveryType'],
  report_delivery: ['reportRunId', 'recipientHash', 'deliveryType'],
  generic_email_delivery: ['siteId', 'recipientHash', 'deliveryType'],
};
const DEFAULT_BLOCKED_REASON = 'email_job_idempotency_blocked';
const DEFAULT_FAILED_REASON = 'email_job_idempotency_failed';
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

export function buildLeadNotificationIdempotencyCandidate(
  input: CandidateInput,
): EmailJobIdempotencyKeyCandidate {
  return buildEmailJobIdempotencyCandidate('lead_notification', input, 'lead_notification_idempotency_candidate');
}

export function buildContactRequestIdempotencyCandidate(
  input: CandidateInput,
): EmailJobIdempotencyKeyCandidate {
  return buildEmailJobIdempotencyCandidate('contact_request', input, 'contact_request_idempotency_candidate');
}

export function buildConversationDeliveryIdempotencyCandidate(
  input: CandidateInput,
): EmailJobIdempotencyKeyCandidate {
  return buildEmailJobIdempotencyCandidate('conversation_delivery', input, 'conversation_delivery_idempotency_candidate');
}

export function buildReportDeliveryIdempotencyCandidate(
  input: CandidateInput,
): EmailJobIdempotencyKeyCandidate {
  return buildEmailJobIdempotencyCandidate('report_delivery', input, 'report_delivery_idempotency_candidate');
}

export function buildGenericEmailDeliveryIdempotencyCandidate(
  input: CandidateInput,
): EmailJobIdempotencyKeyCandidate {
  return buildEmailJobIdempotencyCandidate('generic_email_delivery', input, 'generic_email_delivery_idempotency_candidate');
}

export function buildLeadNotificationIdempotencyPolicy(): EmailJobIdempotencyKeyPolicy {
  return buildEmailJobIdempotencyPolicy('lead_notification', 'lead_notification_idempotency_policy');
}

export function buildContactRequestIdempotencyPolicy(): EmailJobIdempotencyKeyPolicy {
  return buildEmailJobIdempotencyPolicy('contact_request', 'contact_request_idempotency_policy');
}

export function buildConversationDeliveryIdempotencyPolicy(): EmailJobIdempotencyKeyPolicy {
  return buildEmailJobIdempotencyPolicy('conversation_delivery', 'conversation_delivery_idempotency_policy');
}

export function buildReportDeliveryIdempotencyPolicy(): EmailJobIdempotencyKeyPolicy {
  return buildEmailJobIdempotencyPolicy('report_delivery', 'report_delivery_idempotency_policy');
}

export function buildGenericEmailDeliveryIdempotencyPolicy(): EmailJobIdempotencyKeyPolicy {
  return buildEmailJobIdempotencyPolicy('generic_email_delivery', 'generic_email_delivery_idempotency_policy');
}

export function validateEmailJobIdempotencyCandidate(
  candidate: unknown,
): EmailJobIdempotencyValidationResult {
  const record = asRecord(candidate);
  const parts = asRecord(record?.parts);
  if (!record || !parts || record.type !== 'email_job_idempotency_key_candidate') {
    return buildInvalidValidation('missing_candidate', 'missing_email_job_idempotency_candidate');
  }

  if (record.version !== 'v1') {
    return buildInvalidValidation('invalid_version', 'invalid_email_job_idempotency_candidate_version');
  }

  if (!isEmailJobIdempotencySourceType(record.sourceType)) {
    return buildInvalidValidation('invalid_source_type', 'invalid_email_job_idempotency_source_type');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_idempotency_reason');
  }

  if (containsRawRecipientEmail(candidate)) {
    return buildInvalidValidation('raw_recipient_not_allowed', 'raw_recipient_not_allowed');
  }

  const recipient = asRecord(parts.recipient);
  if (!recipient || recipient.type !== 'recipient_hash' || !hasText(recipient.value)) {
    return buildInvalidValidation('missing_recipient_hash', 'missing_email_job_recipient_hash');
  }

  for (const part of REQUIRED_PARTS_BY_SOURCE[record.sourceType]) {
    if (part === 'recipientHash') {
      continue;
    }
    if (!hasText(parts[part])) {
      return buildInvalidValidation('missing_required_part', `missing_${part}`);
    }
  }

  return { valid: true, reasonCode: record.reasonCode };
}

export function validateEmailJobIdempotencyKeyPolicy(
  policy: unknown,
): EmailJobIdempotencyValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_idempotency_key_policy') {
    return buildInvalidValidation('invalid_policy', 'invalid_email_job_idempotency_policy');
  }

  if (record.version !== 'v1') {
    return buildInvalidValidation('invalid_version', 'invalid_email_job_idempotency_policy_version');
  }

  if (!isEmailJobIdempotencySourceType(record.sourceType)) {
    return buildInvalidValidation('invalid_source_type', 'invalid_email_job_idempotency_policy_source_type');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_idempotency_policy_reason');
  }

  if (record.piiMode !== 'hashed_recipient_only' || record.allowsRawRecipientEmail !== false) {
    return buildInvalidValidation('raw_recipient_not_allowed', 'raw_recipient_not_allowed');
  }

  if (!Array.isArray(record.requiredParts)) {
    return buildInvalidValidation('invalid_policy', 'invalid_email_job_idempotency_required_parts');
  }

  const expected = REQUIRED_PARTS_BY_SOURCE[record.sourceType];
  for (const part of expected) {
    if (!record.requiredParts.includes(part)) {
      return buildInvalidValidation('missing_required_part', `missing_${part}`);
    }
  }

  return { valid: true, reasonCode: record.reasonCode };
}

export function validateEmailJobDedupeDecision(
  decision: unknown,
): EmailJobIdempotencyValidationResult {
  const record = asRecord(decision);
  if (!record || !hasText(record.decision)) {
    return buildInvalidValidation('invalid_dedupe_decision', 'invalid_email_job_dedupe_decision');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_dedupe_decision_reason');
  }

  if (record.decision === 'allow_create') {
    return validateEmailJobIdempotencyCandidate(record.candidate);
  }

  if (record.decision === 'skip_duplicate') {
    if (typeof record.duplicateStatus !== 'undefined' && !isEmailJobDuplicateStatus(record.duplicateStatus)) {
      return buildInvalidValidation('invalid_dedupe_decision', 'invalid_email_job_duplicate_status');
    }
    return { valid: true, reasonCode: record.reasonCode };
  }

  if (record.decision === 'blocked') {
    return hasText(record.errorCode)
      ? { valid: true, reasonCode: record.reasonCode }
      : buildInvalidValidation('invalid_dedupe_decision', 'missing_email_job_dedupe_error_code');
  }

  if (record.decision === 'failed') {
    if (!hasText(record.errorCode) || typeof record.retryable !== 'boolean') {
      return buildInvalidValidation('invalid_dedupe_decision', 'invalid_email_job_dedupe_failure');
    }
    return { valid: true, reasonCode: record.reasonCode };
  }

  return buildInvalidValidation('invalid_dedupe_decision', 'invalid_email_job_dedupe_decision');
}

export function validateEmailJobSchemaPlan(plan: unknown): EmailJobIdempotencyValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_schema_plan') {
    return buildInvalidValidation('invalid_schema_plan', 'invalid_email_job_schema_plan');
  }

  if (!SCHEMA_PLAN_TYPES.has(record.planType as EmailJobSchemaPlan['planType']) || record.status !== 'proposed_only') {
    return buildInvalidValidation('invalid_schema_plan', 'invalid_email_job_schema_plan_type');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_schema_plan_reason');
  }

  if (Array.isArray(record.notes) && record.notes.some((note) => typeof note !== 'string')) {
    return buildInvalidValidation('invalid_schema_plan', 'invalid_email_job_schema_plan_notes');
  }

  return { valid: true, reasonCode: record.reasonCode };
}

export function validateEmailJobBackfillRisk(risk: unknown): EmailJobIdempotencyValidationResult {
  const record = asRecord(risk);
  if (!record || record.type !== 'email_job_backfill_risk') {
    return buildInvalidValidation('invalid_backfill_risk', 'invalid_email_job_backfill_risk');
  }

  if (!BACKFILL_RISK_LEVELS.has(record.riskLevel as EmailJobBackfillRisk['riskLevel'])) {
    return buildInvalidValidation('invalid_backfill_risk', 'invalid_email_job_backfill_risk_level');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_backfill_risk_reason');
  }

  if (
    typeof record.requiresDbAudit !== 'boolean'
    || typeof record.requiresDuplicateCleanup !== 'boolean'
    || typeof record.requiresRollbackPlan !== 'boolean'
  ) {
    return buildInvalidValidation('invalid_backfill_risk', 'invalid_email_job_backfill_risk_flags');
  }

  return { valid: true, reasonCode: record.reasonCode };
}

export function buildAllowCreateEmailJobDedupeDecision(
  candidate: EmailJobIdempotencyKeyCandidate,
): EmailJobDedupeDecision {
  const validation = validateEmailJobIdempotencyCandidate(candidate);
  if (!validation.valid) {
    return buildBlockedEmailJobDedupeDecision(validation.reasonCode, validation.errorCode);
  }

  return {
    decision: 'allow_create',
    reasonCode: validation.reasonCode,
    candidate,
  };
}

export function buildSkipDuplicateEmailJobDedupeDecision(
  reasonCode: string,
  duplicateStatus: EmailJobDuplicateStatus = 'unknown',
): EmailJobDedupeDecision {
  return {
    decision: 'skip_duplicate',
    reasonCode: reasonCode || 'email_job_duplicate_detected',
    duplicateStatus: isEmailJobDuplicateStatus(duplicateStatus) ? duplicateStatus : 'unknown',
  };
}

export function buildBlockedEmailJobDedupeDecision(
  reasonCode: string,
  errorCode: EmailJobIdempotencyErrorCode = 'unknown_email_job_idempotency_error',
): EmailJobDedupeDecision {
  return {
    decision: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobDedupeDecision(
  reasonCode: string,
  errorCode: EmailJobIdempotencyErrorCode = 'unknown_email_job_idempotency_error',
  retryable = false,
): EmailJobDedupeDecision {
  return {
    decision: 'failed',
    reasonCode: reasonCode || DEFAULT_FAILED_REASON,
    errorCode,
    retryable: Boolean(retryable),
  };
}

export function buildProposedIdempotencyColumnPlan(reasonCode: string): EmailJobSchemaPlan {
  return buildEmailJobSchemaPlan('idempotency_column', reasonCode || 'proposed_idempotency_column');
}

export function buildProposedPartialUniqueIndexPlan(reasonCode: string): EmailJobSchemaPlan {
  return buildEmailJobSchemaPlan('partial_unique_index', reasonCode || 'proposed_partial_unique_index');
}

export function buildProposedBackfillPlan(reasonCode: string): EmailJobSchemaPlan {
  return buildEmailJobSchemaPlan('backfill_plan', reasonCode || 'proposed_backfill_plan');
}

export function buildProposedDuplicateCleanupPlan(reasonCode: string): EmailJobSchemaPlan {
  return buildEmailJobSchemaPlan('duplicate_cleanup_plan', reasonCode || 'proposed_duplicate_cleanup_plan');
}

export function buildEmailJobBackfillRisk(input: {
  riskLevel?: EmailJobBackfillRisk['riskLevel'];
  reasonCode?: string;
  requiresDbAudit?: boolean;
  requiresDuplicateCleanup?: boolean;
  requiresRollbackPlan?: boolean;
}): EmailJobBackfillRisk {
  const riskLevel = BACKFILL_RISK_LEVELS.has(input.riskLevel || 'medium')
    ? input.riskLevel || 'medium'
    : 'medium';
  return {
    type: 'email_job_backfill_risk',
    riskLevel,
    reasonCode: input.reasonCode || 'email_job_backfill_risk_requires_audit',
    requiresDbAudit: input.requiresDbAudit !== false,
    requiresDuplicateCleanup: Boolean(input.requiresDuplicateCleanup),
    requiresRollbackPlan: input.requiresRollbackPlan !== false,
  };
}

export function isAllowCreateEmailJobDedupeDecision(
  decision: unknown,
): decision is Extract<EmailJobDedupeDecision, { decision: 'allow_create' }> {
  return readDecision(decision) === 'allow_create';
}

export function isSkipDuplicateEmailJobDedupeDecision(
  decision: unknown,
): decision is Extract<EmailJobDedupeDecision, { decision: 'skip_duplicate' }> {
  return readDecision(decision) === 'skip_duplicate';
}

export function isBlockedEmailJobDedupeDecision(
  decision: unknown,
): decision is Extract<EmailJobDedupeDecision, { decision: 'blocked' }> {
  return readDecision(decision) === 'blocked';
}

export function isFailedEmailJobDedupeDecision(
  decision: unknown,
): decision is Extract<EmailJobDedupeDecision, { decision: 'failed' }> {
  return readDecision(decision) === 'failed';
}

export function buildSafeEmailJobIdempotencyCandidateForLog(
  candidate: EmailJobIdempotencyKeyCandidate,
): JsonRecord {
  return sanitizeForSafeProjection({
    type: candidate.type,
    version: candidate.version,
    sourceType: candidate.sourceType,
    reasonCode: candidate.reasonCode,
    parts: {
      ...candidate.parts,
      recipient: buildSafeRecipientIdentity(candidate.parts.recipient),
    },
  }) as JsonRecord;
}

export function buildSafeEmailJobIdempotencyPolicyForLog(
  policy: EmailJobIdempotencyKeyPolicy,
): JsonRecord {
  return {
    type: policy.type,
    version: policy.version,
    sourceType: policy.sourceType,
    requiredParts: [...policy.requiredParts],
    piiMode: policy.piiMode,
    allowsRawRecipientEmail: policy.allowsRawRecipientEmail,
    reasonCode: policy.reasonCode,
  };
}

export function buildSafeEmailJobDedupeDecisionForLog(decision: EmailJobDedupeDecision): JsonRecord {
  return buildSafeEmailJobDedupeDecisionProjection(decision);
}

export function buildSafeEmailJobDedupeDecisionForAudit(decision: EmailJobDedupeDecision): JsonRecord {
  return buildSafeEmailJobDedupeDecisionProjection(decision);
}

export function buildSafeEmailJobSchemaPlanForLog(plan: EmailJobSchemaPlan): JsonRecord {
  return sanitizeForSafeProjection(plan) as JsonRecord;
}

export function buildSafeEmailJobBackfillRiskForLog(risk: EmailJobBackfillRisk): JsonRecord {
  return {
    type: risk.type,
    riskLevel: risk.riskLevel,
    reasonCode: risk.reasonCode,
    requiresDbAudit: risk.requiresDbAudit,
    requiresDuplicateCleanup: risk.requiresDuplicateCleanup,
    requiresRollbackPlan: risk.requiresRollbackPlan,
  };
}

function buildEmailJobIdempotencyCandidate(
  sourceType: EmailJobIdempotencySourceType,
  input: CandidateInput,
  defaultReasonCode: string,
): EmailJobIdempotencyKeyCandidate {
  const parts: EmailJobIdempotencyKeyCandidate['parts'] = {
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

  return {
    type: 'email_job_idempotency_key_candidate',
    version: 'v1',
    sourceType,
    parts,
    reasonCode: readText(input.reasonCode) || defaultReasonCode,
  };
}

function buildEmailJobIdempotencyPolicy(
  sourceType: EmailJobIdempotencySourceType,
  reasonCode: string,
): EmailJobIdempotencyKeyPolicy {
  return {
    type: 'email_job_idempotency_key_policy',
    version: 'v1',
    sourceType,
    requiredParts: REQUIRED_PARTS_BY_SOURCE[sourceType],
    piiMode: 'hashed_recipient_only',
    allowsRawRecipientEmail: false,
    reasonCode,
  };
}

function buildRecipientIdentity(input: RecipientInput): EmailJobRecipientIdentity {
  const identity = asRecord(input.recipientIdentity);
  if (identity?.type === 'recipient_hash' && hasText(identity.value)) {
    return {
      type: 'recipient_hash',
      value: String(identity.value).trim(),
    };
  }

  const recipientHash = readText(input.recipientHash) || readText(input.recipientFingerprint);
  if (recipientHash) {
    return {
      type: 'recipient_hash',
      value: recipientHash,
    };
  }

  return {
    type: 'missing_recipient',
    reasonCode: hasText(input.recipientEmail)
      ? 'raw_recipient_email_not_accepted'
      : 'missing_email_job_recipient_hash',
  };
}

function buildEmailJobSchemaPlan(
  planType: EmailJobSchemaPlan['planType'],
  reasonCode: string,
): EmailJobSchemaPlan {
  return {
    type: 'email_job_schema_plan',
    planType,
    status: 'proposed_only',
    reasonCode,
    notes: [
      'data_object_only',
      'no_sql',
      'no_migration',
      'no_db_access',
      'no_enforcement',
    ],
  };
}

function buildSafeEmailJobDedupeDecisionProjection(decision: EmailJobDedupeDecision): JsonRecord {
  if (decision.decision === 'allow_create') {
    return {
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      candidate: buildSafeEmailJobIdempotencyCandidateForLog(decision.candidate),
    };
  }

  return sanitizeForSafeProjection(decision) as JsonRecord;
}

function buildSafeRecipientIdentity(recipient: EmailJobRecipientIdentity): EmailJobRecipientIdentity {
  if (recipient.type === 'recipient_hash') {
    return {
      type: 'recipient_hash',
      value: maskRecipientHash(recipient.value),
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
    if ((normalizedKey === 'recipienthash' || normalizedKey === 'recipientfingerprint') && typeof rawValue === 'string') {
      output[key] = maskRecipientHash(rawValue);
      continue;
    }
    output[key] = sanitizeForSafeProjection(rawValue);
  }

  return output;
}

function containsRawRecipientEmail(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsRawRecipientEmail(item));
  }

  const record = asRecord(value);
  if (!record) {
    return false;
  }

  return Object.entries(record).some(([key, rawValue]) => {
    if (RAW_RECIPIENT_KEYS.has(normalizeKey(key))) {
      return true;
    }
    return containsRawRecipientEmail(rawValue);
  });
}

function copyTextPart(
  target: EmailJobIdempotencyKeyCandidate['parts'],
  key: keyof Omit<EmailJobIdempotencyKeyCandidate['parts'], 'recipient'>,
  value: unknown,
): void {
  const text = readText(value);
  if (text) {
    target[key] = text;
  }
}

function maskRecipientHash(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function readDecision(decision: unknown): unknown {
  return asRecord(decision)?.decision;
}

function isEmailJobIdempotencySourceType(value: unknown): value is EmailJobIdempotencySourceType {
  return typeof value === 'string' && SOURCE_TYPES.has(value as EmailJobIdempotencySourceType);
}

function isEmailJobDuplicateStatus(value: unknown): value is EmailJobDuplicateStatus {
  return typeof value === 'string' && DUPLICATE_STATUSES.has(value as EmailJobDuplicateStatus);
}

function buildInvalidValidation(
  errorCode: EmailJobIdempotencyErrorCode,
  reasonCode: string,
): EmailJobIdempotencyValidationResult {
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
