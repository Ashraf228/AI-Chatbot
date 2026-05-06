import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");

  if (auth.session.role === "customer" && !siteId) {
    return NextResponse.json({ message: "siteId required" }, { status: 400 });
  }

  if (siteId) {
    try {
      await assertSiteAccess(auth.session, siteId);
    } catch {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const params = new URLSearchParams();
  if (siteId) params.set("siteId", siteId);
  params.set("actorId", auth.session.sub);
  params.set("actorRole", auth.session.role);

  const response = await fetchDashboardBackend(`/admin/conversations/export?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "text/csv; charset=utf-8",
      "Content-Disposition": response.headers.get("Content-Disposition") || 'attachment; filename="chats.csv"',
    },
  });
}
