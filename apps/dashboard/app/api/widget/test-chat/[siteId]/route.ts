import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

type AdminSite = {
  siteKey?: string;
  allowedDomains?: string[];
};

function resolveBackendBaseUrl() {
  const base = process.env.BACKEND_BASE_URL?.trim();
  if (!base) {
    throw new Error("BACKEND_BASE_URL missing in dashboard/.env.local");
  }

  return base;
}

function resolveOrigin(domain: string) {
  const value = domain.trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      return new URL(value).origin;
    } catch {
      return "";
    }
  }

  if (value === "localhost" || value.startsWith("localhost:")) {
    return `http://${value}`;
  }

  return `https://${value}`;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await requireSession({ allowCustomer: true });
  if (auth.response) return auth.response;

  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const incomingSessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

  if (!message) {
    return NextResponse.json({ message: "Bitte eine Testfrage eingeben." }, { status: 400 });
  }

  const siteResponse = await fetchDashboardBackend(`/admin/widget/sites/${siteId}`, {
    method: "GET",
    cache: "no-store",
  });
  const site = (await siteResponse.json().catch(() => ({}))) as AdminSite;

  if (!siteResponse.ok || !site.siteKey) {
    return NextResponse.json({ message: "Kundendaten konnten nicht geladen werden." }, { status: 500 });
  }

  const origin = resolveOrigin(site.allowedDomains?.[0] || "");
  if (!origin) {
    return NextResponse.json(
      { message: "Für den Test-Chat muss zuerst eine erlaubte Domain hinterlegt sein." },
      { status: 400 },
    );
  }

  const base = resolveBackendBaseUrl();
  let sessionId = incomingSessionId;
  const visitorId = `dashboard-test:${siteId}`;

  if (!sessionId) {
    const sessionResponse = await fetch(`${base}/widget/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        siteKey: site.siteKey,
        visitorId,
        sourceUrl: `${origin}/__dashboard-test-chat`,
        userAgent: "Soule Dashboard Test Chat",
      }),
    });
    const sessionData = await sessionResponse.json().catch(() => ({}));

    if (!sessionResponse.ok || !sessionData?.id) {
      return NextResponse.json(
        { message: sessionData?.message || "Test-Session konnte nicht gestartet werden." },
        { status: sessionResponse.status || 500 },
      );
    }

    sessionId = sessionData.id;
  }

  const chatResponse = await fetch(`${base}/widget/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify({
      siteKey: site.siteKey,
      sessionId,
      visitorId,
      message,
    }),
  });
  const chatData = await chatResponse.json().catch(() => ({}));

  if (!chatResponse.ok) {
    return NextResponse.json(
      { message: chatData?.message || "Testfrage konnte nicht beantwortet werden." },
      { status: chatResponse.status || 500 },
    );
  }

  return NextResponse.json({
    sessionId: chatData.sessionId || sessionId,
    answer: chatData.answer || "",
    sources: Array.isArray(chatData.sources) ? chatData.sources : [],
  });
}
