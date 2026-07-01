import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from './sites.service';

export type CustomerOverallStatus =
  | 'Setup unvollständig'
  | 'Wissen fehlt'
  | 'Design fehlt'
  | 'Einbindung fehlt'
  | 'Datenschutz-URL fehlt'
  | 'Test erforderlich'
  | 'Bereit für Live'
  | 'Live'
  | 'Pausiert'
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
  primaryGoal?: string;
  botType?: string;
  knowledgeMode?: 'flexible' | 'grounded' | 'strict';
  systemPrompt?: string;
  ctaText?: string;
  leadCaptureEnabled?: boolean;
  leadNotificationEmail?: string;
  templateId?: string;
  templateAppliedAt?: string;
  assistantProfile?: unknown;
  isActive?: boolean;
  privacyUrl?: string;
  lastTestedAt?: string;
  goLiveAt?: string;
};

export type CustomerStatusStepKey =
  | 'basics'
  | 'template'
  | 'knowledge'
  | 'behavior'
  | 'lead_delivery'
  | 'design'
  | 'embed'
  | 'test'
  | 'live';

export type CustomerStatusStepState = 'complete' | 'incomplete' | 'warning' | 'blocked';

type CustomerStatusAction = {
  key: string;
  label: string;
  href?: string;
};

export type CustomerStatusStep = {
  key: CustomerStatusStepKey;
  label: string;
  status: CustomerStatusStepState;
  missingReason?: string;
  nextAction?: {
    label: string;
    href?: string;
  };
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
       FROM documents d
       LEFT JOIN knowledge_sources ks ON ks.id = d.source_id
       WHERE d.site_id = $1
         AND COALESCE(ks.is_active, true) = true
         AND COALESCE(ks.sync_status, 'ready') = 'ready'`,
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
      setupGoal: config.primaryGoal || config.setupGoal || '',
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
    const domainDone = input.allowedDomains.length > 0;
    const basicsDone = Boolean(input.name.trim() && domainDone);
    const templateDone = Boolean(
      input.config.templateId ||
        input.config.templateAppliedAt ||
        input.config.industry ||
        input.config.assistantProfile ||
        input.config.botType,
    );
    const knowledgeMode = input.config.knowledgeMode || 'flexible';
    const knowledgeDone = input.knowledgeCount > 0 || knowledgeMode !== 'strict';
    const behaviorDone = Boolean(
      (input.config.primaryGoal || input.config.setupGoal) &&
        (input.config.systemPrompt || input.config.ctaText || input.config.welcomeMessage),
    );
    const leadDeliveryDone =
      input.config.leadCaptureEnabled === false || Boolean(input.config.leadNotificationEmail);
    const designVisualDone = isDesignConfigured(input.config);
    const privacyDone = Boolean(input.config.privacyUrl);
    const designDone = Boolean(designVisualDone && privacyDone);
    const embedDone = Boolean(input.siteKey && domainDone);
    const testDone = Boolean(input.config.lastTestedAt);
    const liveDone = Boolean(input.config.goLiveAt && input.config.isActive !== false);
    const preLiveReady = [
      basicsDone,
      templateDone,
      knowledgeDone,
      behaviorDone,
      leadDeliveryDone,
      designDone,
      embedDone,
      testDone,
    ].every(Boolean);
    const steps = this.buildSteps(input.siteId, {
      basicsDone,
      templateDone,
      knowledgeDone,
      behaviorDone,
      leadDeliveryDone,
      designVisualDone,
      privacyDone,
      designDone,
      embedDone,
      testDone,
      liveDone,
      isPaused: input.config.isActive === false,
      preLiveReady,
    });
    const missingSteps = steps
      .filter((step) => step.key !== 'live' && step.status !== 'complete')
      .map((step) => step.key);
    const totalChecks = 8;
    const completedChecks = totalChecks - missingSteps.length;
    const progress = Math.round((completedChecks / totalChecks) * 100);
    const isLiveReady = preLiveReady;

    if (input.config.goLiveAt) {
      return this.toStatus({
        siteId: input.siteId,
        code: input.config.isActive === false ? 'paused' : 'live',
        label: input.config.isActive === false ? 'Pausiert' : 'Live',
        severity: input.config.isActive === false ? 'warning' : 'success',
        progress: 100,
        lifecycleStatus: input.config.isActive === false ? 'paused' : 'live',
        isLiveReady,
        missingSteps,
        steps,
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
        steps,
      });
    }

    if (!basicsDone || !templateDone || !behaviorDone || !leadDeliveryDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'setup_incomplete',
        label: 'Setup unvollständig',
        severity: 'warning',
        progress,
        lifecycleStatus: basicsDone ? 'ready_for_test' : 'setup_incomplete',
        isLiveReady: false,
        missingSteps,
        steps,
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
        steps,
      });
    }

    if (!designVisualDone) {
      return this.toStatus({
        siteId: input.siteId,
        code: 'design_missing',
        label: 'Design fehlt',
        severity: 'warning',
        progress,
        lifecycleStatus: 'setup_incomplete',
        isLiveReady: false,
        missingSteps,
        steps,
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
        steps,
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
        steps,
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
        steps,
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
      steps,
    });
  }

  private toStatus(input: {
    siteId: string;
    code: CustomerStatusCode;
    label: CustomerOverallStatus;
    severity: 'neutral' | 'info' | 'warning' | 'success' | 'error';
    progress: number;
    lifecycleStatus: LifecycleStatus;
    isLiveReady: boolean;
    missingSteps: string[];
    steps: CustomerStatusStep[];
  }) {
    return {
      code: input.code,
      label: input.label,
      severity: input.severity,
      progress: input.progress,
      lifecycleStatus: input.lifecycleStatus,
      isLiveReady: input.isLiveReady,
      missingSteps: input.missingSteps,
      steps: input.steps,
      nextAction: this.resolveNextAction(input.siteId, input.missingSteps, input.code),
    };
  }

  private buildSteps(
    siteId: string,
    checks: {
      basicsDone: boolean;
      templateDone: boolean;
      knowledgeDone: boolean;
      behaviorDone: boolean;
      leadDeliveryDone: boolean;
      designVisualDone: boolean;
      privacyDone: boolean;
      designDone: boolean;
      embedDone: boolean;
      testDone: boolean;
      liveDone: boolean;
      isPaused: boolean;
      preLiveReady: boolean;
    },
  ): CustomerStatusStep[] {
    return [
      this.buildStep({
        key: 'basics',
        label: 'Firma & Domain',
        status: checks.basicsDone ? 'complete' : 'incomplete',
        missingReason: checks.basicsDone ? undefined : 'Firmenname oder Domain fehlt.',
        nextAction: {
          label: 'Firma & Domain ergänzen',
          href: `/sites/${siteId}/setup#setup-step-basics`,
        },
      }),
      this.buildStep({
        key: 'template',
        label: 'KI-Mitarbeiter Profil',
        status: checks.templateDone ? 'complete' : 'incomplete',
        missingReason: checks.templateDone ? undefined : 'KI-Mitarbeiter-Profil oder Legacy-Vorlage fehlt.',
        nextAction: {
          label: 'KI-Mitarbeiter prüfen',
          href: `/sites/${siteId}/setup#setup-step-industry`,
        },
      }),
      this.buildStep({
        key: 'knowledge',
        label: 'Wissen',
        status: checks.knowledgeDone ? 'complete' : 'incomplete',
        missingReason: checks.knowledgeDone ? undefined : 'Mindestens eine Wissensquelle fehlt.',
        nextAction: {
          label: 'Wissen hinzufügen',
          href: `/sites/${siteId}/setup#setup-step-knowledge`,
        },
      }),
      this.buildStep({
        key: 'behavior',
        label: 'Gesprächslogik',
        status: checks.behaviorDone ? 'complete' : 'incomplete',
        missingReason: checks.behaviorDone ? undefined : 'Ziel oder Gesprächslogik fehlt.',
        nextAction: {
          label: 'Gesprächslogik prüfen',
          href: `/sites/${siteId}/setup#setup-step-flow`,
        },
      }),
      this.buildStep({
        key: 'lead_delivery',
        label: 'Lead-Zustellung',
        status: checks.leadDeliveryDone ? 'complete' : 'warning',
        missingReason: checks.leadDeliveryDone ? undefined : 'Lead-Empfänger-E-Mail fehlt.',
        nextAction: {
          label: 'Lead-Empfänger-E-Mail setzen',
          href: `/sites/${siteId}/setup#setup-step-delivery`,
        },
      }),
      this.buildStep({
        key: 'design',
        label: 'Design & Datenschutz',
        status: checks.designDone ? 'complete' : checks.designVisualDone ? 'warning' : 'incomplete',
        missingReason: checks.designDone
          ? undefined
          : checks.designVisualDone
            ? 'Datenschutz-URL fehlt.'
            : 'Branding, Farbe oder Begrüßung fehlt.',
        nextAction: {
          label: checks.designVisualDone ? 'Datenschutz-URL setzen' : 'Design prüfen',
          href: `/sites/${siteId}/setup#setup-step-design`,
        },
      }),
      this.buildStep({
        key: 'embed',
        label: 'Einbindung',
        status: checks.embedDone ? 'complete' : 'incomplete',
        missingReason: checks.embedDone ? undefined : 'Einbindungscode oder erlaubte Domain fehlt.',
        nextAction: {
          label: 'Einbindung vorbereiten',
          href: `/sites/${siteId}/embedding`,
        },
      }),
      this.buildStep({
        key: 'test',
        label: 'Test',
        status: checks.testDone ? 'complete' : 'incomplete',
        missingReason: checks.testDone ? undefined : 'Test-Chat wurde noch nicht durchgeführt.',
        nextAction: {
          label: 'Test-Chat durchführen',
          href: `/sites/${siteId}/setup#customer-test-chat`,
        },
      }),
      this.buildStep({
        key: 'live',
        label: 'Live-Schaltung',
        status: checks.liveDone ? 'complete' : checks.isPaused ? 'warning' : checks.preLiveReady ? 'incomplete' : 'blocked',
        missingReason: checks.liveDone
          ? undefined
          : checks.isPaused
            ? 'Kunde ist pausiert.'
            : checks.preLiveReady
              ? 'Kunde ist bereit, aber noch nicht live geschaltet.'
              : 'Vor Live-Schaltung fehlen noch Pflichtschritte.',
        nextAction: {
          label: 'Live schalten',
          href: `/sites/${siteId}/setup#setup-step-live`,
        },
      }),
    ];
  }

  private buildStep(input: CustomerStatusStep): CustomerStatusStep {
    if (input.status === 'complete') {
      return {
        key: input.key,
        label: input.label,
        status: input.status,
      };
    }

    return input;
  }

  private resolveNextAction(
    siteId: string,
    missingSteps: string[],
    code: CustomerStatusCode,
  ): CustomerStatusAction {
    const firstMissing = missingSteps[0] || '';
    const actions: Record<string, CustomerStatusAction> = {
      basics: { key: 'basics', label: 'Firma & Domain ergänzen', href: `/sites/${siteId}/setup#setup-step-basics` },
      template: { key: 'template', label: 'KI-Mitarbeiter prüfen', href: `/sites/${siteId}/setup#setup-step-industry` },
      knowledge: { key: 'knowledge', label: 'Wissen hinzufügen', href: `/sites/${siteId}/setup#setup-step-knowledge` },
      behavior: { key: 'behavior', label: 'Gesprächslogik prüfen', href: `/sites/${siteId}/setup#setup-step-flow` },
      lead_delivery: { key: 'lead_delivery', label: 'Lead-Empfänger-E-Mail setzen', href: `/sites/${siteId}/setup#setup-step-delivery` },
      design: { key: 'design', label: 'Design und Datenschutz prüfen', href: `/sites/${siteId}/setup#setup-step-design` },
      embed: { key: 'embed', label: 'Einbindung vorbereiten', href: `/sites/${siteId}/embedding` },
      test: { key: 'test', label: 'Test-Chat durchführen', href: `/sites/${siteId}/setup#customer-test-chat` },
    };

    if (actions[firstMissing]) {
      return actions[firstMissing];
    }

    if (code === 'ready_for_live') {
      return { key: 'live', label: 'Live schalten', href: `/sites/${siteId}/setup#setup-step-live` };
    }

    if (code === 'live') {
      return { key: 'live', label: 'Betrieb prüfen', href: `/sites/${siteId}` };
    }

    return { key: 'basics', label: 'Setup prüfen', href: `/sites/${siteId}/setup` };
  }
}
