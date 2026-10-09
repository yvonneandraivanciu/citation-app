import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createUser, findUserByEmail, checkRateLimit, restartPendingSignup } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/email";
import { generateVerifyCode, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(`register:${ip}`);
    if (!rate.allowed)
      return NextResponse.json({ error: `Too many attempts. Try again in ${rate.minutesLeft} minutes.` }, { status: 429 });

    const { email, name, password } = await req.json();
    if (typeof email !== "string" || typeof name !== "string" || typeof password !== "string" || !email || !name.trim() || !password)
      return NextResponse.json({ error: "All fields required." }, { status: 400 });
    if (name.length > 100 || email.length > 254 || password.length > 200)
      return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    const normalizedEmail = email.toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing?.emailVerified)
      return NextResponse.json({ error: "Email already in use." }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const code = generateVerifyCode();
    // An unverified account (e.g. its code expired) is restarted with a fresh
    // code rather than blocking this email forever.
    const user = existing
      ? await restartPendingSignup(existing.id, name.trim(), passwordHash, code)
      : await createUser(normalizedEmail, name.trim(), passwordHash, code);
    if (!user)
      return NextResponse.json({ error: "Email already in use." }, { status: 409 });

    try {
      await sendVerificationEmail(user.email, user.name, code);
    } catch (err) {
      console.error("Failed to send verification email:", err);
      Sentry.captureException(err, { tags: { component: "email" }, extra: { userId: user.id } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
