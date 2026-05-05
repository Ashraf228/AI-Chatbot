import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-core";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LOGIN_PATH = "/login";
const PUBLIC_PATHS = new Set([
  LOGIN_PATH,
  "/healthz",
  "/api/auth/login",
  "/api/auth/logout",
]);

const CUSTOMER_BLOCKED_PREFIXES = [
  "/settings",
  "/usage",
  "/api/usage",
  "/api/tenants",
  "/api/agents",
  "/api/integrations",
  "/api/site-modules",
  "/api/widget/optimization",
];

const CUSTOMER_BLOCKED_SITE_SEGMENTS = new Set([
  "agents",
  "integrations",
  "modules",
  "optimization",
]);

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === LOGIN_PATH) {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const session = await verifySessionToken(token);
      if (session) {
        return NextResponse.redirect(new URL("/sites", request.url));
      }
    }

    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    if (session.role === "customer") {
      if (CUSTOMER_BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return pathname.startsWith("/api/")
          ? NextResponse.json({ message: "Forbidden" }, { status: 403 })
          : NextResponse.redirect(new URL("/sites", request.url));
      }

      const siteMatch = pathname.match(/^\/sites\/([^/]+)\/([^/]+)(?:\/|$)/);
      if (siteMatch && CUSTOMER_BLOCKED_SITE_SEGMENTS.has(siteMatch[2] || "")) {
        return pathname.startsWith("/api/")
          ? NextResponse.json({ message: "Forbidden" }, { status: 403 })
          : NextResponse.redirect(new URL(`/sites/${siteMatch[1]}`, request.url));
      }
    }

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
