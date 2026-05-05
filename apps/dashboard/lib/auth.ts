import { cookies } from "next/headers";
export {
  createAdminSessionToken,
  createOperatorSessionToken,
  createCustomerSessionToken,
  type DashboardSession,
  type DashboardSessionRole,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth-core";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth-core";

export async function getDashboardSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function isAuthenticated() {
  return Boolean(await getDashboardSession());
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
