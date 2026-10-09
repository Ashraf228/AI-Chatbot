import { Injectable } from '@nestjs/common';
import { SiteModulesService } from '../../site-modules/site-modules.service';
import {
  DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG,
  normalizePropertyTicketingModuleConfig,
} from '../../site-modules/module-configs';

@Injectable()
export class PropertyTicketingService {
  constructor(private readonly siteModules: SiteModulesService) {}

  async getConfigForSite(siteId: string) {
    const modules = await this.siteModules.listForSite(siteId);
    const module = modules.find((entry) => entry.key === 'property-ticketing');

    if (!module) {
      return DEFAULT_PROPERTY_TICKETING_MODULE_CONFIG;
    }

    return normalizePropertyTicketingModuleConfig(module.config);
  }
}
