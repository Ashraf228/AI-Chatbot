import { cookies } from "next/headers";
export {
  createAdminSessionToken,
  createOperatorSessionToken,
  createCustomerSessionToken,
  createTenantSessionToken,
  createViewerSessionToken,
  type DashboardSession,
  type DashboardSessionRole,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth-core";
import {
  type DashboardSession,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth-core";

export type DashboardSessionCredential = {
  session: DashboardSession;
  token: string;
};

export async function verifyDashboardSessionCredential(
  token?: string | null
): Promise<DashboardSessionCredential | null> {
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session ? { session, token } : null;
}

export async function getDashboardSessionCredential() {
  const cookieStore = await cookies();
  return verifyDashboardSessionCredential(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
}

export async function getDashboardSession() {
  return (await getDashboardSessionCredential())?.session ?? null;
}

export async function isAuthenticated() {
  return Boolean(await getDashboardSession());
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
