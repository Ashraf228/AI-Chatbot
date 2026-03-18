import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function requireAuth() {
  const cookieStore = await cookies();
  const ok = cookieStore.get("ssb_admin")?.value === "1";

  if (!ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return null;
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

  const r = await fetch(`${base}/admin/ingest/faq`, {
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