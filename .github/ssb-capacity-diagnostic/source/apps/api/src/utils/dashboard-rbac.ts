import { SetMetadata } from '@nestjs/common';

export type DashboardRole = 'admin' | 'operator' | 'customer' | 'viewer';

export const REQUIRED_DASHBOARD_ROLES = 'requiredDashboardRoles';

export function RequireDashboardRoles(...roles: DashboardRole[]) {
  return SetMetadata(REQUIRED_DASHBOARD_ROLES, roles);
}
