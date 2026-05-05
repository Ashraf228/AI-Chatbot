import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const body = await req.json();

  try {
    await assertSiteAccess(auth.session, String(body?.siteId || ""));
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const r = await fetchDashboardBackend("/admin/widget/reports/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
