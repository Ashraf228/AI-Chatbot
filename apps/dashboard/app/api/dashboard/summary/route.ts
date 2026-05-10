import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const response = await fetchDashboardBackend("/admin/dashboard/summary", {
    method: "GET",
    cache: "no-store",
    session: auth.session,
  });

  const text = await response.text();
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
