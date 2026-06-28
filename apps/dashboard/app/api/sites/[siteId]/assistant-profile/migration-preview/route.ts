import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  if (!["admin", "operator"].includes(auth.session.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const response = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/assistant-profile/migration-preview`,
    {
      method: "GET",
      cache: "no-store",
      session: auth.session,
    },
  );

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
