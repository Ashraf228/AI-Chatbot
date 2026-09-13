import { NextResponse } from "next/server";

import {
  getDashboardSessionCredential,
  type DashboardSessionCredential,
} from "@/lib/auth";

export type CustomerKnowledgeOperation = "list" | "import" | "delete";

type TransportDependencies = {
  getSessionCredential: () => Promise<DashboardSessionCredential | null>;
  getDashboardToken: () => string | undefined;
  getBackendBaseUrl: () => string | undefined;
  getDashboardOrigin: () => string | undefined;
  fetchImpl: typeof fetch;
};

type TransportParams = {
  siteId: string;
  sourceId?: string;
};

const IMPORT_KEYS = new Set(["templateKeys", "mode"]);
const ITEM_KEYS = new Set(["templateKey", "sourceId", "status"]);
const TEMPLATE_KEYS = new Set([
  "key",
  "title",
  "category",
  "issueType",
  "tags",
  "importedSourceId",
]);

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

function safePathSegment(value: unknown) {
  if (
    typeof value !== "string"
    || !value
    || value !== value.trim()
    || value === "."
    || value === ".."
    || value.includes("*")
  ) {
    return null;
  }
  return encodeURIComponent(value);
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

function noStoreJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function safeError(status: number) {
  const messages: Record<number, string> = {
    400: "Ungültige Anfrage.",
    401: "Anmeldung erforderlich.",
    403: "Für diese Wissensverwaltung fehlt die Berechtigung.",
    404: "Wissensquelle nicht gefunden.",
    409: "Die Wissensvorlage konnte nicht übernommen werden.",
    500: "Die Wissensverwaltung ist momentan nicht verfügbar.",
  };
  return noStoreJson({ message: messages[status] || messages[500] }, status);
}

function requestPath(operation: CustomerKnowledgeOperation, params: TransportParams) {
  const siteId = safePathSegment(params.siteId);
  if (!siteId) return null;
  const base = `/customer/it-knowledge/${siteId}/templates`;
  if (operation === "list") return base;
  if (operation === "import") return `${base}/import`;
  const sourceId = safePathSegment(params.sourceId);
  return sourceId ? `${base}/${sourceId}` : null;
}

async function importBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!isRecord(body) || Object.keys(body).some((key) => !IMPORT_KEYS.has(key))) return null;
  if (!Array.isArray(body.templateKeys) || body.templateKeys.length === 0 || body.templateKeys.length > 20) {
    return null;
  }
  const templateKeys = body.templateKeys.map((key) => typeof key === "string" ? key.trim() : "");
  if (
    templateKeys.some((key) => !key || key.length > 120 || !/^[a-z0-9-]+$/.test(key))
    || new Set(templateKeys).size !== templateKeys.length
  ) {
    return null;
  }
  const mode = body.mode === undefined ? "skip_existing" : body.mode;
  if (mode !== "skip_existing" && mode !== "overwrite") return null;
  return JSON.stringify({ templateKeys, mode });
}

function safeTemplate(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, TEMPLATE_KEYS)) return null;
  if (
    !isText(value.key)
    || !isText(value.title)
    || !isText(value.category)
    || !isText(value.issueType)
    || !Array.isArray(value.tags)
    || !value.tags.every(isText)
    || !(value.importedSourceId === null || isText(value.importedSourceId))
  ) {
    return null;
  }
  return {
    key: value.key,
    title: value.title,
    category: value.category,
    issueType: value.issueType,
    tags: value.tags,
    importedSourceId: value.importedSourceId,
  };
}

function safeImportItem(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, ITEM_KEYS)) return null;
  if (
    !isText(value.templateKey)
    || !isText(value.sourceId)
    || !["imported", "skipped", "overwritten"].includes(String(value.status))
  ) {
    return null;
  }
  return {
    templateKey: value.templateKey,
    sourceId: value.sourceId,
    status: value.status,
  };
}

function safeArray<T>(value: unknown, mapper: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const mapped = value.map(mapper);
  return mapped.every((entry): entry is T => entry !== null) ? mapped : null;
}

function safeSuccess(operation: CustomerKnowledgeOperation, value: unknown) {
  if (!isRecord(value)) return null;

  if (operation === "list") {
    const keys = new Set([
      "tenantId",
      "siteId",
      "templates",
      "providerCallsUsed",
      "answerReadyTransitionAdded",
    ]);
    const templates = safeArray(value.templates, safeTemplate);
    if (
      !hasExactKeys(value, keys)
      || !isText(value.siteId)
      || value.providerCallsUsed !== false
      || value.answerReadyTransitionAdded !== false
      || !templates
    ) {
      return null;
    }
    return {
      siteId: value.siteId,
      templates,
      providerCallsUsed: false,
      answerReadyTransitionAdded: false,
    };
  }

  if (operation === "import") {
    const keys = new Set([
      "tenantId",
      "siteId",
      "mode",
      "imported",
      "skipped",
      "overwritten",
      "providerCallsUsed",
      "answerReadyTransitionAdded",
    ]);
    const imported = safeArray(value.imported, safeImportItem);
    const skipped = safeArray(value.skipped, safeImportItem);
    const overwritten = safeArray(value.overwritten, safeImportItem);
    if (
      !hasExactKeys(value, keys)
      || !isText(value.siteId)
      || !["skip_existing", "overwrite"].includes(String(value.mode))
      || !imported
      || !skipped
      || !overwritten
      || value.providerCallsUsed !== false
      || value.answerReadyTransitionAdded !== false
    ) {
      return null;
    }
    return {
      siteId: value.siteId,
      mode: value.mode,
      imported,
      skipped,
      overwritten,
      providerCallsUsed: false,
      answerReadyTransitionAdded: false,
    };
  }

  const keys = new Set(["ok", "sourceId", "siteId", "providerCallsUsed"]);
  if (
    !hasExactKeys(value, keys)
    || value.ok !== true
    || !isText(value.sourceId)
    || !isText(value.siteId)
    || value.providerCallsUsed !== false
  ) {
    return null;
  }
  return { ok: true, sourceId: value.sourceId, siteId: value.siteId, providerCallsUsed: false };
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

export function createCustomerKnowledgeTransport(
  dependencies: Partial<TransportDependencies> = {},
) {
  const deps = { ...productionDependencies(), ...dependencies };

  return async function forwardCustomerKnowledgeRequest(
    request: Request,
    operation: CustomerKnowledgeOperation,
    params: TransportParams,
  ) {
    const credential = await deps.getSessionCredential();
    if (!credential) return safeError(401);
    if (
      credential.session.role !== "customer"
      || !credential.session.tenantId
      || !credential.session.tenantUserId
    ) {
      return safeError(403);
    }

    const expectedMethod = operation === "list" ? "GET" : operation === "import" ? "POST" : "DELETE";
    if (request.method !== expectedMethod) return safeError(400);

    if (operation !== "list") {
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
    const body = operation === "import" ? await importBody(request) : undefined;
    if (operation === "import" && !body) return safeError(400);

    const dashboardToken = deps.getDashboardToken()?.trim() || "";
    const backendBase = trustedOrigin(deps.getBackendBaseUrl());
    if (dashboardToken.length < 32 || !backendBase) return safeError(500);

    let upstream: Response;
    try {
      upstream = await deps.fetchImpl(`${backendBase}${path}`, {
        method: expectedMethod,
        headers: {
          Authorization: `Bearer ${credential.token}`,
          "Content-Type": "application/json",
          "X-DASHBOARD-TOKEN": dashboardToken,
        },
        body,
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

    const expectedStatus = operation === "import" ? 201 : 200;
    if (upstream.status !== expectedStatus) return safeError(500);
    const value = await upstream.json().catch(() => null);
    const safeValue = safeSuccess(operation, value);
    return safeValue ? noStoreJson(safeValue, expectedStatus) : safeError(500);
  };
}

export const forwardCustomerKnowledgeRequest = createCustomerKnowledgeTransport();
