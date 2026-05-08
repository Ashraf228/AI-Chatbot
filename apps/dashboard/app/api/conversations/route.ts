import { NextResponse } from "next/server";
import {
  fetchDashboardBackend,
  filterItemsBySiteAccess,
  getAccessibleSiteIds,
} from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  try {
    const auth = await requireSession({ allowCustomer: true });
    if (auth.response) return auth.response;

    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");

    const target = siteId
      ? `/admin/conversations?siteId=${encodeURIComponent(siteId)}`
      : `/admin/conversations`;

    const r = await fetchDashboardBackend(target, {
      method: "GET",
      cache: "no-store",
      session: auth.session,
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
  } catch (err: unknown) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
