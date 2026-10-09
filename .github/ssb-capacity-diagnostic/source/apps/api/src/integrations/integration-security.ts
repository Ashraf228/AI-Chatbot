import { BadRequestException } from '@nestjs/common';
import { isIP } from 'net';
import { lookup } from 'dns/promises';

const SENSITIVE_HEADER_PATTERN = /(authorization|cookie|token|secret|key|password)/i;

export function maskSensitiveRecord(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      SENSITIVE_HEADER_PATTERN.test(key) ? '[masked]' : value,
    ]),
  );
}

export function parseJsonRecord(value: unknown) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    throw new BadRequestException('JSON-Konfiguration ist ungueltig.');
  }
}

export async function validatePublicIntegrationUrl(input: string) {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new BadRequestException('Ungueltige URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Nur http/https URLs sind erlaubt.');
  }

  const allowLocal = process.env.NODE_ENV !== 'production' && process.env.ALLOW_PRIVATE_INTEGRATION_URLS === 'true';
  if (allowLocal) {
    return parsed.toString();
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new BadRequestException('Private oder lokale URLs sind nicht erlaubt.');
  }

  const records = await lookup(parsed.hostname, { all: true }).catch(() => []);
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new BadRequestException('Private oder lokale URLs sind nicht erlaubt.');
  }

  return parsed.toString();
}

function isBlockedHostname(hostname: string) {
  const value = hostname.toLowerCase();
  return value === 'localhost' || value.endsWith('.localhost') || value === '0.0.0.0';
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 0) {
    return true;
  }
  if (address === '127.0.0.1' || address === '::1') {
    return true;
  }
  if (/^10\./.test(address) || /^192\.168\./.test(address)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
    return true;
  }
  if (/^169\.254\./.test(address)) {
    return true;
  }
  if (/^fc|^fd/i.test(address)) {
    return true;
  }
  return false;
}
