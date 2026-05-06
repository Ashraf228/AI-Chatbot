import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => ({}));
  const response = await fetchDashboardBackend(`/admin/sites/${siteId}/apply-template`, {
    method: "POST",
    session: auth.session,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId: body.templateId || body.templateKey,
      mode: body.mode || "overwrite",
      appliedBy: auth.session.sub,
      actorRole: auth.session.role,
    }),
  });

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
