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

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth) return auth;

    const base = process.env.BACKEND_BASE_URL?.trim();
    const adminKey = process.env.ADMIN_KEY?.trim();

    if (!base) {
      return NextResponse.json(
        { message: "BACKEND_BASE_URL missing" },
        { status: 500 }
      );
    }

    if (!adminKey) {
      return NextResponse.json(
        { message: "ADMIN_KEY missing" },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");

    const target = siteId
      ? `${base}/admin/conversations?siteId=${encodeURIComponent(siteId)}`
      : `${base}/admin/conversations`;

    const r = await fetch(target, {
      method: "GET",
      headers: {
        "X-ADMIN-KEY": adminKey,
      },
      cache: "no-store",
    });

    const text = await r.text();

    return new NextResponse(text || "[]", {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}