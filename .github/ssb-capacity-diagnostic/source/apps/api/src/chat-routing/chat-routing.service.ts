import { Injectable } from '@nestjs/common';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { resolveChatRoute } from './chat-route-resolver';

@Injectable()
export class ChatRoutingService {
  constructor(private readonly siteModules: SiteModulesService) {}

  async resolveForSite(input: {
    siteId: string;
    message: string;
    history?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
  }) {
    const modules = await this.siteModules.listForSite(input.siteId);
    const enabledModuleKeys = modules
      .filter((entry) => entry.isEnabled)
      .map((entry) => entry.key);
    const moduleConfigs = Object.fromEntries(
      modules.map((entry) => [entry.key, entry.config || {}]),
    );

    return resolveChatRoute({
      message: input.message,
      history: input.history,
      enabledModuleKeys,
      moduleConfigs,
    });
  }
}
