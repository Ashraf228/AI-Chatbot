import { randomBytes, scryptSync } from "node:crypto";

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function randomPassword(length = 24) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const buffer = randomBytes(length);
  let result = "";

  for (let index = 0; index < length; index += 1) {
    result += alphabet[buffer[index] % alphabet.length];
  }

  return result;
}

function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const adminPassword = randomPassword();

const secrets = {
  ADMIN_KEY: randomHex(32),
  ADMIN_SESSION_SECRET: randomHex(32),
  ADMIN_PANEL_PASSWORD: adminPassword,
  ADMIN_PANEL_PASSWORD_HASH: createPasswordHash(adminPassword),
};

console.log("# Server secrets");
console.log("# Keep these values out of git, screenshots and chat logs.");
console.log("");
console.log(`ADMIN_KEY=${secrets.ADMIN_KEY}`);
console.log(`ADMIN_SESSION_SECRET=${secrets.ADMIN_SESSION_SECRET}`);
console.log(`ADMIN_PANEL_PASSWORD=${secrets.ADMIN_PANEL_PASSWORD}`);
console.log(`ADMIN_PANEL_PASSWORD_HASH=${secrets.ADMIN_PANEL_PASSWORD_HASH}`);
console.log("");
console.log("# Recommended production usage:");
console.log("# - set ADMIN_PANEL_PASSWORD_HASH");
console.log("# - do not set ADMIN_PANEL_PASSWORD in production");
console.log("# - rotate OPENAI/SMTP/database credentials separately at the provider");
