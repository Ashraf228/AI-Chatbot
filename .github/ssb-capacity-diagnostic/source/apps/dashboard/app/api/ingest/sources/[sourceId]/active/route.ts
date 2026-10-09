import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  const auth = await requireSession({ allowCustomer: false });
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { sourceId } = await context.params;
  const response = await fetchDashboardBackend(`/admin/ingest/sources/${encodeURIComponent(sourceId)}/active`, {
    method: "PATCH",
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
