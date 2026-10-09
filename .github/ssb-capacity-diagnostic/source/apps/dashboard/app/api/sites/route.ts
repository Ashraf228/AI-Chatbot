import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-auth";
import { fetchDashboardBackend, filterSitesForSession } from "@/lib/dashboard-api";

export async function GET() {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const r = await fetchDashboardBackend("/admin/sites", {
    method: "GET",
    cache: "no-store",
    session: auth.session,
  });

  const data = await r.json().catch(() => []);
  if (!r.ok) {
    return NextResponse.json(data, { status: r.status });
  }

  return NextResponse.json(
    filterSitesForSession(auth.session, Array.isArray(data) ? data : [])
  );
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const body = await req.json();

  const r = await fetchDashboardBackend("/admin/sites", {
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
