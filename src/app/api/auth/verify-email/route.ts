import { NextRequest, NextResponse } from "next/server";

// This route is no longer used — verification is now done via 6-digit code.
// Kept here to avoid 404s on old links.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/register", req.url));
}
