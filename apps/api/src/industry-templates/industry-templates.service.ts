import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IndustryTemplate,
  getIndustryTemplate,
  listIndustryTemplates,
} from './industry-template-registry';
import { WidgetAdminSiteService } from '../modules/widget/services/widget-admin-site.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { PrismaService } from '../db/prisma.service';

type SetupGoal = 'lead_capture' | 'support' | 'product_advice' | 'appointments';

function isSetupGoal(value: string): value is SetupGoal {
  return ['lead_capture', 'support', 'product_advice', 'appointments'].includes(value);
}

@Injectable()
export class IndustryTemplatesService {
  constructor(
    private readonly widgetSites: WidgetAdminSiteService,
    private readonly siteModules: SiteModulesService,
    private readonly db: PrismaService,
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
      welcomeMessage:
        mode === 'fill_missing_only' && site.welcomeMessage && site.welcomeMessage !== 'Hi! Wie kann ich helfen?'
          ? site.welcomeMessage
          : template.welcomeMessage,
    });

    await this.siteModules.updateForSite(
      siteId,
      mode === 'fill_missing_only'
        ? await this.buildMissingOnlyModules(siteId, template)
        : template.modules,
    );
    await this.writeAuditLog({
      siteId,
      tenantId: site.tenantId,
      actorId: input.appliedBy || 'dashboard',
      actorRole: input.actorRole || 'admin',
      template,
      mode,
      appliedAt,
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
      systemPrompt: fillMissingOnly && site.systemPrompt ? site.systemPrompt : template.systemPrompt,
      suggestedQuestionsByPath:
        fillMissingOnly && Object.keys(site.suggestedQuestionsByPath || {}).length > 0
          ? site.suggestedQuestionsByPath
          : template.recommendedQuestions,
      tone: fillMissingOnly && site.tone ? site.tone : template.tone,
      ctaText: fillMissingOnly && site.ctaText ? site.ctaText : template.ctaText,
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

    return template.modules.map((templateModule) => {
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

  private async writeAuditLog(input: {
    siteId: string;
    tenantId: string;
    actorId: string;
    actorRole: string;
    template: IndustryTemplate;
    mode: string;
    appliedAt: string;
  }) {
    await this.db.query(
      `INSERT INTO audit_logs(
         id, site_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
      [
        randomUUID(),
        input.siteId,
        input.tenantId,
        input.actorId,
        input.actorRole,
        'template.applied',
        'industry_template',
        input.template.key,
        JSON.stringify({
          templateId: input.template.key,
          templateVersion: input.template.version,
          mode: input.mode,
          appliedAt: input.appliedAt,
        }),
      ],
    );
  }
}
