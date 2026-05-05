import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';
import {
  getSiteModuleDefinition,
  SITE_MODULE_REGISTRY,
  SiteModuleDefinition,
} from './module-registry';
import { normalizeModuleConfig } from './module-configs';

type SiteModuleRow = {
  site_id: string;
  module_key: string;
  is_enabled: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SiteModulesService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
  ) {}

  private mapRow(
    siteId: string,
    definition: SiteModuleDefinition,
    row?: SiteModuleRow,
  ) {
    return {
      siteId,
      key: definition.key,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      isEnabled: row?.is_enabled ?? Boolean(definition.defaultEnabled),
      config: normalizeModuleConfig(definition.key, row?.config),
      createdAt: row?.created_at ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  }

  async listForSite(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const res = await this.db.query<SiteModuleRow>(
      `SELECT site_id, module_key, is_enabled, config, created_at, updated_at
       FROM site_modules
       WHERE site_id = $1
       ORDER BY module_key ASC`,
      [siteId],
    );

    const rowsByKey = new Map(res.rows.map((row) => [row.module_key, row]));

    return SITE_MODULE_REGISTRY.map((definition) =>
      this.mapRow(siteId, definition, rowsByKey.get(definition.key)),
    );
  }

  async updateForSite(
    siteId: string,
    modules: Array<{
      key: string;
      isEnabled: boolean;
      config?: Record<string, unknown>;
    }>,
  ) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    for (const module of modules) {
      const definition = getSiteModuleDefinition(module.key);
      if (!definition) {
        throw new BadRequestException(`Unknown module key: ${module.key}`);
      }

      await this.db.query(
        `INSERT INTO site_modules(site_id, module_key, is_enabled, config, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, now(), now())
         ON CONFLICT (site_id, module_key) DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           config = EXCLUDED.config,
           updated_at = now()`,
        [
          siteId,
          definition.key,
          module.isEnabled,
          JSON.stringify(normalizeModuleConfig(definition.key, module.config)),
        ],
      );
    }

    return this.listForSite(siteId);
  }
}
