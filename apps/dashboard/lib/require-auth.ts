import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function requireAuth() {
  const ok = await isAuthenticated();

  if (!ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return null;
}
