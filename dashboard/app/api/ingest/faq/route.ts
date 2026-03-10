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

  const base = process.env.BACKEND_BASE_URL!;
  const adminKey = process.env.ADMIN_KEY!;
  const body = await req.json();

  const r = await fetch(`${base}/admin/ingest/faq`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ADMIN-KEY": adminKey,
    },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}