import { randomBytes, randomInt } from "crypto";
import { NextRequest } from "next/server";

/** 6-digit numeric email verification code, from a CSPRNG. */
export function generateVerifyCode(): string {
  return String(randomInt(100000, 1000000));
}

/** URL-safe, 256-bit password reset token, from a CSPRNG. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Random identifier for DB rows (not secret, but no reason to use Math.random). */
export function generateId(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * Client IP for rate limiting. x-forwarded-for can be a comma-separated
 * chain ("client, proxy1, proxy2"); the first entry is the original client
 * as recorded by Vercel's edge.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/** Escapes text for safe interpolation into HTML (e.g. user-supplied names in emails). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
