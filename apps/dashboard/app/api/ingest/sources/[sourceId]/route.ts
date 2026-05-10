import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  const auth = await requireSession({ allowCustomer: false });
  if (auth.response) return auth.response;

  const { sourceId } = await context.params;
  const response = await fetchDashboardBackend(`/admin/ingest/sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
    session: auth.session,
  });

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
