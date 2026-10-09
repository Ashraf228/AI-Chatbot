import type { EmailJobPayload } from './delivery-payload.builders';
import type {
  BlockedEmailDeliveryExecutionResult,
  EmailDeliveryExecutionResult,
  EmailDeliveryExecutionErrorCode,
  FailedEmailDeliveryExecutionResult,
  ReadyEmailDeliveryExecutionResult,
  SkippedEmailDeliveryExecutionResult,
} from './email-delivery-executor.boundary';
import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailQueueWriteStatus = 'ready_to_enqueue' | 'skipped' | 'blocked' | 'failed';

export type EmailQueueWriteErrorCode =
  | EmailDeliveryExecutionErrorCode
  | 'missing_source_result'
  | 'unsupported_source_status'
  | 'missing_payload'
  | 'missing_recipient'
  | 'invalid_payload'
  | 'invalid_correlation'
  | 'unknown_email_queue_write_error';

export type EmailQueueWriteCorrelation = {
  siteId?: string;
  sessionId?: string;
  conversationId?: string;
  leadId?: string;
  contactRequestId?: string;
};

export type EmailQueueWriteRequest = {
  type: 'email_queue_write_request';
  reasonCode: string;
  payload: EmailJobPayload;
  correlation?: EmailQueueWriteCorrelation;
};

export type ReadyEmailQueueWriteResult = {
  status: 'ready_to_enqueue';
  reasonCode: string;
  request: EmailQueueWriteRequest;
};

export type SkippedEmailQueueWriteResult = {
  status: 'skipped';
  reasonCode: string;
  channel?: 'email';
};

export type BlockedEmailQueueWriteResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailQueueWriteErrorCode;
};

export type FailedEmailQueueWriteResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailQueueWriteErrorCode;
  retryable: boolean;
};

export type EmailQueueWriteResult =
  | ReadyEmailQueueWriteResult
  | SkippedEmailQueueWriteResult
  | BlockedEmailQueueWriteResult
  | FailedEmailQueueWriteResult;

export type EmailQueueWriteValidationResult =
  | { valid: true; reasonCode: string }
  | { valid: false; reasonCode: string; errorCode: EmailQueueWriteErrorCode };

type JsonRecord = Record<string, unknown>;

const DEFAULT_BLOCKED_REASON = 'email_queue_write_blocked';
const DEFAULT_FAILED_REASON = 'email_queue_write_failed';
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
const CORRELATION_KEYS = ['siteId', 'sessionId', 'conversationId', 'leadId', 'contactRequestId'] as const;

export function isReadyEmailDeliveryExecutionResult(
  result: unknown,
): result is ReadyEmailDeliveryExecutionResult {
  return readStatus(result) === 'ready' && readAction(result) === 'queue_email_job';
}

export function isSkippedEmailDeliveryExecutionResult(
  result: unknown,
): result is SkippedEmailDeliveryExecutionResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailDeliveryExecutionResult(
  result: unknown,
): result is BlockedEmailDeliveryExecutionResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailDeliveryExecutionResult(
  result: unknown,
): result is FailedEmailDeliveryExecutionResult {
  return readStatus(result) === 'failed';
}

export function isReadyEmailQueueWriteResult(
  result: unknown,
): result is ReadyEmailQueueWriteResult {
  return readStatus(result) === 'ready_to_enqueue';
}

export function isSkippedEmailQueueWriteResult(
  result: unknown,
): result is SkippedEmailQueueWriteResult {
  return readStatus(result) === 'skipped';
}

export function isBlockedEmailQueueWriteResult(
  result: unknown,
): result is BlockedEmailQueueWriteResult {
  return readStatus(result) === 'blocked';
}

export function isFailedEmailQueueWriteResult(
  result: unknown,
): result is FailedEmailQueueWriteResult {
  return readStatus(result) === 'failed';
}

export function validateEmailQueueWriteInput(source: unknown): EmailQueueWriteValidationResult {
  if (!source) {
    return buildInvalidValidation('missing_source_result', DEFAULT_BLOCKED_REASON);
  }

  if (!isReadyEmailDeliveryExecutionResult(source)) {
    if (
      isSkippedEmailDeliveryExecutionResult(source)
      || isBlockedEmailDeliveryExecutionResult(source)
      || isFailedEmailDeliveryExecutionResult(source)
    ) {
      return buildInvalidValidation('unsupported_source_status', readReasonCode(source) || DEFAULT_BLOCKED_REASON);
    }
    return buildInvalidValidation('unsupported_source_status', DEFAULT_BLOCKED_REASON);
  }

  const request = buildEmailQueueWriteRequest(source);
  if (!request) {
    return buildInvalidValidation('missing_payload', 'missing_email_queue_payload');
  }

  return validateReadyEmailQueueWriteRequest(request);
}

export function validateReadyEmailQueueWriteRequest(
  request: unknown,
): EmailQueueWriteValidationResult {
  const record = asRecord(request);
  if (!record || record.type !== 'email_queue_write_request') {
    return buildInvalidValidation('missing_payload', 'missing_email_queue_payload');
  }

  const payload = asRecord(record.payload);
  if (!payload) {
    return buildInvalidValidation('missing_payload', 'missing_email_queue_payload');
  }

  if (!hasText(payload.recipientEmail)) {
    return buildInvalidValidation('missing_recipient', 'missing_email_recipient');
  }

  if (!hasText(payload.subject) || (!hasText(payload.html) && !hasText(payload.text))) {
    return buildInvalidValidation('invalid_payload', 'invalid_email_queue_payload');
  }

  const metadata = asRecord(payload.metadata);
  if (!metadata || !hasText(metadata.tenantId) || !hasText(metadata.siteId) || !hasText(metadata.sessionId)) {
    return buildInvalidValidation('invalid_payload', 'invalid_email_queue_payload');
  }

  const correlation = asRecord(record.correlation);
  if (correlation && !hasOnlyStringCorrelationValues(correlation)) {
    return buildInvalidValidation('invalid_correlation', 'invalid_email_queue_correlation');
  }

  return {
    valid: true,
    reasonCode: readReasonCode(record) || 'lead_email_ready',
  };
}

export function buildEmailQueueWriteRequest(
  source: ReadyEmailDeliveryExecutionResult,
): EmailQueueWriteRequest | null {
  const payload = source?.payload;
  if (!payload) {
    return null;
  }

  const correlation = buildCorrelationFromPayload(payload);
  return {
    type: 'email_queue_write_request',
    reasonCode: source.reasonCode || 'lead_email_ready',
    payload,
    ...(Object.keys(correlation).length > 0 ? { correlation } : {}),
  };
}

export function buildReadyEmailQueueWriteResult(source: unknown): EmailQueueWriteResult {
  if (!isReadyEmailDeliveryExecutionResult(source)) {
    return buildBlockedEmailQueueWriteResult(DEFAULT_BLOCKED_REASON, 'unsupported_source_status');
  }

  const request = buildEmailQueueWriteRequest(source);
  if (!request) {
    return buildBlockedEmailQueueWriteResult('missing_email_queue_payload', 'missing_payload');
  }

  const validation = validateReadyEmailQueueWriteRequest(request);
  if (!validation.valid) {
    return buildBlockedEmailQueueWriteResult(validation.reasonCode, validation.errorCode);
  }

  return {
    status: 'ready_to_enqueue',
    reasonCode: validation.reasonCode,
    request,
  };
}

export function buildEmailQueueWriteResultFromDeliveryResult(
  source: EmailDeliveryExecutionResult | unknown,
): EmailQueueWriteResult {
  if (isSkippedEmailDeliveryExecutionResult(source)) {
    return buildSkippedEmailQueueWriteResult(source.reasonCode, {
      channel: source.channel === 'email' ? 'email' : undefined,
    });
  }

  if (isBlockedEmailDeliveryExecutionResult(source)) {
    return buildBlockedEmailQueueWriteResult(source.reasonCode, source.errorCode);
  }

  if (isFailedEmailDeliveryExecutionResult(source)) {
    return buildFailedEmailQueueWriteResult({
      reasonCode: source.reasonCode,
      errorCode: source.errorCode,
      retryable: source.retryable,
    });
  }

  return buildReadyEmailQueueWriteResult(source);
}

export function buildSkippedEmailQueueWriteResult(
  reasonCode: string,
  context?: { channel?: 'email' },
): SkippedEmailQueueWriteResult {
  return {
    status: 'skipped',
    reasonCode: reasonCode || 'noop',
    ...(context?.channel ? { channel: context.channel } : {}),
  };
}

export function buildBlockedEmailQueueWriteResult(
  reasonCode: string,
  errorCode: EmailQueueWriteErrorCode,
): BlockedEmailQueueWriteResult {
  return {
    status: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailQueueWriteResult(params: {
  reasonCode?: string;
  errorCode?: EmailQueueWriteErrorCode;
  retryable?: boolean;
}): FailedEmailQueueWriteResult {
  return {
    status: 'failed',
    reasonCode: params.reasonCode || DEFAULT_FAILED_REASON,
    errorCode: params.errorCode || 'unknown_email_queue_write_error',
    retryable: Boolean(params.retryable),
  };
}

export function buildSafeEmailQueueWriteRequestForLog(
  request: EmailQueueWriteRequest,
): Record<string, unknown> {
  return buildSafeProjection(request, 'log');
}

export function buildSafeEmailQueueWriteResultForLog(
  result: EmailQueueWriteResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'log');
}

export function buildSafeEmailQueueWriteResultForAudit(
  result: EmailQueueWriteResult,
): Record<string, unknown> {
  return buildSafeProjection(result, 'audit');
}

function buildSafeProjection(value: unknown, mode: 'log' | 'audit'): Record<string, unknown> {
  const sanitized = mode === 'audit' ? sanitizeNotificationPayloadForAudit(value) : value;
  return redactScalarContactValues(redactBodyFields(omitSecretKeys(sanitized))) as Record<string, unknown>;
}

function buildCorrelationFromPayload(payload: EmailJobPayload): EmailQueueWriteCorrelation {
  const metadata = asRecord(payload.metadata);
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    CORRELATION_KEYS
      .map((key) => [key, metadata[key]])
      .filter((entry): entry is [typeof CORRELATION_KEYS[number], string] => hasText(entry[1])),
  );
}

function buildInvalidValidation(
  errorCode: EmailQueueWriteErrorCode,
  reasonCode: string,
): EmailQueueWriteValidationResult {
  return { valid: false, reasonCode, errorCode };
}

function readStatus(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.status === 'string' ? record.status : null;
}

function readAction(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.action === 'string' ? record.action : null;
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

function hasOnlyStringCorrelationValues(correlation: JsonRecord): boolean {
  return Object.values(correlation).every((value) => value === undefined || typeof value === 'string');
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
