import { cookies } from "next/headers";
export {
  createAdminSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifyAdminSessionToken,
} from "@/lib/auth-core";
import { SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/auth-core";

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
