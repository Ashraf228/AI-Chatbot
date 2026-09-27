import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const HEADER = 'x-site-pilot-token';
const RULE_KEYS = ['tenantId', 'siteId', 'tokenSha256', 'validFrom', 'expiresAt'];
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const HEX_256 = /^[a-f0-9]{64}$/;
const MAX_WINDOW_MS = 60 * 60 * 1000;

type PilotRule = {
  tenantId: string;
  siteId: string;
  tokenSha256: string;
  validFrom: string;
  expiresAt: string;
};

function utcTimestamp(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : NaN;
}

// Validate before listening as well as at the boundary. Invalid configuration
// must never silently disable an intended restriction.
export function readSitePilotAccessRules(raw = process.env.SITE_PILOT_ACCESS_RULES_JSON): PilotRule[] {
  if (raw === undefined || raw === '') return [];
  try {
    if (raw.length > 32768) throw new Error();
    const rules: unknown = JSON.parse(raw);
    if (!Array.isArray(rules) || rules.length > 50) throw new Error();
    const sites = new Set<string>();
    for (const rule of rules) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)
        || Object.keys(rule).length !== RULE_KEYS.length
        || !RULE_KEYS.every((key) => Object.prototype.hasOwnProperty.call(rule, key))
        || typeof rule.tenantId !== 'string' || !ID.test(rule.tenantId)
        || typeof rule.siteId !== 'string' || !ID.test(rule.siteId)
        || typeof rule.tokenSha256 !== 'string' || !HEX_256.test(rule.tokenSha256)
        || sites.has(rule.siteId)) throw new Error();
      const start = utcTimestamp(rule.validFrom);
      const end = utcTimestamp(rule.expiresAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_WINDOW_MS) {
        throw new Error();
      }
      sites.add(rule.siteId);
    }
    return rules as PilotRule[];
  } catch {
    // No config value, digest or credential is included in the error.
    throw new ServiceUnavailableException('Invalid site pilot access configuration');
  }
}

export function assertSitePilotAccess(
  scope: { siteId: string; tenantId?: string | null },
  request?: { headers?: Record<string, unknown> },
  now = Date.now(),
): void {
  // siteId comes from the loaded site, never from a caller's scope header.
  // A tenant mismatch for a restricted site is a denial, not an unrestricted site.
  const rule = readSitePilotAccessRules().find((entry) => entry.siteId === scope.siteId);
  if (!rule) return;
  const token = request?.headers?.[HEADER];
  if (scope.tenantId !== rule.tenantId || !Number.isFinite(now)
    || now < Date.parse(rule.validFrom) || now >= Date.parse(rule.expiresAt)
    || typeof token !== 'string' || !HEX_256.test(token)) {
    throw new ForbiddenException('Forbidden');
  }
  const actual = createHash('sha256')
    .update(`${rule.tenantId}\0${rule.siteId}\0${token}`).digest();
  if (!timingSafeEqual(actual, Buffer.from(rule.tokenSha256, 'hex'))) {
    throw new ForbiddenException('Forbidden');
  }
}
