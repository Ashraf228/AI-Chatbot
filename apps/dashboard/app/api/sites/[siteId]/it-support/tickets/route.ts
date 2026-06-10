import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const target = `/admin/sites/${encodeURIComponent(siteId)}/it-support/tickets${url.search}`;
  const response = await fetchDashboardBackend(target, {
    method: "GET",
    session: auth.session,
    cache: "no-store",
  });
  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
