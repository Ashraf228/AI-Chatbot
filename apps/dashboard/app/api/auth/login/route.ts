import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  const expected = process.env.ADMIN_PANEL_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ message: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE_NAME,
    await createAdminSessionToken(),
    getSessionCookieOptions()
  );

  return res;
}
