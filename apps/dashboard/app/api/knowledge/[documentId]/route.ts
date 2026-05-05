import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const { documentId } = await context.params;
  const url = new URL(_req.url);
  const siteId = url.searchParams.get("siteId") || "";

  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const r = await fetchDashboardBackend(`/admin/ingest/knowledge/${documentId}`, {
    method: "DELETE",
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
