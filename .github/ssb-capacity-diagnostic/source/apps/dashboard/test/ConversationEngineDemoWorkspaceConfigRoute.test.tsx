import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../lib/customer-workspace-proxy", () => ({
  authorizeCustomerWorkspaceProxy: vi.fn(),
  customerWorkspaceAuthorizationHeaders: vi.fn(() => ({})),
}));

vi.mock("../lib/dashboard-api", () => ({
  assertSiteAccess: vi.fn(),
  fetchDashboardBackend: vi.fn(),
}));

import {
  DELETE,
  GET,
  PUT,
} from "../app/api/sites/[siteId]/conversation-engine/demo-workspace/config/route";
import { GET as GET_ACCESS } from "../app/api/sites/[siteId]/conversation-engine/demo-workspace/access/route";
import { assertSiteAccess, fetchDashboardBackend } from "../lib/dashboard-api";
import {
  authorizeCustomerWorkspaceProxy,
  customerWorkspaceAuthorizationHeaders,
} from "../lib/customer-workspace-proxy";

describe("conversation engine demo workspace config dashboard route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("proxies load/save/reset only for admin/operator site-bound requests", async () => {
    vi.mocked(authorizeCustomerWorkspaceProxy).mockResolvedValue({
      response: null,
      credential: {
        token: "operator-session",
        session: {
          role: "operator",
          sub: "operator:test",
          tenantId: "tenant-1",
        },
      },
    } as never);
    vi.mocked(assertSiteAccess).mockResolvedValue(undefined);
    vi.mocked(fetchDashboardBackend)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hasSavedConfig: false, savedConfig: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ saved: true, hasSavedConfig: true, savedConfig: { assistantName: "Demo" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deleted: true, hadSavedConfig: true, hasSavedConfig: false, savedConfig: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const getResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });
    const putResponse = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantName: "Demo" }),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );
    const deleteResponse = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(assertSiteAccess).toHaveBeenCalledTimes(3);
    expect(fetchDashboardBackend).toHaveBeenNthCalledWith(
      1,
      "/admin/sites/site-1/conversation-engine/demo-workspace/config",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(fetchDashboardBackend).toHaveBeenNthCalledWith(
      2,
      "/admin/sites/site-1/conversation-engine/demo-workspace/config",
      expect.objectContaining({
        method: "PUT",
        cache: "no-store",
        body: JSON.stringify({ assistantName: "Demo" }),
      }),
    );
    expect(fetchDashboardBackend).toHaveBeenNthCalledWith(
      3,
      "/admin/sites/site-1/conversation-engine/demo-workspace/config",
      expect.objectContaining({
        method: "DELETE",
        cache: "no-store",
      }),
    );
    expect(getResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(putResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(deleteResponse.headers.get("Cache-Control")).toBe("no-store");
  });

  test("forwards a bounded customer session token for API-side authorization", async () => {
    vi.mocked(authorizeCustomerWorkspaceProxy).mockResolvedValue({
      response: null,
      credential: {
        token: "customer-session",
        session: {
          role: "customer",
          sub: "customer:tenant-1:user@synthetic.invalid",
          tenantId: "tenant-1",
          tenantUserId: "user-1",
        },
      },
    } as never);
    vi.mocked(customerWorkspaceAuthorizationHeaders).mockReturnValue({
      Authorization: "Bearer customer-session",
    });
    vi.mocked(fetchDashboardBackend).mockResolvedValue(
      new Response(JSON.stringify({ hasSavedConfig: false, savedConfig: null }), { status: 200 }),
    );

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(assertSiteAccess).not.toHaveBeenCalled();
    expect(fetchDashboardBackend).toHaveBeenCalledWith(
      "/admin/sites/site-1/conversation-engine/demo-workspace/config",
      expect.objectContaining({
        session: expect.objectContaining({ role: "customer", tenantUserId: "user-1" }),
        headers: { Authorization: "Bearer customer-session" },
      }),
    );
    expect(response.status).toBe(200);
  });

  test("uses the API access endpoint as the customer navigation authority", async () => {
    vi.mocked(authorizeCustomerWorkspaceProxy).mockResolvedValue({
      response: null,
      credential: {
        token: "customer-session",
        session: {
          role: "customer",
          sub: "customer:tenant-1:user@synthetic.invalid",
          tenantId: "tenant-1",
          tenantUserId: "user-1",
        },
      },
    } as never);
    vi.mocked(customerWorkspaceAuthorizationHeaders).mockReturnValue({
      Authorization: "Bearer customer-session",
    });
    vi.mocked(fetchDashboardBackend).mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, siteId: "site-1" }), { status: 200 }),
    );

    const response = await GET_ACCESS(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(assertSiteAccess).not.toHaveBeenCalled();
    expect(fetchDashboardBackend).toHaveBeenCalledWith(
      "/admin/sites/site-1/conversation-engine/demo-workspace/access",
      expect.objectContaining({ headers: { Authorization: "Bearer customer-session" } }),
    );
    await expect(response.json()).resolves.toEqual({ allowed: true, siteId: "site-1" });
  });
});
