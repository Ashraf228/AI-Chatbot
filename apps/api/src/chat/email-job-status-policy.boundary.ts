import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobStatusValue = 'queued' | 'processing' | 'sent' | 'failed';

export type EmailJobStatusTransitionName =
  | 'queued_to_processing'
  | 'processing_to_sent'
  | 'processing_to_retry_queued'
  | 'processing_to_failed';

export type EmailJobStatusPolicyErrorCode =
  | 'missing_policy'
  | 'missing_reason_code'
  | 'invalid_transition'
  | 'invalid_retry_count'
  | 'invalid_max_attempts'
  | 'invalid_retry_policy'
  | 'invalid_locking_policy'
  | 'invalid_lock_mode'
  | 'invalid_stale_threshold'
  | 'invalid_processing_age'
  | 'invalid_stale_processing_policy'
  | 'unknown_email_job_status_policy_error';

export type EmailJobStatusTransitionPolicy = {
  type: 'email_job_status_transition_policy';
  transition: EmailJobStatusTransitionName;
  from: EmailJobStatusValue;
  to: EmailJobStatusValue;
  reasonCode: string;
};

export type EmailJobRetryPolicy = {
  type: 'email_job_retry_policy';
  retryCount: number;
  maxAttempts: number;
  decision: 'retry' | 'final_failed' | 'blocked';
  reasonCode: string;
  nextRetryDelayMinutes?: number;
  errorCode?: EmailJobStatusPolicyErrorCode;
};

export type EmailJobLockingPolicy = {
  type: 'email_job_locking_policy';
  lockMode: 'for_update_skip_locked';
  status: 'queued';
  availableNow: boolean;
  orderBy: readonly ['available_at', 'created_at'];
  limit: 1;
  reasonCode: string;
};

export type EmailJobStaleProcessingPolicy = {
  type: 'email_job_stale_processing_policy';
  thresholdMinutes: number;
  processingAgeMinutes: number;
  candidateStatus: EmailJobStatusValue;
  decision: 'recovery_candidate' | 'not_stale' | 'blocked';
  reasonCode: string;
  errorCode?: EmailJobStatusPolicyErrorCode;
};

export type EmailJobStatusPolicy =
  | EmailJobStatusTransitionPolicy
  | EmailJobRetryPolicy
  | EmailJobLockingPolicy
  | EmailJobStaleProcessingPolicy;

export type ReadyEmailJobStatusPolicyResult = {
  status: 'ready';
  reasonCode: string;
  policy: EmailJobStatusPolicy;
};

export type SkippedEmailJobStatusPolicyResult = {
  status: 'skipped';
  reasonCode: string;
};

export type BlockedEmailJobStatusPolicyResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobStatusPolicyErrorCode;
};

export type FailedEmailJobStatusPolicyResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobStatusPolicyErrorCode;
  retryable: boolean;
};

export type EmailJobStatusPolicyResult =
  | ReadyEmailJobStatusPolicyResult
  | SkippedEmailJobStatusPolicyResult
  | BlockedEmailJobStatusPolicyResult
  | FailedEmailJobStatusPolicyResult;

export type EmailJobStatusPolicyValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobStatusPolicyErrorCode };

type JsonRecord = Record<string, unknown>;

const DEFAULT_BLOCKED_REASON = 'email_job_status_policy_blocked';
const DEFAULT_FAILED_REASON = 'email_job_status_policy_failed';
const DEFAULT_SKIPPED_REASON = 'email_job_status_policy_skipped';
const MAX_RETRY_DELAY_MINUTES = 30;
const LOCKING_ORDER_BY = ['available_at', 'created_at'] as const;
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
const BODY_KEYS = new Set(['html', 'text', 'body']);
const MESSAGE_KEYS = new Set([
  'message',
  'usermessage',
  'user_message',
  'providererror',
  'provider_error',
  'lasterror',
  'last_error',
  'errormessage',
  'error_message',
  'sql',
]);

export function buildQueuedToProcessingPolicy(
  reasonCode = 'email_job_status_policy_pick_ready',
): EmailJobStatusTransitionPolicy {
  return buildTransitionPolicy('queued_to_processing', 'queued', 'processing', reasonCode);
}

export function buildProcessingToSentPolicy(
  reasonCode = 'email_job_status_policy_send_succeeded',
): EmailJobStatusTransitionPolicy {
  return buildTransitionPolicy('processing_to_sent', 'processing', 'sent', reasonCode);
}

export function buildProcessingToRetryQueuedPolicy(
  reasonCode = 'email_job_status_policy_retry_scheduled',
): EmailJobStatusTransitionPolicy {
  return buildTransitionPolicy('processing_to_retry_queued', 'processing', 'queued', reasonCode);
}

export function buildProcessingToFailedPolicy(
  reasonCode = 'email_job_status_policy_final_failed',
): EmailJobStatusTransitionPolicy {
  return buildTransitionPolicy('processing_to_failed', 'processing', 'failed', reasonCode);
}

export function validateEmailJobStatusTransitionPolicy(
  policy: unknown,
): EmailJobStatusPolicyValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_status_transition_policy') {
    return buildInvalidValidation('invalid_transition', 'invalid_email_job_status_transition_policy');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_status_transition_reason');
  }

  if (!isAllowedTransitionName(record.transition)) {
    return buildInvalidValidation('invalid_transition', 'invalid_email_job_status_transition');
  }

  if (!isEmailJobStatusValue(record.from) || !isEmailJobStatusValue(record.to)) {
    return buildInvalidValidation('invalid_transition', 'invalid_email_job_status_transition_status');
  }

  if (!matchesNamedTransition(record.transition, record.from, record.to)) {
    return buildInvalidValidation('invalid_transition', 'invalid_email_job_status_transition_matrix');
  }

  return { valid: true, reasonCode: record.reasonCode };
}

export function isAllowedEmailJobStatusTransition(from: unknown, to: unknown): boolean {
  return isEmailJobStatusValue(from)
    && isEmailJobStatusValue(to)
    && (
      (from === 'queued' && to === 'processing')
      || (from === 'processing' && to === 'sent')
      || (from === 'processing' && to === 'queued')
      || (from === 'processing' && to === 'failed')
    );
}

export function buildEmailJobRetryPolicy(
  retryCount: number,
  maxAttempts: number,
): EmailJobRetryPolicy {
  if (!isValidNonNegativeInteger(retryCount)) {
    return buildBlockedEmailJobRetryPolicy(
      retryCount,
      maxAttempts,
      'invalid_email_job_retry_count',
      'invalid_retry_count',
    );
  }

  if (!isValidPositiveInteger(maxAttempts)) {
    return buildBlockedEmailJobRetryPolicy(
      retryCount,
      maxAttempts,
      'invalid_email_job_max_attempts',
      'invalid_max_attempts',
    );
  }

  const nextRetryCount = retryCount + 1;
  if (retryCount < maxAttempts) {
    return {
      type: 'email_job_retry_policy',
      retryCount,
      maxAttempts,
      decision: 'retry',
      nextRetryDelayMinutes: calculateEmailJobRetryDelayMinutes(nextRetryCount),
      reasonCode: 'email_job_retry_available',
    };
  }

  return {
    type: 'email_job_retry_policy',
    retryCount,
    maxAttempts,
    decision: 'final_failed',
    reasonCode: 'email_job_retry_exhausted',
  };
}

export function validateEmailJobRetryPolicy(policy: unknown): EmailJobStatusPolicyValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_retry_policy') {
    return buildInvalidValidation('invalid_retry_policy', 'invalid_email_job_retry_policy');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_retry_reason');
  }

  if (!isValidNonNegativeInteger(record.retryCount)) {
    return buildInvalidValidation('invalid_retry_count', 'invalid_email_job_retry_count');
  }

  if (!isValidPositiveInteger(record.maxAttempts)) {
    return buildInvalidValidation('invalid_max_attempts', 'invalid_email_job_max_attempts');
  }

  if (record.decision === 'retry' && isValidRetryDelay(record.nextRetryDelayMinutes)) {
    return { valid: true, reasonCode: record.reasonCode };
  }

  if (record.decision === 'final_failed') {
    return { valid: true, reasonCode: record.reasonCode };
  }

  if (record.decision === 'blocked' && hasText(record.errorCode)) {
    return { valid: true, reasonCode: record.reasonCode };
  }

  return buildInvalidValidation('invalid_retry_policy', 'invalid_email_job_retry_policy');
}

export function calculateEmailJobRetryDelayMinutes(nextRetryCount: number): number {
  if (!Number.isFinite(nextRetryCount) || nextRetryCount <= 0) {
    return 1;
  }
  return Math.min(Math.ceil(nextRetryCount) * 2, MAX_RETRY_DELAY_MINUTES);
}

export function buildEmailJobLockingPolicy(
  reasonCode = 'email_job_locking_policy_ready',
): EmailJobLockingPolicy {
  return {
    type: 'email_job_locking_policy',
    lockMode: 'for_update_skip_locked',
    status: 'queued',
    availableNow: true,
    orderBy: LOCKING_ORDER_BY,
    limit: 1,
    reasonCode: reasonCode || 'email_job_locking_policy_ready',
  };
}

export function validateEmailJobLockingPolicy(policy: unknown): EmailJobStatusPolicyValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_locking_policy') {
    return buildInvalidValidation('invalid_locking_policy', 'invalid_email_job_locking_policy');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_locking_reason');
  }

  if (record.lockMode !== 'for_update_skip_locked') {
    return buildInvalidValidation('invalid_lock_mode', 'invalid_email_job_lock_mode');
  }

  if (
    record.status !== 'queued'
    || record.availableNow !== true
    || !isExpectedOrderBy(record.orderBy)
    || record.limit !== 1
  ) {
    return buildInvalidValidation('invalid_locking_policy', 'invalid_email_job_locking_policy');
  }

  return { valid: true, reasonCode: record.reasonCode };
}

export function buildEmailJobStaleProcessingPolicy(input: {
  thresholdMinutes: number;
  processingAgeMinutes: number;
  candidateStatus?: EmailJobStatusValue;
  reasonCode?: string;
}): EmailJobStaleProcessingPolicy {
  const thresholdMinutes = input.thresholdMinutes;
  const processingAgeMinutes = input.processingAgeMinutes;
  const candidateStatus = input.candidateStatus || 'processing';

  if (!isValidPositiveNumber(thresholdMinutes)) {
    return buildBlockedEmailJobStaleProcessingPolicy(
      thresholdMinutes,
      processingAgeMinutes,
      candidateStatus,
      'invalid_email_job_stale_threshold',
      'invalid_stale_threshold',
    );
  }

  if (!isValidNonNegativeNumber(processingAgeMinutes)) {
    return buildBlockedEmailJobStaleProcessingPolicy(
      thresholdMinutes,
      processingAgeMinutes,
      candidateStatus,
      'invalid_email_job_processing_age',
      'invalid_processing_age',
    );
  }

  if (candidateStatus !== 'processing') {
    return {
      type: 'email_job_stale_processing_policy',
      thresholdMinutes,
      processingAgeMinutes,
      candidateStatus,
      decision: 'not_stale',
      reasonCode: input.reasonCode || 'email_job_not_processing',
    };
  }

  if (processingAgeMinutes > thresholdMinutes) {
    return {
      type: 'email_job_stale_processing_policy',
      thresholdMinutes,
      processingAgeMinutes,
      candidateStatus,
      decision: 'recovery_candidate',
      reasonCode: input.reasonCode || 'email_job_stale_processing_candidate',
    };
  }

  return {
    type: 'email_job_stale_processing_policy',
    thresholdMinutes,
    processingAgeMinutes,
    candidateStatus,
    decision: 'not_stale',
    reasonCode: input.reasonCode || 'email_job_processing_not_stale',
  };
}

export function validateEmailJobStaleProcessingPolicy(
  policy: unknown,
): EmailJobStatusPolicyValidationResult {
  const record = asRecord(policy);
  if (!record || record.type !== 'email_job_stale_processing_policy') {
    return buildInvalidValidation(
      'invalid_stale_processing_policy',
      'invalid_email_job_stale_processing_policy',
    );
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_stale_processing_reason');
  }

  if (!isValidPositiveNumber(record.thresholdMinutes)) {
    return buildInvalidValidation('invalid_stale_threshold', 'invalid_email_job_stale_threshold');
  }

  if (!isValidNonNegativeNumber(record.processingAgeMinutes)) {
    return buildInvalidValidation('invalid_processing_age', 'invalid_email_job_processing_age');
  }

  if (!isEmailJobStatusValue(record.candidateStatus)) {
    return buildInvalidValidation(
      'invalid_stale_processing_policy',
      'invalid_email_job_stale_processing_status',
    );
  }

  if (
    record.decision === 'recovery_candidate'
    && record.candidateStatus === 'processing'
    && record.processingAgeMinutes > record.thresholdMinutes
  ) {
    return { valid: true, reasonCode: record.reasonCode };
  }

  if (record.decision === 'not_stale') {
    return { valid: true, reasonCode: record.reasonCode };
  }

  if (record.decision === 'blocked' && hasText(record.errorCode)) {
    return { valid: true, reasonCode: record.reasonCode };
  }

  return buildInvalidValidation(
    'invalid_stale_processing_policy',
    'invalid_email_job_stale_processing_policy',
  );
}

export function buildReadyEmailJobStatusPolicyResult(
  policy: EmailJobStatusPolicy,
): EmailJobStatusPolicyResult {
  const validation = validateEmailJobStatusPolicy(policy);
  if (!validation.valid) {
    return buildBlockedEmailJobStatusPolicyResult(validation.reasonCode, validation.errorCode);
  }

  return {
    status: 'ready',
    reasonCode: validation.reasonCode,
    policy,
  };
}

export function buildSkippedEmailJobStatusPolicyResult(
  reasonCode = DEFAULT_SKIPPED_REASON,
): SkippedEmailJobStatusPolicyResult {
  return {
    status: 'skipped',
    reasonCode: reasonCode || DEFAULT_SKIPPED_REASON,
  };
}

export function buildBlockedEmailJobStatusPolicyResult(
  reasonCode: string,
  errorCode: EmailJobStatusPolicyErrorCode,
): BlockedEmailJobStatusPolicyResult {
  return {
    status: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobStatusPolicyResult(
  reasonCode: string,
  errorCode: EmailJobStatusPolicyErrorCode,
  retryable = false,
): FailedEmailJobStatusPolicyResult {
  return {
    status: 'failed',
    reasonCode: reasonCode || DEFAULT_FAILED_REASON,
    errorCode,
    retryable,
  };
}

export function isReadyEmailJobStatusPolicyResult(
  result: unknown,
): result is ReadyEmailJobStatusPolicyResult {
  return readStatus(result) === 'ready';
}

export function isSkippedEmailJobStatusPolicyResult(
  result: unknown,
): result is SkippedEmailJobStatusPolicyResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobStatusPolicyResult(
  result: unknown,
): result is BlockedEmailJobStatusPolicyResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobStatusPolicyResult(
  result: unknown,
): result is FailedEmailJobStatusPolicyResult {
  return readStatus(result) === 'failed';
}

export function buildSafeEmailJobStatusPolicyForLog(policy: EmailJobStatusPolicy): Record<string, unknown> {
  return buildSafeProjection(policy, 'log');
}

export function buildSafeEmailJobStatusPolicyResultForLog(
  result: EmailJobStatusPolicyResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'log');
}

export function buildSafeEmailJobStatusPolicyResultForAudit(
  result: EmailJobStatusPolicyResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'audit');
}

export function validateEmailJobStatusPolicy(policy: unknown): EmailJobStatusPolicyValidationResult {
  const record = asRecord(policy);
  if (!record) {
    return buildInvalidValidation('missing_policy', 'missing_email_job_status_policy');
  }

  if (record.type === 'email_job_status_transition_policy') {
    return validateEmailJobStatusTransitionPolicy(record);
  }

  if (record.type === 'email_job_retry_policy') {
    return validateEmailJobRetryPolicy(record);
  }

  if (record.type === 'email_job_locking_policy') {
    return validateEmailJobLockingPolicy(record);
  }

  if (record.type === 'email_job_stale_processing_policy') {
    return validateEmailJobStaleProcessingPolicy(record);
  }

  return buildInvalidValidation('missing_policy', 'missing_email_job_status_policy');
}

function buildTransitionPolicy(
  transition: EmailJobStatusTransitionName,
  from: EmailJobStatusValue,
  to: EmailJobStatusValue,
  reasonCode: string,
): EmailJobStatusTransitionPolicy {
  return {
    type: 'email_job_status_transition_policy',
    transition,
    from,
    to,
    reasonCode: reasonCode || 'email_job_status_transition_policy_ready',
  };
}

function buildBlockedEmailJobRetryPolicy(
  retryCount: number,
  maxAttempts: number,
  reasonCode: string,
  errorCode: EmailJobStatusPolicyErrorCode,
): EmailJobRetryPolicy {
  return {
    type: 'email_job_retry_policy',
    retryCount,
    maxAttempts,
    decision: 'blocked',
    reasonCode,
    errorCode,
  };
}

function buildBlockedEmailJobStaleProcessingPolicy(
  thresholdMinutes: number,
  processingAgeMinutes: number,
  candidateStatus: EmailJobStatusValue,
  reasonCode: string,
  errorCode: EmailJobStatusPolicyErrorCode,
): EmailJobStaleProcessingPolicy {
  return {
    type: 'email_job_stale_processing_policy',
    thresholdMinutes,
    processingAgeMinutes,
    candidateStatus,
    decision: 'blocked',
    reasonCode,
    errorCode,
  };
}

function buildInvalidValidation(
  errorCode: EmailJobStatusPolicyErrorCode,
  reasonCode: string,
): EmailJobStatusPolicyValidationResult {
  return { valid: false, reasonCode, errorCode };
}

function matchesNamedTransition(
  transition: EmailJobStatusTransitionName,
  from: EmailJobStatusValue,
  to: EmailJobStatusValue,
): boolean {
  if (transition === 'queued_to_processing') {
    return from === 'queued' && to === 'processing';
  }

  if (transition === 'processing_to_sent') {
    return from === 'processing' && to === 'sent';
  }

  if (transition === 'processing_to_retry_queued') {
    return from === 'processing' && to === 'queued';
  }

  return from === 'processing' && to === 'failed';
}

function isAllowedTransitionName(value: unknown): value is EmailJobStatusTransitionName {
  return value === 'queued_to_processing'
    || value === 'processing_to_sent'
    || value === 'processing_to_retry_queued'
    || value === 'processing_to_failed';
}

function isEmailJobStatusValue(value: unknown): value is EmailJobStatusValue {
  return value === 'queued' || value === 'processing' || value === 'sent' || value === 'failed';
}

function isValidNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isFinite(value) && Number(value) >= 0;
}

function isValidPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isFinite(value) && Number(value) > 0;
}

function isValidPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidRetryDelay(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_RETRY_DELAY_MINUTES;
}

function isExpectedOrderBy(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === 2
    && value[0] === 'available_at'
    && value[1] === 'created_at';
}

function buildSafeProjection(value: unknown, mode: 'log' | 'audit'): Record<string, unknown> {
  const sanitized = mode === 'audit' ? sanitizeNotificationPayloadForAudit(value) : value;
  return redactScalarContactValues(redactLongMessageFields(redactBodyFields(omitSecretKeys(sanitized)))) as Record<string, unknown>;
}

function readStatus(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.status === 'string' ? record.status : null;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function omitSecretKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => omitSecretKeys(item));
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !SECRET_KEYS.has(normalizeKey(key)))
      .map(([key, child]) => [key, omitSecretKeys(child)]),
  );
}

function redactBodyFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactBodyFields(item));
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      BODY_KEYS.has(normalizeKey(key)) && hasText(child) ? '[redacted-body]' : redactBodyFields(child),
    ]),
  );
}

function redactLongMessageFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactLongMessageFields(item));
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      MESSAGE_KEYS.has(normalizeKey(key)) && hasText(child) ? '[redacted-message]' : redactLongMessageFields(child),
    ]),
  );
}

function redactScalarContactValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactScalarContactValues(item));
  }

  const record = asRecord(value);
  if (record) {
    return Object.fromEntries(
      Object.entries(record).map(([key, child]) => [key, redactScalarContactValues(child)]),
    );
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\+?\d[\d\s()./-]{6,}\d/g, '[redacted-phone]');
}
