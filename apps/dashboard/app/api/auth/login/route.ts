import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  createOperatorSessionToken,
  createTenantSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import {
  isAdminPasswordConfigured,
  isOperatorPasswordConfigured,
  verifyAdminPassword,
  verifyOperatorPassword,
} from "@/lib/auth-password";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import {
  clearLoginFailures,
  getRetryAfterSeconds,
  isLoginRateLimited,
  registerLoginFailure,
} from "@/lib/login-rate-limit";
import { resolveTenantLoginSessionInput } from "@/lib/tenant-user-role";

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
  const mode =
    body?.mode === "customer" ? "customer" : body?.mode === "operator" ? "operator" : "admin";
  const password = typeof body?.password === "string" ? body.password : "";

  if (mode === "admin" || mode === "operator") {
    const isConfigured =
      mode === "admin" ? isAdminPasswordConfigured() : isOperatorPasswordConfigured();
    const isValid =
      mode === "admin" ? verifyAdminPassword(password) : verifyOperatorPassword(password);

    if (!isConfigured) {
      return NextResponse.json(
        { message: mode === "admin" ? "Admin auth misconfigured" : "Operator auth misconfigured" },
        { status: 500 }
      );
    }

    if (!isValid) {
      await registerLoginFailure(ip);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    await clearLoginFailures(ip);
    const res = NextResponse.json({ ok: true, role: mode });
    res.cookies.set(
      SESSION_COOKIE_NAME,
      mode === "admin" ? await createAdminSessionToken() : await createOperatorSessionToken(),
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
        id?: string;
        tenantId?: string;
        email?: string;
        displayName?: string;
        role?: string;
        expiresAt?: string | null;
      }
    | { message?: string }
    | null;
  const authenticatedCustomer =
    backendPayload && typeof backendPayload === "object" && "tenantId" in backendPayload
      ? backendPayload
      : null;

  if (!backendResponse.ok) {
    await registerLoginFailure(ip);
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const tenantSessionInput = resolveTenantLoginSessionInput(authenticatedCustomer);
  if (!tenantSessionInput) {
    await registerLoginFailure(ip);
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  await clearLoginFailures(ip);
  const res = NextResponse.json({
    ok: true,
    role: tenantSessionInput.role,
    redirectTo: tenantSessionInput.role === "viewer" ? "/evaluation" : "/sites",
  });
  res.cookies.set(
    SESSION_COOKIE_NAME,
    await createTenantSessionToken({
      role: tenantSessionInput.role,
      tenantId: tenantSessionInput.tenantId,
      tenantUserId: tenantSessionInput.tenantUserId,
      email: tenantSessionInput.email,
      displayName: tenantSessionInput.displayName,
      accountExpiresAt: tenantSessionInput.accountExpiresAt,
    }),
    getSessionCookieOptions()
  );

  return res;
}
