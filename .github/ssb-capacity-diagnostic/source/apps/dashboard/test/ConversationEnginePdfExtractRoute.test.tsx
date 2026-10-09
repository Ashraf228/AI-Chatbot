import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../lib/customer-workspace-proxy", () => ({
  authorizeCustomerWorkspaceProxy: vi.fn(),
  customerWorkspaceAuthorizationHeaders: vi.fn(() => ({})),
}));

vi.mock("../lib/dashboard-api", () => ({
  assertSiteAccess: vi.fn(),
  fetchDashboardBackend: vi.fn(),
}));

import { POST } from "../app/api/sites/[siteId]/conversation-engine/knowledge/pdf-extract/route";
import { assertSiteAccess, fetchDashboardBackend } from "../lib/dashboard-api";
import {
  authorizeCustomerWorkspaceProxy,
  customerWorkspaceAuthorizationHeaders,
} from "../lib/customer-workspace-proxy";

function createFormDataRequest(formData: FormData) {
  return {
    formData: async () => formData,
  } as unknown as Request;
}

describe("conversation engine pdf extract dashboard route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("proxies PDF extraction only for admin/operator site-bound requests", async () => {
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
      new Response(
        JSON.stringify({
          fileName: "Demo Upload.pdf",
          extractedText: "Synthetischer Demo-PDF-Inhalt fuer den in-memory Knowledge Upload.",
          extractedChars: 67,
          originalChars: 67,
          truncated: false,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const formData = new FormData();
    formData.append(
      "file",
      new File(["%PDF demo"], "Demo Upload.pdf", { type: "application/pdf" }),
      "Demo Upload.pdf",
    );

    const response = await POST(createFormDataRequest(formData), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(assertSiteAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin" }),
      "site-1",
    );
    expect(fetchDashboardBackend).toHaveBeenCalledWith(
      "/admin/sites/site-1/conversation-engine/knowledge/pdf-extract",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        session: expect.objectContaining({ role: "admin" }),
        body: expect.any(FormData),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      fileName: "Demo Upload.pdf",
      extractedText: "Synthetischer Demo-PDF-Inhalt fuer den in-memory Knowledge Upload.",
      truncated: false,
    });
  });

  test("forwards bounded customer PDF extraction with the signed session", async () => {
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
      new Response(JSON.stringify({ fileName: "Demo Upload.pdf", extractedText: "Synthetic", truncated: false }), {
        status: 200,
      }),
    );

    const formData = new FormData();
    formData.append("file", new File(["%PDF demo"], "Demo Upload.pdf", { type: "application/pdf" }));

    const response = await POST(createFormDataRequest(formData), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(assertSiteAccess).not.toHaveBeenCalled();
    expect(fetchDashboardBackend).toHaveBeenCalledWith(
      "/admin/sites/site-1/conversation-engine/knowledge/pdf-extract",
      expect.objectContaining({
        headers: { Authorization: "Bearer customer-session" },
        body: expect.any(FormData),
      }),
    );
    expect(response.status).toBe(200);
  });

  test("rejects non-PDF uploads before any extraction runs", async () => {
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

    const formData = new FormData();
    formData.append("file", new File(["demo"], "notes.txt", { type: "text/plain" }));

    const response = await POST(createFormDataRequest(formData), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(fetchDashboardBackend).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "unsupported file type" });
  });

  test("rejects PDFs above the in-memory size boundary", async () => {
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

    const largePayload = "a".repeat(5 * 1024 * 1024 + 1);
    const formData = new FormData();
    formData.append(
      "file",
      new File([largePayload], "too-large.pdf", { type: "application/pdf" }),
      "too-large.pdf",
    );

    const response = await POST(createFormDataRequest(formData), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(fetchDashboardBackend).not.toHaveBeenCalled();
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ message: "PDF too large" });
  });
});
