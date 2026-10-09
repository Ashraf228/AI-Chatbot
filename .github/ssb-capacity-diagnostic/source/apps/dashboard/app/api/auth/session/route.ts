import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth";
import { fetchEvaluationBackend } from "@/lib/evaluation-server";
import { toPublicSession } from "@/lib/session-public";

export async function GET() {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "viewer") {
    const validation = await fetchEvaluationBackend(session, "/context", { method: "GET" });
    if (!validation.ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.json(toPublicSession(session), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
