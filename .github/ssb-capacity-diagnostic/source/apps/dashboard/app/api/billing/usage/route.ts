import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  const target = tenantId ? `/admin/billing/usage?tenantId=${encodeURIComponent(tenantId)}` : "/admin/billing/usage";
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
