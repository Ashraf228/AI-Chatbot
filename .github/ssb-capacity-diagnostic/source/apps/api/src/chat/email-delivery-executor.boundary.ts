import type { EmailJobPayload } from './delivery-payload.builders';
import type {
  DeliveryExecutionBlockErrorCode,
  DeliveryExecutionPlan,
} from './delivery-execution.boundary';
import {
  buildSafeDeliveryExecutionPlanForAudit,
  buildSafeDeliveryExecutionPlanForLog,
} from './delivery-execution.boundary';
import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type EmailDeliveryExecutionStatus = 'ready' | 'skipped' | 'blocked' | 'failed';

export type EmailDeliveryExecutionErrorCode =
  | DeliveryExecutionBlockErrorCode
  | 'missing_plan'
  | 'unsupported_action'
  | 'queue_write_failed'
  | 'unknown_email_delivery_error';

export type ReadyEmailDeliveryExecutionResult = {
  status: 'ready';
  action: 'queue_email_job';
  reasonCode: string;
  payload: EmailJobPayload;
};

export type SkippedEmailDeliveryExecutionResult = {
  status: 'skipped';
  reasonCode: string;
  channel?: 'email';
};

export type BlockedEmailDeliveryExecutionResult = {
  status: 'blocked';
  reasonCode: string;
  errorCode: EmailDeliveryExecutionErrorCode;
};

export type FailedEmailDeliveryExecutionResult = {
  status: 'failed';
  reasonCode: string;
  errorCode: EmailDeliveryExecutionErrorCode;
  retryable: boolean;
};

export type EmailDeliveryExecutionResult =
  | ReadyEmailDeliveryExecutionResult
  | SkippedEmailDeliveryExecutionResult
  | BlockedEmailDeliveryExecutionResult
  | FailedEmailDeliveryExecutionResult;

export type EmailDeliveryPlanValidationResult =
  | { valid: true; reasonCode: string }
  | {
      valid: false;
      reasonCode: string;
      errorCode: EmailDeliveryExecutionErrorCode;
    };

type JsonRecord = Record<string, unknown>;

const DEFAULT_BLOCKED_REASON = 'email_delivery_blocked';
const DEFAULT_FAILED_REASON = 'email_delivery_failed';

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

export function isReadyEmailDeliveryPlan(plan: unknown): plan is Extract<
  DeliveryExecutionPlan,
  { action: 'queue_email_job' }
> {
  return readPlanAction(plan) === 'queue_email_job';
}

export function isSkippedEmailDeliveryPlan(plan: unknown): plan is Extract<
  DeliveryExecutionPlan,
  { action: 'noop' }
> {
  return readPlanAction(plan) === 'noop';
}

export function isBlockedEmailDeliveryPlan(plan: unknown): plan is Extract<
  DeliveryExecutionPlan,
  { action: 'blocked' }
> {
  return readPlanAction(plan) === 'blocked';
}

export function isUnsupportedEmailDeliveryPlan(plan: unknown): boolean {
  const action = readPlanAction(plan);
  return action !== 'queue_email_job' && action !== 'noop' && action !== 'blocked';
}

export function validateEmailDeliveryPlanForExecutor(plan: unknown): EmailDeliveryPlanValidationResult {
  if (!plan) {
    return buildInvalidValidation('missing_plan', DEFAULT_BLOCKED_REASON);
  }

  if (isSkippedEmailDeliveryPlan(plan) || isBlockedEmailDeliveryPlan(plan)) {
    return { valid: true, reasonCode: readReasonCode(plan) || plan.action };
  }

  if (isReadyEmailDeliveryPlan(plan)) {
    return validateReadyEmailDeliveryPlan(plan);
  }

  return buildInvalidValidation('unsupported_action', DEFAULT_BLOCKED_REASON);
}

export function validateReadyEmailDeliveryPlan(plan: unknown): EmailDeliveryPlanValidationResult {
  if (!isReadyEmailDeliveryPlan(plan)) {
    return buildInvalidValidation('unsupported_action', DEFAULT_BLOCKED_REASON);
  }

  const payload = asRecord(plan.payload);
  if (!payload) {
    return buildInvalidValidation('missing_payload', 'missing_email_job_payload');
  }

  if (!hasText(payload.recipientEmail)) {
    return buildInvalidValidation('missing_recipient', 'missing_email_recipient');
  }

  if (!hasText(payload.subject) || (!hasText(payload.html) && !hasText(payload.text))) {
    return buildInvalidValidation('invalid_payload', 'invalid_email_job_payload');
  }

  const metadata = asRecord(payload.metadata);
  if (!metadata || !hasText(metadata.tenantId) || !hasText(metadata.siteId) || !hasText(metadata.sessionId)) {
    return buildInvalidValidation('invalid_payload', 'invalid_email_job_payload');
  }

  return {
    valid: true,
    reasonCode: plan.reasonCode || 'lead_email_ready',
  };
}

export function buildEmailDeliveryResultFromPlan(plan: unknown): EmailDeliveryExecutionResult {
  if (isSkippedEmailDeliveryPlan(plan)) {
    return buildSkippedEmailDeliveryResult(plan.reasonCode || 'noop', {
      channel: plan.channel === 'email' ? 'email' : undefined,
    });
  }

  if (isBlockedEmailDeliveryPlan(plan)) {
    return buildBlockedEmailDeliveryResult(
      plan.reasonCode || DEFAULT_BLOCKED_REASON,
      plan.errorCode || 'unknown_email_delivery_error',
    );
  }

  if (isReadyEmailDeliveryPlan(plan)) {
    const validation = validateReadyEmailDeliveryPlan(plan);
    if (!validation.valid) {
      return buildBlockedEmailDeliveryResult(validation.reasonCode, validation.errorCode);
    }
    return buildReadyEmailDeliveryResult(plan);
  }

  return buildBlockedEmailDeliveryResult(DEFAULT_BLOCKED_REASON, 'unsupported_action');
}

export function buildReadyEmailDeliveryResult(
  plan: Extract<DeliveryExecutionPlan, { action: 'queue_email_job' }>,
): ReadyEmailDeliveryExecutionResult {
  return {
    status: 'ready',
    action: 'queue_email_job',
    reasonCode: plan.reasonCode || 'lead_email_ready',
    payload: plan.payload,
  };
}

export function buildSkippedEmailDeliveryResult(
  reasonCode: string,
  context?: { channel?: 'email' },
): SkippedEmailDeliveryExecutionResult {
  return {
    status: 'skipped',
    reasonCode: reasonCode || 'noop',
    ...(context?.channel ? { channel: context.channel } : {}),
  };
}

export function buildBlockedEmailDeliveryResult(
  reasonCode: string,
  errorCode: EmailDeliveryExecutionErrorCode,
): BlockedEmailDeliveryExecutionResult {
  return {
    status: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildFailedEmailDeliveryResult(params: {
  reasonCode?: string;
  errorCode?: EmailDeliveryExecutionErrorCode;
  retryable?: boolean;
}): FailedEmailDeliveryExecutionResult {
  return {
    status: 'failed',
    reasonCode: params.reasonCode || DEFAULT_FAILED_REASON,
    errorCode: params.errorCode || 'unknown_email_delivery_error',
    retryable: Boolean(params.retryable),
  };
}

export function buildSafeEmailDeliveryResultForLog(result: EmailDeliveryExecutionResult): Record<string, unknown> {
  return buildSafeEmailDeliveryResultProjection(result, 'log');
}

export function buildSafeEmailDeliveryResultForAudit(result: EmailDeliveryExecutionResult): Record<string, unknown> {
  return buildSafeEmailDeliveryResultProjection(result, 'audit');
}

function buildSafeEmailDeliveryResultProjection(
  result: EmailDeliveryExecutionResult,
  mode: 'log' | 'audit',
): Record<string, unknown> {
  const projected = result.status === 'ready'
    ? {
        ...result,
        payload: mode === 'log'
          ? buildSafeDeliveryExecutionPlanForLog({
              action: 'queue_email_job',
              commandType: 'queue_email_job',
              reasonCode: result.reasonCode,
              payload: result.payload,
            }).payload
          : buildSafeDeliveryExecutionPlanForAudit({
              action: 'queue_email_job',
              commandType: 'queue_email_job',
              reasonCode: result.reasonCode,
              payload: result.payload,
            }).payload,
      }
    : result;

  const sanitized = mode === 'audit'
    ? sanitizeNotificationPayloadForAudit(projected)
    : projected;
  return redactScalarContactValues(redactBodyFields(omitSecretKeys(sanitized))) as Record<string, unknown>;
}

function buildInvalidValidation(
  errorCode: EmailDeliveryExecutionErrorCode,
  reasonCode: string,
): EmailDeliveryPlanValidationResult {
  return { valid: false, reasonCode, errorCode };
}

function readPlanAction(plan: unknown): string | null {
  const record = asRecord(plan);
  return typeof record?.action === 'string' ? record.action : null;
}

function readReasonCode(plan: unknown): string | null {
  const record = asRecord(plan);
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
