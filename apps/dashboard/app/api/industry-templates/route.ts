import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth) return auth;

  const response = await fetchDashboardBackend("/admin/industry-templates", {
    method: "GET",
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text || "[]", {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
