import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "../../../../../../lib/dashboard-api";
import {
  authorizeCustomerWorkspaceProxy,
  customerWorkspaceAuthorizationHeaders,
} from "../../../../../../lib/customer-workspace-proxy";

export async function POST(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await authorizeCustomerWorkspaceProxy(req, { mutating: true });
  if (auth.response) return auth.response;

  const { siteId } = await context.params;
  if (auth.credential.session.role !== "customer") {
    try {
      await assertSiteAccess(auth.credential.session, siteId);
    } catch {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const response = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/runtime-pilot`,
    {
      method: "POST",
      cache: "no-store",
      session: auth.credential.session,
      headers: {
        "Content-Type": "application/json",
        ...customerWorkspaceAuthorizationHeaders(auth.credential),
      },
      body: JSON.stringify(body),
    },
  );

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
