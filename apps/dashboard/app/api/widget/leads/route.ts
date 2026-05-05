import { NextResponse } from "next/server";
import {
  fetchDashboardBackend,
  filterItemsBySiteAccess,
  getAccessibleSiteIds,
} from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const url = new URL(req.url);

  const target = new URL("http://internal/admin/widget/leads");
  const siteId = url.searchParams.get("siteId");
  const status = url.searchParams.get("status");
  if (siteId) target.searchParams.set("siteId", siteId);
  if (status) target.searchParams.set("status", status);

  const r = await fetchDashboardBackend(`${target.pathname}${target.search}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = (await r.json().catch(() => [])) as Record<string, unknown>[];
  if (!r.ok) {
    return NextResponse.json(data, { status: r.status });
  }

  if (auth.session.role !== "customer") {
    return NextResponse.json(Array.isArray(data) ? data : []);
  }

  const allowedSiteIds = await getAccessibleSiteIds(auth.session);
  return NextResponse.json(
    filterItemsBySiteAccess(Array.isArray(data) ? data : [], allowedSiteIds)
  );
}
