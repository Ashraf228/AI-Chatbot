import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { SitesService } from '../sites/sites.service';
import { AssistantProfileDiagnosticsService } from './assistant-profile-diagnostics.service';
import { AssistantProfileResolverService } from './assistant-profile-resolver.service';
import { AssistantProfile, AssistantProfileLegacySource, ConversationEngineConfig } from './assistant-profile.types';

type SiteModulePreview = {
  key: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
};

type PreviewChange = {
  type: 'mapped' | 'created' | 'unchanged' | 'deprecated';
  from?: string;
  to?: string;
  description: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim())
    : [];
}

function hasKeys(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function publicLegacySourceLabel(value: AssistantProfileLegacySource) {
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

function fieldsFromConversationFlow(flow: Record<string, unknown>) {
  const requiredFields = asStringArray(flow.requiredFields);
  const questionOrder = asStringArray(flow.questionOrder);
  const fields = asStringArray(flow.fields);
  return questionOrder.length > 0 ? questionOrder : requiredFields.length > 0 ? requiredFields : fields;
}

function fieldsFromIntakeFlow(flow: Record<string, unknown>) {
  const requiredFields = asStringArray(flow.requiredFields);
  const questionOrder = asStringArray(flow.questionOrder);
  const fields = asStringArray(flow.fields);
  return questionOrder.length > 0 ? questionOrder : requiredFields.length > 0 ? requiredFields : fields;
}

function sanitizeProfile(profile: AssistantProfile) {
  return {
    ...profile,
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
    deliveryChannels: Object.fromEntries(
      Object.entries(profile.deliveryChannels).map(([type, channel]) => [
        type,
        {
          enabled: Boolean(channel?.enabled),
          status: channel?.enabled ? 'configured' : 'inactive',
        },
      ]),
    ),
    agents: profile.agents.map((agent) => ({
      key: agent.key,
      label: agent.label,
      purpose: agent.purpose,
      enabled: agent.enabled,
      triggerMode: agent.triggerMode,
      allowedActions: agent.allowedActions,
      requiredFields: agent.requiredFields.map((field) => ({
        key: field.key,
        label: field.label,
        required: field.required,
      })),
      escalationRules: agent.escalationRules,
      knowledgeScope: agent.knowledgeScope,
      integrations: agent.integrations,
    })),
  };
}

@Injectable()
export class AssistantProfileMigrationPreviewService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly siteModules: SiteModulesService,
    private readonly resolver: AssistantProfileResolverService,
    private readonly diagnostics: AssistantProfileDiagnosticsService,
  ) {}

  async getMigrationPreview(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new NotFoundException('Site not found');
    }

    const modules = await this.siteModules.listForSite(siteId) as SiteModulePreview[];
    const moduleConfigs = Object.fromEntries(modules.map((module) => [module.key, module.config || {}]));
    const siteConfig = asRecord(site.config);
    const currentProfile = (await this.diagnostics.getDiagnostics(siteId)).assistantProfileDebug;
    const resolvedProfile = this.resolver.resolve({ siteConfig, moduleConfigs });
    const readyKnowledgeCount = await this.countReadyKnowledgeSources(siteId);

    const previewWarnings = this.buildWarnings(siteConfig, moduleConfigs, resolvedProfile, readyKnowledgeCount);
    const blockers = this.buildBlockers(siteConfig, moduleConfigs, resolvedProfile);

    return {
      currentProfile,
      proposedAssistantProfile: sanitizeProfile(resolvedProfile),
      proposedConversationEngineConfig: this.buildConversationEngineConfig(resolvedProfile),
      proposedStorageLocation: 'site_modules[assistant-profile].config.assistantProfile',
      changes: this.buildChanges(siteConfig, moduleConfigs, resolvedProfile),
      warnings: unique([...currentProfile.warnings, ...previewWarnings]),
      blockers,
      reversible: true,
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

  private buildConversationEngineConfig(profile: AssistantProfile): ConversationEngineConfig {
    return {
      ...profile.conversationEngine,
      summarizeBeforeHandoff: profile.handoffRules.summarizeBeforeHandoff,
      handoffWhenUncertain: profile.handoffRules.handoffWhenUncertain,
    };
  }

  private buildChanges(
    siteConfig: Record<string, unknown>,
    moduleConfigs: Record<string, Record<string, unknown>>,
    profile: AssistantProfile,
  ): PreviewChange[] {
    const leadSalesConfig = asRecord(moduleConfigs['lead-sales']);
    const intakeFlow = asRecord(leadSalesConfig.intakeFlow);
    const conversationFlow = asRecord(siteConfig.conversationFlow);
    const changes: PreviewChange[] = [
      {
        type: 'created',
        to: 'assistantProfile',
        description: `Neues neutrales AssistantProfile ${profile.profileKey}@v${profile.profileVersion} würde erzeugt.`,
      },
      {
        type: 'created',
        to: 'conversationEngine',
        description: 'ConversationEngineConfig würde aus Profil- und Übergaberegeln vorgeschlagen.',
      },
      {
        type: 'unchanged',
        from: 'sites.config',
        description: 'Public Widget-, Branding-, Domain- und Datenschutzfelder bleiben unverändert.',
      },
    ];

    if (hasKeys(intakeFlow)) {
      changes.push({
        type: 'mapped',
        from: 'lead-sales.intakeFlow.questionOrder',
        to: 'assistantProfile.requiredFields',
        description: 'Pflichtinformationen würden aus dem bestehenden Anfrage-Flow übernommen.',
      });
      changes.push({
        type: 'deprecated',
        from: 'site_modules.config.lead-sales.intakeFlow',
        to: 'assistantProfile.requiredFields',
        description: 'Der alte Anfrage-Flow wäre nach einer späteren Migration nur noch Legacy-Kompatibilität.',
      });
    }

    if (hasKeys(conversationFlow)) {
      changes.push({
        type: 'mapped',
        from: 'sites.config.conversationFlow',
        to: 'assistantProfile.legacyProfileMapping',
        description: 'Der bestehende Gesprächsablauf würde als Legacy-Mapping abgebildet.',
      });
      changes.push({
        type: 'deprecated',
        from: 'sites.config.conversationFlow',
        to: 'assistantProfile',
        description: 'conversationFlow wäre nach einer späteren Migration deprecated.',
      });
    }

    if (asString(siteConfig.leadNotificationEmail) || typeof siteConfig.leadCaptureEnabled === 'boolean') {
      changes.push({
        type: 'mapped',
        from: 'leadCaptureEnabled / leadNotificationEmail',
        to: 'assistantProfile.deliveryChannels.email',
        description: 'Lead-Zustellung würde als E-Mail-Delivery-Channel ohne Empfängerwert in der Vorschau dargestellt.',
      });
    }

    if (asString(siteConfig.botType) === 'handwerker-first-contact') {
      changes.push({
        type: 'mapped',
        from: 'botType=handwerker-first-contact',
        to: 'profileKey=local-service-first-contact',
        description: 'Der bestehende Handwerker-Bot-Typ würde auf das Legacy-kompatible Profil gemappt.',
      });
    }

    if (profile.enabledTasks.length > 0) {
      changes.push({
        type: 'created',
        from: 'assistantProfile.enabledTasks',
        to: 'assistantProfile.enabledAgents',
        description: 'Aktive Aufgaben würden die vorgeschlagenen Agenten sichtbar machen.',
      });
    }

    return changes;
  }

  private buildWarnings(
    siteConfig: Record<string, unknown>,
    moduleConfigs: Record<string, Record<string, unknown>>,
    profile: AssistantProfile,
    readyKnowledgeCount: number,
  ) {
    const warnings: string[] = [];
    const leadSalesConfig = asRecord(moduleConfigs['lead-sales']);
    const intakeFields = fieldsFromIntakeFlow(asRecord(leadSalesConfig.intakeFlow));
    const conversationFields = fieldsFromConversationFlow(asRecord(siteConfig.conversationFlow));
    const activeLegacySources = [
      hasKeys(asRecord(leadSalesConfig.intakeFlow)) ? 'lead-sales.intakeFlow' : '',
      hasKeys(asRecord(siteConfig.conversationFlow)) ? 'conversationFlow' : '',
      asString(siteConfig.botType) ? 'botType' : '',
      asString(siteConfig.industry) ? 'industry' : '',
      asString(siteConfig.templateId) ? 'templateId' : '',
    ].filter(Boolean);

    if (activeLegacySources.length > 1) {
      warnings.push(`Mehrere Legacy-Quellen aktiv: ${activeLegacySources.join(', ')}`);
    }

    if (intakeFields.length > 0 && conversationFields.length > 0 && intakeFields.join('|') !== conversationFields.join('|')) {
      warnings.push('Widersprüchliche requiredFields zwischen intakeFlow und conversationFlow erkannt.');
    }

    if (siteConfig.leadCaptureEnabled === true && !asString(siteConfig.leadNotificationEmail)) {
      warnings.push('Lead-Erfassung ist aktiv, aber keine E-Mail-Zustellung konfiguriert.');
    }

    if (asString(siteConfig.botType) && !['handwerker-first-contact'].includes(asString(siteConfig.botType))) {
      warnings.push('Unbekannter botType erkannt.');
    }

    if (asString(siteConfig.industry) && ![
      'local-services',
      'local-service-first-contact',
      'local_service',
      'local-service',
      'it-support',
      'ecommerce-shopify',
    ].includes(asString(siteConfig.industry))) {
      warnings.push('Unbekannte industry erkannt.');
    }

    if (hasKeys(asRecord(siteConfig.conversationFlow)) && conversationFields.length === 0) {
      warnings.push('Veraltete oder nicht erkennbare conversationFlow-Struktur erkannt.');
    }

    if (readyKnowledgeCount === 0) {
      warnings.push('Keine Wissensbasis vorhanden.');
    }

    if (profile.enabledTasks.length === 0) {
      warnings.push('Keine aktive Aufgabe ableitbar.');
    }

    return warnings;
  }

  private buildBlockers(
    siteConfig: Record<string, unknown>,
    moduleConfigs: Record<string, Record<string, unknown>>,
    profile: AssistantProfile,
  ) {
    const blockers: string[] = [];
    const leadSalesConfig = asRecord(moduleConfigs['lead-sales']);

    if (
      !hasKeys(siteConfig) &&
      !hasKeys(asRecord(leadSalesConfig.intakeFlow)) &&
      profile.profileKey === 'universal-assistant'
    ) {
      blockers.push('Keine eindeutige Site-Konfiguration gefunden.');
    }

    return blockers;
  }
}
