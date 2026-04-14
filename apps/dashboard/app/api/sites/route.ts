import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.ADMIN_KEY?.trim();

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

  const r = await fetch(`${base}/admin/sites`, {
    method: "GET",
    headers: {
      "X-ADMIN-KEY": adminKey,
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
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.ADMIN_KEY?.trim();
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

  const r = await fetch(`${base}/admin/sites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ADMIN-KEY": adminKey,
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
