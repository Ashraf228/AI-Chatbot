import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  createCustomerSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { isAdminPasswordConfigured, verifyAdminPassword } from "@/lib/auth-password";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
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
  const mode = body?.mode === "customer" ? "customer" : "admin";
  const password = typeof body?.password === "string" ? body.password : "";

  if (mode === "admin") {
    if (!isAdminPasswordConfigured()) {
      return NextResponse.json(
        { message: "Admin auth misconfigured" },
        { status: 500 }
      );
    }

    if (!verifyAdminPassword(password)) {
      await registerLoginFailure(ip);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    await clearLoginFailures(ip);
    const res = NextResponse.json({ ok: true, role: "admin" });
    res.cookies.set(
      SESSION_COOKIE_NAME,
      await createAdminSessionToken(),
      getSessionCookieOptions()
    );

    return res;
  }

  const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!tenantId || !email || !password) {
    await registerLoginFailure(ip);
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const backendResponse = await fetchDashboardBackend("/admin/tenant-users/authenticate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tenantId,
      email,
      password,
    }),
  });

  const backendPayload = (await backendResponse.json().catch(() => null)) as
    | {
        tenantId?: string;
        email?: string;
        displayName?: string;
      }
    | { message?: string }
    | null;
  const backendMessage =
    backendPayload && typeof backendPayload === "object" && "message" in backendPayload
      ? backendPayload.message
      : undefined;
  const authenticatedCustomer =
    backendPayload && typeof backendPayload === "object" && "tenantId" in backendPayload
      ? backendPayload
      : null;

  if (!backendResponse.ok) {
    await registerLoginFailure(ip);
    return NextResponse.json(
      { message: backendMessage || "Invalid credentials" },
      { status: backendResponse.status === 401 ? 401 : 500 }
    );
  }

  await clearLoginFailures(ip);
  const res = NextResponse.json({ ok: true, role: "customer" });
  res.cookies.set(
    SESSION_COOKIE_NAME,
    await createCustomerSessionToken({
      tenantId: authenticatedCustomer?.tenantId || tenantId,
      email: authenticatedCustomer?.email || email,
      displayName: authenticatedCustomer?.displayName || email,
    }),
    getSessionCookieOptions()
  );

  return res;
}
