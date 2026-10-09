import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";

  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const response = await fetchDashboardBackend("/admin/ingest/manual", {
    method: "POST",
    session: auth.session,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
