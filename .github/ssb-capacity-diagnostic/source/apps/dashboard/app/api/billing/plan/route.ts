import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  const target = tenantId ? `/admin/billing/plan?tenantId=${encodeURIComponent(tenantId)}` : "/admin/billing/plan";
  const response = await fetchDashboardBackend(target, {
    method: "GET",
    cache: "no-store",
    session: auth.session,
  });
  const text = await response.text();

  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(req: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const body = await req.text();
  const response = await fetchDashboardBackend("/admin/billing/plan", {
    method: "PATCH",
    body,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    session: auth.session,
  });
  const text = await response.text();

  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
