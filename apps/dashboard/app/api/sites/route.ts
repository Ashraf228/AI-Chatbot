import { NextResponse } from "next/server";
import { requireAuth, requireSession } from "@/lib/require-auth";
import { fetchDashboardBackend, filterSitesForSession } from "@/lib/dashboard-api";

export async function GET() {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const r = await fetchDashboardBackend("/admin/sites", {
    method: "GET",
    cache: "no-store",
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
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.DASHBOARD_INTERNAL_TOKEN?.trim() || process.env.ADMIN_KEY?.trim();
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

  const r = await fetch(`${base}/admin/sites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DASHBOARD-TOKEN": adminKey,
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
