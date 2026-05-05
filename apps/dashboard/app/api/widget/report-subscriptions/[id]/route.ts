import { NextResponse } from "next/server";
import { fetchDashboardBackend, getAccessibleSiteIds } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const body = await req.json();
  const { id } = await context.params;

  if (auth.session.role === "customer") {
    const allowedSiteIds = await getAccessibleSiteIds(auth.session);
    const lookup = await fetchDashboardBackend("/admin/widget/report-subscriptions", {
      method: "GET",
      cache: "no-store",
    });
    const subscriptions = (await lookup.json().catch(() => [])) as Array<{
      id?: string;
      siteId?: string;
    }>;
    const subscription = Array.isArray(subscriptions)
      ? subscriptions.find((entry) => entry.id === id)
      : null;
    if (!subscription?.siteId || !allowedSiteIds.has(subscription.siteId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const r = await fetchDashboardBackend(`/admin/widget/report-subscriptions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;
  const { id } = await context.params;

  if (auth.session.role === "customer") {
    const allowedSiteIds = await getAccessibleSiteIds(auth.session);
    const lookup = await fetchDashboardBackend("/admin/widget/report-subscriptions", {
      method: "GET",
      cache: "no-store",
    });
    const subscriptions = (await lookup.json().catch(() => [])) as Array<{
      id?: string;
      siteId?: string;
    }>;
    const subscription = Array.isArray(subscriptions)
      ? subscriptions.find((entry) => entry.id === id)
      : null;
    if (!subscription?.siteId || !allowedSiteIds.has(subscription.siteId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const r = await fetchDashboardBackend(`/admin/widget/report-subscriptions/${id}`, {
    method: "DELETE",
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
