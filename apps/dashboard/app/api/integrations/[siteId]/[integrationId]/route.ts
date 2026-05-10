import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ siteId: string; integrationId: string }> }
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const body = await req.json();
  const { siteId, integrationId } = await context.params;
  await assertSiteAccess(auth.session, siteId);

  const response = await fetchDashboardBackend(
    `/admin/sites/${siteId}/integrations/${integrationId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      session: auth.session,
      body: JSON.stringify(body),
    }
  );
  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ siteId: string; integrationId: string }> }
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { siteId, integrationId } = await context.params;
  await assertSiteAccess(auth.session, siteId);

  const response = await fetchDashboardBackend(
    `/admin/sites/${siteId}/integrations/${integrationId}`,
    {
      method: "DELETE",
      session: auth.session,
    }
  );
  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
