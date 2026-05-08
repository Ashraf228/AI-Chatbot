import { NextResponse } from "next/server";
import {
  assertSiteAccess,
  fetchDashboardBackend,
  filterItemsBySiteAccess,
  getAccessibleSiteIds,
} from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");

  const target = new URL("http://internal/admin/widget/report-subscriptions");
  if (siteId) target.searchParams.set("siteId", siteId);

  const r = await fetchDashboardBackend(`${target.pathname}${target.search}`, {
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
}

export async function POST(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const body = await req.json();

  try {
    await assertSiteAccess(auth.session, String(body?.siteId || ""));
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const r = await fetchDashboardBackend("/admin/widget/report-subscriptions", {
    method: "POST",
    session: auth.session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
