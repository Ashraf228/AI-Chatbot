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

export type CustomerStatusCode =
  | 'setup_incomplete'
  | 'knowledge_missing'
  | 'design_missing'
  | 'embed_missing'
  | 'privacy_missing'
  | 'test_required'
  | 'ready_for_live'
  | 'live'
  | 'paused'
  | 'error';

export type LifecycleStatus =
  | 'draft'
  | 'setup_incomplete'
  | 'ready_for_test'
  | 'ready_for_live'
  | 'live'
  | 'paused'
  | 'error';

type SiteConfig = {
  brandColor?: string;
  welcomeMessage?: string;
  logoUrl?: string;
  industry?: string;
  setupGoal?: string;
  isActive?: boolean;
  privacyUrl?: string;
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
      siteId,
      name: site.name,
      allowedDomains: site.allowed_domains || [],
      siteKey: site.site_key,
      knowledgeCount,
      config,
    });

    return {
      siteId,
      ...status,
      status: status.label,
      knowledgeCount,
      industry: config.industry || '',
      setupGoal: config.setupGoal || '',
      lastTestedAt: config.lastTestedAt || '',
      goLiveAt: config.goLiveAt || '',
    };
  }

  private compute(input: {
    siteId: string;
    name: string;
    allowedDomains: string[];
    siteKey: string;
    knowledgeCount: number;
    config: SiteConfig;
  }) {
    const basicsDone = Boolean(input.name.trim() && input.config.industry && input.config.setupGoal);
    const domainDone = input.allowedDomains.length > 0;
    const knowledgeDone = input.knowledgeCount > 0;
    const designDone = isDesignConfigured(input.config);
    const embedDone = Boolean(input.siteKey && domainDone);
    const privacyDone = Boolean(input.config.privacyUrl);
    const testDone = Boolean(input.config.lastTestedAt);
    const missingSteps = [
      !basicsDone ? 'basics' : '',
      !domainDone ? 'domain' : '',
      !knowledgeDone ? 'knowledge' : '',
      !designDone ? 'design' : '',
      !embedDone ? 'embed' : '',
      !privacyDone ? 'privacy_url' : '',
      !testDone ? 'test_chat' : '',
    ].filter(Boolean);
    const totalChecks = 7;
    const completedChecks = totalChecks - missingSteps.length;
    const progress = Math.round((completedChecks / totalChecks) * 100);
    const isLiveReady = missingSteps.length === 0;

    if (input.config.goLiveAt) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'live',
        label: 'Live',
        severity: 'success',
        progress: 100,
        lifecycleStatus: input.config.isActive === false ? 'paused' : 'live',
        isLiveReady: true,
        missingSteps: [],
      });
    }

    if (input.config.isActive === false) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'paused',
        label: 'Pausiert',
        severity: 'warning',
        progress,
        lifecycleStatus: 'paused',
        isLiveReady,
        missingSteps,
      });
    }

    if (!basicsDone || !domainDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'setup_incomplete',
        label: 'Setup unvollständig',
        severity: 'warning',
        progress,
        lifecycleStatus: basicsDone ? 'ready_for_test' : 'setup_incomplete',
        isLiveReady: false,
        missingSteps,
      });
    }

    if (!knowledgeDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'knowledge_missing',
        label: 'Wissen fehlt',
        severity: 'warning',
        progress,
        lifecycleStatus: 'setup_incomplete',
        isLiveReady: false,
        missingSteps,
      });
    }

    if (!designDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'design_missing',
        label: 'Design fehlt',
        severity: 'warning',
        progress,
        lifecycleStatus: 'setup_incomplete',
        isLiveReady: false,
        missingSteps,
      });
    }

    if (!embedDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'embed_missing',
        label: 'Einbindung fehlt',
        severity: 'warning',
        progress,
        lifecycleStatus: 'setup_incomplete',
        isLiveReady: false,
        missingSteps,
      });
    }

    if (!privacyDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'privacy_missing',
        label: 'Datenschutz-URL fehlt',
        severity: 'warning',
        progress,
        lifecycleStatus: 'ready_for_test',
        isLiveReady: false,
        missingSteps,
      });
    }

    if (!testDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'test_required',
        label: 'Test erforderlich',
        severity: 'warning',
        progress,
        lifecycleStatus: 'ready_for_test',
        isLiveReady: false,
        missingSteps,
      });
    }

    return this.toStatus({
      siteId: input.siteId,
      code: 'ready_for_live',
      label: 'Bereit für Live',
      severity: 'success',
      progress,
      lifecycleStatus: 'ready_for_live',
      isLiveReady,
      missingSteps,
    });
  }

  private toStatus(input: {
    siteId: string;
    code: CustomerStatusCode;
    label: CustomerOverallStatus | 'Pausiert' | 'Datenschutz-URL fehlt';
    severity: 'info' | 'warning' | 'success' | 'error';
    progress: number;
    lifecycleStatus: LifecycleStatus;
    isLiveReady: boolean;
    missingSteps: string[];
  }) {
    return {
      code: input.code,
      label: input.label,
      severity: input.severity,
      progress: input.progress,
      lifecycleStatus: input.lifecycleStatus,
      isLiveReady: input.isLiveReady,
      missingSteps: input.missingSteps,
      nextAction: this.resolveNextAction(input.siteId, input.missingSteps, input.code),
    };
  }

  private resolveNextAction(siteId: string, missingSteps: string[], code: CustomerStatusCode) {
    const firstMissing = missingSteps[0] || '';
    const actions: Record<string, { label: string; href: string }> = {
      basics: { label: 'Setup fortsetzen', href: `/sites/${siteId}/setup` },
      domain: { label: 'Domain setzen', href: `/sites/${siteId}/setup#setup-step-basics` },
      knowledge: { label: 'Wissen hinzufügen', href: `/sites/${siteId}/knowledge` },
      design: { label: 'Design prüfen', href: `/sites/${siteId}/branding` },
      embed: { label: 'Einbindung vorbereiten', href: `/sites/${siteId}/embedding` },
      privacy_url: { label: 'Datenschutz-URL setzen', href: `/sites/${siteId}/branding` },
      test_chat: { label: 'Test-Chat durchführen', href: `/sites/${siteId}#customer-test-chat` },
    };

    if (actions[firstMissing]) {
      return actions[firstMissing];
    }

    if (code === 'ready_for_live') {
      return { label: 'Live schalten', href: `/sites/${siteId}/setup#setup-step-live` };
    }

    if (code === 'live') {
      return { label: 'Betrieb prüfen', href: `/sites/${siteId}` };
    }

    return { label: 'Setup prüfen', href: `/sites/${siteId}/setup` };
  }
}
