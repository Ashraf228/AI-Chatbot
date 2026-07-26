import { afterEach, describe, expect, test, vi } from "vitest";

import { POST } from "../app/api/sites/[siteId]/conversation-engine/runtime-pilot/route";

vi.mock("../lib/require-auth", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../lib/dashboard-api", () => ({
  assertSiteAccess: vi.fn(),
  fetchDashboardBackend: vi.fn(),
}));

import { requireSession } from "../lib/require-auth";
import { assertSiteAccess, fetchDashboardBackend } from "../lib/dashboard-api";

describe("conversation engine runtime pilot dashboard route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("forwards admin runtime pilot requests to the backend", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      response: null,
      session: {
        role: "admin",
        sub: "admin:test",
        tenantId: null,
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

  test("rejects non admin operator roles", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      response: null,
      session: {
        role: "customer",
        sub: "customer:test",
        tenantId: "tenant-1",
      },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/sites/site-1/conversation-engine/runtime-pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "demo" }),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(fetchDashboardBackend).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });
});
