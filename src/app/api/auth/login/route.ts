import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail, checkRateLimit, resetRateLimit } from "@/lib/db";
import { signToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { getClientIp } from "@/lib/security";
import { verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string" || !email || !password)
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const ip = getClientIp(req);
    const key = `login:${ip}:${email?.toLowerCase()}`;

    const rate = await checkRateLimit(key);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${rate.minutesLeft} minutes.` },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email?.toLowerCase());
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Please verify your email before logging in. Check your inbox.", unverified: true },
        { status: 403 }
      );
    }

    // Successful login — clear rate limit
    await resetRateLimit(key);

    const token = signToken(user.id);
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, emailVerified: true } });
    res.cookies.set("token", token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("Login error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
