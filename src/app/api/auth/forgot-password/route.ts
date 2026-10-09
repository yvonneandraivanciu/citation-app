import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail, setResetToken, checkRateLimit } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { generateResetToken, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(`forgot:${ip}`);
    if (!rate.allowed)
      return NextResponse.json({ error: `Too many attempts. Try again in ${rate.minutesLeft} minutes.` }, { status: 429 });

    const { email } = await req.json();
    // Always return success even if email not found — prevents email enumeration
    const user = typeof email === "string" ? await findUserByEmail(email.toLowerCase()) : undefined;
    if (user) {
      const token = generateResetToken();
      await setResetToken(user.id, token);
      try {
        await sendPasswordResetEmail(user.email, user.name, token);
      } catch (err) {
        console.error("Failed to send reset email:", err);
        Sentry.captureException(err, { tags: { component: "email" }, extra: { userId: user.id } });
      }
    }

    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
