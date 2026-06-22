import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { REQUIRED_DASHBOARD_ROLES, type DashboardRole } from './dashboard-rbac';

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
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminKey = request.headers['x-admin-key'];
    const dashboardToken = request.headers['x-dashboard-token'];
    const dashboardRole = request.headers['x-dashboard-role'];
    const dashboardActor = request.headers['x-dashboard-actor'];
    const dashboardTenant = request.headers['x-dashboard-tenant'];
    const dashboardTenantUser = request.headers['x-dashboard-tenant-user'];
    const dashboardSessionExpires = request.headers['x-dashboard-session-expires'];
    const expectedAdminKey = process.env.ADMIN_KEY?.trim();
    const expectedDashboardToken = process.env.DASHBOARD_INTERNAL_TOKEN?.trim();
    const requiredRoles =
      this.reflector.getAllAndOverride<DashboardRole[]>(REQUIRED_DASHBOARD_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

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

    if (hasAdminKey) {
      request.dashboardAuth = {
        role: 'admin',
        actorId: 'admin-key',
        tenantId: null,
        authMode: 'admin-key',
      };
      return true;
    }

    if (typeof dashboardRole === 'string' && !['admin', 'operator', 'customer', 'viewer'].includes(dashboardRole)) {
      throw new UnauthorizedException('dashboard role required');
    }

    if (dashboardRole === 'viewer' && requiredRoles.length === 0) {
      throw new ForbiddenException('insufficient dashboard role');
    }

    if (requiredRoles.length > 0 && typeof dashboardRole !== 'string') {
      throw new UnauthorizedException('dashboard role required');
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(dashboardRole as DashboardRole)) {
      throw new ForbiddenException('insufficient dashboard role');
    }

    request.dashboardAuth = {
      role: typeof dashboardRole === 'string' ? dashboardRole : 'operator',
      actorId: typeof dashboardActor === 'string' ? dashboardActor : 'dashboard',
      tenantId: typeof dashboardTenant === 'string' ? dashboardTenant : null,
      tenantUserId: typeof dashboardTenantUser === 'string' ? dashboardTenantUser : null,
      sessionExpiresAt: typeof dashboardSessionExpires === 'string' ? dashboardSessionExpires : null,
      authMode: 'dashboard-token',
    };

    return true;
  }
}
