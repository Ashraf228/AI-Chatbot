import { BadRequestException, Injectable } from '@nestjs/common';
import {
  IndustryTemplate,
  getIndustryTemplate,
  listIndustryTemplates,
} from './industry-template-registry';
import { WidgetAdminSiteService } from '../modules/widget/services/widget-admin-site.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { getSiteModuleDefinition } from '../site-modules/module-registry';
import { AuditLogService } from '../audit-logs/audit-log.service';

type SetupGoal = 'lead_capture' | 'support' | 'product_advice' | 'appointments';

function isSetupGoal(value: string): value is SetupGoal {
  return ['lead_capture', 'support', 'product_advice', 'appointments'].includes(value);
}

@Injectable()
export class IndustryTemplatesService {
  constructor(
    private readonly widgetSites: WidgetAdminSiteService,
    private readonly siteModules: SiteModulesService,
    private readonly auditLogs: AuditLogService,
  ) {}

  listTemplates() {
    return listIndustryTemplates();
  }

  async applyTemplate(
    siteId: string,
    input: {
      templateKey: string;
      mode?: 'fill_missing_only' | 'overwrite';
      appliedBy?: string;
      actorRole?: string;
    },
  ) {
    const templateKey = input.templateKey;
    const template = getIndustryTemplate(templateKey);
    if (!template) {
      throw new BadRequestException('Unknown industry template');
    }
    const mode = input.mode === 'fill_missing_only' ? 'fill_missing_only' : 'overwrite';
    const appliedAt = new Date().toISOString();
    const site = await this.widgetSites.getSite(siteId);

    await this.widgetSites.updateWidgetConfig(
      siteId,
      this.buildWidgetPatch(site, template, {
        mode,
        appliedAt,
        appliedBy: input.appliedBy || 'dashboard',
      }),
    );

    await this.widgetSites.updateBranding(siteId, {
      ...this.buildBrandingPatch(site, template, mode),
    });

    await this.siteModules.updateForSite(
      siteId,
      mode === 'fill_missing_only'
        ? await this.buildMissingOnlyModules(siteId, template)
        : this.filterKnownModules(template.modules),
    );
    await this.auditLogs.record({
      siteId,
      tenantId: site.tenantId,
      actorId: input.appliedBy || 'dashboard',
      actorRole: input.actorRole || 'admin',
      action: 'apply_template',
      resourceType: 'industry_template',
      resourceId: template.key,
      metadata: {
        templateId: template.key,
        templateVersion: template.version,
        mode,
        appliedAt,
      },
    });

    return {
      siteId,
      templateId: template.key,
      templateVersion: template.version,
      appliedAt,
      appliedBy: input.appliedBy || 'dashboard',
      mode,
      applied: true,
      template,
    };
  }

  private buildWidgetPatch(
    site: Awaited<ReturnType<WidgetAdminSiteService['getSite']>>,
    template: IndustryTemplate,
    metadata: {
      mode: 'fill_missing_only' | 'overwrite';
      appliedAt: string;
      appliedBy: string;
    },
  ) {
    const fillMissingOnly = metadata.mode === 'fill_missing_only';
    return {
      industry: fillMissingOnly && site.industry ? site.industry : template.key,
      setupGoal:
        fillMissingOnly && isSetupGoal(site.setupGoal)
          ? site.setupGoal
          : template.setupGoal,
      botType: fillMissingOnly && site.botType ? site.botType : template.botType,
      systemPrompt: fillMissingOnly && site.systemPrompt ? site.systemPrompt : template.systemPrompt,
      suggestedQuestionsByPath:
        fillMissingOnly && Object.keys(site.suggestedQuestionsByPath || {}).length > 0
          ? site.suggestedQuestionsByPath
          : template.recommendedQuestions,
      conversationFlow:
        fillMissingOnly && Object.keys(site.conversationFlow || {}).length > 0
          ? site.conversationFlow
          : template.conversationFlow,
      tone: fillMissingOnly && site.tone ? site.tone : template.tone,
      ctaText: fillMissingOnly && site.ctaText ? site.ctaText : template.ctaText,
      launcherLabel: fillMissingOnly && site.launcherLabel ? site.launcherLabel : template.launcherLabel,
      reportKpis: fillMissingOnly && site.reportKpis.length > 0 ? site.reportKpis : template.reportKpis,
      topTestQuestions:
        fillMissingOnly && site.topTestQuestions.length > 0
          ? site.topTestQuestions
          : template.topTestQuestions,
      templateId: template.key,
      templateVersion: template.version,
      templateAppliedAt: metadata.appliedAt,
      templateAppliedBy: metadata.appliedBy,
      templateApplyMode: metadata.mode,
    };
  }

  private async buildMissingOnlyModules(siteId: string, template: IndustryTemplate) {
    const currentModules = await this.siteModules.listForSite(siteId);
    const currentByKey = new Map(currentModules.map((module) => [module.key, module]));

    return this.filterKnownModules(template.modules).map((templateModule) => {
      const current = currentByKey.get(templateModule.key);
      if (!current) {
        return templateModule;
      }

      const currentConfig = current.config || {};
      const templateConfig = templateModule.config || {};

      return {
        key: templateModule.key,
        isEnabled: current.isEnabled || templateModule.isEnabled,
        config:
          Object.keys(currentConfig).length > 0
            ? currentConfig
            : templateConfig,
      };
    });
  }

  private filterKnownModules(modules: IndustryTemplate['modules']) {
    return modules.filter((module) => getSiteModuleDefinition(module.key));
  }

  private buildBrandingPatch(
    site: Awaited<ReturnType<WidgetAdminSiteService['getSite']>>,
    template: IndustryTemplate,
    mode: 'fill_missing_only' | 'overwrite',
  ) {
    const fillMissingOnly = mode === 'fill_missing_only';
    const defaults = template.brandingDefaults;

    return {
      brandColor:
        fillMissingOnly && site.brandColor && site.brandColor !== '#b55400'
          ? site.brandColor
          : defaults.brandColor,
      accentColor:
        fillMissingOnly && site.accentColor && site.accentColor !== '#fff0d9'
          ? site.accentColor
          : defaults.accentColor,
      fontFamily:
        fillMissingOnly && site.fontFamily && site.fontFamily !== 'system'
          ? site.fontFamily
          : defaults.fontFamily,
      botName:
        fillMissingOnly && site.botName && site.botName !== 'Service-Assistent'
          ? site.botName
          : defaults.botName || site.botName,
      welcomeMessage:
        fillMissingOnly && site.welcomeMessage && site.welcomeMessage !== 'Hi! Wie kann ich helfen?'
          ? site.welcomeMessage
          : template.welcomeMessage,
    };
  }
}
