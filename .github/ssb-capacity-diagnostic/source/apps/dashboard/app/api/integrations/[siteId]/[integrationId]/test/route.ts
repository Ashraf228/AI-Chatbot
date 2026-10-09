import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(
  _req: Request,
  context: { params: Promise<{ siteId: string; integrationId: string }> }
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { siteId, integrationId } = await context.params;
  await assertSiteAccess(auth.session, siteId);

  const response = await fetchDashboardBackend(
    `/admin/sites/${siteId}/integrations/${integrationId}/test`,
    {
      method: "POST",
      session: auth.session,
    }
  );
  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
