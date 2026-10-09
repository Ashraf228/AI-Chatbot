import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  try {
    const auth = await requireSession({ adminOnly: true });
    if (auth.response) return auth.response;

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");
    const siteId = url.searchParams.get("siteId");
    const summary = url.searchParams.get("summary");

    const targetParams = new URLSearchParams();
    if (tenantId) targetParams.set("tenantId", tenantId);
    if (siteId) targetParams.set("siteId", siteId);

    const targetPath = summary === "1" ? "/admin/usage/summary" : "/admin/usage";
    const target = targetParams.size > 0 ? `${targetPath}?${targetParams.toString()}` : targetPath;

    const r = await fetchDashboardBackend(target, {
      method: "GET",
      session: auth.session,
      cache: "no-store",
    });

    const text = await r.text();

    return new NextResponse(text || (summary === "1" ? "{}" : "[]"), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
