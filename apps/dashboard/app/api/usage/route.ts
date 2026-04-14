import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

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
    const tenantId = url.searchParams.get("tenantId");
    const siteId = url.searchParams.get("siteId");
    const summary = url.searchParams.get("summary");

    const target =
      summary === "1" ? `${base}/admin/usage/summary` : `${base}/admin/usage`;

    const targetUrl = new URL(target);

    if (tenantId) targetUrl.searchParams.set("tenantId", tenantId);
    if (siteId) targetUrl.searchParams.set("siteId", siteId);

    const r = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "X-ADMIN-KEY": adminKey,
      },
      cache: "no-store",
    });

    const text = await r.text();

    return new NextResponse(text || (summary === "1" ? "{}" : "[]"), {
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
