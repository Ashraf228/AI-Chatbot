import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { isAdminPasswordConfigured, verifyAdminPassword } from "@/lib/auth-password";
import {
  clearLoginFailures,
  getRetryAfterSeconds,
  isLoginRateLimited,
  registerLoginFailure,
} from "@/lib/login-rate-limit";

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { message: "Admin auth misconfigured" },
      { status: 500 }
    );
  }

  const ip = getClientIp(req);
  if (await isLoginRateLimited(ip)) {
    return NextResponse.json(
      { message: "Too many login attempts" },
      {
        status: 429,
        headers: {
          "Retry-After": String(await getRetryAfterSeconds(ip)),
        },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!verifyAdminPassword(password)) {
    await registerLoginFailure(ip);
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  await clearLoginFailures(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE_NAME,
    await createAdminSessionToken(),
    getSessionCookieOptions()
  );

  return res;
}
