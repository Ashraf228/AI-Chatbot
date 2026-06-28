import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

async function requireAdminSiteAccess(req: Request, context: { params: Promise<{ siteId: string }> }) {
  const auth = await requireSession();
  if (auth.response) return { auth, response: auth.response, siteId: "" };
  if (!["admin", "operator"].includes(auth.session.role)) {
    return { auth, response: NextResponse.json({ message: "Forbidden" }, { status: 403 }), siteId: "" };
  }
  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return { auth, response: NextResponse.json({ message: "Forbidden" }, { status: 403 }), siteId };
  }
  return { auth, response: null, siteId };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireAdminSiteAccess(req, context);
  if (response) return response;

  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/settings`,
    {
      method: "GET",
      cache: "no-store",
      session: auth.session,
    },
  );
  const text = await backendResponse.text();
  return new NextResponse(text || "{}", {
    status: backendResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { auth, response, siteId } = await requireAdminSiteAccess(req, context);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/settings`,
    {
      method: "PUT",
      cache: "no-store",
      session: auth.session,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const text = await backendResponse.text();
  return new NextResponse(text || "{}", {
    status: backendResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}
