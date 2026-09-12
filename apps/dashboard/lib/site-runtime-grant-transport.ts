import { NextResponse } from "next/server";
import {
  getDashboardSessionCredential,
  type DashboardSessionCredential,
} from "@/lib/auth";

export type SiteRuntimeGrantOperation =
  | "create"
  | "preview"
  | "revoke"
  | "status";

export type SiteRuntimeGrantRouteParams = {
  tenantId: string;
  siteId: string;
  grantId?: string;
};

type TransportDependencies = {
  getSessionCredential: () => Promise<DashboardSessionCredential | null>;
  getDashboardToken: () => string | undefined;
  getBackendBaseUrl: () => string | undefined;
  getDashboardOrigin: () => string | undefined;
  fetchImpl: typeof fetch;
};

const TERM_FIELDS = new Set([
  "validFrom",
  "expiresAt",
  "embeddingDimension",
  "providerRegion",
  "dataCategories",
  "customerDataApproved",
  "productionApproved",
  "providerDpaApproved",
  "retentionPolicy",
  "redactionPolicy",
  "loggingPolicy",
  "deletionPolicy",
  "reindexPolicy",
  "rateLimit",
  "costLimit",
  "approvalEvidenceRef",
]);
const REVOKE_FIELDS = new Set(["revocationReason"]);
const GRANT_FIELDS = new Set([
  "id",
  "providerKey",
  "model",
  "environment",
  "validFrom",
  "expiresAt",
  "status",
  "revokedAt",
]);
const RUNTIME_FIELDS = new Set(["providerKey", "model", "environment"]);
const GRANT_STATUSES = new Set(["scheduled", "active", "expired", "revoked"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value: Record<string, unknown>, keys: Set<string>) {
  const actual = Object.keys(value);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function noStoreJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function safeError(status: number) {
  const messages: Record<number, string> = {
    400: "Invalid request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not found",
    409: "Conflict",
    500: "Internal server error",
  };
  return noStoreJson({ message: messages[status] || messages[500] }, status);
}

function trustedOrigin(value: string | undefined): string | null {
  if (!value || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function safePathSegment(value: unknown): string | null {
  if (
    typeof value !== "string"
    || !value
    || value !== value.trim()
    || value === "."
    || value === ".."
  ) {
    return null;
  }
  return encodeURIComponent(value);
}

function requestPath(operation: SiteRuntimeGrantOperation, params: SiteRuntimeGrantRouteParams) {
  const tenantId = safePathSegment(params.tenantId);
  const siteId = safePathSegment(params.siteId);
  const grantId = params.grantId === undefined ? null : safePathSegment(params.grantId);
  if (!tenantId || !siteId || ((operation === "revoke" || operation === "status") && !grantId)) {
    return null;
  }

  const base = `/internal/site-runtime-grants/${tenantId}/${siteId}`;
  if (operation === "preview") return `${base}/preview`;
  if (operation === "revoke") return `${base}/${grantId}/revoke`;
  if (operation === "status") return `${base}/${grantId}`;
  return base;
}

async function requestBody(request: Request, operation: SiteRuntimeGrantOperation) {
  if (operation === "status") return { ok: true as const, body: undefined };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false as const };
  }
  if (!isRecord(body)) return { ok: false as const };

  const allowed = operation === "revoke" ? REVOKE_FIELDS : TERM_FIELDS;
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    return { ok: false as const };
  }
  return { ok: true as const, body: JSON.stringify(body) };
}

function safeGrant(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, GRANT_FIELDS)) return null;
  if (
    !isText(value.id)
    || !isText(value.providerKey)
    || !isText(value.model)
    || !isText(value.environment)
    || !isText(value.validFrom)
    || !isText(value.expiresAt)
    || !GRANT_STATUSES.has(String(value.status))
    || !(value.revokedAt === null || isText(value.revokedAt))
  ) {
    return null;
  }
  return {
    id: value.id,
    providerKey: value.providerKey,
    model: value.model,
    environment: value.environment,
    validFrom: value.validFrom,
    expiresAt: value.expiresAt,
    status: value.status,
    revokedAt: value.revokedAt,
  };
}

function safeRuntime(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, RUNTIME_FIELDS)) return null;
  if (!isText(value.providerKey) || !isText(value.model) || !isText(value.environment)) return null;
  return {
    providerKey: value.providerKey,
    model: value.model,
    environment: value.environment,
  };
}

function safeSuccess(operation: SiteRuntimeGrantOperation, value: unknown) {
  if (!isRecord(value) || !isText(value.kind)) return null;

  if (operation === "preview" && value.kind === "would_create") {
    const runtime = safeRuntime(value.runtime);
    return hasExactKeys(value, new Set(["kind", "runtime"])) && runtime
      ? { kind: "would_create", runtime }
      : null;
  }

  const allowedKinds: Record<SiteRuntimeGrantOperation, Set<string>> = {
    create: new Set(["created", "reused"]),
    preview: new Set(["would_reuse"]),
    revoke: new Set(["revoked", "already_revoked"]),
    status: new Set(["found"]),
  };
  if (!allowedKinds[operation].has(value.kind) || !hasExactKeys(value, new Set(["kind", "grant"]))) {
    return null;
  }
  const grant = safeGrant(value.grant);
  return grant ? { kind: value.kind, grant } : null;
}

function expectedMethod(operation: SiteRuntimeGrantOperation) {
  return operation === "status" ? "GET" : "POST";
}

function productionDependencies(): TransportDependencies {
  return {
    getSessionCredential: getDashboardSessionCredential,
    getDashboardToken: () => process.env.DASHBOARD_INTERNAL_TOKEN,
    getBackendBaseUrl: () => process.env.BACKEND_BASE_URL,
    getDashboardOrigin: () => process.env.DASHBOARD_PUBLIC_URL,
    fetchImpl: fetch,
  };
}

export function createSiteRuntimeGrantTransport(
  dependencies: Partial<TransportDependencies> = {},
) {
  const deps = { ...productionDependencies(), ...dependencies };

  return async function forwardSiteRuntimeGrantRequest(
    request: Request,
    operation: SiteRuntimeGrantOperation,
    params: SiteRuntimeGrantRouteParams,
  ) {
    const credential = await deps.getSessionCredential();
    if (
      !credential
      || credential.session.role !== "customer"
      || !credential.session.tenantId
      || !credential.session.tenantUserId
    ) {
      return safeError(401);
    }

    if (request.method !== expectedMethod(operation)) return safeError(400);

    if (operation !== "status") {
      const expectedOrigin = trustedOrigin(deps.getDashboardOrigin());
      const requestOrigin = trustedOrigin(request.headers.get("origin") || undefined);
      const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
      if (!expectedOrigin) return safeError(500);
      if (!requestOrigin || requestOrigin !== expectedOrigin || fetchSite !== "same-origin") {
        return safeError(403);
      }
    }

    const path = requestPath(operation, params);
    if (!path) return safeError(400);

    const parsedBody = await requestBody(request, operation);
    if (!parsedBody.ok) return safeError(400);

    const dashboardToken = deps.getDashboardToken()?.trim() || "";
    const backendBase = trustedOrigin(deps.getBackendBaseUrl());
    if (dashboardToken.length < 32 || !backendBase) return safeError(500);

    let upstream: Response;
    try {
      upstream = await deps.fetchImpl(`${backendBase}${path}`, {
        method: expectedMethod(operation),
        headers: {
          Authorization: `Bearer ${credential.token}`,
          "Content-Type": "application/json",
          "X-DASHBOARD-TOKEN": dashboardToken,
        },
        body: parsedBody.body,
        cache: "no-store",
        redirect: "manual",
      });
    } catch {
      return safeError(500);
    }

    if (upstream.status >= 300 && upstream.status < 400) return safeError(500);
    if (!upstream.ok) {
      return safeError([400, 401, 403, 404, 409].includes(upstream.status) ? upstream.status : 500);
    }

    const expectedStatus = operation === "create" ? 201 : 200;
    if (upstream.status !== expectedStatus) return safeError(500);

    let value: unknown;
    try {
      value = await upstream.json();
    } catch {
      return safeError(500);
    }
    const safeValue = safeSuccess(operation, value);
    return safeValue ? noStoreJson(safeValue, upstream.status) : safeError(500);
  };
}

export const forwardSiteRuntimeGrantRequest = createSiteRuntimeGrantTransport();
