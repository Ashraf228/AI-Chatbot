import { scryptSync, timingSafeEqual as timingSafeBufferEqual } from "node:crypto";

const MIN_PASSWORD_LENGTH = 12;
const HASH_PREFIX = "scrypt";

function timingSafeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeBufferEqual(aBuffer, bBuffer);
}

function parsePasswordHash(value: string) {
  const [algorithm, saltHex, hashHex] = value.split("$");
  if (algorithm !== HASH_PREFIX || !saltHex || !hashHex) {
    return null;
  }

  try {
    return {
      salt: Buffer.from(saltHex, "hex"),
      hash: Buffer.from(hashHex, "hex"),
    };
  } catch {
    return null;
  }
}

export function verifyAdminPassword(password: string) {
  return verifyPasswordWithEnv(password, {
    hashEnv: "ADMIN_PANEL_PASSWORD_HASH",
    fallbackEnv: "ADMIN_PANEL_PASSWORD",
  });
}

export function verifyOperatorPassword(password: string) {
  return verifyPasswordWithEnv(password, {
    hashEnv: "OPERATOR_PANEL_PASSWORD_HASH",
    fallbackEnv: "OPERATOR_PANEL_PASSWORD",
  });
}

function verifyPasswordWithEnv(
  password: string,
  env: {
    hashEnv: string;
    fallbackEnv: string;
  },
) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return false;
  }

  const passwordHash = process.env[env.hashEnv]?.trim();
  if (passwordHash) {
    const parsed = parsePasswordHash(passwordHash);
    if (!parsed) {
      return false;
    }

    const derived = scryptSync(password, parsed.salt, parsed.hash.length);
    return timingSafeBufferEqual(derived, parsed.hash);
  }

  const fallbackPassword = process.env[env.fallbackEnv]?.trim();
  if (!fallbackPassword) {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return timingSafeEqual(password, fallbackPassword);
}

export function isAdminPasswordConfigured() {
  return Boolean(
    process.env.ADMIN_PANEL_PASSWORD_HASH?.trim() ||
      process.env.ADMIN_PANEL_PASSWORD?.trim()
  );
}

export function isOperatorPasswordConfigured() {
  return Boolean(
    process.env.OPERATOR_PANEL_PASSWORD_HASH?.trim() ||
      process.env.OPERATOR_PANEL_PASSWORD?.trim()
  );
}
