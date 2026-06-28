import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  if (!["admin", "operator"].includes(auth.session.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const backendResponse = await fetchDashboardBackend(
    `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/test-cases/run`,
    {
      method: "POST",
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
