import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

export async function POST(
  _req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();
  const { jobId } = await context.params;

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const r = await fetch(`${base}/admin/agents/webhooks/${jobId}/retry`, {
    method: "POST",
    headers: {
      "X-DASHBOARD-TOKEN": adminKey,
    },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
