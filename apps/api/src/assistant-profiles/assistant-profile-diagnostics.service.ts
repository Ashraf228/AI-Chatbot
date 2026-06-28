import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { SitesService } from '../sites/sites.service';
import { AssistantProfileResolverService } from './assistant-profile-resolver.service';
import { AssistantProfile } from './assistant-profile.types';

type SiteModuleDiagnostics = {
  key: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function enabledDeliveryChannels(profile: AssistantProfile) {
  return Object.entries(profile.deliveryChannels).map(([type, channel]) => ({
    type,
    enabled: Boolean(channel?.enabled),
    status: channel?.enabled ? 'configured' : 'inactive',
  }));
}

function publicLegacySourceLabel(value: string) {
  switch (value) {
    case 'assistantProfile':
      return 'neues KI-Mitarbeiter-Profil';
    case 'lead-sales.intakeFlow':
      return 'bestehender Anfrage-Flow';
    case 'conversationFlow':
      return 'bestehender Gesprächsablauf';
    case 'botType':
      return 'bestehender Bot-Typ';
    case 'industry':
      return 'bestehende Branchenvorlage';
    case 'templateId':
      return 'bestehende Vorlage';
    default:
      return 'Standardprofil';
  }
}

@Injectable()
export class AssistantProfileDiagnosticsService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly siteModules: SiteModulesService,
    private readonly resolver: AssistantProfileResolverService,
  ) {}

  async getDiagnostics(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new NotFoundException('Site not found');
    }

    const modules = await this.siteModules.listForSite(siteId) as SiteModuleDiagnostics[];
    const moduleConfigs = Object.fromEntries(modules.map((module) => [module.key, module.config || {}]));
    const siteConfig = asRecord(site.config);
    const profile = this.resolver.resolve({
      siteConfig,
      moduleConfigs,
    });
    const readyKnowledgeCount = await this.countReadyKnowledgeSources(siteId);
    const warnings = this.buildWarnings(siteConfig, moduleConfigs, profile, readyKnowledgeCount);

    return {
      assistantProfileDebug: {
        profileKey: profile.profileKey,
        profileVersion: profile.profileVersion,
        assistantName: profile.assistantName,
        role: profile.role,
        tone: profile.tone,
        answerStyle: profile.answerStyle,
        knowledgeMode: profile.knowledgeMode,
        legacySource: profile.legacySource,
        sourceLabel: publicLegacySourceLabel(profile.legacySource),
        enabledTasks: profile.enabledTasks,
        enabledAgents: profile.enabledAgents,
        requiredFields: profile.requiredFields.map((field) => ({
          key: field.key,
          label: field.label,
          required: field.required,
          source: field.source || profile.legacySource,
        })),
        handoffRules: {
          enabled: profile.handoffRules.enabled,
          requireAllFields: profile.handoffRules.requireAllFields,
          summarizeBeforeHandoff: profile.handoffRules.summarizeBeforeHandoff,
          handoffWhenUncertain: profile.handoffRules.handoffWhenUncertain,
        },
        deliveryChannels: enabledDeliveryChannels(profile),
        warnings,
        migrationHints: this.buildMigrationHints(profile),
      },
    };
  }

  private async countReadyKnowledgeSources(siteId: string) {
    const res = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM knowledge_sources
       WHERE site_id = $1
         AND is_active IS DISTINCT FROM false
         AND sync_status = 'ready'`,
      [siteId],
    );
    return Number(res.rows[0]?.count || 0);
  }

  private buildWarnings(
    siteConfig: Record<string, unknown>,
    moduleConfigs: Record<string, Record<string, unknown>>,
    profile: AssistantProfile,
    readyKnowledgeCount: number,
  ) {
    const warnings: string[] = [];
    const leadSalesConfig = asRecord(moduleConfigs['lead-sales']);

    if (Object.keys(asRecord(siteConfig.conversationFlow)).length > 0) {
      warnings.push('Legacy conversationFlow aktiv');
    }

    if (Object.keys(asRecord(leadSalesConfig.intakeFlow)).length > 0) {
      warnings.push('lead-sales.intakeFlow wird bevorzugt');
    }

    if (typeof siteConfig.botType === 'string' && siteConfig.botType.trim()) {
      warnings.push('botType ist deprecated');
    }

    if (readyKnowledgeCount === 0) {
      warnings.push('Keine Wissensbasis erkannt');
    }

    if (!profile.handoffRules.enabled) {
      warnings.push('Keine Übergabe-Regel konfiguriert');
    }

    if (profile.enabledAgents.length === 0) {
      warnings.push('Keine Agenten aktiviert');
    }

    if (profile.legacySource !== 'assistantProfile') {
      warnings.push('Profil stammt aus Legacy-Mapping');
    }

    return warnings;
  }

  private buildMigrationHints(profile: AssistantProfile) {
    const hints = [
      'Neues AssistantProfile künftig als neutrale Assistant-Konfiguration speichern.',
      'Public Widget-, Branding-, Domain- und Datenschutzfelder in sites.config belassen.',
    ];

    if (profile.legacySource !== 'assistantProfile') {
      hints.unshift('Bestehende Legacy-Konfiguration kann in ein versioniertes AssistantProfile migriert werden.');
    }

    return hints;
  }
}
