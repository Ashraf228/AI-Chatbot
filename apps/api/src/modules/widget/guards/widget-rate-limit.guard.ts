import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { WidgetSecurityService } from '../services/widget-security.service';

@Injectable()
export class WidgetRateLimitGuard implements CanActivate {
  constructor(private readonly widgetSecurityService: WidgetSecurityService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const route = String(request.route?.path || 'unknown');
    const siteKey = String(
      request.body?.siteKey || request.query?.siteKey || request.headers['x-site-key'] || 'unknown',
    );
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      'unknown';

    const result = await this.widgetSecurityService.checkRateLimit(
      `${siteKey}:${route}:${String(ip)}`,
      route.includes('chat') ? 30 : 60,
      60_000,
    );
    return result.allowed;
  }
}
