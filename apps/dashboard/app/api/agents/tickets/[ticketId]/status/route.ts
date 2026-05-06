import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-auth";

export async function POST(
  req: Request,
  context: { params: Promise<{ ticketId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();
  const { ticketId } = await context.params;

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const body = await req.text();
  const r = await fetch(`${base}/admin/agents/tickets/${ticketId}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DASHBOARD-TOKEN": adminKey,
      "X-DASHBOARD-ROLE": auth.session.role,
      "X-DASHBOARD-ACTOR": auth.session.sub,
    },
    body,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
