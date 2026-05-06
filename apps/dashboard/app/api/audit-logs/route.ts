import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  if (auth.session.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");
  const limit = url.searchParams.get("limit") || "100";

  if (siteId) {
    try {
      await assertSiteAccess(auth.session, siteId);
    } catch {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const params = new URLSearchParams();
  if (siteId) params.set("siteId", siteId);
  params.set("limit", limit);

  const response = await fetchDashboardBackend(`/admin/audit-logs?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    session: auth.session,
  });
  const data = await response.json().catch(() => []);

  return NextResponse.json(data, { status: response.status });
}
