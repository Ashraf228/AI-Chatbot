import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const { runId } = await context.params;

  const r = await fetchDashboardBackend(`/admin/agents/runs/${runId}/tools`, {
    method: "GET",
    session: auth.session,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "[]", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
