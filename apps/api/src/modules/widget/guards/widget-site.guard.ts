import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WidgetConfigService } from '../services/widget-config.service';

@Injectable()
export class WidgetSiteGuard implements CanActivate {
  constructor(private readonly widgetConfigService: WidgetConfigService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const siteKey =
      request.body?.siteKey || request.query?.siteKey || request.headers['x-site-key'];

    if (typeof siteKey !== 'string' || siteKey.trim().length === 0) {
      return false;
    }

    await this.widgetConfigService.getSiteByKey(siteKey);
    return true;
  }
}
