import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from './sites.service';

export type CustomerOverallStatus =
  | 'Setup unvollständig'
  | 'Wissen fehlt'
  | 'Design fehlt'
  | 'Einbindung fehlt'
  | 'Test erforderlich'
  | 'Bereit für Live'
  | 'Live'
  | 'Fehler';

type SiteConfig = {
  brandColor?: string;
  welcomeMessage?: string;
  logoUrl?: string;
  industry?: string;
  setupGoal?: string;
  lastTestedAt?: string;
  goLiveAt?: string;
};

function parseConfig(value: unknown): SiteConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as SiteConfig;
}

function isDesignConfigured(config: SiteConfig) {
  return Boolean(
    config.logoUrl ||
      (config.brandColor && config.brandColor !== '#b55400') ||
      (config.welcomeMessage && config.welcomeMessage !== 'Hi! Wie kann ich helfen?'),
  );
}

@Injectable()
export class SiteStatusService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
  ) {}

  async resolveStatus(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('site not found');
    }

    const config = parseConfig(site.config);
    const knowledge = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM documents
       WHERE site_id = $1`,
      [siteId],
    );
    const knowledgeCount = Number(knowledge.rows[0]?.count || 0);

    const status = this.compute({
      name: site.name,
      allowedDomains: site.allowed_domains || [],
      siteKey: site.site_key,
      knowledgeCount,
      config,
    });

    return {
      siteId,
      status,
      knowledgeCount,
      industry: config.industry || '',
      setupGoal: config.setupGoal || '',
      lastTestedAt: config.lastTestedAt || '',
      goLiveAt: config.goLiveAt || '',
    };
  }

  private compute(input: {
    name: string;
    allowedDomains: string[];
    siteKey: string;
    knowledgeCount: number;
    config: SiteConfig;
  }): CustomerOverallStatus {
    if (input.config.goLiveAt) {
      return 'Live';
    }

    const basicsDone = Boolean(
      input.name.trim() &&
        input.allowedDomains.length > 0 &&
        input.config.industry &&
        input.config.setupGoal,
    );

    if (!basicsDone) {
      return 'Setup unvollständig';
    }

    if (input.knowledgeCount === 0) {
      return 'Wissen fehlt';
    }

    if (!isDesignConfigured(input.config)) {
      return 'Design fehlt';
    }

    if (!input.siteKey || input.allowedDomains.length === 0) {
      return 'Einbindung fehlt';
    }

    if (!input.config.lastTestedAt) {
      return 'Test erforderlich';
    }

    return 'Bereit für Live';
  }
}
