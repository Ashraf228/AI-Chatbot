import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "../../../../../../../lib/dashboard-api";
import {
  authorizeCustomerWorkspaceProxy,
  customerWorkspaceAuthorizationHeaders,
} from "../../../../../../../lib/customer-workspace-proxy";

export async function GET(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await authorizeCustomerWorkspaceProxy(req, { mutating: false });
  if (auth.response) return auth.response;

  const { siteId } = await context.params;
  if (auth.credential.session.role !== "customer") {
    try {
      await assertSiteAccess(auth.credential.session, siteId);
    } catch {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const response = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/access`,
    {
      method: "GET",
      cache: "no-store",
      session: auth.credential.session,
      headers: customerWorkspaceAuthorizationHeaders(auth.credential),
    },
  );
  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}
