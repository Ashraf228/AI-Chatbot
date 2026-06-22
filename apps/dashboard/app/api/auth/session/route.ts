import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth";
import { toPublicSession } from "@/lib/session-public";

export async function GET() {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(toPublicSession(session), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
