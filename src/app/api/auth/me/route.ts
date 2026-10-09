import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findUserById } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ user: null });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ user: null });

  const user = await findUserById(payload.userId);
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
