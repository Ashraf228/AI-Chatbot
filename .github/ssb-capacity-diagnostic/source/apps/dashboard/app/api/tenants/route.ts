import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const r = await fetchDashboardBackend("/admin/tenants", {
    method: "GET",
    session: auth.session,
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

  const body = await req.json();

  const r = await fetchDashboardBackend("/admin/tenants", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    session: auth.session,
    body: JSON.stringify(body),
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
