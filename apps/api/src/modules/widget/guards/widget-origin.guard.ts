import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { WidgetSecurityService } from '../services/widget-security.service';

@Injectable()
export class WidgetOriginGuard implements CanActivate {
  constructor(private readonly widgetSecurityService: WidgetSecurityService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const origin = request.headers.origin as string | undefined;
    const referer = request.headers.referer as string | undefined;
    const siteKey =
      request.body?.siteKey || request.query?.siteKey || request.headers['x-site-key'];

    return this.widgetSecurityService.isAllowedOrigin(String(siteKey || ''), origin, referer);
  }
}
