import { NextResponse } from "next/server";
import { fetchDashboardBackend, getAccessibleSiteIds } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession({ allowCustomer: true });
    if (auth.response) return auth.response;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { message: "Conversation id missing" },
        { status: 400 }
      );
    }

    const r = await fetchDashboardBackend(`/admin/conversations/${id}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as {
      conversation?: { site_id?: string };
      messages?: unknown[];
      message?: string;
    };
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }

    if (auth.session.role === "customer") {
      const allowedSiteIds = await getAccessibleSiteIds(auth.session);
      const siteId = data?.conversation?.site_id;
      if (!siteId || !allowedSiteIds.has(siteId)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if (auth.response) return auth.response;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { message: "Conversation id missing" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      actorId: auth.session.sub,
      actorRole: auth.session.role,
    });
    const r = await fetchDashboardBackend(`/admin/conversations/${id}?${params.toString()}`, {
      method: "DELETE",
    });

    const text = await r.text();

    return new NextResponse(text || "{}", {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
