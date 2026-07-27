import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "../../../../../../../lib/dashboard-api";
import { requireSession } from "../../../../../../../lib/require-auth";

async function requireAdminSiteAccess(context: { params: Promise<{ siteId: string }> }) {
  const auth = await requireSession();
  if (auth.response) {
    return { auth, response: auth.response, siteId: "" };
  }
  if (!["admin", "operator"].includes(auth.session.role)) {
    return {
      auth,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
      siteId: "",
    };
  }
  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return {
      auth,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
      siteId,
    };
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
  _req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireAdminSiteAccess(context);
  if (response) return response;

  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
    {
      method: "GET",
      cache: "no-store",
      session: auth.session,
    },
  );
  const text = await backendResponse.text();
  return noStoreJson(text, backendResponse.status);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireAdminSiteAccess(context);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
    {
      method: "PUT",
      cache: "no-store",
      session: auth.session,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const text = await backendResponse.text();
  return noStoreJson(text, backendResponse.status);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireAdminSiteAccess(context);
  if (response) return response;

  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
    {
      method: "DELETE",
      cache: "no-store",
      session: auth.session,
    },
  );
  const text = await backendResponse.text();
  return noStoreJson(text, backendResponse.status);
}
