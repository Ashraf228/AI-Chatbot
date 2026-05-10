import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { randomBytes, randomUUID } from 'crypto';
import { SiteConfigInput } from './dto';
import { resolveSiteKey } from './site-key';
import { TenantsService } from '../tenants/tenants.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { UsageLimitService } from '../billing/usage-limit.service';

type SiteRow = {
  id: string;
  site_key: string;
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

@Injectable()
export class SitesService {
  constructor(
    private db: PrismaService,
    private readonly tenants: TenantsService,
    private readonly auditLogs: AuditLogService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  private normalizeSite(row: SiteRow | null): NormalizedSiteRow | null {
    if (!row) {
      return null;
    }

    const config = parseSiteConfig(row.config);
    const configuredSiteKey =
      typeof row.site_key === 'string' && row.site_key.trim().length > 0
        ? row.site_key.trim()
        : typeof config.siteKey === 'string'
          ? config.siteKey.trim()
          : '';

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
      WHERE site_key = $1
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
    const tenantId = await this.tenants.ensureTenantExists(params.tenantId.trim());
    await this.usageLimits.assertWithinLimit(tenantId, 'maxSites');
    const id = params.id?.trim() || randomUUID();
    const config = parseSiteConfig(params.config);
    const resolvedSiteKey =
      resolveSiteKey(params.siteKey, name) ||
      `site-${id.slice(0, 8)}`;

    await this.assertUniqueSiteKey(resolvedSiteKey, id);

    const publicKey = 'pk_' + randomBytes(32).toString('hex');
    const { siteKey: _legacySiteKey, ...nextConfig } = config as SiteConfigInput & {
      siteKey?: unknown;
    };

    await this.db.query(
      `INSERT INTO sites(id, site_key, tenant_id, name, allowed_domains, public_key, config)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         site_key=EXCLUDED.site_key,
         tenant_id=EXCLUDED.tenant_id,
         name=EXCLUDED.name,
         allowed_domains=EXCLUDED.allowed_domains,
         config=(sites.config - 'siteKey') || EXCLUDED.config`,
      [id, resolvedSiteKey, tenantId, name, params.allowedDomains, publicKey, nextConfig],
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

  async updateSite(
    siteId: string,
    params: {
      siteKey?: string;
      name?: string;
      allowedDomains?: string[];
    },
  ) {
    const site = await this.getSite(siteId);
    if (!site) {
      throw new BadRequestException('site not found');
    }

    const nextName = typeof params.name === 'string' && params.name.trim() ? params.name.trim() : site.name;
    const nextSiteKey =
      typeof params.siteKey === 'string' && params.siteKey.trim()
        ? resolveSiteKey(params.siteKey, site.site_key) || site.site_key
        : site.site_key;
    const nextAllowedDomains =
      Array.isArray(params.allowedDomains) && params.allowedDomains.length > 0
        ? params.allowedDomains.map((entry) => entry.trim()).filter(Boolean)
        : site.allowed_domains;

    await this.assertUniqueSiteKey(nextSiteKey, siteId);

    await this.db.query(
      `UPDATE sites
       SET name = $2,
           site_key = $3,
           allowed_domains = $4
       WHERE id = $1`,
      [siteId, nextName, nextSiteKey, nextAllowedDomains],
    );

    return this.getSite(siteId);
  }

  async markLive(
    siteId: string,
    actor: { actorId?: string; actorRole?: string } = {},
  ) {
    const site = await this.getSite(siteId);
    if (!site) {
      throw new BadRequestException('site not found');
    }

    const goLiveAt = new Date().toISOString();
    await this.db.query(
      `UPDATE sites
       SET config = COALESCE(config, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [
        siteId,
        JSON.stringify({
          goLiveAt,
          isActive: true,
          lifecycleStatus: 'live',
        }),
      ],
    );

    await this.auditLogs.record({
      siteId,
      tenantId: site.tenant_id,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: 'go_live',
      resourceType: 'site',
      resourceId: siteId,
      metadata: { goLiveAt, lifecycleStatus: 'live' },
    });

    return this.getSite(siteId);
  }
}
