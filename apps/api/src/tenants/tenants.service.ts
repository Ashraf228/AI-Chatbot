import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { resolveSiteKey } from '../sites/site-key';

type TenantRow = {
  id: string;
  name: string;
  created_at: string;
};

@Injectable()
export class TenantsService {
  constructor(private readonly db: PrismaService) {}

  private normalizeTenantName(id: string, name?: string) {
    return name?.trim() || id;
  }

  private normalizeTenantId(id: string) {
    const normalized = resolveSiteKey(id);
    if (!normalized) {
      throw new BadRequestException('tenantId required');
    }

    return normalized;
  }

  async listTenants() {
    const res = await this.db.query<TenantRow>(
      `SELECT id, name, created_at
       FROM tenants
       ORDER BY name ASC, id ASC`,
    );

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    }));
  }

  async createTenant(params: { id: string; name?: string }) {
    const id = this.normalizeTenantId(params.id);
    const name = this.normalizeTenantName(id, params.name);

    await this.db.query(
      `INSERT INTO tenants(id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name`,
      [id, name],
    );

    return this.getTenant(id);
  }

  async getTenant(id: string) {
    const normalizedId = this.normalizeTenantId(id);
    const res = await this.db.query<TenantRow>(
      `SELECT id, name, created_at
       FROM tenants
       WHERE id = $1
       LIMIT 1`,
      [normalizedId],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    };
  }

  async ensureTenantExists(id: string) {
    const normalizedId = this.normalizeTenantId(id);
    const res = await this.db.query<{ id: string }>(
      `SELECT id
       FROM tenants
       WHERE id = $1
       LIMIT 1`,
      [normalizedId],
    );

    if (!res.rows[0]) {
      throw new BadRequestException('tenantId not found');
    }

    return normalizedId;
  }
}
