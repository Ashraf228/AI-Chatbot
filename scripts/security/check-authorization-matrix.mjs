import fs from "node:fs";
import { getAuthorizationInventory, repoPath } from "./authorization-inventory.mjs";

const matrixPath = repoPath("test/security/authorization-matrix.json");
const viewerAccessPath = repoPath("apps/dashboard/lib/viewer-access.ts");

const requiredFields = [
  "id",
  "layer",
  "method",
  "path",
  "source",
  "authType",
  "allowedRoles",
  "tenantBound",
  "siteBound",
  "ownershipBound",
  "mutation",
  "sensitiveResponse",
  "expectedScopeCheck",
  "testCaseId",
];

const expectedViewerPaths = [
  "/evaluation",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/evaluation/context",
  "/api/evaluation/chat/session",
  "/api/evaluation/chat/message",
  "/api/evaluation/chat/ticket/confirm",
  "/api/evaluation/chat/ticket/cancel",
  "/api/evaluation/chat/ticket/handoff",
  "/api/evaluation/chat/ticket/handoff/status",
];

function fail(message) {
  console.error(`[authorization-matrix] FAIL: ${message}`);
  process.exitCode = 1;
}

function key(route) {
  return `${route.layer}:${route.method}:${route.path}`;
}

function assertViewerAllowlistSource() {
  const source = fs.readFileSync(viewerAccessPath, "utf8");
  for (const route of expectedViewerPaths) {
    if (!source.includes(`\"${route}\"`) && !source.includes(`'${route}'`)) {
      fail(`viewer allowlist source is missing ${route}`);
    }
  }
  if (/startsWith\s*\(/.test(source) || /\.some\s*\(/.test(source)) {
    fail("viewer allowlist must remain exact-match only; startsWith/some was found");
  }
}

const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
const routes = matrix.routes ?? [];
const inventory = getAuthorizationInventory();
const matrixByKey = new Map();

for (const route of routes) {
  for (const field of requiredFields) {
    if (!(field in route)) {
      fail(`${route.id ?? key(route)} is missing field ${field}`);
    }
  }
  if (matrixByKey.has(key(route))) {
    fail(`duplicate matrix entry for ${key(route)}`);
  }
  matrixByKey.set(key(route), route);
  if (!Array.isArray(route.allowedRoles) || route.allowedRoles.length === 0) {
    fail(`${route.id} must declare at least one allowed role`);
  }
}

const inventoryByKey = new Map(inventory.map((route) => [key(route), route]));

for (const route of inventory) {
  if (!matrixByKey.has(key(route))) {
    fail(`route exists in source but not in matrix: ${key(route)} (${route.source})`);
  }
}

for (const route of routes) {
  if (!inventoryByKey.has(key(route))) {
    fail(`matrix route no longer exists in source: ${key(route)} (${route.source})`);
  }
}

const viewerMatrixRoutes = routes
  .filter((route) => route.allowedRoles.length === 1 && route.allowedRoles[0] === "viewer")
  .map((route) => route.path)
  .filter((route, index, allRoutes) => allRoutes.indexOf(route) === index)
  .sort();

if (JSON.stringify(viewerMatrixRoutes) !== JSON.stringify([...expectedViewerPaths].sort())) {
  fail(
    `viewer matrix allowlist mismatch: expected ${expectedViewerPaths.length}, found ${viewerMatrixRoutes.length}`,
  );
}

for (const route of routes) {
  if (route.allowedRoles.includes("viewer") && !expectedViewerPaths.includes(route.path)) {
    fail(`viewer role is allowed outside exact allowlist: ${route.method} ${route.path}`);
  }
  if (route.sensitiveResponse && route.allowedRoles.includes("public")) {
    fail(`public route cannot be marked as sensitive response: ${route.method} ${route.path}`);
  }
}

assertViewerAllowlistSource();

if (process.exitCode) {
  process.exit();
}

console.log(
  `[authorization-matrix] PASS: ${routes.length} matrix entries match ${inventory.length} source routes; viewer allowlist is exact`,
);
