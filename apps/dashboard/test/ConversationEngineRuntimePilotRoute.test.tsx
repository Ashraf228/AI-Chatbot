import { afterEach, describe, expect, test, vi } from "vitest";

import { POST } from "../app/api/sites/[siteId]/conversation-engine/runtime-pilot/route";

vi.mock("../lib/customer-workspace-proxy", () => ({
  authorizeCustomerWorkspaceProxy: vi.fn(),
  customerWorkspaceAuthorizationHeaders: vi.fn(() => ({})),
}));

vi.mock("../lib/dashboard-api", () => ({
  assertSiteAccess: vi.fn(),
  fetchDashboardBackend: vi.fn(),
}));

import { assertSiteAccess, fetchDashboardBackend } from "../lib/dashboard-api";
import {
  authorizeCustomerWorkspaceProxy,
  customerWorkspaceAuthorizationHeaders,
} from "../lib/customer-workspace-proxy";

describe("conversation engine runtime pilot dashboard route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("forwards admin runtime pilot requests to the backend", async () => {
    vi.mocked(authorizeCustomerWorkspaceProxy).mockResolvedValue({
      response: null,
      credential: {
        token: "admin-session",
        session: {
          role: "admin",
          sub: "admin:test",
          tenantId: null,
        },
      },
    } as never);
    vi.mocked(assertSiteAccess).mockResolvedValue(undefined);
    vi.mocked(fetchDashboardBackend).mockResolvedValue(
      new Response(JSON.stringify({ runtimePilotEnabled: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/sites/site-1/conversation-engine/runtime-pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "demo" }),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(assertSiteAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin" }),
      "site-1",
    );
    expect(fetchDashboardBackend).toHaveBeenCalledWith(
      "/admin/sites/site-1/conversation-engine/runtime-pilot",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ runtimePilotEnabled: true });
  });

  test("forwards a customer runtime request with its signed session for API revalidation", async () => {
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
      new Response(JSON.stringify({ runtimePilotEnabled: true }), { status: 200 }),
    );

    const response = await POST(
      new Request("http://localhost/api/sites/site-1/conversation-engine/runtime-pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "demo" }),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(assertSiteAccess).not.toHaveBeenCalled();
    expect(fetchDashboardBackend).toHaveBeenCalledWith(
      "/admin/sites/site-1/conversation-engine/runtime-pilot",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer customer-session" }),
      }),
    );
    expect(response.status).toBe(200);
  });
});
