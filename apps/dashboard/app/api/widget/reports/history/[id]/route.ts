import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const params = new URLSearchParams({
    actorId: auth.session.sub,
    actorRole: auth.session.role,
  });

  const response = await fetchDashboardBackend(`/admin/widget/reports/history/${id}?${params.toString()}`, {
    method: "DELETE",
    session: auth.session,
  });
  const data = await response.json().catch(() => ({}));

  return NextResponse.json(data, { status: response.status });
}
