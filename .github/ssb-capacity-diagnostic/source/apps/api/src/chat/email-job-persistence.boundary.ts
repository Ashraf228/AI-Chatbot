import type {
  EmailQueueWriteErrorCode,
  EmailQueueWriteRequest,
  EmailQueueWriteResult,
  ReadyEmailQueueWriteResult,
} from './email-queue-write.boundary';
import {
  isBlockedEmailQueueWriteResult,
  isFailedEmailQueueWriteResult,
  isReadyEmailQueueWriteResult,
  isSkippedEmailQueueWriteResult,
  validateReadyEmailQueueWriteRequest,
} from './email-queue-write.boundary';
import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobPersistenceStatus = 'ready_to_persist' | 'skipped' | 'blocked' | 'failed';

export type EmailJobPersistenceErrorCode =
  | EmailQueueWriteErrorCode
  | 'missing_source_result'
  | 'unsupported_source_status'
  | 'missing_request'
  | 'invalid_request'
  | 'missing_payload'
  | 'missing_recipient'
  | 'invalid_payload'
  | 'invalid_correlation'
  | 'unknown_email_job_persistence_error';

export type EmailJobPersistenceCorrelation = {
  siteId?: string;
  sessionId?: string;
  conversationId?: string;
  leadId?: string;
  contactRequestId?: string;
};

export type EmailJobPersistenceRequest = {
  type: 'email_job_persistence_request';
  reasonCode: string;
  payload: EmailQueueWriteRequest['payload'];
  correlation?: EmailJobPersistenceCorrelation;
};

export type ReadyEmailJobPersistenceResult = {
  status: 'ready_to_persist';
  reasonCode: string;
  request: EmailJobPersistenceRequest;
};

export type SkippedEmailJobPersistenceResult = {
  status: 'skipped';
  reasonCode: string;
  channel?: 'email';
};

export type BlockedEmailJobPersistenceResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobPersistenceErrorCode;
};

export type FailedEmailJobPersistenceResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobPersistenceErrorCode;
  retryable: boolean;
};

export type EmailJobPersistenceResult =
  | ReadyEmailJobPersistenceResult
  | SkippedEmailJobPersistenceResult
  | BlockedEmailJobPersistenceResult
  | FailedEmailJobPersistenceResult;

export type EmailJobPersistenceValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobPersistenceErrorCode };

type JsonRecord = Record<string, unknown>;

const DEFAULT_BLOCKED_REASON = 'email_job_persistence_blocked';
const DEFAULT_FAILED_REASON = 'email_job_persistence_failed';
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

export function isReadyEmailJobPersistenceResult(
  result: unknown,
): result is ReadyEmailJobPersistenceResult {
  return readStatus(result) === 'ready_to_persist';
}

export function isSkippedEmailJobPersistenceResult(
  result: unknown,
): result is SkippedEmailJobPersistenceResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobPersistenceResult(
  result: unknown,
): result is BlockedEmailJobPersistenceResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobPersistenceResult(
  result: unknown,
): result is FailedEmailJobPersistenceResult {
  return readStatus(result) === 'failed';
}

export function validateEmailJobPersistenceInput(source: unknown): EmailJobPersistenceValidationResult {
  if (!source) {
    return buildInvalidValidation('missing_source_result', DEFAULT_BLOCKED_REASON);
  }

  if (!isReadyEmailQueueWriteResult(source)) {
    if (
      isSkippedEmailQueueWriteResult(source)
      || isBlockedEmailQueueWriteResult(source)
      || isFailedEmailQueueWriteResult(source)
    ) {
      return buildInvalidValidation('unsupported_source_status', readReasonCode(source) || DEFAULT_BLOCKED_REASON);
    }
    return buildInvalidValidation('unsupported_source_status', DEFAULT_BLOCKED_REASON);
  }

  const request = buildEmailJobPersistenceRequest(source);
  if (!request) {
    return buildInvalidValidation('missing_request', 'missing_email_job_persistence_request');
  }

  return validateReadyEmailJobPersistenceRequest(request);
}

export function validateReadyEmailJobPersistenceRequest(
  request: unknown,
): EmailJobPersistenceValidationResult {
  const record = asRecord(request);
  if (!record || record.type !== 'email_job_persistence_request') {
    return buildInvalidValidation('missing_request', 'missing_email_job_persistence_request');
  }

  const queueRequest = toEmailQueueWriteRequest(record);
  if (!queueRequest) {
    return buildInvalidValidation('missing_request', 'missing_email_job_persistence_request');
  }

  const validation = validateReadyEmailQueueWriteRequest(queueRequest);
  if (!validation.valid) {
    return buildInvalidValidation(validation.errorCode, validation.reasonCode);
  }

  return {
    valid: true,
    reasonCode: validation.reasonCode,
  };
}

export function buildEmailJobPersistenceRequest(
  source: ReadyEmailQueueWriteResult,
): EmailJobPersistenceRequest | null {
  const request = asRecord(source?.request);
  if (!request) {
    return null;
  }

  return {
    type: 'email_job_persistence_request',
    reasonCode: readReasonCode(source) || readReasonCode(request) || 'lead_email_ready',
    payload: source.request.payload,
    ...(source.request.correlation ? { correlation: { ...source.request.correlation } } : {}),
  };
}

export function buildReadyEmailJobPersistenceResult(source: unknown): EmailJobPersistenceResult {
  if (!isReadyEmailQueueWriteResult(source)) {
    return buildBlockedEmailJobPersistenceResult(DEFAULT_BLOCKED_REASON, 'unsupported_source_status');
  }

  const request = buildEmailJobPersistenceRequest(source);
  if (!request) {
    return buildBlockedEmailJobPersistenceResult('missing_email_job_persistence_request', 'missing_request');
  }

  const validation = validateReadyEmailJobPersistenceRequest(request);
  if (!validation.valid) {
    return buildBlockedEmailJobPersistenceResult(validation.reasonCode, validation.errorCode);
  }

  return {
    status: 'ready_to_persist',
    reasonCode: validation.reasonCode,
    request,
  };
}

export function buildEmailJobPersistenceResultFromQueueWriteResult(
  source: EmailQueueWriteResult | unknown,
): EmailJobPersistenceResult {
  if (isSkippedEmailQueueWriteResult(source)) {
    return buildSkippedEmailJobPersistenceResult(source.reasonCode, {
      channel: source.channel === 'email' ? 'email' : undefined,
    });
  }

  if (isBlockedEmailQueueWriteResult(source)) {
    return buildBlockedEmailJobPersistenceResult(source.reasonCode, source.errorCode);
  }

  if (isFailedEmailQueueWriteResult(source)) {
    return buildFailedEmailJobPersistenceResult({
      reasonCode: source.reasonCode,
      errorCode: source.errorCode,
      retryable: source.retryable,
    });
  }

  return buildReadyEmailJobPersistenceResult(source);
}

export function buildSkippedEmailJobPersistenceResult(
  reasonCode: string,
  context?: { channel?: 'email' },
): SkippedEmailJobPersistenceResult {
  return {
    status: 'skipped',
    reasonCode: reasonCode || 'noop',
    ...(context?.channel ? { channel: context.channel } : {}),
  };
}

export function buildBlockedEmailJobPersistenceResult(
  reasonCode: string,
  errorCode: EmailJobPersistenceErrorCode,
): BlockedEmailJobPersistenceResult {
  return {
    status: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobPersistenceResult(params: {
  reasonCode?: string;
  errorCode?: EmailJobPersistenceErrorCode;
  retryable?: boolean;
}): FailedEmailJobPersistenceResult {
  return {
    status: 'failed',
    reasonCode: params.reasonCode || DEFAULT_FAILED_REASON,
    errorCode: params.errorCode || 'unknown_email_job_persistence_error',
    retryable: Boolean(params.retryable),
  };
}

export function buildSafeEmailJobPersistenceRequestForLog(
  request: EmailJobPersistenceRequest,
): Record<string, unknown> {
  return buildSafeProjection(request, 'log');
}

export function buildSafeEmailJobPersistenceResultForLog(
  result: EmailJobPersistenceResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'log');
}

export function buildSafeEmailJobPersistenceResultForAudit(
  result: EmailJobPersistenceResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'audit');
}

function toEmailQueueWriteRequest(record: JsonRecord): EmailQueueWriteRequest | null {
  const payload = asRecord(record.payload);
  if (!payload) {
    return null;
  }

  const correlation = asRecord(record.correlation);
  return {
    type: 'email_queue_write_request',
    reasonCode: typeof record.reasonCode === 'string' ? record.reasonCode : 'lead_email_ready',
    payload: record.payload as EmailQueueWriteRequest['payload'],
    ...(correlation ? { correlation: { ...correlation } as EmailQueueWriteRequest['correlation'] } : {}),
  };
}

function buildInvalidValidation(
  errorCode: EmailJobPersistenceErrorCode,
  reasonCode: string,
): EmailJobPersistenceValidationResult {
  return { valid: false, reasonCode, errorCode };
}

function buildSafeProjection(value: unknown, mode: 'log' | 'audit'): Record<string, unknown> {
  const sanitized = mode === 'audit' ? sanitizeNotificationPayloadForAudit(value) : value;
  return redactScalarContactValues(redactBodyFields(omitSecretKeys(sanitized))) as Record<string, unknown>;
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

function hasText(value: unknown): boolean {
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
