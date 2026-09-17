import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../lib/require-auth", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../lib/dashboard-api", () => ({
  assertSiteAccess: vi.fn(),
  fetchDashboardBackend: vi.fn(),
}));

import { POST } from "../app/api/sites/[siteId]/conversation-engine/response-preview/route";
import { assertSiteAccess, fetchDashboardBackend } from "../lib/dashboard-api";
import { requireSession } from "../lib/require-auth";

describe("conversation engine response preview dashboard route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("forwards an authorized site-bound preview request without changing the API result", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      response: null,
      session: { role: "operator", sub: "operator:synthetic", tenantId: "tenant-preview" },
    } as never);
    vi.mocked(assertSiteAccess).mockResolvedValue(undefined);
    vi.mocked(fetchDashboardBackend).mockResolvedValue(new Response(JSON.stringify({
      responsePreviewEnabled: true,
      knowledgeRetrieval: { status: "error", warnings: ["Wissensbasis-Vorschau konnte nicht abgerufen werden."] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const body = { message: "synthetic preview", includeKnowledge: true };
    const response = await POST(
      new Request("http://localhost/api/sites/site-preview/conversation-engine/response-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ siteId: "site-preview" }) },
    );

    expect(assertSiteAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: "operator", tenantId: "tenant-preview" }),
      "site-preview",
    );
    expect(fetchDashboardBackend).toHaveBeenCalledWith(
      "/admin/sites/site-preview/conversation-engine/response-preview",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        session: expect.objectContaining({ role: "operator" }),
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      knowledgeRetrieval: { status: "error" },
    });
  });

  test("rejects customer sessions before the API preview route is called", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      response: null,
      session: { role: "customer", sub: "customer:synthetic", tenantId: "tenant-preview" },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/sites/site-preview/conversation-engine/response-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "synthetic preview", includeKnowledge: true }),
      }),
      { params: Promise.resolve({ siteId: "site-preview" }) },
    );

    expect(assertSiteAccess).not.toHaveBeenCalled();
    expect(fetchDashboardBackend).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });
});
