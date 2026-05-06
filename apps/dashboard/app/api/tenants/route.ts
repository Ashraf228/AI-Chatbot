import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();

  if (!base) {
    return NextResponse.json(
      { message: "BACKEND_BASE_URL missing in dashboard/.env.local" },
      { status: 500 }
    );
  }

  if (!adminKey) {
    return NextResponse.json(
      { message: "ADMIN_KEY missing in dashboard/.env.local" },
      { status: 500 }
    );
  }

  const r = await fetch(`${base}/admin/tenants`, {
    method: "GET",
    headers: {
      "X-DASHBOARD-TOKEN": adminKey,
      "X-DASHBOARD-ROLE": auth.session.role,
      "X-DASHBOARD-ACTOR": auth.session.sub,
    },
    cache: "no-store",
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();
  const body = await req.json();

  if (!base) {
    return NextResponse.json(
      { message: "BACKEND_BASE_URL missing in dashboard/.env.local" },
      { status: 500 }
    );
  }

  if (!adminKey) {
    return NextResponse.json(
      { message: "ADMIN_KEY missing in dashboard/.env.local" },
      { status: 500 }
    );
  }

  const r = await fetch(`${base}/admin/tenants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DASHBOARD-TOKEN": adminKey,
      "X-DASHBOARD-ROLE": auth.session.role,
      "X-DASHBOARD-ACTOR": auth.session.sub,
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
