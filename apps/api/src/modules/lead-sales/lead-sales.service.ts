import { Injectable } from '@nestjs/common';
import { SiteModulesService } from '../../site-modules/site-modules.service';
import {
  DEFAULT_LEAD_SALES_MODULE_CONFIG,
  normalizeLeadSalesModuleConfig,
} from '../../site-modules/module-configs';

@Injectable()
export class LeadSalesService {
  constructor(private readonly siteModules: SiteModulesService) {}

  async getConfigForSite(siteId: string) {
    const modules = await this.siteModules.listForSite(siteId);
    const module = modules.find((entry) => entry.key === 'lead-sales');

    if (!module) {
      return DEFAULT_LEAD_SALES_MODULE_CONFIG;
    }

    return normalizeLeadSalesModuleConfig(module.config);
  }
}
