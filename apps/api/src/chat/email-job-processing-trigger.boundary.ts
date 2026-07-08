import type {
  EmailJobPersistenceCorrelation,
  EmailJobPersistenceErrorCode,
  EmailJobPersistenceResult,
  ReadyEmailJobPersistenceResult,
} from './email-job-persistence.boundary';
import {
  isBlockedEmailJobPersistenceResult,
  isFailedEmailJobPersistenceResult,
  isReadyEmailJobPersistenceResult,
  isSkippedEmailJobPersistenceResult,
} from './email-job-persistence.boundary';
import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailJobProcessingTriggerStatus =
  | 'ready_to_trigger'
  | 'skipped'
  | 'blocked'
  | 'failed';

export type EmailJobProcessingTriggerErrorCode =
  | EmailJobPersistenceErrorCode
  | 'missing_source_result'
  | 'unsupported_source_status'
  | 'missing_request'
  | 'invalid_request'
  | 'missing_reason_code'
  | 'invalid_source'
  | 'invalid_correlation'
  | 'unknown_email_job_processing_trigger_error';

export type EmailJobProcessingTriggerRequest = {
  type: 'email_job_processing_trigger_request';
  reasonCode: string;
  source?: {
    persistenceStatus?: string;
  };
  correlation?: EmailJobPersistenceCorrelation;
};

export type ReadyEmailJobProcessingTriggerResult = {
  status: 'ready_to_trigger';
  reasonCode: string;
  request: EmailJobProcessingTriggerRequest;
};

export type SkippedEmailJobProcessingTriggerResult = {
  status: 'skipped';
  reasonCode: string;
  channel?: 'email';
};

export type BlockedEmailJobProcessingTriggerResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailJobProcessingTriggerErrorCode;
};

export type FailedEmailJobProcessingTriggerResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailJobProcessingTriggerErrorCode;
  retryable: boolean;
};

export type EmailJobProcessingTriggerResult =
  | ReadyEmailJobProcessingTriggerResult
  | SkippedEmailJobProcessingTriggerResult
  | BlockedEmailJobProcessingTriggerResult
  | FailedEmailJobProcessingTriggerResult;

export type EmailJobProcessingTriggerValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailJobProcessingTriggerErrorCode };

type JsonRecord = Record<string, unknown>;

const DEFAULT_BLOCKED_REASON = 'email_job_processing_trigger_blocked';
const DEFAULT_FAILED_REASON = 'email_job_processing_trigger_failed';
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
const MESSAGE_KEYS = new Set(['message', 'usermessage', 'user_message', 'providererror', 'provider_error', 'lasterror', 'last_error', 'errormessage', 'error_message']);

export function isReadyEmailJobProcessingTriggerResult(
  result: unknown,
): result is ReadyEmailJobProcessingTriggerResult {
  return readStatus(result) === 'ready_to_trigger';
}

export function isSkippedEmailJobProcessingTriggerResult(
  result: unknown,
): result is SkippedEmailJobProcessingTriggerResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailJobProcessingTriggerResult(
  result: unknown,
): result is BlockedEmailJobProcessingTriggerResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailJobProcessingTriggerResult(
  result: unknown,
): result is FailedEmailJobProcessingTriggerResult {
  return readStatus(result) === 'failed';
}

export function validateEmailJobProcessingTriggerInput(
  source: unknown,
): EmailJobProcessingTriggerValidationResult {
  if (!source) {
    return buildInvalidValidation('missing_source_result', DEFAULT_BLOCKED_REASON);
  }

  if (!isReadyEmailJobPersistenceResult(source)) {
    if (
      isSkippedEmailJobPersistenceResult(source)
      || isBlockedEmailJobPersistenceResult(source)
      || isFailedEmailJobPersistenceResult(source)
    ) {
      return buildInvalidValidation('unsupported_source_status', readReasonCode(source) || DEFAULT_BLOCKED_REASON);
    }
    return buildInvalidValidation('unsupported_source_status', DEFAULT_BLOCKED_REASON);
  }

  const request = buildEmailJobProcessingTriggerRequest(source);
  if (!request) {
    return buildInvalidValidation('missing_request', 'missing_email_job_processing_trigger_request');
  }

  return validateReadyEmailJobProcessingTriggerRequest(request);
}

export function validateReadyEmailJobProcessingTriggerRequest(
  request: unknown,
): EmailJobProcessingTriggerValidationResult {
  const record = asRecord(request);
  if (!record || record.type !== 'email_job_processing_trigger_request') {
    return buildInvalidValidation('missing_request', 'missing_email_job_processing_trigger_request');
  }

  if (!hasText(record.reasonCode)) {
    return buildInvalidValidation('missing_reason_code', 'missing_email_job_processing_trigger_reason');
  }

  const source = asRecord(record.source);
  if (source && source.persistenceStatus !== undefined && typeof source.persistenceStatus !== 'string') {
    return buildInvalidValidation('invalid_source', 'invalid_email_job_processing_trigger_source');
  }

  const correlation = asRecord(record.correlation);
  if (correlation && !hasOnlyStringCorrelationValues(correlation)) {
    return buildInvalidValidation('invalid_correlation', 'invalid_email_job_processing_trigger_correlation');
  }

  return {
    valid: true,
    reasonCode: record.reasonCode,
  };
}

export function buildEmailJobProcessingTriggerRequest(
  source: ReadyEmailJobPersistenceResult,
): EmailJobProcessingTriggerRequest | null {
  if (!isReadyEmailJobPersistenceResult(source) || !hasText(source.reasonCode)) {
    return null;
  }

  return {
    type: 'email_job_processing_trigger_request',
    reasonCode: source.reasonCode,
    source: {
      persistenceStatus: source.status,
    },
    ...(source.request?.correlation ? { correlation: { ...source.request.correlation } } : {}),
  };
}

export function buildReadyEmailJobProcessingTriggerResult(source: unknown): EmailJobProcessingTriggerResult {
  if (!isReadyEmailJobPersistenceResult(source)) {
    return buildBlockedEmailJobProcessingTriggerResult(DEFAULT_BLOCKED_REASON, 'unsupported_source_status');
  }

  const request = buildEmailJobProcessingTriggerRequest(source);
  if (!request) {
    return buildBlockedEmailJobProcessingTriggerResult(
      'missing_email_job_processing_trigger_request',
      'missing_request',
    );
  }

  const validation = validateReadyEmailJobProcessingTriggerRequest(request);
  if (!validation.valid) {
    return buildBlockedEmailJobProcessingTriggerResult(validation.reasonCode, validation.errorCode);
  }

  return {
    status: 'ready_to_trigger',
    reasonCode: validation.reasonCode,
    request,
  };
}

export function buildEmailJobProcessingTriggerResultFromPersistenceResult(
  source: EmailJobPersistenceResult | unknown,
): EmailJobProcessingTriggerResult {
  if (isSkippedEmailJobPersistenceResult(source)) {
    return buildSkippedEmailJobProcessingTriggerResult(source.reasonCode, {
      channel: source.channel === 'email' ? 'email' : undefined,
    });
  }

  if (isBlockedEmailJobPersistenceResult(source)) {
    return buildBlockedEmailJobProcessingTriggerResult(source.reasonCode, source.errorCode);
  }

  if (isFailedEmailJobPersistenceResult(source)) {
    return buildFailedEmailJobProcessingTriggerResult({
      reasonCode: source.reasonCode,
      errorCode: source.errorCode,
      retryable: source.retryable,
    });
  }

  return buildReadyEmailJobProcessingTriggerResult(source);
}

export function buildSkippedEmailJobProcessingTriggerResult(
  reasonCode: string,
  context?: { channel?: 'email' },
): SkippedEmailJobProcessingTriggerResult {
  return {
    status: 'skipped',
    reasonCode: reasonCode || 'noop',
    ...(context?.channel ? { channel: context.channel } : {}),
  };
}

export function buildBlockedEmailJobProcessingTriggerResult(
  reasonCode: string,
  errorCode: EmailJobProcessingTriggerErrorCode,
): BlockedEmailJobProcessingTriggerResult {
  return {
    status: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailJobProcessingTriggerResult(params: {
  reasonCode?: string;
  errorCode?: EmailJobProcessingTriggerErrorCode;
  retryable?: boolean;
}): FailedEmailJobProcessingTriggerResult {
  return {
    status: 'failed',
    reasonCode: params.reasonCode || DEFAULT_FAILED_REASON,
    errorCode: params.errorCode || 'unknown_email_job_processing_trigger_error',
    retryable: Boolean(params.retryable),
  };
}

export function buildSafeEmailJobProcessingTriggerRequestForLog(
  request: EmailJobProcessingTriggerRequest,
): Record<string, unknown> {
  return buildSafeProjection(request, 'log');
}

export function buildSafeEmailJobProcessingTriggerResultForLog(
  result: EmailJobProcessingTriggerResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'log');
}

export function buildSafeEmailJobProcessingTriggerResultForAudit(
  result: EmailJobProcessingTriggerResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'audit');
}

function buildInvalidValidation(
  errorCode: EmailJobProcessingTriggerErrorCode,
  reasonCode: string,
): EmailJobProcessingTriggerValidationResult {
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

function hasOnlyStringCorrelationValues(correlation: JsonRecord): boolean {
  return Object.values(correlation).every((value) => typeof value === 'string');
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
