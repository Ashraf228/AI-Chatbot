import type {
  EmailJobProcessingTriggerErrorCode,
  EmailJobProcessingTriggerResult,
  ReadyEmailJobProcessingTriggerResult,
} from './email-job-processing-trigger.boundary';
import {
  isBlockedEmailJobProcessingTriggerResult,
  isFailedEmailJobProcessingTriggerResult,
  isReadyEmailJobProcessingTriggerResult,
  isSkippedEmailJobProcessingTriggerResult,
  validateReadyEmailJobProcessingTriggerRequest,
} from './email-job-processing-trigger.boundary';
import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobWorkerStatus = 'ready_to_select' | 'skipped' | 'blocked' | 'failed';

export type EmailJobWorkerErrorCode =
  | EmailJobProcessingTriggerErrorCode
  | 'missing_source_result'
  | 'unsupported_source_status'
  | 'missing_reason_code'
  | 'missing_selection_plan'
  | 'invalid_selection_plan'
  | 'invalid_status_transition'
  | 'invalid_retry_decision'
  | 'invalid_attempts'
  | 'invalid_max_attempts'
  | 'unknown_email_job_worker_error';

export type EmailJobWorkerSelectionPlan = {
  type: 'email_job_worker_selection_plan';
  reasonCode: string;
  criteria: {
    status: 'queued';
    availableNow: boolean;
    orderBy: readonly ['available_at', 'created_at'];
    limit: 1;
    lockMode: 'for_update_skip_locked';
  };
};

export type EmailJobStatusTransitionPlan =
  | {
      type: 'email_job_status_transition_plan';
      transition: 'queued_to_processing';
      reasonCode: string;
    }
  | {
      type: 'email_job_status_transition_plan';
      transition: 'processing_to_sent';
      reasonCode: string;
    }
  | {
      type: 'email_job_status_transition_plan';
      transition: 'processing_to_retry_queued';
      reasonCode: string;
      retryDelayMinutes: number;
    }
  | {
      type: 'email_job_status_transition_plan';
      transition: 'processing_to_failed';
      reasonCode: string;
      retryable: false;
    };

export type EmailJobRetryDecision =
  | {
      decision: 'retry';
      reasonCode: string;
      nextRetryDelayMinutes: number;
    }
  | {
      decision: 'final_failed';
      reasonCode: string;
    }
  | {
      decision: 'blocked';
      reasonCode: string;
      errorCode: EmailJobWorkerErrorCode;
    };

export type ReadyEmailJobWorkerResult = {
  status: 'ready_to_select';
  reasonCode: string;
  selectionPlan: EmailJobWorkerSelectionPlan;
};

export type SkippedEmailJobWorkerResult = {
  status: 'skipped';
  reasonCode: string;
  channel?: 'email';
};

export type BlockedEmailJobWorkerResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobWorkerErrorCode;
};

export type FailedEmailJobWorkerResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobWorkerErrorCode;
  retryable: boolean;
};

export type EmailJobWorkerResult =
  | ReadyEmailJobWorkerResult
  | SkippedEmailJobWorkerResult
  | BlockedEmailJobWorkerResult
  | FailedEmailJobWorkerResult;

export type EmailJobWorkerValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobWorkerErrorCode };

type JsonRecord = Record<string, unknown>;

const DEFAULT_BLOCKED_REASON = 'email_job_worker_blocked';
const DEFAULT_FAILED_REASON = 'email_job_worker_failed';
const DEFAULT_READY_REASON = 'email_job_worker_ready_to_select';
const MAX_RETRY_DELAY_MINUTES = 30;
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

export function isReadyEmailJobWorkerResult(result: unknown): result is ReadyEmailJobWorkerResult {
  return readStatus(result) === 'ready_to_select';
}

export function isSkippedEmailJobWorkerResult(result: unknown): result is SkippedEmailJobWorkerResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobWorkerResult(result: unknown): result is BlockedEmailJobWorkerResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobWorkerResult(result: unknown): result is FailedEmailJobWorkerResult {
  return readStatus(result) === 'failed';
}

export function validateEmailJobWorkerInput(source: unknown): EmailJobWorkerValidationResult {
  if (!source) {
    return buildInvalidValidation('missing_source_result', DEFAULT_BLOCKED_REASON);
  }

  if (!isReadyEmailJobProcessingTriggerResult(source)) {
    if (
      isSkippedEmailJobProcessingTriggerResult(source)
      || isBlockedEmailJobProcessingTriggerResult(source)
      || isFailedEmailJobProcessingTriggerResult(source)
    ) {
      return buildInvalidValidation('unsupported_source_status', readReasonCode(source) || DEFAULT_BLOCKED_REASON);
    }
    return buildInvalidValidation('unsupported_source_status', DEFAULT_BLOCKED_REASON);
  }

  if (!hasText(source.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_worker_reason');
  }

  const requestValidation = validateReadyEmailJobProcessingTriggerRequest(source.request);
  if (!requestValidation.valid) {
    return buildInvalidValidation(requestValidation.errorCode, requestValidation.reasonCode);
  }

  return {
    valid: true,
    reasonCode: source.reasonCode,
  };
}

export function validateEmailJobWorkerSelectionPlan(plan: unknown): EmailJobWorkerValidationResult {
  const record = asRecord(plan);
  const criteria = asRecord(record?.criteria);
  if (!record || record.type !== 'email_job_worker_selection_plan' || !criteria) {
    return buildInvalidValidation('missing_selection_plan', 'missing_email_job_worker_selection_plan');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_worker_reason');
  }

  if (
    criteria.status !== 'queued'
    || criteria.availableNow !== true
    || !isExpectedOrderBy(criteria.orderBy)
    || criteria.limit !== 1
    || criteria.lockMode !== 'for_update_skip_locked'
  ) {
    return buildInvalidValidation('invalid_selection_plan', 'invalid_email_job_worker_selection_plan');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function validateEmailJobStatusTransitionPlan(plan: unknown): EmailJobWorkerValidationResult {
  const record = asRecord(plan);
  if (!record || record.type !== 'email_job_status_transition_plan') {
    return buildInvalidValidation('invalid_status_transition', 'invalid_email_job_status_transition_plan');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_status_transition_reason');
  }

  if (
    record.transition === 'queued_to_processing'
    || record.transition === 'processing_to_sent'
    || (record.transition === 'processing_to_failed' && record.retryable === false)
  ) {
    return { valid: true, reasonCode: record.reasonCode };
  }

  if (
    record.transition === 'processing_to_retry_queued'
    && isValidRetryDelay(record.retryDelayMinutes)
  ) {
    return { valid: true, reasonCode: record.reasonCode };
  }

  return buildInvalidValidation('invalid_status_transition', 'invalid_email_job_status_transition_plan');
}

export function validateEmailJobRetryDecision(decision: unknown): EmailJobWorkerValidationResult {
  const record = asRecord(decision);
  if (!record) {
    return buildInvalidValidation('invalid_retry_decision', 'invalid_email_job_retry_decision');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_retry_reason');
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

  return buildInvalidValidation('invalid_retry_decision', 'invalid_email_job_retry_decision');
}

export function buildEmailJobWorkerSelectionPlan(
  source: ReadyEmailJobProcessingTriggerResult,
): EmailJobWorkerSelectionPlan | null {
  const validation = validateEmailJobWorkerInput(source);
  if (!validation.valid) {
    return null;
  }

  return {
    type: 'email_job_worker_selection_plan',
    reasonCode: validation.reasonCode,
    criteria: {
      status: 'queued',
      availableNow: true,
      orderBy: ['available_at', 'created_at'] as const,
      limit: 1,
      lockMode: 'for_update_skip_locked',
    },
  };
}

export function buildQueuedToProcessingTransitionPlan(reasonCode: string): EmailJobStatusTransitionPlan {
  return {
    type: 'email_job_status_transition_plan',
    transition: 'queued_to_processing',
    reasonCode: reasonCode || 'email_job_worker_pick_ready',
  };
}

export function buildProcessingToSentTransitionPlan(reasonCode: string): EmailJobStatusTransitionPlan {
  return {
    type: 'email_job_status_transition_plan',
    transition: 'processing_to_sent',
    reasonCode: reasonCode || 'email_job_worker_send_succeeded',
  };
}

export function buildProcessingToRetryQueuedTransitionPlan(
  reasonCode: string,
  retryDelayMinutes: number,
): EmailJobStatusTransitionPlan {
  return {
    type: 'email_job_status_transition_plan',
    transition: 'processing_to_retry_queued',
    reasonCode: reasonCode || 'email_job_worker_retry_scheduled',
    retryDelayMinutes: normalizeRetryDelay(retryDelayMinutes),
  };
}

export function buildProcessingToFailedTransitionPlan(reasonCode: string): EmailJobStatusTransitionPlan {
  return {
    type: 'email_job_status_transition_plan',
    transition: 'processing_to_failed',
    reasonCode: reasonCode || 'email_job_worker_final_failed',
    retryable: false,
  };
}

export function buildEmailJobRetryDecision(
  attempts: number,
  maxAttempts: number,
): EmailJobRetryDecision {
  if (!isValidNonNegativeInteger(attempts)) {
    return buildBlockedEmailJobRetryDecision('invalid_email_job_retry_attempts', 'invalid_attempts');
  }

  if (!isValidPositiveInteger(maxAttempts)) {
    return buildBlockedEmailJobRetryDecision('invalid_email_job_retry_max_attempts', 'invalid_max_attempts');
  }

  if (attempts < maxAttempts) {
    return {
      decision: 'retry',
      reasonCode: 'email_job_worker_retry_available',
      nextRetryDelayMinutes: normalizeRetryDelay(attempts * 2),
    };
  }

  return {
    decision: 'final_failed',
    reasonCode: 'email_job_worker_retry_exhausted',
  };
}

export function buildBlockedEmailJobRetryDecision(
  reasonCode: string,
  errorCode: EmailJobWorkerErrorCode,
): EmailJobRetryDecision {
  return {
    decision: 'blocked',
    reasonCode: reasonCode || 'email_job_worker_retry_blocked',
    errorCode,
  };
}

export function buildReadyEmailJobWorkerResult(source: unknown): EmailJobWorkerResult {
  if (!isReadyEmailJobProcessingTriggerResult(source)) {
    return buildBlockedEmailJobWorkerResult(DEFAULT_BLOCKED_REASON, 'unsupported_source_status');
  }

  const selectionPlan = buildEmailJobWorkerSelectionPlan(source);
  if (!selectionPlan) {
    const validation = validateEmailJobWorkerInput(source);
    return buildBlockedEmailJobWorkerResult(
      validation.reasonCode,
      validation.valid ? 'missing_selection_plan' : validation.errorCode,
    );
  }

  const planValidation = validateEmailJobWorkerSelectionPlan(selectionPlan);
  if (!planValidation.valid) {
    return buildBlockedEmailJobWorkerResult(planValidation.reasonCode, planValidation.errorCode);
  }

  return {
    status: 'ready_to_select',
    reasonCode: planValidation.reasonCode,
    selectionPlan,
  };
}

export function buildSkippedEmailJobWorkerResult(
  reasonCode: string,
  context?: { channel?: 'email' },
): SkippedEmailJobWorkerResult {
  return {
    status: 'skipped',
    reasonCode: reasonCode || 'noop',
    ...(context?.channel ? { channel: context.channel } : {}),
  };
}

export function buildBlockedEmailJobWorkerResult(
  reasonCode: string,
  errorCode: EmailJobWorkerErrorCode,
): BlockedEmailJobWorkerResult {
  return {
    status: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobWorkerResult(params: {
  reasonCode?: string;
  errorCode?: EmailJobWorkerErrorCode;
  retryable?: boolean;
}): FailedEmailJobWorkerResult {
  return {
    status: 'failed',
    reasonCode: params.reasonCode || DEFAULT_FAILED_REASON,
    errorCode: params.errorCode || 'unknown_email_job_worker_error',
    retryable: Boolean(params.retryable),
  };
}

export function buildEmailJobWorkerResultFromTriggerResult(
  source: EmailJobProcessingTriggerResult | unknown,
): EmailJobWorkerResult {
  if (isSkippedEmailJobProcessingTriggerResult(source)) {
    return buildSkippedEmailJobWorkerResult(source.reasonCode, {
      channel: source.channel === 'email' ? 'email' : undefined,
    });
  }

  if (isBlockedEmailJobProcessingTriggerResult(source)) {
    return buildBlockedEmailJobWorkerResult(source.reasonCode, source.errorCode);
  }

  if (isFailedEmailJobProcessingTriggerResult(source)) {
    return buildFailedEmailJobWorkerResult({
      reasonCode: source.reasonCode,
      errorCode: source.errorCode,
      retryable: source.retryable,
    });
  }

  return buildReadyEmailJobWorkerResult(source);
}

export function buildSafeEmailJobWorkerSelectionPlanForLog(
  plan: EmailJobWorkerSelectionPlan,
): Record<string, unknown> {
  return buildSafeProjection(plan, 'log');
}

export function buildSafeEmailJobWorkerResultForLog(
  result: EmailJobWorkerResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'log');
}

export function buildSafeEmailJobWorkerResultForAudit(
  result: EmailJobWorkerResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'audit');
}

export function buildSafeEmailJobStatusTransitionPlanForLog(
  plan: EmailJobStatusTransitionPlan,
): Record<string, unknown> {
  return buildSafeProjection(plan, 'log');
}

export function buildSafeEmailJobRetryDecisionForLog(
  decision: EmailJobRetryDecision,
): Record<string, unknown> {
  return buildSafeProjection(decision, 'log');
}

function buildInvalidValidation(
  errorCode: EmailJobWorkerErrorCode,
  reasonCode: string,
): EmailJobWorkerValidationResult {
  return { valid: false, reasonCode, errorCode };
}

function buildSafeProjection(value: unknown, mode: 'log' | 'audit'): Record<string, unknown> {
  const sanitized = mode === 'audit' ? sanitizeNotificationPayloadForAudit(value) : value;
  return redactScalarContactValues(redactLongMessageFields(redactBodyFields(omitSecretKeys(sanitized)))) as Record<string, unknown>;
}

function readStatus(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.status === 'string' ? record.status : null;
}

function readReasonCode(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.reasonCode === 'string' ? record.reasonCode : null;
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

function isExpectedOrderBy(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === 2
    && value[0] === 'available_at'
    && value[1] === 'created_at';
}

function isValidNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isFinite(value) && Number(value) >= 0;
}

function isValidPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isFinite(value) && Number(value) > 0;
}

function isValidRetryDelay(value: unknown): value is number {
  return Number.isFinite(value)
    && typeof value === 'number'
    && value > 0
    && value <= MAX_RETRY_DELAY_MINUTES;
}

function normalizeRetryDelay(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.min(Math.ceil(value), MAX_RETRY_DELAY_MINUTES);
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
