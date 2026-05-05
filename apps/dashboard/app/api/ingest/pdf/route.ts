import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

export async function POST(req: Request) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const incomingForm = await req.formData();
  const siteId = incomingForm.get("siteId");
  const file = incomingForm.get("file");

  if (!siteId || typeof siteId !== "string") {
    return NextResponse.json({ message: "siteId missing" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file missing" }, { status: 400 });
  }

  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const forwardForm = new FormData();
  forwardForm.append("siteId", siteId);
  forwardForm.append("file", file, file.name);

  const r = await fetchDashboardBackend("/admin/ingest/pdf", {
    method: "POST",
    body: forwardForm,
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
