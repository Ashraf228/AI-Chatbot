import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "../../../../../../../lib/dashboard-api";
import {
  authorizeCustomerWorkspaceProxy,
  customerWorkspaceAuthorizationHeaders,
} from "../../../../../../../lib/customer-workspace-proxy";

async function requireWorkspaceSiteAccess(
  request: Request,
  context: { params: Promise<{ siteId: string }> },
  mutating: boolean,
) {
  const auth = await authorizeCustomerWorkspaceProxy(request, { mutating });
  if (auth.response) {
    return { auth, response: auth.response, siteId: "" };
  }
  const { siteId } = await context.params;
  if (auth.credential.session.role !== "customer") {
    try {
      await assertSiteAccess(auth.credential.session, siteId);
    } catch {
      return {
        auth,
        response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
        siteId,
      };
    }
  }
  return { auth, response: null, siteId };
}

function noStoreJson(text: string, status: number) {
  return new NextResponse(text || "{}", {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireWorkspaceSiteAccess(req, context, false);
  if (response) return response;

  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
    {
      method: "GET",
      cache: "no-store",
      session: auth.credential.session,
      headers: customerWorkspaceAuthorizationHeaders(auth.credential),
    },
  );
  const text = await backendResponse.text();
  return noStoreJson(text, backendResponse.status);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireWorkspaceSiteAccess(req, context, true);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
    {
      method: "PUT",
      cache: "no-store",
      session: auth.credential.session,
      headers: {
        "Content-Type": "application/json",
        ...customerWorkspaceAuthorizationHeaders(auth.credential),
      },
      body: JSON.stringify(body),
    },
  );
  const text = await backendResponse.text();
  return noStoreJson(text, backendResponse.status);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireWorkspaceSiteAccess(req, context, true);
  if (response) return response;

  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
    {
      method: "DELETE",
      cache: "no-store",
      session: auth.credential.session,
      headers: customerWorkspaceAuthorizationHeaders(auth.credential),
    },
  );
  const text = await backendResponse.text();
  return noStoreJson(text, backendResponse.status);
}
