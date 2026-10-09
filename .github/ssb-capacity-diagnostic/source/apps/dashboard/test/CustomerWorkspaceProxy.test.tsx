import { describe, expect, test, vi } from "vitest";

vi.mock("../lib/auth", () => ({
  getDashboardSessionCredential: vi.fn(),
}));

import {
  createCustomerWorkspaceProxyAuthorizer,
  customerWorkspaceAuthorizationHeaders,
} from "../lib/customer-workspace-proxy";

const customerCredential = {
  token: "synthetic-customer-session-token",
  session: {
    role: "customer" as const,
    sub: "customer:tenant-1:user@synthetic.invalid",
    tenantId: "tenant-1",
    tenantUserId: "user-1",
    email: "user@synthetic.invalid",
    displayName: "Synthetic User",
    iat: 1,
    exp: 2,
    sessionIssuedAt: "2026-01-01T00:00:00.000Z",
    sessionExpiresAt: "2026-01-01T01:00:00.000Z",
  },
};

function request(headers: Readonly<Record<string, string>> = {}) {
  return new Request("https://dashboard.synthetic.invalid/api/workspace", { headers });
}

describe("customer workspace proxy authorizer", () => {
  test("accepts an individual customer session and forwards only its signed bearer token", async () => {
    const authorize = createCustomerWorkspaceProxyAuthorizer({
      getSessionCredential: async () => customerCredential,
      getDashboardOrigin: () => "https://dashboard.synthetic.invalid",
    });

    const result = await authorize(request(), { mutating: false });
    expect(result.response).toBeNull();
    expect(result.credential).toEqual(customerCredential);
    expect(customerWorkspaceAuthorizationHeaders(customerCredential)).toEqual({
      Authorization: "Bearer synthetic-customer-session-token",
    });
  });

  test("requires same-origin browser provenance for customer mutations", async () => {
    const authorize = createCustomerWorkspaceProxyAuthorizer({
      getSessionCredential: async () => customerCredential,
      getDashboardOrigin: () => "https://dashboard.synthetic.invalid",
    });

    const allowed = await authorize(request({
      Origin: "https://dashboard.synthetic.invalid",
      "Sec-Fetch-Site": "same-origin",
    }), { mutating: true });
    expect(allowed.response).toBeNull();

    for (const headers of [
      {},
      { Origin: "https://other.synthetic.invalid", "Sec-Fetch-Site": "same-origin" },
      { Origin: "https://dashboard.synthetic.invalid", "Sec-Fetch-Site": "same-site" },
    ]) {
      const denied = await authorize(request(headers), { mutating: true });
      expect(denied.response?.status).toBe(403);
    }
  });

  test("rejects anonymous, viewer, and incomplete customer sessions", async () => {
    const credentials = [
      null,
      { ...customerCredential, session: { ...customerCredential.session, role: "viewer" as const } },
      { ...customerCredential, session: { ...customerCredential.session, tenantUserId: undefined } },
    ];

    for (const credential of credentials) {
      const authorize = createCustomerWorkspaceProxyAuthorizer({
        getSessionCredential: async () => credential,
        getDashboardOrigin: () => "https://dashboard.synthetic.invalid",
      });
      const result = await authorize(request(), { mutating: false });
      expect(result.response?.status).toBe(credential ? 403 : 401);
    }
  });

  test("preserves admin and shared operator proxy behavior without inventing a bearer identity", async () => {
    for (const role of ["admin", "operator"] as const) {
      const credential = {
        ...customerCredential,
        token: `synthetic-${role}-session`,
        session: { ...customerCredential.session, role, tenantId: undefined, tenantUserId: undefined },
      };
      const authorize = createCustomerWorkspaceProxyAuthorizer({
        getSessionCredential: async () => credential,
        getDashboardOrigin: () => "https://dashboard.synthetic.invalid",
      });
      const result = await authorize(request(), { mutating: false });
      expect(result.response).toBeNull();
      expect(customerWorkspaceAuthorizationHeaders(credential)).toEqual({});
    }
  });
});
