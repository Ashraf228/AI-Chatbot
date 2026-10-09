import type { DashboardSession } from "@/lib/auth";

export function toPublicSession(session: DashboardSession) {
  const publicSession: {
    role: DashboardSession["role"];
    displayName: string | null;
    tenantId?: string | null;
    sessionExpiresAt: string;
    accountExpiresAt: string | null;
  } = {
    role: session.role,
    displayName: session.displayName || null,
    sessionExpiresAt: session.sessionExpiresAt,
    accountExpiresAt: session.accountExpiresAt || null,
  };

  if (session.role === "customer") {
    publicSession.tenantId = session.tenantId || null;
  }

  return publicSession;
}
