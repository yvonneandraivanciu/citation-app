import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { findUserByResetToken, updatePassword, checkRateLimit } from "@/lib/db";
import { getClientIp } from "@/lib/security";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(`reset:${getClientIp(req)}`);
    if (!rate.allowed)
      return NextResponse.json({ error: `Too many attempts. Try again in ${rate.minutesLeft} minutes.` }, { status: 429 });

    const { token, password } = await req.json();
    if (typeof token !== "string" || typeof password !== "string" || !token || !password)
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    if (password.length < 8 || password.length > 200)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    const user = await findUserByResetToken(token);
    if (!user)
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
    if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date())
      return NextResponse.json({ error: "Reset link has expired. Please request a new one." }, { status: 400 });

    const passwordHash = await hashPassword(password);
    await updatePassword(user.id, passwordHash);
    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
