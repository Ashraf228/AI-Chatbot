import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.ADMIN_KEY?.trim();
  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const target = new URL(`${base}/admin/widget/optimization`);
  if (siteId) target.searchParams.set("siteId", siteId);

  const r = await fetch(target.toString(), {
    method: "GET",
    headers: {
      "X-ADMIN-KEY": adminKey,
    },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
