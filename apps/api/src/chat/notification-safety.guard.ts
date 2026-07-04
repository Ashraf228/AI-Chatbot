export type NotificationNoopReason =
  | 'delivery_channel_disabled'
  | 'missing_delivery_config'
  | 'missing_delivery_target'
  | 'missing_email_target'
  | 'missing_webhook_target';

type JsonRecord = Record<string, unknown>;

const REDACTED = '[redacted]';

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

const DELIVERY_TARGET_KEYS = new Set([
  'recipientemail',
  'recipient_email',
  'webhookurl',
  'webhook_url',
  'callbackurl',
  'callback_url',
  'endpointurl',
  'endpoint_url',
]);

const PUBLIC_UNSAFE_CONTAINER_KEYS = new Set(['deliverychannels', 'delivery_channels']);

function normalizeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readEnabled(value: unknown) {
  const record = asRecord(value);
  return record && typeof record.enabled === 'boolean' ? record.enabled : true;
}

function cloneArray(value: unknown[], transform: (item: unknown, path: string[]) => unknown, path: string[]) {
  return value.map((item, index) => transform(item, [...path, String(index)]));
}

function sanitizeObject(
  input: JsonRecord,
  path: string[],
  mode: 'admin' | 'log' | 'audit' | 'public',
): JsonRecord {
  const output: JsonRecord = {};

  for (const [key, rawValue] of Object.entries(input)) {
    const nextPath = [...path, key];
    const normalizedKey = normalizeKey(key);

    if (mode === 'public' && PUBLIC_UNSAFE_CONTAINER_KEYS.has(normalizedKey)) {
      continue;
    }

    if (isSensitiveDeliveryPath(nextPath)) {
      if (mode === 'admin' || mode === 'public') {
        continue;
      }
      output[key] = redactDeliverySensitiveValue(rawValue);
      continue;
    }

    if (DELIVERY_TARGET_KEYS.has(normalizedKey) && (mode === 'admin' || mode === 'public' || mode === 'audit')) {
      if (mode === 'audit') {
        output[key] = redactDeliverySensitiveValue(rawValue);
      }
      continue;
    }

    output[key] = sanitizeValue(rawValue, nextPath, mode);
  }

  return output;
}

function sanitizeValue(value: unknown, path: string[], mode: 'admin' | 'log' | 'audit' | 'public'): unknown {
  if (Array.isArray(value)) {
    return cloneArray(value, (item, itemPath) => sanitizeValue(item, itemPath, mode), path);
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  return sanitizeObject(record, path, mode);
}

export function isSensitiveDeliveryKey(key: unknown): boolean {
  return typeof key === 'string' && SECRET_KEYS.has(normalizeKey(key));
}

export function isDeliverySecretField(key: unknown): boolean {
  return isSensitiveDeliveryKey(key);
}

export function isSensitiveDeliveryPath(path: string | string[]): boolean {
  const parts = Array.isArray(path) ? path : path.split('.');
  const last = parts[parts.length - 1] || '';
  if (isSensitiveDeliveryKey(last)) {
    return true;
  }

  const previous = parts[parts.length - 2] || '';
  return normalizeKey(previous) === 'headers' && isSensitiveDeliveryKey(last);
}

export function redactDeliverySensitiveValue(value: unknown): unknown {
  return value === null || typeof value === 'undefined' || value === '' ? value : REDACTED;
}

export function sanitizeDeliveryHeaders(headers: unknown): JsonRecord {
  const record = asRecord(headers);
  if (!record) {
    return {};
  }

  return sanitizeObject(record, ['headers'], 'log');
}

export function sanitizeDeliveryConfigForLog(config: unknown): unknown {
  return sanitizeValue(config, [], 'log');
}

export function sanitizeDeliveryConfigForAdminRead(config: unknown): unknown {
  return sanitizeValue(config, [], 'admin');
}

export function sanitizeNotificationPayloadForAudit(payload: unknown): unknown {
  return sanitizeValue(payload, [], 'audit');
}

export function stripPublicNotificationFields(config: unknown): unknown {
  return sanitizeValue(config, [], 'public');
}

export function hasUsableEmailTarget(input: unknown): boolean {
  if (typeof input === 'string') {
    return hasText(input);
  }

  const record = asRecord(input);
  if (!record || readEnabled(record) === false) {
    return false;
  }

  return hasText(record.recipientEmail) || hasText(record.email) || hasText(record.to);
}

export function hasUsableWebhookTarget(input: unknown): boolean {
  if (typeof input === 'string') {
    return hasText(input);
  }

  const record = asRecord(input);
  if (!record || readEnabled(record) === false) {
    return false;
  }

  return (
    hasText(record.webhookUrl) ||
    hasText(record.webhook_url) ||
    hasText(record.callbackUrl) ||
    hasText(record.callback_url) ||
    hasText(record.endpointUrl) ||
    hasText(record.endpoint_url) ||
    hasText(record.url)
  );
}

export function hasAnyUsableDeliveryTarget(input: unknown): boolean {
  const record = asRecord(input);
  if (!record) {
    return hasUsableEmailTarget(input) || hasUsableWebhookTarget(input);
  }

  const deliveryChannels = asRecord(record.deliveryChannels) || asRecord(record.delivery_channels);
  if (deliveryChannels) {
    return Object.values(deliveryChannels).some((channel) => (
      hasUsableEmailTarget(channel) || hasUsableWebhookTarget(channel)
    ));
  }

  return hasUsableEmailTarget(record) || hasUsableWebhookTarget(record);
}

export function getNotificationNoopReason(input: {
  type?: 'email' | 'webhook' | 'any';
  config?: unknown;
  enabled?: boolean;
}): NotificationNoopReason | null {
  if (input.enabled === false) {
    return 'delivery_channel_disabled';
  }

  const type = input.type || 'any';
  if (typeof input.config === 'undefined' || input.config === null) {
    return 'missing_delivery_config';
  }

  if (type === 'email') {
    return hasUsableEmailTarget(input.config) ? null : 'missing_email_target';
  }

  if (type === 'webhook') {
    return hasUsableWebhookTarget(input.config) ? null : 'missing_webhook_target';
  }

  return hasAnyUsableDeliveryTarget(input.config) ? null : 'missing_delivery_target';
}

export function shouldNoopNotification(input: {
  type?: 'email' | 'webhook' | 'any';
  config?: unknown;
  enabled?: boolean;
}): boolean {
  return getNotificationNoopReason(input) !== null;
}

export function getPublicUnsafeDeliveryKeys(value: unknown): string[] {
  const unsafe: string[] = [];

  function visit(current: unknown, path: string[]) {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }

    const record = asRecord(current);
    if (!record) {
      return;
    }

    for (const [key, child] of Object.entries(record)) {
      const nextPath = [...path, key];
      const normalizedKey = normalizeKey(key);
      if (
        PUBLIC_UNSAFE_CONTAINER_KEYS.has(normalizedKey) ||
        DELIVERY_TARGET_KEYS.has(normalizedKey) ||
        isSensitiveDeliveryPath(nextPath)
      ) {
        unsafe.push(nextPath.join('.'));
      }
      visit(child, nextPath);
    }
  }

  visit(value, []);
  return unsafe;
}

export function assertNoPublicDeliverySecrets(value: unknown): boolean {
  return getPublicUnsafeDeliveryKeys(value).length === 0;
}
