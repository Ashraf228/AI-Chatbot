import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(
  _req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const response = await fetchDashboardBackend(`/admin/sites/${siteId}/go-live`, {
    method: "POST",
    session: auth.session,
    body: JSON.stringify({
      actorId: auth.session.sub,
      actorRole: auth.session.role,
    }),
  });
  const data = await response.json().catch(() => ({}));

  return NextResponse.json(data, { status: response.status });
}
