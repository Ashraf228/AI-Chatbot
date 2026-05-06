import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();
  const { siteId } = await context.params;

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const r = await fetch(`${base}/admin/integrations/${siteId}`, {
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();
  const body = await req.json();
  const { siteId } = await context.params;

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const r = await fetch(`${base}/admin/integrations/${siteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-DASHBOARD-TOKEN": adminKey,
      "X-DASHBOARD-ROLE": auth.session.role,
      "X-DASHBOARD-ACTOR": auth.session.sub,
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new NextResponse(text || "[]", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
