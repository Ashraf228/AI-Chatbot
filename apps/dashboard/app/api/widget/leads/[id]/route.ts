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
    const lookup = await fetchDashboardBackend("/admin/widget/leads", {
      method: "GET",
      cache: "no-store",
      session: auth.session,
    });
    const leads = (await lookup.json().catch(() => [])) as Array<{
      id?: string;
      siteId?: string;
    }>;
    const lead = Array.isArray(leads) ? leads.find((entry) => entry.id === id) : null;
    if (!lead?.siteId || !allowedSiteIds.has(lead.siteId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const r = await fetchDashboardBackend(`/admin/widget/leads/${id}`, {
    method: "PATCH",
    session: auth.session,
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
  const auth = await requireSession({ adminOnly: true });
  if (auth.response) return auth.response;
  const { id } = await context.params;

  const params = new URLSearchParams({
    actorId: auth.session.sub,
    actorRole: auth.session.role,
  });
  const r = await fetchDashboardBackend(`/admin/widget/leads/${id}?${params.toString()}`, {
    method: "DELETE",
    session: auth.session,
  });

  const text = await r.text();
  return new NextResponse(text || "{}", {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
