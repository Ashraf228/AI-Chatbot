export const SESSION_COOKIE_NAME = "ssb_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MIN_SESSION_SECRET_LENGTH = 32;

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

export async function createAdminSessionToken() {
  const secret = getSessionSecret();
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      "Missing strong admin session secret. Set ADMIN_SESSION_SECRET to a random value with at least 32 characters."
    );
  }

  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const payload = base64UrlEncode(
    JSON.stringify({
      role: "admin",
      sub: "dashboard-admin",
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
      jti: bytesToBase64(randomBytes),
    })
  );
  const signature = await sign(payload, secret);

  return `${payload}.${signature}`;
}

export async function verifyAdminSessionToken(token?: string | null) {
  if (!token) return false;

  const secret = getSessionSecret();
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = await sign(payload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload));
    return (
      parsed?.role === "admin" &&
      parsed?.sub === "dashboard-admin" &&
      Number(parsed?.exp) > Date.now()
    );
  } catch {
    return false;
  }
}
