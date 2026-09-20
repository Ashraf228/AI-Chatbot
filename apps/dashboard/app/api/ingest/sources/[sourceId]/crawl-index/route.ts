import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "../../../../../../lib/dashboard-api";
import { requireSession } from "../../../../../../lib/require-auth";

function origin(value: string | null | undefined) {
  if (!value || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      && url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export async function POST(request: Request, context: { params: Promise<{ sourceId: string }> }) {
  const auth = await requireSession({ allowCustomer: false });
  if (auth.response) return auth.response;
  if (!["admin", "operator"].includes(auth.session.role)) return NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 });
  const expected = origin(process.env.DASHBOARD_PUBLIC_URL);
  if (!expected) return NextResponse.json({ message: "Dashboard-Adresse ist nicht konfiguriert." }, { status: 503 });
  if (origin(request.headers.get("origin")) !== expected || request.headers.get("sec-fetch-site") !== "same-origin") {
    return NextResponse.json({ message: "Unzulässiger Ursprung." }, { status: 403 });
  }
  let body: { maxPages?: number };
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((k) => k !== "maxPages")
      || (body.maxPages !== undefined && (!Number.isInteger(body.maxPages) || body.maxPages < 1 || body.maxPages > 20))) throw new Error();
  } catch { return NextResponse.json({ message: "Seitenlimit muss zwischen 1 und 20 liegen." }, { status: 400 }); }
  const { sourceId } = await context.params;
  try {
    const response = await fetchDashboardBackend(`/admin/ingest/sources/${encodeURIComponent(sourceId)}/crawl-index`, {
      method: "POST", session: auth.session, body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" }, signal: request.signal,
    });
    return new NextResponse(await response.text(), { status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "Website konnte nicht indexiert werden. Bestehendes Wissen bleibt erhalten." }, { status: 502 }); }
}
