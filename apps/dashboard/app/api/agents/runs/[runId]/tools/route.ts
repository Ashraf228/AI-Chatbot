import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.ADMIN_KEY?.trim();
  const { runId } = await context.params;

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const r = await fetch(`${base}/admin/agents/runs/${runId}/tools`, {
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
}
