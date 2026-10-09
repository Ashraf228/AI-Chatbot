import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  if (auth.session.role !== "admin" && auth.session.role !== "operator") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") || "50";
  const params = new URLSearchParams({ limit });
  const response = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/agent-activity?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      session: auth.session,
    },
  );
  const data = await response.json().catch(() => []);

  return NextResponse.json(data, { status: response.status });
}
