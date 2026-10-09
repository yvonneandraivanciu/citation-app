import jwt from "jsonwebtoken";

const DEV_FALLBACK_SECRET = "dev-secret-change-in-production";

/**
 * Resolved lazily (not at import time) so `next build` doesn't fail before
 * env vars are injected, but any real sign/verify in production without a
 * secret fails loudly instead of silently using a public, forgeable default.
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set. Refusing to sign or verify tokens with the development fallback in production.");
  }
  return DEV_FALLBACK_SECRET;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } | null {
  const secret = getSecret(); // outside the try: a missing secret in prod must surface, not look like "logged out"
  try {
    return jwt.verify(token, secret) as { userId: string };
  } catch {
    return null;
  }
}

/** Options for the session cookie, shared by every route that sets it. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
