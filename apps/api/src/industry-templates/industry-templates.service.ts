import { BadRequestException, Injectable } from '@nestjs/common';
import {
  getIndustryTemplate,
  listIndustryTemplates,
} from './industry-template-registry';
import { WidgetAdminSiteService } from '../modules/widget/services/widget-admin-site.service';
import { SiteModulesService } from '../site-modules/site-modules.service';

@Injectable()
export class IndustryTemplatesService {
  constructor(
    private readonly widgetSites: WidgetAdminSiteService,
    private readonly siteModules: SiteModulesService,
  ) {}

  listTemplates() {
    return listIndustryTemplates();
  }

  async applyTemplate(siteId: string, templateKey: string) {
    const template = getIndustryTemplate(templateKey);
    if (!template) {
      throw new BadRequestException('Unknown industry template');
    }

    await this.widgetSites.updateWidgetConfig(siteId, {
      industry: template.key,
      setupGoal: template.setupGoal,
      systemPrompt: template.systemPrompt,
      suggestedQuestionsByPath: template.recommendedQuestions,
    });

    await this.widgetSites.updateBranding(siteId, {
      welcomeMessage: template.welcomeMessage,
    });

    await this.siteModules.updateForSite(siteId, template.modules);

    return {
      siteId,
      templateKey: template.key,
      applied: true,
      template,
    };
  }
}
