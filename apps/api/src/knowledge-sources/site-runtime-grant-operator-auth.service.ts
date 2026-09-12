import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../db/prisma.service';

const MIN_SECRET_LENGTH = 32;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const MAX_TOKEN_LENGTH = 8192;
const CAPABILITY_KEY = 'siteRuntimeGrantOperatorV1';
const INTERNAL_TENANT_IDS = new Set(['t_default', 't-default']);
const TENANT_OPERATOR_ROLES = new Set(['owner', 'admin', 'manager', 'editor']);
const SESSION_KEYS = new Set([
  'role',
  'sub',
  'exp',
  'iat',
  'tenantId',
  'tenantUserId',
  'email',
  'displayName',
  'sessionIssuedAt',
  'sessionExpiresAt',
  'accountExpiresAt',
  'jti',
]);

export type SiteRuntimeGrantOperatorAuthInput = {
  authorizationHeader?: unknown;
  dashboardTokenHeader?: unknown;
  targetTenantId?: unknown;
  targetSiteId?: unknown;
};

export type AuthorizedSiteRuntimeGrantContext = {
  tenantId: string;
  siteId: string;
  actorId: string;
  actorRole: 'admin';
};

type VerifiedTenantSession = {
  role: 'customer';
  sub: string;
  tenantId: string;
  tenantUserId: string;
  email: string;
  exp: number;
  iat: number;
  accountExpiresAt: string | null;
};

type PrincipalRow = {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  is_active: boolean;
  expires_at: Date | string | null;
  operator_capability: unknown;
  has_internal_subscription: boolean;
};

type OperatorTarget = {
  tenantId: string;
  siteIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value: Record<string, unknown>, expected: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
    && !value.includes('*');
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function decodeCanonicalBase64Url(value: string): string | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.toString('base64url') !== value) return null;
    return decoded.toString('utf8');
  } catch {
    return null;
  }
}

function timestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCapability(value: unknown): OperatorTarget[] | null {
  if (!isRecord(value) || !hasExactKeys(value, new Set(['enabled', 'targets']))) return null;
  if (value.enabled !== true || !Array.isArray(value.targets) || value.targets.length === 0) return null;

  const targets: OperatorTarget[] = [];
  const tenantIds = new Set<string>();
  for (const candidate of value.targets) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, new Set(['tenantId', 'siteIds']))) return null;
    if (!isCanonicalId(candidate.tenantId) || !Array.isArray(candidate.siteIds) || candidate.siteIds.length === 0) {
      return null;
    }
    if (tenantIds.has(candidate.tenantId)) return null;

    const siteIds = candidate.siteIds;
    if (!siteIds.every(isCanonicalId) || new Set(siteIds).size !== siteIds.length) return null;
    tenantIds.add(candidate.tenantId);
    targets.push({ tenantId: candidate.tenantId, siteIds: [...siteIds] });
  }

  return targets;
}

function unauthorized(): never {
  throw new UnauthorizedException('Unauthorized');
}

function forbidden(): never {
  throw new ForbiddenException('Forbidden');
}

function notFound(): never {
  throw new NotFoundException('Not found');
}

@Injectable()
export class SiteRuntimeGrantOperatorAuthService {
  constructor(private readonly db: PrismaService) {}

  async authorize(input: SiteRuntimeGrantOperatorAuthInput): Promise<AuthorizedSiteRuntimeGrantContext> {
    const session = this.verifyCredentials(input);

    try {
      const principal = await this.loadPrincipal(session.tenantUserId);
      this.assertPrincipal(session, principal);

      const targets = parseCapability(principal.operator_capability);
      if (!targets) forbidden();

      const targetTenantId = isCanonicalId(input.targetTenantId) ? input.targetTenantId : null;
      const targetSiteId = isCanonicalId(input.targetSiteId) ? input.targetSiteId : null;
      if (!targetTenantId || !targetSiteId) notFound();

      const target = targets.find((candidate) => candidate.tenantId === targetTenantId);
      if (!target || !target.siteIds.includes(targetSiteId)) notFound();

      const site = await this.db.query<{ id: string }>(
        'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [targetSiteId, targetTenantId],
      );
      if (site.rows.length !== 1) notFound();

      return {
        tenantId: targetTenantId,
        siteId: targetSiteId,
        actorId: `tenant-user:${principal.id}`,
        actorRole: 'admin',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Internal authorization failure', { cause: error });
    }
  }

  private verifyCredentials(input: SiteRuntimeGrantOperatorAuthInput): VerifiedTenantSession {
    const expectedDashboardToken = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || '';
    const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim() || '';
    const dashboardToken = typeof input?.dashboardTokenHeader === 'string'
      ? input.dashboardTokenHeader
      : '';

    if (
      expectedDashboardToken.length < MIN_SECRET_LENGTH
      || sessionSecret.length < MIN_SECRET_LENGTH
      || !secureCompare(dashboardToken, expectedDashboardToken)
    ) {
      unauthorized();
    }

    if (typeof input?.authorizationHeader !== 'string') unauthorized();
    const authorizationMatch = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(input.authorizationHeader);
    if (!authorizationMatch) unauthorized();
    return this.verifySessionToken(authorizationMatch[1], sessionSecret);
  }

  private verifySessionToken(token: string, secret: string): VerifiedTenantSession {
    if (token.length > MAX_TOKEN_LENGTH) unauthorized();
    const parts = token.split('.');
    if (parts.length !== 2) unauthorized();
    const [encodedPayload, encodedSignature] = parts;
    if (!decodeCanonicalBase64Url(encodedPayload) || !/^[A-Za-z0-9_-]+$/.test(encodedSignature)) {
      unauthorized();
    }

    const actualSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest();
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
      unauthorized();
    }

    try {
      const decoded = decodeCanonicalBase64Url(encodedPayload);
      const payload: unknown = decoded ? JSON.parse(decoded) : null;
      if (!isRecord(payload) || Object.keys(payload).some((key) => !SESSION_KEYS.has(key))) unauthorized();

      const now = Date.now();
      const exp = Number(payload.exp);
      const iat = Number(payload.iat);
      const tenantId = payload.tenantId;
      const tenantUserId = payload.tenantUserId;
      const email = payload.email;
      const accountExpiresAt = payload.accountExpiresAt;

      if (
        payload.role !== 'customer'
        || !isCanonicalId(tenantId)
        || !isCanonicalId(tenantUserId)
        || typeof email !== 'string'
        || !email
        || email !== email.trim().toLowerCase()
        || payload.sub !== `customer:${tenantId}:${email}`
        || !isNonEmptyText(payload.displayName)
        || !Number.isSafeInteger(iat)
        || !Number.isSafeInteger(exp)
        || iat <= 0
        || exp <= iat
        || iat > now + CLOCK_SKEW_MS
        || exp <= now
        || exp - iat > SESSION_TTL_MS
        || !isNonEmptyText(payload.jti)
        || !isNonEmptyText(payload.sessionIssuedAt)
        || !isNonEmptyText(payload.sessionExpiresAt)
        || Date.parse(payload.sessionIssuedAt) !== iat
        || Date.parse(payload.sessionExpiresAt) !== exp
      ) {
        unauthorized();
      }

      let normalizedAccountExpiry: string | null = null;
      if (accountExpiresAt !== undefined) {
        if (!isNonEmptyText(accountExpiresAt)) unauthorized();
        const accountExpiry = Date.parse(accountExpiresAt);
        if (!Number.isFinite(accountExpiry) || accountExpiry <= now || exp > accountExpiry) unauthorized();
        normalizedAccountExpiry = accountExpiresAt;
      }

      return {
        role: 'customer',
        sub: payload.sub,
        tenantId,
        tenantUserId,
        email,
        exp,
        iat,
        accountExpiresAt: normalizedAccountExpiry,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      unauthorized();
    }
  }

  private async loadPrincipal(tenantUserId: string): Promise<PrincipalRow> {
    const result = await this.db.query<PrincipalRow>(
      `SELECT
         tu.id,
         tu.tenant_id,
         tu.email,
         tu.role,
         tu.is_active,
         tu.expires_at,
         tu.metadata -> '${CAPABILITY_KEY}' AS operator_capability,
         EXISTS (
           SELECT 1
           FROM tenant_subscriptions ts
           WHERE ts.tenant_id = tu.tenant_id
             AND ts.status = 'internal'
         ) AS has_internal_subscription
       FROM tenant_users tu
       WHERE tu.id = $1
       LIMIT 1`,
      [tenantUserId],
    );
    const principal = result.rows[0];
    if (!principal) unauthorized();
    return principal;
  }

  private assertPrincipal(session: VerifiedTenantSession, principal: PrincipalRow): void {
    const now = Date.now();
    const persistedExpiry = timestamp(principal.expires_at);
    const claimedAccountExpiry = timestamp(session.accountExpiresAt);
    const hasPersistedExpiry = principal.expires_at !== null;
    if (
      !principal.is_active
      || (hasPersistedExpiry && persistedExpiry === null)
      || (persistedExpiry !== null && persistedExpiry <= now)
      || principal.tenant_id !== session.tenantId
      || principal.email.trim().toLowerCase() !== session.email
      || !TENANT_OPERATOR_ROLES.has(principal.role)
      || persistedExpiry !== claimedAccountExpiry
    ) {
      unauthorized();
    }

    if (!INTERNAL_TENANT_IDS.has(principal.tenant_id) || !principal.has_internal_subscription) {
      forbidden();
    }
  }
}
