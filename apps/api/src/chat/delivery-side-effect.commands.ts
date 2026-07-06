import type {
  DeliveryPayloadBuildResult,
  EmailJobPayload,
  LeadNotificationPayload,
} from './delivery-payload.builders';
import { buildDeliveryAuditPayload, buildSafeDeliveryPayloadForLog } from './delivery-payload.builders';
import type { NotificationNoopReason } from './notification-safety.guard';
import { sanitizeNotificationPayloadForAudit } from './notification-safety.guard';

export type DeliverySideEffectChannel = 'email' | 'webhook' | 'system';

export type DeliverySideEffectReasonCode =
  | 'lead_email_ready'
  | 'missing_email_job_payload'
  | NotificationNoopReason;

export type QueueEmailJobCommand = {
  type: 'queue_email_job';
  payload: EmailJobPayload;
  reasonCode: 'lead_email_ready';
};

export type NoopDeliveryCommand = {
  type: 'noop';
  reasonCode: DeliverySideEffectReasonCode;
  channel?: DeliverySideEffectChannel;
};

export type DeliverySideEffectCommand = QueueEmailJobCommand | NoopDeliveryCommand;

export function buildQueueEmailJobCommand(params: {
  payload: EmailJobPayload;
}): QueueEmailJobCommand {
  return {
    type: 'queue_email_job',
    payload: params.payload,
    reasonCode: 'lead_email_ready',
  };
}

export function buildNoopDeliveryCommand(params: {
  reasonCode: DeliverySideEffectReasonCode;
  channel?: DeliverySideEffectChannel;
}): NoopDeliveryCommand {
  return {
    type: 'noop',
    reasonCode: params.reasonCode,
    ...(params.channel ? { channel: params.channel } : {}),
  };
}

export function buildLeadEmailDeliveryCommands(params: {
  deliveryResult: DeliveryPayloadBuildResult<LeadNotificationPayload>;
  emailJobPayload?: EmailJobPayload | null;
}): DeliverySideEffectCommand[] {
  if (params.deliveryResult.status === 'noop') {
    return [
      buildNoopDeliveryCommand({
        reasonCode: params.deliveryResult.reasonCode as DeliverySideEffectReasonCode,
        channel: 'email',
      }),
    ];
  }

  if (!params.emailJobPayload) {
    return [
      buildNoopDeliveryCommand({
        reasonCode: 'missing_email_job_payload',
        channel: 'email',
      }),
    ];
  }

  return [buildQueueEmailJobCommand({ payload: params.emailJobPayload })];
}

export function buildDeliveryCommandAuditProjection(command: DeliverySideEffectCommand): Record<string, unknown> {
  const projection = sanitizeNotificationPayloadForAudit(command);
  return isRecord(projection) ? redactScalarContactValues(projection) as Record<string, unknown> : {};
}

export function buildDeliveryCommandLogProjection(command: DeliverySideEffectCommand): Record<string, unknown> {
  return redactScalarContactValues(buildSafeDeliveryPayloadForLog(command)) as Record<string, unknown>;
}

export function buildDeliveryCommandsAuditPayload(commands: DeliverySideEffectCommand[]): Record<string, unknown> {
  return buildDeliveryAuditPayload({
    commandCount: commands.length,
    commands: commands.map((command) => buildDeliveryCommandAuditProjection(command)),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function redactScalarContactValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactScalarContactValues(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, redactScalarContactValues(child)]),
    );
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\+?\d[\d\s()./-]{6,}\d/g, '[redacted-phone]');
}
