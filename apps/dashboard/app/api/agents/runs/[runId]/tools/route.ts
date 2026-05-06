import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();
  const { runId } = await context.params;

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const r = await fetch(`${base}/admin/agents/runs/${runId}/tools`, {
    method: "GET",
    headers: {
      "X-DASHBOARD-TOKEN": adminKey,
      "X-DASHBOARD-ROLE": auth.session.role,
      "X-DASHBOARD-ACTOR": auth.session.sub,
    },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "[]", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
