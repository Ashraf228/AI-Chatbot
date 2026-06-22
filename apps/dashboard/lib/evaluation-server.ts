import { NextResponse } from "next/server";
import { getDashboardSession, type DashboardSession } from "@/lib/auth";
import { fetchDashboardBackend } from "@/lib/dashboard-api";

export async function requireViewerSession(): Promise<
  | { session: DashboardSession; response: null }
  | { session: null; response: NextResponse }
> {
  const session = await getDashboardSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "viewer") {
    return { session: null, response: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}

export async function fetchEvaluationBackend(
  session: DashboardSession,
  path: string,
  init: RequestInit = {},
) {
  return fetchDashboardBackend(`/admin/evaluation${path}`, {
    ...init,
    cache: "no-store",
    session,
  });
}

export function passThroughEvaluationResponse(response: Response, body: unknown) {
  return NextResponse.json(body, {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
