import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../db/database.service';
import { resolveSiteKey } from '../sites/site-key';
import { TENANT_USER_ROLES, TenantUserRole } from './tenant-users.dto';
import { TenantsService } from './tenants.service';

type TenantUserRow = {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  evaluation_site_id: string | null;
  created_at: string;
  updated_at: string;
};

type EvaluationSiteRow = {
  id: string;
  tenant_id: string | null;
  is_evaluation_demo: boolean;
  is_active: boolean;
};

function normalizeRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const MIN_PASSWORD_LENGTH = 12;
const PASSWORD_HASH_PREFIX = 'scrypt';

function sanitizeMetadata(value: Record<string, unknown>) {
  const { passwordHash: _passwordHash, ...rest } = value;
  return rest;
}

function normalizeExpiresAt(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value.trim() === '') {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new BadRequestException('expiresAt must be a valid ISO timestamp');
  }

  return new Date(timestamp).toISOString();
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) {
    return false;
  }

  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function normalizeOptionalId(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  return value.trim();
}

function hashPassword(password: string) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${PASSWORD_HASH_PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPasswordHash(password: string, passwordHash: string) {
  const [algorithm, saltHex, hashHex] = passwordHash.split('$');
  if (algorithm !== PASSWORD_HASH_PREFIX || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(password, salt, expectedHash.length);
  return timingSafeEqual(derived, expectedHash);
}

@Injectable()
export class TenantUsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenants: TenantsService,
  ) {}

  private normalizeRole(role?: string): TenantUserRole {
    const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
    if (TENANT_USER_ROLES.includes(normalized as TenantUserRole)) {
      return normalized as TenantUserRole;
    }

    return 'editor';
  }

  private normalizeTenantUser(row: TenantUserRow) {
    const metadata = normalizeRecord(row.metadata);

    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      displayName: row.display_name,
      role: this.normalizeRole(row.role),
      isActive: row.is_active,
      metadata: sanitizeMetadata(metadata),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      evaluationSiteId: row.evaluation_site_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async resolveEvaluationSiteId(params: {
    tenantId: string;
    role: TenantUserRole;
    evaluationSiteId: string | null | undefined;
  }) {
    const evaluationSiteId = normalizeOptionalId(params.evaluationSiteId);
    if (evaluationSiteId === undefined) {
      return undefined;
    }
    if (evaluationSiteId === null) {
      return null;
    }
    if (params.role !== 'viewer') {
      throw new BadRequestException('evaluationSiteId requires role viewer');
    }

    const site = await this.db.query<EvaluationSiteRow>(
      `SELECT
         id,
         tenant_id,
         is_evaluation_demo,
         CASE
           WHEN config ? 'isActive' THEN lower(config->>'isActive') = 'true'
           ELSE true
         END AS is_active
       FROM sites
       WHERE id = $1
       LIMIT 1`,
      [evaluationSiteId],
    );
    const row = site.rows[0];
    if (!row || row.tenant_id !== params.tenantId || !row.is_evaluation_demo || !row.is_active) {
      throw new BadRequestException('evaluationSiteId must reference an active evaluation demo site in the same tenant');
    }

    return evaluationSiteId;
  }

  async listForTenant(tenantId: string) {
    const normalizedTenantId = await this.tenants.ensureTenantExists(tenantId);
    const res = await this.db.query<TenantUserRow>(
      `SELECT
         id,
         tenant_id,
         email,
         display_name,
         role,
         is_active,
         metadata,
         expires_at,
         evaluation_site_id,
         created_at,
         updated_at
       FROM tenant_users
       WHERE tenant_id = $1
       ORDER BY display_name ASC, email ASC`,
      [normalizedTenantId],
    );

    return res.rows.map((row) => this.normalizeTenantUser(row));
  }

  async create(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role?: TenantUserRole;
    metadata?: Record<string, unknown>;
    password?: string;
    expiresAt?: string | null;
    evaluationSiteId?: string | null;
  }) {
    const tenantId = await this.tenants.ensureTenantExists(input.tenantId);
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim();

    if (!email) {
      throw new BadRequestException('email required');
    }
    if (!displayName) {
      throw new BadRequestException('displayName required');
    }

    const role = this.normalizeRole(input.role);
    const id = randomUUID();
    const metadata = normalizeRecord(input.metadata);
    const expiresAt = normalizeExpiresAt(input.expiresAt);
    const evaluationSiteId = await this.resolveEvaluationSiteId({
      tenantId,
      role,
      evaluationSiteId: input.evaluationSiteId,
    });

    if (typeof input.password === 'string' && input.password.trim()) {
      metadata.passwordHash = hashPassword(input.password.trim());
    }

    await this.db.query(
      `INSERT INTO tenant_users(
         id,
         tenant_id,
         email,
         display_name,
         role,
         is_active,
         metadata,
         expires_at,
         evaluation_site_id,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, $7::timestamptz, $8, now(), now())
       ON CONFLICT (tenant_id, email) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         metadata = EXCLUDED.metadata,
         expires_at = EXCLUDED.expires_at,
         evaluation_site_id = EXCLUDED.evaluation_site_id,
         updated_at = now()`,
      [id, tenantId, email, displayName, role, JSON.stringify(metadata), expiresAt ?? null, evaluationSiteId ?? null],
    );

    const users = await this.listForTenant(tenantId);
    const user = users.find((entry) => entry.email === email);
    if (!user) {
      throw new NotFoundException('Tenant user not found after create');
    }

    return user;
  }

  async update(id: string, input: {
    displayName?: string;
    role?: TenantUserRole;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
    password?: string;
    expiresAt?: string | null;
    evaluationSiteId?: string | null;
  }) {
    const normalizedId = resolveSiteKey(id, id);
    if (!normalizedId) {
      throw new BadRequestException('tenantUserId required');
    }

    const current = await this.db.query<TenantUserRow>(
      `SELECT
         id,
         tenant_id,
         email,
         display_name,
         role,
         is_active,
         metadata,
         expires_at,
         evaluation_site_id,
         created_at,
         updated_at
       FROM tenant_users
       WHERE id = $1
       LIMIT 1`,
      [normalizedId],
    );

    const row = current.rows[0];
    if (!row) {
      throw new NotFoundException('Tenant user not found');
    }

    const nextDisplayName = input.displayName?.trim() || row.display_name;
    const nextRole = input.role ? this.normalizeRole(input.role) : this.normalizeRole(row.role);
    const nextIsActive = typeof input.isActive === 'boolean' ? input.isActive : row.is_active;
    const nextExpiresAt =
      input.expiresAt !== undefined ? normalizeExpiresAt(input.expiresAt) : row.expires_at;
    const resolvedEvaluationSiteId = await this.resolveEvaluationSiteId({
      tenantId: row.tenant_id,
      role: nextRole,
      evaluationSiteId: input.evaluationSiteId,
    });
    const nextEvaluationSiteId =
      resolvedEvaluationSiteId !== undefined ? resolvedEvaluationSiteId : row.evaluation_site_id;
    if (nextRole !== 'viewer' && nextEvaluationSiteId) {
      throw new BadRequestException('evaluationSiteId requires role viewer');
    }
    const nextMetadata =
      input.metadata !== undefined ? normalizeRecord(input.metadata) : normalizeRecord(row.metadata);

    if (typeof input.password === 'string' && input.password.trim()) {
      nextMetadata.passwordHash = hashPassword(input.password.trim());
    }

    await this.db.query(
      `UPDATE tenant_users
       SET display_name = $2,
           role = $3,
           is_active = $4,
           metadata = $5::jsonb,
           expires_at = $6::timestamptz,
           evaluation_site_id = $7,
           updated_at = now()
       WHERE id = $1`,
      [
        normalizedId,
        nextDisplayName,
        nextRole,
        nextIsActive,
        JSON.stringify(nextMetadata),
        nextExpiresAt ?? null,
        nextEvaluationSiteId ?? null,
      ],
    );

    const users = await this.listForTenant(row.tenant_id);
    const updated = users.find((entry) => entry.id === normalizedId);
    if (!updated) {
      throw new NotFoundException('Tenant user not found after update');
    }

    return updated;
  }

  async authenticate(input: {
    tenantId: string;
    email: string;
    password: string;
  }) {
    const tenantId = await this.tenants.ensureTenantExists(input.tenantId);
    const email = normalizeEmail(input.email);

    if (!email || typeof input.password !== 'string' || !input.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const res = await this.db.query<TenantUserRow>(
      `SELECT
         id,
         tenant_id,
         email,
         display_name,
         role,
         is_active,
         metadata,
         expires_at,
         evaluation_site_id,
         created_at,
         updated_at
       FROM tenant_users
       WHERE tenant_id = $1
         AND email = $2
       LIMIT 1`,
      [tenantId, email],
    );

    const row = res.rows[0];
    if (!row || !row.is_active || isExpired(row.expires_at)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const metadata = normalizeRecord(row.metadata);
    const passwordHash = typeof metadata.passwordHash === 'string' ? metadata.passwordHash : '';
    if (!passwordHash || !verifyPasswordHash(input.password, passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = this.normalizeTenantUser(row);
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      expiresAt: user.expiresAt,
    };
  }
}
