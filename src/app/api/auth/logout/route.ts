import { NextResponse } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
