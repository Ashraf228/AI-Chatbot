import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../lib/require-auth", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../lib/dashboard-api", () => ({
  assertSiteAccess: vi.fn(),
  fetchDashboardBackend: vi.fn(),
}));

import { POST } from "../app/api/sites/[siteId]/conversation-engine/knowledge/pdf-extract/route";
import { assertSiteAccess, fetchDashboardBackend } from "../lib/dashboard-api";
import { requireSession } from "../lib/require-auth";

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

  test("rejects customer sessions for the demo PDF extract route", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      response: null,
      session: {
        role: "customer",
        sub: "customer:test",
        tenantId: "tenant-1",
      },
    } as never);

    const formData = new FormData();
    formData.append("file", new File(["%PDF demo"], "Demo Upload.pdf", { type: "application/pdf" }));

    const response = await POST(createFormDataRequest(formData), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(assertSiteAccess).not.toHaveBeenCalled();
    expect(fetchDashboardBackend).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  test("rejects non-PDF uploads before any extraction runs", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      response: null,
      session: {
        role: "operator",
        sub: "operator:test",
        tenantId: "tenant-1",
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
    vi.mocked(requireSession).mockResolvedValue({
      response: null,
      session: {
        role: "admin",
        sub: "admin:test",
        tenantId: null,
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
