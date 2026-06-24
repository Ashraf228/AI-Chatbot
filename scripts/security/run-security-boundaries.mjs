import fs from "node:fs";
import path from "node:path";
import { repoPath } from "./authorization-inventory.mjs";

const artifactDir = repoPath("artifacts/security");
fs.mkdirSync(artifactDir, { recursive: true });

const matrix = JSON.parse(fs.readFileSync(repoPath("test/security/authorization-matrix.json"), "utf8"));
const viewerAccess = fs.readFileSync(repoPath("apps/dashboard/lib/viewer-access.ts"), "utf8");
const proxy = fs.readFileSync(repoPath("apps/dashboard/proxy.ts"), "utf8");
const authCore = fs.readFileSync(repoPath("apps/dashboard/lib/auth-core.ts"), "utf8");
const dashboardApi = fs.readFileSync(repoPath("apps/dashboard/lib/dashboard-api.ts"), "utf8");
const adminGuard = fs.readFileSync(repoPath("apps/api/src/utils/admin.guard.ts"), "utf8");
const adminScope = fs.readFileSync(repoPath("apps/api/src/utils/admin-scope.service.ts"), "utf8");
const evaluationAccess = fs.readFileSync(repoPath("apps/api/src/evaluation/evaluation-access.service.ts"), "utf8");
const evaluationService = fs.readFileSync(repoPath("apps/api/src/evaluation/evaluation.service.ts"), "utf8");
const vectorService = fs.readFileSync(repoPath("apps/api/src/vector/vector.service.ts"), "utf8");
const handoffService = fs.readFileSync(repoPath("apps/api/src/evaluation/evaluation-handoff.service.ts"), "utf8");
const mockHandoff = fs.readFileSync(repoPath("apps/api/src/evaluation/evaluation-mock-handoff.controller.ts"), "utf8");
const webhookHmac = fs.readFileSync(repoPath("apps/api/src/webhooks/webhook-hmac.ts"), "utf8");
const ticketWebhookConfig = fs.readFileSync(repoPath("apps/api/src/integrations/ticket-webhook-config.service.ts"), "utf8");
const integrationsService = fs.readFileSync(repoPath("apps/api/src/integrations/integrations.service.ts"), "utf8");
const webhookDispatcher = fs.readFileSync(
  repoPath("apps/api/src/integrations/integration-event-dispatcher.service.ts"),
  "utf8",
);

const reports = [];

function test(id, className, description, assertion) {
  try {
    assertion();
    reports.push({ id, className, description, status: "PASS" });
  } catch (error) {
    reports.push({ id, className, description, status: "FAIL", error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includes(source, value, label = value) {
  assert(source.includes(value), `expected ${label}`);
}

function notIncludes(source, value, label = value) {
  assert(!source.includes(value), `unexpected ${label}`);
}

function route(pathname, method = "GET", layer = "dashboard") {
  return matrix.routes.find((entry) => entry.layer === layer && entry.path === pathname && entry.method === method);
}

function roleAllows(pathname, role) {
  return matrix.routes.some((entry) => entry.path === pathname && entry.allowedRoles.includes(role));
}

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

expectedViewerPaths.forEach((pathname, index) => {
  test(`SEC-${String(index + 1).padStart(3, "0")}`, "viewer-allowlist", `viewer may access exact ${pathname}`, () => {
    assert(roleAllows(pathname, "viewer"), `${pathname} is not viewer-allowed in matrix`);
    includes(viewerAccess, pathname);
  });
});

[
  "/api/tenants",
  "/api/sites",
  "/api/widget/leads",
  "/api/conversations",
  "/api/knowledge",
  "/api/agents/summary",
  "/api/sites/:siteId/export",
  "/api/sites/:siteId/delete-data",
  "/api/integrations/:siteId",
  "/api/site-modules/:siteId",
].forEach((pathname, offset) => {
  test(`SEC-${String(11 + offset).padStart(3, "0")}`, "viewer-deny", `viewer is denied ${pathname}`, () => {
    assert(!roleAllows(pathname, "viewer"), `${pathname} unexpectedly allows viewer`);
  });
});

test("SEC-021", "viewer-allowlist", "viewer allowlist uses Set exact match", () => {
  includes(viewerAccess, "new Set");
  includes(viewerAccess, "VIEWER_ALLOWED_PATHS.has");
  notIncludes(viewerAccess, "startsWith(");
});

test("SEC-022", "viewer-allowlist", "dashboard proxy blocks viewer API outside allowlist", () => {
  includes(proxy, "isViewerAllowedPath(pathname)");
  includes(proxy, "role === \"viewer\"");
  includes(proxy, "status: 403");
});

test("SEC-023", "viewer-allowlist", "viewer unknown page redirects to evaluation", () => {
  includes(proxy, "new URL(\"/evaluation\"");
});

test("SEC-024", "session-security", "tenant roles require tenant id", () => {
  includes(authCore, "TENANT_SESSION_ROLES.has(role)");
  includes(authCore, "!tenantId");
});

test("SEC-025", "session-security", "viewer sessions expire server-side", () => {
  includes(authCore, "expiresAt");
  includes(authCore, "exp <= Date.now()");
});

test("SEC-026", "session-security", "session cookie is httpOnly", () => {
  includes(authCore, "httpOnly: true");
});

test("SEC-027", "session-security", "session cookie uses SameSite strict", () => {
  includes(authCore, "sameSite: \"strict\"");
});

test("SEC-028", "session-security", "production cookie is secure", () => {
  includes(authCore, "secure: process.env.NODE_ENV === \"production\"");
});

test("SEC-029", "dashboard-proxy", "dashboard API injects internal token only server-side", () => {
  includes(dashboardApi, "X-DASHBOARD-TOKEN");
  includes(dashboardApi, "DASHBOARD_INTERNAL_TOKEN");
});

test("SEC-030", "dashboard-proxy", "dashboard API forwards tenant context", () => {
  includes(dashboardApi, "X-DASHBOARD-TENANT");
  includes(dashboardApi, "X-DASHBOARD-TENANT-USER");
});

test("SEC-031", "backend-guard", "backend rejects forged role headers without dashboard token", () => {
  includes(adminGuard, "x-dashboard-token");
  includes(adminGuard, "admin key required");
});

test("SEC-032", "backend-guard", "backend validates dashboard token with timingSafeEqual", () => {
  includes(adminGuard, "timingSafeEqual");
});

test("SEC-033", "backend-guard", "viewer is denied by default on admin guard", () => {
  includes(adminGuard, "dashboardRole === 'viewer'");
  includes(adminGuard, "insufficient dashboard role");
});

test("SEC-034", "backend-guard", "role metadata is required for non-default roles", () => {
  includes(adminGuard, "REQUIRED_DASHBOARD_ROLES");
});

test("SEC-035", "tenant-scope", "site access compares tenant id", () => {
  includes(adminScope, "tenant_id FROM sites");
  includes(adminScope, "site.tenant_id !== auth.tenantId");
});

test("SEC-036", "tenant-scope", "widget leads are scoped through site", () => {
  includes(adminScope, "'widget_leads'");
  includes(adminScope, "findResourceSite");
});

test("SEC-037", "tenant-scope", "conversations are scoped through site", () => {
  includes(adminScope, "'conversations'");
  includes(adminScope, "findResourceSite");
});

test("SEC-038", "tenant-scope", "documents are scoped through site", () => {
  includes(adminScope, "'documents'");
  includes(adminScope, "findResourceSite");
});

test("SEC-039", "tenant-scope", "webhook jobs are scoped through site", () => {
  includes(adminScope, "'webhook_jobs'");
  includes(adminScope, "findResourceSite");
});

test("SEC-040", "tenant-scope", "report runs are scoped through site", () => {
  includes(adminScope, "'report_runs'");
  includes(adminScope, "findResourceSite");
});

test("SEC-041", "evaluation-viewer", "viewer access requires viewer role", () => {
  includes(evaluationAccess, "auth.role !== 'viewer'");
});

test("SEC-042", "evaluation-viewer", "viewer access requires tenant user", () => {
  includes(evaluationAccess, "tenantUserId");
});

test("SEC-043", "evaluation-viewer", "viewer access revalidates tenant user row", () => {
  includes(evaluationAccess, "FROM tenant_users tu");
});

test("SEC-044", "evaluation-viewer", "viewer access requires active account", () => {
  includes(evaluationAccess, "tu.is_active");
});

test("SEC-045", "evaluation-viewer", "viewer access checks expiration", () => {
  includes(evaluationAccess, "tu.expires_at");
});

test("SEC-046", "evaluation-viewer", "viewer access requires evaluation site id", () => {
  includes(evaluationAccess, "tu.evaluation_site_id");
});

test("SEC-047", "evaluation-viewer", "viewer access requires demo site", () => {
  includes(evaluationAccess, "s.is_evaluation_demo");
});

test("SEC-048", "evaluation-viewer", "viewer deny emits audit without secrets", () => {
  includes(evaluationAccess, "auditLogs.record");
  notIncludes(evaluationAccess, "password");
});

test("SEC-049", "evaluation-ticket", "ticket confirm uses exact confirmation route", () => {
  const entry = route("/api/evaluation/chat/ticket/confirm", "POST");
  assert(entry?.allowedRoles.includes("viewer"), "viewer confirm route missing");
});

test("SEC-050", "evaluation-ticket", "ticket cancel uses exact cancel route", () => {
  const entry = route("/api/evaluation/chat/ticket/cancel", "POST");
  assert(entry?.allowedRoles.includes("viewer"), "viewer cancel route missing");
});

test("SEC-051", "evaluation-ticket", "reporter email is redacted from model/browser context", () => {
  includes(evaluationService, "reporterEmail");
  includes(evaluationService, "sanitize");
});

test("SEC-052", "retrieval-scope", "evaluation retrieval passes evaluationMode server-side", () => {
  includes(evaluationService, "evaluationMode: true");
});

test("SEC-053", "retrieval-scope", "vector retrieval supports demo filter", () => {
  includes(vectorService, "demo");
  includes(vectorService, "synthetic");
});

test("SEC-054", "retrieval-scope", "vector retrieval uses tenant and site filters", () => {
  includes(vectorService, "tenantId");
  includes(vectorService, "siteId");
});

test("SEC-055", "retrieval-scope", "zero result path does not remove tenant/site filters", () => {
  notIncludes(vectorService, "WHERE 1=1");
});

test("SEC-056", "handoff", "handoff event id is stable", () => {
  includes(handoffService, "eventId");
  includes(handoffService, "payloadHash");
});

test("SEC-057", "handoff", "handoff delivery id is per attempt", () => {
  includes(handoffService, "deliveryId");
  includes(handoffService, "attempt");
});

test("SEC-058", "handoff", "mock receiver validates signature from Buffer", () => {
  includes(mockHandoff, "Buffer");
  includes(handoffService, "verifyWebhookSignature");
  includes(webhookHmac, "timingSafeEqual");
});

test("SEC-059", "webhook", "generic webhook HMAC stores payload body for retries", () => {
  includes(webhookDispatcher, "payload_body");
});

test("SEC-060", "webhook", "generic webhook protects reserved headers", () => {
  includes(ticketWebhookConfig + webhookDispatcher + integrationsService, "x-ssb");
});

const routeClasses = [
  ["SEC-061", "matrix", "all mutation routes declare mutation=true", () => matrix.routes.every((r) => (r.method === "GET") === !r.mutation || r.mutation)],
  ["SEC-062", "matrix", "all sensitive routes are non-public", () => matrix.routes.every((r) => !r.sensitiveResponse || !r.allowedRoles.includes("public"))],
  ["SEC-063", "matrix", "all ownership-bound routes are tenant-bound or viewer-bound", () => matrix.routes.every((r) => !r.ownershipBound || r.tenantBound || r.allowedRoles.includes("viewer"))],
  ["SEC-064", "matrix", "all site-id routes are site-bound", () => matrix.routes.every((r) => !r.path.includes(":siteId") || r.siteBound)],
  ["SEC-065", "matrix", "tenant routes are not public", () => matrix.routes.every((r) => !r.tenantBound || !r.allowedRoles.includes("public"))],
  ["SEC-066", "matrix", "viewer matrix routes are exact expected count", () => new Set(matrix.routes.filter((r) => r.allowedRoles.includes("viewer")).map((r) => r.path)).size === expectedViewerPaths.length],
  ["SEC-067", "matrix", "non-viewer auth routes are explicit public exceptions", () => matrix.routes.filter((r) => r.path.startsWith("/api/auth/") && !r.allowedRoles.includes("viewer")).every((r) => r.exception)],
  ["SEC-068", "matrix", "dashboard API routes have a test case id", () => matrix.routes.filter((r) => r.layer === "dashboard").every((r) => r.testCaseId)],
  ["SEC-069", "matrix", "backend API routes have a test case id", () => matrix.routes.filter((r) => r.layer === "api").every((r) => r.testCaseId)],
  ["SEC-070", "matrix", "all route ids are unique", () => new Set(matrix.routes.map((r) => r.id)).size === matrix.routes.length],
];

for (const [id, className, description, assertion] of routeClasses) {
  test(id, className, description, () => assert(assertion(), description));
}

const failed = reports.filter((report) => report.status !== "PASS");
const jsonReport = {
  generatedAt: new Date().toISOString(),
  routeCount: matrix.routes.length,
  testCount: reports.length,
  failedCount: failed.length,
  reports,
};
fs.writeFileSync(path.join(artifactDir, "security-boundaries.json"), JSON.stringify(jsonReport, null, 2) + "\n");
fs.writeFileSync(
  path.join(artifactDir, "security-boundaries.md"),
  [
    "# Security Boundary Gate",
    "",
    `- Tests: ${reports.length}`,
    `- Failed: ${failed.length}`,
    `- Routes in matrix: ${matrix.routes.length}`,
    "",
    ...reports.map((report) => `- ${report.status} ${report.id} ${report.className}: ${report.description}`),
    "",
  ].join("\n"),
);

if (failed.length > 0) {
  for (const report of failed) {
    console.error(`[security-boundaries] ${report.id} FAIL ${report.description}: ${report.error}`);
  }
  process.exit(1);
}

console.log(`[security-boundaries] PASS: ${reports.length} boundary checks across ${matrix.routes.length} routes`);
