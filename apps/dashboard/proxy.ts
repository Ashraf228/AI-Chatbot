import { SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/auth-core";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LOGIN_PATH = "/login";
const PUBLIC_PATHS = new Set([
  LOGIN_PATH,
  "/api/auth/login",
  "/api/auth/logout",
]);

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === LOGIN_PATH) {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const isAuthenticated = await verifyAdminSessionToken(token);
      if (isAuthenticated) {
        return NextResponse.redirect(new URL("/sites", request.url));
      }
    }

    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifyAdminSessionToken(token);

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
