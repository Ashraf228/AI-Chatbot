import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function requireAuth() {
  const cookieStore = await cookies();
  const ok = cookieStore.get("ssb_admin")?.value === "1";

  if (!ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.ADMIN_KEY?.trim();

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

  const incomingForm = await req.formData();
  const siteId = incomingForm.get("siteId");
  const file = incomingForm.get("file");

  if (!siteId || typeof siteId !== "string") {
    return NextResponse.json({ message: "siteId missing" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file missing" }, { status: 400 });
  }

  const forwardForm = new FormData();
  forwardForm.append("siteId", siteId);
  forwardForm.append("file", file, file.name);

  const r = await fetch(`${base}/admin/ingest/pdf`, {
    method: "POST",
    headers: {
      "X-ADMIN-KEY": adminKey,
    },
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