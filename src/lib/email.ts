import { Resend } from "resend";
import { escapeHtml } from "./security";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

/**
 * The Resend SDK reports API failures (bad key, unverified domain, rate
 * limit…) by *returning* `{ error }` rather than throwing — so without this,
 * callers' try/catch + Sentry reporting never sees a failed send.
 */
function throwOnResendError(result: { error: { message: string; name?: string } | null }): void {
  if (result.error) {
    throw new Error(`Resend failed to send email: ${result.error.name ?? "error"}: ${result.error.message}`);
  }
}

export async function sendVerificationEmail(email: string, name: string, code: string) {
  const result = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your Cite. verification code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2 style="margin-bottom:0.5rem">Welcome to Cite., ${escapeHtml(name)}!</h2>
        <p style="color:#555;margin-bottom:1.5rem">Enter this code on the sign up page to verify your account:</p>
        <div style="background:#f0f4ff;border:2px solid #d0dafc;border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:1.5rem">
          <span style="font-size:2.5rem;font-weight:700;letter-spacing:0.5rem;color:#2d5be3;font-family:monospace">${code}</span>
        </div>
        <p style="color:#999;font-size:0.85rem">This code expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
  throwOnResendError(result);
  return result;
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${APP_URL}/reset-password?token=${token}`;
  const result = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your Cite. password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2>Reset your password</h2>
        <p style="color:#555;margin-bottom:1.5rem">Hi ${escapeHtml(name)}, enter this link in your browser to reset your password:</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:1rem;word-break:break-all;font-family:monospace;font-size:0.85rem;margin-bottom:1rem">${link}</div>
        <p style="color:#999;font-size:0.85rem">Expires in 1 hour.</p>
      </div>
    `,
  });
  throwOnResendError(result);
  return result;
}
