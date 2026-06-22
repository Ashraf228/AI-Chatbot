import type { DashboardSessionRole } from "./auth-core";

const CUSTOMER_TENANT_ROLES = new Set(["owner", "admin", "manager", "editor"]);

export function mapTenantUserRoleToDashboardRole(role: unknown): Extract<
  DashboardSessionRole,
  "customer" | "viewer"
> | null {
  if (role === "viewer") {
    return "viewer";
  }

  if (typeof role === "string" && CUSTOMER_TENANT_ROLES.has(role)) {
    return "customer";
  }

  return null;
}

export type TenantLoginBackendPayload = {
  id?: string;
  tenantId?: string;
  email?: string;
  displayName?: string;
  role?: string;
  expiresAt?: string | null;
};

export function resolveTenantLoginSessionInput(payload: TenantLoginBackendPayload | null) {
  const role = mapTenantUserRoleToDashboardRole(payload?.role);
  const tenantId = typeof payload?.tenantId === "string" ? payload.tenantId.trim() : "";
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";

  if (!payload || !role || !tenantId || !email) {
    return null;
  }

  return {
    role,
    tenantId,
    tenantUserId: typeof payload.id === "string" ? payload.id : undefined,
    email,
    displayName:
      typeof payload.displayName === "string" && payload.displayName.trim()
        ? payload.displayName.trim()
        : email,
    accountExpiresAt: payload.expiresAt || undefined,
  };
}
