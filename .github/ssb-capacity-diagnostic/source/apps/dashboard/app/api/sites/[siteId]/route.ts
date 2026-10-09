import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const body = await req.json();
  const { siteId } = await context.params;

  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const response = await fetchDashboardBackend(`/admin/sites/${siteId}`, {
    method: "PATCH",
    session: auth.session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { siteId } = await context.params;

  const response = await fetchDashboardBackend(`/admin/sites/${siteId}`, {
    method: "DELETE",
    session: auth.session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      confirmation: typeof body?.confirmation === "string" ? body.confirmation : "",
    }),
  });

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
