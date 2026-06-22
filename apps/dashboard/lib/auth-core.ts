export const SESSION_COOKIE_NAME = "ssb_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MIN_SESSION_SECRET_LENGTH = 32;

export type DashboardSessionRole = "admin" | "operator" | "customer" | "viewer";
export type DashboardSession = {
  role: DashboardSessionRole;
  sub: string;
  exp: number;
  iat: number;
  tenantId?: string;
  tenantUserId?: string;
  email?: string;
  displayName?: string;
  sessionIssuedAt: string;
  sessionExpiresAt: string;
  accountExpiresAt?: string;
};

const SESSION_ROLES = new Set<DashboardSessionRole>(["admin", "operator", "customer", "viewer"]);
const TENANT_SESSION_ROLES = new Set<DashboardSessionRole>(["customer", "viewer"]);

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function base64UrlEncode(input: string) {
  return bytesToBase64(new TextEncoder().encode(input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return new TextDecoder().decode(base64ToBytes(normalized + padding));
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || "";
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(value: string, secret: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return bytesToBase64(new Uint8Array(signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

function parseFutureTimestamp(value?: string | null) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return timestamp;
}

function resolveSessionExpiry(accountExpiresAt?: string) {
  const defaultExpiry = Date.now() + SESSION_TTL_SECONDS * 1000;
  const accountExpiry = parseFutureTimestamp(accountExpiresAt);
  return typeof accountExpiry === "number" ? Math.min(defaultExpiry, accountExpiry) : defaultExpiry;
}

async function createSessionToken(
  payload: Omit<DashboardSession, "iat" | "exp" | "sessionIssuedAt" | "sessionExpiresAt">,
) {
  const secret = getSessionSecret();
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      "Missing strong admin session secret. Set ADMIN_SESSION_SECRET to a random value with at least 32 characters."
    );
  }

  if (TENANT_SESSION_ROLES.has(payload.role) && !payload.tenantId) {
    throw new Error("Tenant-bound sessions require tenantId.");
  }

  const issuedAt = Date.now();
  const expiresAt = resolveSessionExpiry(payload.accountExpiresAt);
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const encodedPayload = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: issuedAt,
      exp: expiresAt,
      sessionIssuedAt: new Date(issuedAt).toISOString(),
      sessionExpiresAt: new Date(expiresAt).toISOString(),
      jti: bytesToBase64(randomBytes),
    })
  );
  const signature = await sign(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export async function createAdminSessionToken() {
  return createSessionToken({
    role: "admin",
    sub: "dashboard-admin",
  });
}

export async function createOperatorSessionToken() {
  return createSessionToken({
    role: "operator",
    sub: "dashboard-operator",
  });
}

export async function createCustomerSessionToken(input: {
  tenantId: string;
  tenantUserId?: string;
  email: string;
  displayName: string;
  accountExpiresAt?: string | null;
}) {
  return createTenantSessionToken({
    role: "customer",
    ...input,
  });
}

export async function createViewerSessionToken(input: {
  tenantId: string;
  tenantUserId?: string;
  email: string;
  displayName: string;
  accountExpiresAt?: string | null;
}) {
  return createTenantSessionToken({
    role: "viewer",
    ...input,
  });
}

export async function createTenantSessionToken(input: {
  role: "customer" | "viewer";
  tenantId: string;
  tenantUserId?: string;
  email: string;
  displayName: string;
  accountExpiresAt?: string | null;
}) {
  return createSessionToken({
    role: input.role,
    sub: `customer:${input.tenantId}:${input.email.toLowerCase()}`,
    tenantId: input.tenantId,
    tenantUserId: input.tenantUserId,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    accountExpiresAt: input.accountExpiresAt || undefined,
  });
}

export async function verifySessionToken(token?: string | null): Promise<DashboardSession | null> {
  if (!token) return null;

  const secret = getSessionSecret();
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = await sign(payload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload));
    const role = parsed?.role;
    const exp = Number(parsed?.exp);
    const iat = Number(parsed?.iat || 0);
    const tenantId = typeof parsed?.tenantId === "string" ? parsed.tenantId : undefined;
    const accountExpiresAt =
      typeof parsed?.accountExpiresAt === "string" ? parsed.accountExpiresAt : undefined;
    const accountExpiry = parseFutureTimestamp(accountExpiresAt);

    if (!SESSION_ROLES.has(role) || !Number.isFinite(exp) || exp <= Date.now()) {
      return null;
    }

    if (TENANT_SESSION_ROLES.has(role) && !tenantId) {
      return null;
    }

    if (accountExpiresAt && (!accountExpiry || accountExpiry <= Date.now() || exp > accountExpiry)) {
      return null;
    }

    return {
      role,
      sub: String(parsed?.sub || ""),
      exp,
      iat,
      tenantId,
      tenantUserId: typeof parsed?.tenantUserId === "string" ? parsed.tenantUserId : undefined,
      email: typeof parsed?.email === "string" ? parsed.email : undefined,
      displayName: typeof parsed?.displayName === "string" ? parsed.displayName : undefined,
      sessionIssuedAt:
        typeof parsed?.sessionIssuedAt === "string"
          ? parsed.sessionIssuedAt
          : new Date(iat || 0).toISOString(),
      sessionExpiresAt:
        typeof parsed?.sessionExpiresAt === "string" ? parsed.sessionExpiresAt : new Date(exp).toISOString(),
      accountExpiresAt,
    };
  } catch {
    return null;
  }
}

export async function verifyAdminSessionToken(token?: string | null) {
  const session = await verifySessionToken(token);
  return session?.role === "admin";
}
