import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { findUserByEmailAndVerifyCode, verifyUserEmail, checkRateLimit } from "@/lib/db";
import { signToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { email, code } = await req.json();
    if (typeof code !== "string" || !code.trim())
      return NextResponse.json({ error: "Please enter the code." }, { status: 400 });
    if (typeof email !== "string" || !email)
      return NextResponse.json({ error: "Missing email. Please sign up again." }, { status: 400 });
    const normalizedEmail = email.toLowerCase();

    // Limit guesses both per IP and per account, so rotating IPs doesn't
    // allow brute-forcing one account's 6-digit code.
    for (const key of [`verify:${ip}`, `verify-email:${normalizedEmail}`]) {
      const rate = await checkRateLimit(key);
      if (!rate.allowed)
        return NextResponse.json({ error: `Too many attempts. Try again in ${rate.minutesLeft} minutes.` }, { status: 429 });
    }

    const user = await findUserByEmailAndVerifyCode(normalizedEmail, code.trim());
    if (!user)
      return NextResponse.json({ error: "Invalid code. Check your email and try again." }, { status: 400 });

    if (user.verifyCodeExpiry && new Date(user.verifyCodeExpiry) < new Date())
      return NextResponse.json({ error: "Code has expired. Please sign up again." }, { status: 400 });

    await verifyUserEmail(user.id);

    const token = signToken(user.id);
    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set("token", token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("Verify code error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
