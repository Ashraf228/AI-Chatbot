import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.ADMIN_KEY?.trim();
  const body = await req.json();
  const { siteId } = await context.params;

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const r = await fetch(`${base}/admin/widget/branding/${siteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-ADMIN-KEY": adminKey,
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
