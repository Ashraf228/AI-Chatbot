import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { randomBytes, randomUUID } from 'crypto';
import { SiteConfigInput } from './dto';

type SiteRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  allowed_domains: string[];
  public_key: string | null;
  config: Record<string, unknown>;
  created_at?: string;
};

type NormalizedSiteRow = SiteRow & {
  site_key: string;
};

function parseSiteConfig(config: Record<string, unknown> | null | undefined) {
  return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
}

function slugifySiteKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

@Injectable()
export class SitesService {
  constructor(private db: PrismaService) {}

  private normalizeSite(row: SiteRow | null): NormalizedSiteRow | null {
    if (!row) {
      return null;
    }

    const config = parseSiteConfig(row.config);
    const configuredSiteKey = typeof config.siteKey === 'string' ? config.siteKey.trim() : '';

    return {
      ...row,
      config,
      site_key: configuredSiteKey || row.id,
    };
  }

  private async assertUniqueSiteKey(siteKey: string, excludeId?: string) {
    const values = [siteKey];
    let query = `
      SELECT id
      FROM sites
      WHERE COALESCE(config->>'siteKey', id) = $1
    `;

    if (excludeId) {
      values.push(excludeId);
      query += ` AND id <> $2`;
    }

    query += ` LIMIT 1`;

    const existing = await this.db.query<{ id: string }>(query, values);
    if (existing.rows[0]) {
      throw new BadRequestException('siteKey already exists');
    }
  }

  async createSite(params: {
    id?: string;
    siteKey?: string;
    tenantId: string;
    name: string;
    allowedDomains: string[];
    config?: SiteConfigInput;
  }) {
    const name = params.name.trim();
    const tenantId = params.tenantId.trim();
    const id = params.id?.trim() || randomUUID();
    const config = parseSiteConfig(params.config);
    const resolvedSiteKey =
      slugifySiteKey(params.siteKey || '') ||
      slugifySiteKey(name) ||
      `site-${id.slice(0, 8)}`;

    await this.assertUniqueSiteKey(resolvedSiteKey, id);

    const publicKey = 'pk_' + randomBytes(32).toString('hex');
    const nextConfig = {
      ...config,
      siteKey: resolvedSiteKey,
    };

    await this.db.query(
      `INSERT INTO sites(id, tenant_id, name, allowed_domains, public_key, config)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id=EXCLUDED.tenant_id,
         name=EXCLUDED.name,
         allowed_domains=EXCLUDED.allowed_domains,
         config=sites.config || EXCLUDED.config`,
      [id, tenantId, name, params.allowedDomains, publicKey, nextConfig],
    );

    return this.getSite(id);
  }

  async getSite(id: string): Promise<NormalizedSiteRow | null> {
    const res = await this.db.query<SiteRow>(`SELECT * FROM sites WHERE id=$1`, [id]);
    return this.normalizeSite(res.rows[0] || null);
  }

  async listSites(): Promise<NormalizedSiteRow[]> {
    const res = await this.db.query<SiteRow>(`SELECT * FROM sites ORDER BY created_at DESC`);
    return res.rows
      .map((row) => this.normalizeSite(row))
      .filter((row): row is NormalizedSiteRow => row !== null);
  }
}
