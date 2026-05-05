import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  created_at: string;
  updated_at: string;
};

function normalizeRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
         created_at,
         updated_at
       FROM tenant_users
       WHERE tenant_id = $1
       ORDER BY display_name ASC, email ASC`,
      [normalizedTenantId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      displayName: row.display_name,
      role: this.normalizeRole(row.role),
      isActive: row.is_active,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async create(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role?: TenantUserRole;
    metadata?: Record<string, unknown>;
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

    await this.db.query(
      `INSERT INTO tenant_users(
         id,
         tenant_id,
         email,
         display_name,
         role,
         is_active,
         metadata,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, now(), now())
       ON CONFLICT (tenant_id, email) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [id, tenantId, email, displayName, role, JSON.stringify(normalizeRecord(input.metadata))],
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
    const nextMetadata =
      input.metadata !== undefined ? normalizeRecord(input.metadata) : normalizeRecord(row.metadata);

    await this.db.query(
      `UPDATE tenant_users
       SET display_name = $2,
           role = $3,
           is_active = $4,
           metadata = $5::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [normalizedId, nextDisplayName, nextRole, nextIsActive, JSON.stringify(nextMetadata)],
    );

    const users = await this.listForTenant(row.tenant_id);
    const updated = users.find((entry) => entry.id === normalizedId);
    if (!updated) {
      throw new NotFoundException('Tenant user not found after update');
    }

    return updated;
  }
}
