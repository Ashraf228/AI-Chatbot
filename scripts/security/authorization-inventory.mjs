import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const httpMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function walk(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, files);
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizePathSegment(segment) {
  return segment.replace(/^\[(.+)\]$/, ":$1");
}

function normalizeRoutePath(routePath) {
  return routePath
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .replace(/^$/, "/");
}

function dashboardRoutePath(filePath) {
  const rel = path.relative(path.join(repoRoot, "apps/dashboard/app"), filePath);
  const segments = rel.split(path.sep);
  segments.pop();
  return normalizeRoutePath(
    "/" +
      segments
        .map(normalizePathSegment)
        .join("/"),
  );
}

function dashboardPagePath(filePath) {
  const rel = path.relative(path.join(repoRoot, "apps/dashboard/app"), filePath);
  const segments = rel.split(path.sep);
  segments.pop();
  const normalized = segments
    .filter((segment) => segment !== "app" && !segment.startsWith("("))
    .map(normalizePathSegment)
    .join("/");
  return normalizeRoutePath(`/${normalized}`);
}

function dashboardMethods(source) {
  const methods = new Set();
  const pattern = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  let match;
  while ((match = pattern.exec(source))) {
    methods.add(match[1]);
  }
  return [...methods].sort();
}

function controllerBase(source) {
  const match = source.match(/@Controller\(([^)]*)\)/m);
  if (!match) {
    return "";
  }
  return decoratorStringValue(match[1]);
}

function decoratorStringValue(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const quoted = trimmed.match(/^['"`]([^'"`]*)['"`]$/);
  if (quoted) {
    return quoted[1];
  }
  return "";
}

function backendRoutesFromController(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const base = controllerBase(source);
  const routes = [];
  const pattern = /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/g;
  let match;
  while ((match = pattern.exec(source))) {
    const method = match[1].toUpperCase();
    if (!httpMethods.has(method)) {
      continue;
    }
    const subPath = decoratorStringValue(match[2]);
    routes.push({
      layer: "api",
      method,
      path: normalizeRoutePath(`/${base}/${subPath}`.replace(/:([A-Za-z0-9_]+)/g, ":$1")),
      source: path.relative(repoRoot, filePath),
    });
  }
  return routes;
}

export function getDashboardApiInventory() {
  const routeFiles = walk(
    path.join(repoRoot, "apps/dashboard/app/api"),
    (filePath) => filePath.endsWith(`${path.sep}route.ts`),
  );
  return routeFiles.flatMap((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    return dashboardMethods(source).map((method) => ({
      layer: "dashboard",
      method,
      path: dashboardRoutePath(filePath),
      source: path.relative(repoRoot, filePath),
    }));
  });
}

export function getDashboardPageInventory() {
  const pageFiles = walk(
    path.join(repoRoot, "apps/dashboard/app"),
    (filePath) => filePath.endsWith(`${path.sep}page.tsx`) && !filePath.includes(`${path.sep}api${path.sep}`),
  );
  return pageFiles.map((filePath) => ({
    layer: "dashboard",
    method: "GET",
    path: dashboardPagePath(filePath),
    source: path.relative(repoRoot, filePath),
  }));
}

export function getBackendControllerInventory() {
  const controllerFiles = walk(
    path.join(repoRoot, "apps/api/src"),
    (filePath) => filePath.endsWith(".controller.ts"),
  );
  return controllerFiles.flatMap(backendRoutesFromController);
}

export function getAuthorizationInventory() {
  return [...getDashboardPageInventory(), ...getDashboardApiInventory(), ...getBackendControllerInventory()].sort((a, b) =>
    `${a.layer}:${a.method}:${a.path}`.localeCompare(`${b.layer}:${b.method}:${b.path}`),
  );
}

export function repoPath(...segments) {
  return path.join(repoRoot, ...segments);
}
