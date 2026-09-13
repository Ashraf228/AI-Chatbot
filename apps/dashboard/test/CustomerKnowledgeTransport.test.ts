import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardSessionCredential } from "../lib/auth";
import {
  createCustomerKnowledgeTransport,
  type CustomerKnowledgeOperation,
} from "../lib/customer-knowledge-transport";

const SESSION_TOKEN = "synthetic.unchanged-customer-session";
const DASHBOARD_TOKEN = "synthetic-dashboard-token-for-knowledge-transport";
const DASHBOARD_ORIGIN = "https://dashboard.synthetic.invalid";
const BACKEND_ORIGIN = "http://api.synthetic.invalid:5000";

function customerCredential(): DashboardSessionCredential {
  return {
    token: SESSION_TOKEN,
    session: {
      role: "customer",
      sub: "customer:tenant-1:poweruser@synthetic.invalid",
      tenantId: "tenant-1",
      tenantUserId: "poweruser-1",
      email: "poweruser@synthetic.invalid",
      displayName: "Synthetic Poweruser",
      iat: 1,
      exp: 2,
      sessionIssuedAt: new Date(1).toISOString(),
      sessionExpiresAt: new Date(2).toISOString(),
    },
  };
}

function catalog() {
  return {
    tenantId: "tenant-1",
    siteId: "site-1",
    templates: [{
      key: "vpn-not-connecting",
      title: "VPN verbindet nicht",
      category: "connectivity",
      issueType: "vpn",
      tags: ["vpn"],
      importedSourceId: null,
    }],
    providerCallsUsed: false,
    answerReadyTransitionAdded: false,
  };
}

function importResult() {
  return {
    tenantId: "tenant-1",
    siteId: "site-1",
    mode: "skip_existing",
    imported: [{ templateKey: "vpn-not-connecting", sourceId: "source-1", status: "imported" }],
    skipped: [],
    overwritten: [],
    providerCallsUsed: false,
    answerReadyTransitionAdded: false,
  };
}

type FetchCall = { input: string; init: RequestInit };

function harness(
  responseFactory: () => Response = () => Response.json(catalog()),
  credential: DashboardSessionCredential | null = customerCredential(),
) {
  const calls: FetchCall[] = [];
  const forward = createCustomerKnowledgeTransport({
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

function request(method: "GET" | "POST" | "DELETE", body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${DASHBOARD_ORIGIN}/api/sites/site-1/it-knowledge/templates`, {
    method,
    headers: {
      ...(method === "GET" ? {} : { Origin: DASHBOARD_ORIGIN, "Sec-Fetch-Site": "same-origin" }),
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("requires an individual customer session and never accepts viewer or operator role alone", async () => {
  const missing = harness(undefined, null);
  assert.equal((await missing.forward(request("GET"), "list", { siteId: "site-1" })).status, 401);

  for (const role of ["viewer", "operator"] as const) {
    const credential = customerCredential();
    credential.session = { ...credential.session, role };
    const current = harness(undefined, credential);
    assert.equal((await current.forward(request("GET"), "list", { siteId: "site-1" })).status, 403);
    assert.equal(current.calls.length, 0);
  }
});

test("forwards list with the signed token and strips tenant identity from the browser response", async () => {
  const current = harness();
  const response = await current.forward(request("GET"), "list", { siteId: "site-1" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await body(response), {
    siteId: "site-1",
    templates: catalog().templates,
    providerCallsUsed: false,
    answerReadyTransitionAdded: false,
  });
  assert.equal(current.calls[0].input, `${BACKEND_ORIGIN}/customer/it-knowledge/site-1/templates`);
  const headers = new Headers(current.calls[0].init.headers);
  assert.equal(headers.get("authorization"), `Bearer ${SESSION_TOKEN}`);
  assert.equal(headers.get("x-dashboard-token"), DASHBOARD_TOKEN);
});

test("requires exact same-origin provenance for import and delete", async () => {
  const operations: Array<{ operation: CustomerKnowledgeOperation; method: "POST" | "DELETE"; body?: unknown }> = [
    { operation: "import", method: "POST", body: { templateKeys: ["vpn-not-connecting"] } },
    { operation: "delete", method: "DELETE" },
  ];
  for (const entry of operations) {
    const current = harness();
    const response = await current.forward(
      request(entry.method, entry.body, { Origin: "https://foreign.synthetic.invalid" }),
      entry.operation,
      { siteId: "site-1", sourceId: "source-1" },
    );
    assert.equal(response.status, 403);
    assert.equal(current.calls.length, 0);
  }
});

test("forwards only the exact import contract and ignores forged browser credentials", async () => {
  const current = harness(() => Response.json(importResult(), { status: 201 }));
  const response = await current.forward(
    request("POST", { templateKeys: ["vpn-not-connecting"], mode: "skip_existing" }, {
      Authorization: "Bearer browser-forgery",
      "X-DASHBOARD-TOKEN": "browser-forgery",
      "X-ADMIN-KEY": "browser-forgery",
    }),
    "import",
    { siteId: "site-1" },
  );
  assert.equal(response.status, 201);
  assert.equal(current.calls[0].init.body, JSON.stringify({
    templateKeys: ["vpn-not-connecting"],
    mode: "skip_existing",
  }));
  const headers = new Headers(current.calls[0].init.headers);
  assert.equal(headers.get("authorization"), `Bearer ${SESSION_TOKEN}`);
  assert.equal(headers.get("x-admin-key"), null);
  assert.equal(headers.get("x-dashboard-token"), DASHBOARD_TOKEN);
});

test("rejects reserved fields, duplicates, and unsafe resource identifiers before upstream", async () => {
  for (const invalidBody of [
    { templateKeys: ["vpn-not-connecting"], tenantId: "tenant-other" },
    { templateKeys: ["vpn-not-connecting"], providerKey: "synthetic-provider" },
    { templateKeys: ["vpn-not-connecting", "vpn-not-connecting"] },
  ]) {
    const current = harness();
    const response = await current.forward(request("POST", invalidBody), "import", { siteId: "site-1" });
    assert.equal(response.status, 400);
    assert.equal(current.calls.length, 0);
  }

  const unsafe = harness();
  const response = await unsafe.forward(request("DELETE"), "delete", { siteId: "site-1", sourceId: ".." });
  assert.equal(response.status, 400);
  assert.equal(unsafe.calls.length, 0);
});

test("maps an owned draft deletion to the fixed API route", async () => {
  const current = harness(() => Response.json({
    ok: true,
    sourceId: "source-1",
    siteId: "site-1",
    providerCallsUsed: false,
  }));
  const response = await current.forward(request("DELETE"), "delete", {
    siteId: "site-1",
    sourceId: "source-1",
  });
  assert.equal(response.status, 200);
  assert.equal(current.calls[0].input, `${BACKEND_ORIGIN}/customer/it-knowledge/site-1/templates/source-1`);
  assert.equal(current.calls[0].init.method, "DELETE");
  assert.equal(current.calls[0].init.body, undefined);
});

test("sanitizes redirects, backend details, and malformed success responses", async () => {
  const cases = [
    () => new Response(null, { status: 307, headers: { Location: "https://foreign.synthetic.invalid" } }),
    () => Response.json({ message: "database detail", token: SESSION_TOKEN }, { status: 422 }),
    () => Response.json({ ...catalog(), internalPolicy: "secret" }),
  ];
  for (const responseFactory of cases) {
    const current = harness(responseFactory);
    const response = await current.forward(request("GET"), "list", { siteId: "site-1" });
    assert.equal(response.status, 500);
    const serialized = JSON.stringify(await body(response));
    assert.equal(serialized.includes("database detail"), false);
    assert.equal(serialized.includes(SESSION_TOKEN), false);
    assert.equal(serialized.includes("internalPolicy"), false);
  }
});
