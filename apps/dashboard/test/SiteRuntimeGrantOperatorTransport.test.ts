import assert from "node:assert/strict";
import test from "node:test";

import { createTenantSessionToken } from "../lib/auth-core";
import {
  verifyDashboardSessionCredential,
  type DashboardSessionCredential,
} from "../lib/auth";
import {
  createSiteRuntimeGrantTransport,
  type SiteRuntimeGrantOperation,
  type SiteRuntimeGrantRouteParams,
} from "../lib/site-runtime-grant-transport";

const SESSION_SECRET = "synthetic-session-secret-for-dashboard-transport";
const SESSION_TOKEN = "synthetic.unchanged-session-token";
const DASHBOARD_TOKEN = "synthetic-dashboard-token-for-transport-tests";
const DASHBOARD_ORIGIN = "https://dashboard.synthetic.invalid";
const BACKEND_ORIGIN = "http://api.synthetic.invalid:5000";

function customerCredential(): DashboardSessionCredential {
  return {
    token: SESSION_TOKEN,
    session: {
      role: "customer",
      sub: "customer:t_default:operator@synthetic.invalid",
      tenantId: "t_default",
      tenantUserId: "operator-user-1",
      email: "operator@synthetic.invalid",
      displayName: "Synthetic Operator",
      iat: 1,
      exp: 2,
      sessionIssuedAt: new Date(1).toISOString(),
      sessionExpiresAt: new Date(2).toISOString(),
    },
  };
}

function terms() {
  return {
    validFrom: "2030-01-01T00:00:00.000Z",
    expiresAt: "2030-02-01T00:00:00.000Z",
    embeddingDimension: 1536,
    providerRegion: "synthetic-region",
    dataCategories: ["synthetic-support-content"],
    customerDataApproved: false,
    productionApproved: false,
    providerDpaApproved: false,
    retentionPolicy: "synthetic-retention",
    redactionPolicy: "synthetic-redaction",
    loggingPolicy: "synthetic-logging",
    deletionPolicy: "synthetic-deletion",
    reindexPolicy: null,
    rateLimit: "synthetic-rate-limit",
    costLimit: "synthetic-cost-limit",
    approvalEvidenceRef: "synthetic-evidence",
  };
}

function grant(id = "grant-1") {
  return {
    id,
    providerKey: "synthetic-provider",
    model: "synthetic-model",
    environment: "synthetic",
    validFrom: "2030-01-01T00:00:00.000Z",
    expiresAt: "2030-02-01T00:00:00.000Z",
    status: "scheduled",
    revokedAt: null,
  };
}

type FetchCall = { input: string; init: RequestInit };

function harness(
  responseFactory: () => Response = () => Response.json(
    { kind: "created", grant: grant() },
    { status: 201 },
  ),
  credential: DashboardSessionCredential | null = customerCredential(),
) {
  const calls: FetchCall[] = [];
  const forward = createSiteRuntimeGrantTransport({
    getSessionCredential: async () => credential,
    getDashboardToken: () => DASHBOARD_TOKEN,
    getBackendBaseUrl: () => BACKEND_ORIGIN,
    getDashboardOrigin: () => DASHBOARD_ORIGIN,
    fetchImpl: (async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push({ input: String(input), init: init || {} });
      return responseFactory();
    }) as typeof fetch,
  });
  return { calls, forward };
}

function request(method: "GET" | "POST", body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${DASHBOARD_ORIGIN}/api/internal/site-runtime-grants`, {
    method,
    headers: {
      ...(method === "POST"
        ? { Origin: DASHBOARD_ORIGIN, "Sec-Fetch-Site": "same-origin" }
        : {}),
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("returns the verified tenant session token unchanged", async () => {
  process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
  try {
    const token = await createTenantSessionToken({
      role: "customer",
      tenantId: "t_default",
      tenantUserId: "operator-user-1",
      email: "operator@synthetic.invalid",
      displayName: "Synthetic Operator",
    });
    const credential = await verifyDashboardSessionCredential(token);
    assert.equal(credential?.token, token);
    assert.equal(credential?.session.role, "customer");
    assert.equal(credential?.session.tenantUserId, "operator-user-1");
  } finally {
    delete process.env.ADMIN_SESSION_SECRET;
  }
});

test("rejects missing and shared operator sessions without an upstream call", async () => {
  const missing = harness(undefined, null);
  const missingResponse = await missing.forward(
    request("POST", terms()),
    "create",
    { tenantId: "tenant-target", siteId: "site-target" },
  );
  assert.equal(missingResponse.status, 401);
  assert.equal(missing.calls.length, 0);

  const shared = customerCredential();
  shared.session = { ...shared.session, role: "operator", tenantUserId: undefined };
  const sharedHarness = harness(undefined, shared);
  const sharedResponse = await sharedHarness.forward(
    request("POST", terms()),
    "create",
    { tenantId: "tenant-target", siteId: "site-target" },
  );
  assert.equal(sharedResponse.status, 401);
  assert.equal(sharedHarness.calls.length, 0);
});

test("rejects missing or mismatched mutation provenance without an upstream call", async () => {
  for (const headers of [
    { Origin: "", "Sec-Fetch-Site": "same-origin" },
    { Origin: "https://foreign.synthetic.invalid", "Sec-Fetch-Site": "same-origin" },
    { Origin: DASHBOARD_ORIGIN, "Sec-Fetch-Site": "same-site" },
    { Origin: DASHBOARD_ORIGIN, "Sec-Fetch-Site": "" },
  ]) {
    const current = harness();
    const response = await current.forward(
      request("POST", terms(), headers),
      "create",
      { tenantId: "tenant-target", siteId: "site-target" },
    );
    assert.equal(response.status, 403);
    assert.equal(current.calls.length, 0);
  }
});

test("forwards a valid create with only server-selected credentials and no caching", async () => {
  const current = harness();
  const response = await current.forward(
    request("POST", terms(), {
      Authorization: "Bearer browser-forgery",
      "X-DASHBOARD-TOKEN": "browser-forgery",
      "X-DASHBOARD-ACTOR": "browser-forgery",
      "X-DASHBOARD-ROLE": "admin",
      "X-ADMIN-KEY": "browser-forgery",
    }),
    "create",
    { tenantId: "tenant target", siteId: "site/target" },
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await body(response), { kind: "created", grant: grant() });
  assert.equal(current.calls.length, 1);
  assert.equal(
    current.calls[0].input,
    `${BACKEND_ORIGIN}/internal/site-runtime-grants/tenant%20target/site%2Ftarget`,
  );
  assert.equal(current.calls[0].init.method, "POST");
  assert.equal(current.calls[0].init.cache, "no-store");
  assert.equal(current.calls[0].init.redirect, "manual");
  assert.equal(current.calls[0].init.body, JSON.stringify(terms()));

  const forwardedHeaders = new Headers(current.calls[0].init.headers);
  assert.equal(forwardedHeaders.get("authorization"), `Bearer ${SESSION_TOKEN}`);
  assert.equal(forwardedHeaders.get("x-dashboard-token"), DASHBOARD_TOKEN);
  assert.equal(forwardedHeaders.get("x-dashboard-actor"), null);
  assert.equal(forwardedHeaders.get("x-dashboard-role"), null);
  assert.equal(forwardedHeaders.get("x-admin-key"), null);
});

test("maps preview, revoke, and status to fixed methods, URLs, and bodies", async () => {
  const cases: Array<{
    operation: SiteRuntimeGrantOperation;
    params: SiteRuntimeGrantRouteParams;
    request: Request;
    expectedPath: string;
    expectedBody?: string;
    response: unknown;
  }> = [
    {
      operation: "preview",
      params: { tenantId: "tenant-target", siteId: "site-target" },
      request: request("POST", terms()),
      expectedPath: "/internal/site-runtime-grants/tenant-target/site-target/preview",
      expectedBody: JSON.stringify(terms()),
      response: {
        kind: "would_create",
        runtime: { providerKey: "synthetic-provider", model: "synthetic-model", environment: "synthetic" },
      },
    },
    {
      operation: "revoke",
      params: { tenantId: "tenant-target", siteId: "site-target", grantId: "grant-1" },
      request: request("POST", { revocationReason: "synthetic-reason" }),
      expectedPath: "/internal/site-runtime-grants/tenant-target/site-target/grant-1/revoke",
      expectedBody: JSON.stringify({ revocationReason: "synthetic-reason" }),
      response: { kind: "revoked", grant: { ...grant(), status: "revoked", revokedAt: "2030-01-02T00:00:00.000Z" } },
    },
    {
      operation: "status",
      params: { tenantId: "tenant-target", siteId: "site-target", grantId: "grant-1" },
      request: request("GET"),
      expectedPath: "/internal/site-runtime-grants/tenant-target/site-target/grant-1",
      response: { kind: "found", grant: grant() },
    },
  ];

  for (const entry of cases) {
    const current = harness(() => Response.json(entry.response, { status: 200 }));
    const response = await current.forward(entry.request, entry.operation, entry.params);
    assert.equal(response.status, 200);
    assert.equal(current.calls[0].input, `${BACKEND_ORIGIN}${entry.expectedPath}`);
    assert.equal(current.calls[0].init.method, entry.operation === "status" ? "GET" : "POST");
    assert.equal(current.calls[0].init.body, entry.expectedBody);
    assert.deepEqual(await body(response), entry.response);
  }
});

test("rejects unknown body fields and unsafe identifiers without an upstream call", async () => {
  const unknownBody = harness();
  const unknownResponse = await unknownBody.forward(
    request("POST", { ...terms(), actorRole: "admin" }),
    "create",
    { tenantId: "tenant-target", siteId: "site-target" },
  );
  assert.equal(unknownResponse.status, 400);
  assert.equal(unknownBody.calls.length, 0);

  const unsafePath = harness();
  const unsafeResponse = await unsafePath.forward(
    request("GET"),
    "status",
    { tenantId: "..", siteId: "site-target", grantId: "grant-1" },
  );
  assert.equal(unsafeResponse.status, 400);
  assert.equal(unsafePath.calls.length, 0);
});

test("sanitizes redirects, upstream errors, and malformed success payloads", async () => {
  const cases = [
    () => new Response(null, { status: 307, headers: { Location: "https://foreign.synthetic.invalid" } }),
    () => Response.json({ message: "database detail", token: SESSION_TOKEN }, { status: 422 }),
    () => Response.json({ kind: "created", grant: grant(), internalPolicy: "secret" }, { status: 201 }),
  ];

  for (const responseFactory of cases) {
    const current = harness(responseFactory);
    const response = await current.forward(
      request("POST", terms()),
      "create",
      { tenantId: "tenant-target", siteId: "site-target" },
    );
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const serialized = JSON.stringify(await body(response));
    assert.equal(serialized.includes("database detail"), false);
    assert.equal(serialized.includes(SESSION_TOKEN), false);
    assert.equal(serialized.includes("internalPolicy"), false);
  }
});
