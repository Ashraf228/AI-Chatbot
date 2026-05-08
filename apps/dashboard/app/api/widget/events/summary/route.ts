import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");
  const params = new URLSearchParams();
  if (siteId) params.set("siteId", siteId);
  const target = params.size > 0
    ? `/admin/widget/events/summary?${params.toString()}`
    : "/admin/widget/events/summary";

  const r = await fetchDashboardBackend(target, {
    method: "GET",
    session: auth.session,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
