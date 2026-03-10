import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isLoggedIn = req.cookies.get("ssb_admin")?.value === "1";
  const url = req.nextUrl;

  const protectedPaths = ["/sites", "/ingest"];
  const isProtected = protectedPaths.some((p) => url.pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sites/:path*", "/ingest/:path*"],
};