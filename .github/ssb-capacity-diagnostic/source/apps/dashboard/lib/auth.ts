import { cookies } from "next/headers";
import { WRITER_SESSION_COOKIE } from './admin-writer-session';
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
  writerProof?: string;
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
  const credential = await verifyDashboardSessionCredential(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  return credential ? { ...credential, writerProof: cookieStore.get(WRITER_SESSION_COOKIE)?.value } : null;
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
