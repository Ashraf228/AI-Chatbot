import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

function secureCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminKey = request.headers['x-admin-key'];
    const dashboardToken = request.headers['x-dashboard-token'];
    const expectedAdminKey = process.env.ADMIN_KEY?.trim();
    const expectedDashboardToken = process.env.DASHBOARD_INTERNAL_TOKEN?.trim();

    const hasAdminKey =
      typeof adminKey === 'string' &&
      !!expectedAdminKey &&
      expectedAdminKey.length >= 32 &&
      secureCompare(adminKey, expectedAdminKey);

    const hasDashboardToken =
      typeof dashboardToken === 'string' &&
      !!expectedDashboardToken &&
      expectedDashboardToken.length >= 32 &&
      secureCompare(dashboardToken, expectedDashboardToken);

    if (!hasAdminKey && !hasDashboardToken) {
      throw new UnauthorizedException('admin key required');
    }

    return true;
  }
}
