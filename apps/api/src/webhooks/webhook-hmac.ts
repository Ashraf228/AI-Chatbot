import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const WEBHOOK_HMAC_VERSION = 'v1';
export const WEBHOOK_SIGNATURE_HEADER = 'x-ssb-signature';
export const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;
const MIN_SIGNATURE_TOLERANCE_SECONDS = 30;
const MAX_SIGNATURE_TOLERANCE_SECONDS = 600;

export type WebhookHmacHeaders = {
  'content-type': 'application/json';
  'x-ssb-event-id': string;
  'x-ssb-delivery-id': string;
  'x-ssb-event-type': string;
  'x-ssb-timestamp': string;
  'x-ssb-signature': string;
};

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; code: 'missing_header' | 'invalid_version' | 'invalid_signature' | 'timestamp_out_of_range' };

export function createWebhookEventId() {
  return `evt_${randomUUID()}`;
}

export function createWebhookDeliveryId() {
  return `del_${randomUUID()}`;
}

export function normalizeSignatureToleranceSeconds(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_SIGNATURE_TOLERANCE_SECONDS || parsed > MAX_SIGNATURE_TOLERANCE_SECONDS) {
    return DEFAULT_SIGNATURE_TOLERANCE_SECONDS;
  }
  return parsed;
}

export function decodeWebhookSecretB64(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const secret = Buffer.from(value.trim(), 'base64');
  return secret.length >= 32 ? secret : null;
}

export function serializeWebhookJson(payload: unknown) {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

export function payloadSha256Hex(body: Buffer) {
  return createHash('sha256').update(body).digest('hex');
}

export function signWebhookBody(secret: Buffer, timestamp: string, body: Buffer) {
  const signedPrefix = Buffer.from(`${timestamp}.`, 'utf8');
  const digest = createHmac('sha256', secret)
    .update(signedPrefix)
    .update(body)
    .digest('hex')
    .toLowerCase();
  return `${WEBHOOK_HMAC_VERSION}=${digest}`;
}

export function buildWebhookHeaders(input: {
  secret: Buffer;
  eventId: string;
  deliveryId: string;
  eventType: string;
  timestamp: string;
  body: Buffer;
}): WebhookHmacHeaders {
  return {
    'content-type': 'application/json',
    'x-ssb-event-id': input.eventId,
    'x-ssb-delivery-id': input.deliveryId,
    'x-ssb-event-type': input.eventType,
    'x-ssb-timestamp': input.timestamp,
    'x-ssb-signature': signWebhookBody(input.secret, input.timestamp, input.body),
  };
}

export function verifyWebhookSignature(input: {
  secret: Buffer;
  signatureHeader?: string;
  timestampHeader?: string;
  body: Buffer;
  nowMs?: number;
  toleranceSeconds?: number;
}): WebhookVerifyResult {
  const signatureHeader = input.signatureHeader || '';
  const timestampHeader = input.timestampHeader || '';
  if (!signatureHeader || !timestampHeader) {
    return { ok: false, code: 'missing_header' };
  }

  const [version, hexDigest] = signatureHeader.split('=');
  if (version !== WEBHOOK_HMAC_VERSION || !hexDigest || !/^[a-f0-9]{64}$/.test(hexDigest)) {
    return { ok: false, code: 'invalid_version' };
  }

  const timestampMs = Date.parse(timestampHeader);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, code: 'timestamp_out_of_range' };
  }
  const toleranceMs = normalizeSignatureToleranceSeconds(input.toleranceSeconds) * 1000;
  if (Math.abs((input.nowMs ?? Date.now()) - timestampMs) > toleranceMs) {
    return { ok: false, code: 'timestamp_out_of_range' };
  }

  const expectedHex = signWebhookBody(input.secret, timestampHeader, input.body).slice(`${WEBHOOK_HMAC_VERSION}=`.length);
  const received = Buffer.from(hexDigest, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (received.length !== expected.length) {
    return { ok: false, code: 'invalid_signature' };
  }
  return timingSafeEqual(received, expected) ? { ok: true } : { ok: false, code: 'invalid_signature' };
}
