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
import {
  CUSTOMER_WORKSPACE_CAPABILITY_KEY,
  CUSTOMER_WORKSPACE_ROLES,
  isCanonicalWorkspaceId,
  parseCustomerWorkspaceCapability,
} from '../tenants/customer-workspace-capability';

const MIN_SECRET_LENGTH = 32;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const MAX_TOKEN_LENGTH = 8192;
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

export type CustomerWorkspaceOperatorAuthInput = {
  authorizationHeader?: unknown;
  dashboardTokenHeader?: unknown;
  targetSiteId?: unknown;
};

export type AuthorizedCustomerWorkspaceContext = {
  tenantId: string;
  siteId: string;
  actorId: string;
  actorRole: 'customer';
};

type VerifiedTenantSession = {
  tenantId: string;
  tenantUserId: string;
  email: string;
  accountExpiresAt: string | null;
};

type PrincipalRow = {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  is_active: boolean;
  expires_at: Date | string | null;
  workspace_capability: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
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
export class CustomerWorkspaceOperatorAuthService {
  constructor(private readonly db: PrismaService) {}

  async authorize(input: CustomerWorkspaceOperatorAuthInput): Promise<AuthorizedCustomerWorkspaceContext> {
    const session = this.verifyCredentials(input);

    try {
      const principal = await this.loadPrincipal(session.tenantUserId);
      this.assertPrincipal(session, principal);

      const capability = parseCustomerWorkspaceCapability(principal.workspace_capability);
      if (!capability) forbidden();

      const targetSiteId = isCanonicalWorkspaceId(input.targetSiteId) ? input.targetSiteId : null;
      if (!targetSiteId || !capability.siteIds.includes(targetSiteId)) notFound();

      const site = await this.db.query<{ id: string }>(
        'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [targetSiteId, principal.tenant_id],
      );
      if (site.rows.length !== 1) notFound();

      return {
        tenantId: principal.tenant_id,
        siteId: targetSiteId,
        actorId: `tenant-user:${principal.id}`,
        actorRole: 'customer',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Internal authorization failure', { cause: error });
    }
  }

  private verifyCredentials(input: CustomerWorkspaceOperatorAuthInput): VerifiedTenantSession {
    const expectedDashboardToken = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || '';
    const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim() || '';
    const dashboardToken = typeof input.dashboardTokenHeader === 'string' ? input.dashboardTokenHeader : '';

    if (
      expectedDashboardToken.length < MIN_SECRET_LENGTH
      || sessionSecret.length < MIN_SECRET_LENGTH
      || !secureCompare(dashboardToken, expectedDashboardToken)
    ) {
      unauthorized();
    }

    if (typeof input.authorizationHeader !== 'string') unauthorized();
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(input.authorizationHeader);
    if (!match) unauthorized();
    return this.verifySessionToken(match[1], sessionSecret);
  }

  private verifySessionToken(token: string, secret: string): VerifiedTenantSession {
    if (token.length > MAX_TOKEN_LENGTH) unauthorized();
    const parts = token.split('.');
    if (parts.length !== 2) unauthorized();
    const [encodedPayload, encodedSignature] = parts;
    if (!decodeCanonicalBase64Url(encodedPayload) || !/^[A-Za-z0-9_-]+$/.test(encodedSignature)) unauthorized();

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
        || !isCanonicalWorkspaceId(tenantId)
        || !isCanonicalWorkspaceId(tenantUserId)
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

      return { tenantId, tenantUserId, email, accountExpiresAt: normalizedAccountExpiry };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      unauthorized();
    }
  }

  private async loadPrincipal(tenantUserId: string): Promise<PrincipalRow> {
    const result = await this.db.query<PrincipalRow>(
      `SELECT
         id,
         tenant_id,
         email,
         role,
         is_active,
         expires_at,
         metadata -> $2 AS workspace_capability
       FROM tenant_users
       WHERE id = $1
       LIMIT 1`,
      [tenantUserId, CUSTOMER_WORKSPACE_CAPABILITY_KEY],
    );
    const principal = result.rows[0];
    if (!principal) unauthorized();
    return principal;
  }

  private assertPrincipal(session: VerifiedTenantSession, principal: PrincipalRow): void {
    const now = Date.now();
    const persistedExpiry = timestamp(principal.expires_at);
    const claimedExpiry = timestamp(session.accountExpiresAt);
    const hasPersistedExpiry = principal.expires_at !== null;
    if (
      !principal.is_active
      || (hasPersistedExpiry && persistedExpiry === null)
      || (persistedExpiry !== null && persistedExpiry <= now)
      || principal.tenant_id !== session.tenantId
      || principal.email.trim().toLowerCase() !== session.email
      || !CUSTOMER_WORKSPACE_ROLES.has(principal.role)
      || persistedExpiry !== claimedExpiry
    ) {
      unauthorized();
    }
  }
}
