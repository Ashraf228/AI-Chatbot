import { NextResponse } from "next/server";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto === "https" || !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/.test(host) ? "https" : "http";
  const loginUrl = new URL("/login", `${proto}://${host}`);
  loginUrl.searchParams.set("loggedOut", "1");

  const res = NextResponse.redirect(loginUrl, 303);
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return res;
}
