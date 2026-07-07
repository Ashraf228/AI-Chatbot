import type {
  DeliverySideEffectChannel,
  NoopDeliveryCommand,
  QueueEmailJobCommand,
} from './delivery-side-effect.commands';
import type { EmailJobPayload } from './delivery-payload.builders';
import { buildSafeDeliveryPayloadForLog } from './delivery-payload.builders';
import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type DeliveryExecutionAction = 'queue_email_job' | 'noop' | 'blocked';

export type DeliveryExecutionBlockErrorCode =
  | 'missing_command'
  | 'missing_command_type'
  | 'unsupported_command_type'
  | 'missing_payload'
  | 'invalid_payload'
  | 'missing_recipient';

export type DeliveryExecutionValidationResult =
  | { valid: true; reasonCode: string }
  | {
      valid: false;
      reasonCode: string;
      errorCode: DeliveryExecutionBlockErrorCode;
    };

export type DeliveryExecutionPlan =
  | {
      action: 'queue_email_job';
      commandType: 'queue_email_job';
      reasonCode: string;
      payload: EmailJobPayload;
    }
  | {
      action: 'noop';
      reasonCode: string;
      channel?: DeliverySideEffectChannel;
    }
  | {
      action: 'blocked';
      reasonCode: string;
      errorCode: DeliveryExecutionBlockErrorCode;
    };

type JsonRecord = Record<string, unknown>;

const DEFAULT_BLOCKED_REASON = 'delivery_execution_blocked';

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

export function isNoopDeliveryCommand(command: unknown): command is NoopDeliveryCommand {
  return readCommandType(command) === 'noop';
}

export function isEmailQueueDeliveryCommand(command: unknown): command is QueueEmailJobCommand {
  return readCommandType(command) === 'queue_email_job';
}

export function isUnsupportedDeliveryCommand(command: unknown): boolean {
  const commandType = readCommandType(command);
  return commandType !== 'noop' && commandType !== 'queue_email_job';
}

export function validateDeliveryCommandForExecution(command: unknown): DeliveryExecutionValidationResult {
  if (!command) {
    return buildInvalidValidation('missing_command', DEFAULT_BLOCKED_REASON);
  }

  const commandType = readCommandType(command);
  if (!commandType) {
    return buildInvalidValidation('missing_command_type', DEFAULT_BLOCKED_REASON);
  }

  if (commandType === 'noop') {
    return { valid: true, reasonCode: readReasonCode(command) || 'noop' };
  }

  if (commandType === 'queue_email_job') {
    return validateEmailQueueCommand(command);
  }

  return buildInvalidValidation('unsupported_command_type', DEFAULT_BLOCKED_REASON);
}

export function validateEmailQueueCommand(command: unknown): DeliveryExecutionValidationResult {
  if (!isEmailQueueDeliveryCommand(command)) {
    return buildInvalidValidation('unsupported_command_type', DEFAULT_BLOCKED_REASON);
  }

  const payload = asRecord(command.payload);
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
    reasonCode: command.reasonCode || 'lead_email_ready',
  };
}

export function buildDeliveryExecutionPlan(command: unknown): DeliveryExecutionPlan {
  if (isNoopDeliveryCommand(command)) {
    return buildNoopExecutionPlan(command);
  }

  if (isEmailQueueDeliveryCommand(command)) {
    return buildEmailQueueExecutionPlan(command);
  }

  const validation = validateDeliveryCommandForExecution(command);
  if (!validation.valid) {
    return buildBlockedExecutionPlan(validation.reasonCode, validation.errorCode);
  }

  return buildBlockedExecutionPlan(DEFAULT_BLOCKED_REASON, 'unsupported_command_type');
}

export function buildEmailQueueExecutionPlan(command: QueueEmailJobCommand): DeliveryExecutionPlan {
  const validation = validateEmailQueueCommand(command);
  if (!validation.valid) {
    return buildBlockedExecutionPlan(validation.reasonCode, validation.errorCode);
  }

  return {
    action: 'queue_email_job',
    commandType: 'queue_email_job',
    reasonCode: validation.reasonCode,
    payload: command.payload,
  };
}

export function buildNoopExecutionPlan(command: NoopDeliveryCommand): DeliveryExecutionPlan {
  return {
    action: 'noop',
    reasonCode: command.reasonCode || 'noop',
    ...(command.channel ? { channel: command.channel } : {}),
  };
}

export function buildBlockedExecutionPlan(
  reasonCode: string,
  errorCode: DeliveryExecutionBlockErrorCode,
): DeliveryExecutionPlan {
  return {
    action: 'blocked',
    reasonCode: reasonCode || DEFAULT_BLOCKED_REASON,
    errorCode,
  };
}

export function buildSafeDeliveryExecutionPlanForLog(plan: DeliveryExecutionPlan): Record<string, unknown> {
  return buildSafeExecutionProjection(plan, 'log');
}

export function buildSafeDeliveryExecutionPlanForAudit(plan: DeliveryExecutionPlan): Record<string, unknown> {
  return buildSafeExecutionProjection(plan, 'audit');
}

function buildSafeExecutionProjection(
  plan: DeliveryExecutionPlan,
  mode: 'log' | 'audit',
): Record<string, unknown> {
  const sanitized = mode === 'log'
    ? buildSafeDeliveryPayloadForLog(plan)
    : sanitizeNotificationPayloadForAudit(plan);
  return redactScalarContactValues(omitSecretKeys(sanitized)) as Record<string, unknown>;
}

function buildInvalidValidation(
  errorCode: DeliveryExecutionBlockErrorCode,
  reasonCode: string,
): DeliveryExecutionValidationResult {
  return { valid: false, reasonCode, errorCode };
}

function readCommandType(command: unknown): string | null {
  const record = asRecord(command);
  return typeof record?.type === 'string' ? record.type : null;
}

function readReasonCode(command: unknown): string | null {
  const record = asRecord(command);
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
