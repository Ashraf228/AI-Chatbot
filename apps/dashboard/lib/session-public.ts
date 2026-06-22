import type { DashboardSession } from "@/lib/auth";

export function toPublicSession(session: DashboardSession) {
  return {
    role: session.role,
    displayName: session.displayName || null,
    tenantId:
      session.role === "customer" || session.role === "viewer" ? session.tenantId || null : null,
    sessionExpiresAt: session.sessionExpiresAt,
    accountExpiresAt: session.accountExpiresAt || null,
  };
}
