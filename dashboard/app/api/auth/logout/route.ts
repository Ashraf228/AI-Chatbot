import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", "http://localhost:3000"));
  res.cookies.set("ssb_admin", "", {
    path: "/",
    maxAge: 0,
  });
  return res;
}