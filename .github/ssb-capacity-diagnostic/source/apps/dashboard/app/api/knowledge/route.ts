import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId") || "";

  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const r = await fetchDashboardBackend(
    `/admin/ingest/knowledge?siteId=${encodeURIComponent(siteId)}`,
    {
      method: "GET",
      cache: "no-store",
      session: auth.session,
    }
  );

  const text = await r.text();
  return new NextResponse(text || "[]", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
