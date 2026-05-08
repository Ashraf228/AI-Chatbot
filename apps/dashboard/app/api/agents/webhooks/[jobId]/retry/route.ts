import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(
  _req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const { jobId } = await context.params;

  const r = await fetchDashboardBackend(`/admin/agents/webhooks/${jobId}/retry`, {
    method: "POST",
    session: auth.session,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
