import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const { siteId } = await context.params;

  const r = await fetchDashboardBackend(`/admin/site-modules/${siteId}`, {
    method: "GET",
    session: auth.session,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text || "[]", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;

  const body = await req.json();
  const { siteId } = await context.params;

  const r = await fetchDashboardBackend(`/admin/site-modules/${siteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    session: auth.session,
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new NextResponse(text || "[]", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
