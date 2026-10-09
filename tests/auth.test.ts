import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { signToken, verifyToken } from "@/lib/auth";

describe("auth: signToken / verifyToken", () => {
  it("round-trips a userId through sign and verify", () => {
    const token = signToken("user-123");
    const payload = verifyToken(token);
    expect(payload?.userId).toBe("user-123");
  });

  it("returns null for a garbage token", () => {
    expect(verifyToken("not-a-real-token")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifyToken("")).toBeNull();
  });

  it("returns null for a token forged with a different secret", () => {
    // Simulates a forged token, or JWT_SECRET being rotated out from under
    // an already-issued token.
    const forged = jwt.sign({ userId: "attacker" }, "a-totally-different-secret", { expiresIn: "7d" });
    expect(verifyToken(forged)).toBeNull();
  });

  it("returns null for an expired token", () => {
    const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";
    const expired = jwt.sign({ userId: "user-123" }, secret, { expiresIn: -10 }); // already in the past
    expect(verifyToken(expired)).toBeNull();
  });

  it("different userIds produce tokens that verify to their own userId only", () => {
    const tokenA = signToken("user-A");
    const tokenB = signToken("user-B");
    expect(verifyToken(tokenA)?.userId).toBe("user-A");
    expect(verifyToken(tokenB)?.userId).toBe("user-B");
  });
});

describe("auth: JWT secret handling", () => {
  it("refuses to fall back to the dev secret in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    const fresh = await import("@/lib/auth");
    expect(() => fresh.signToken("user-1")).toThrow(/JWT_SECRET/);
    expect(() => fresh.verifyToken("anything")).toThrow(/JWT_SECRET/);
    vi.unstubAllEnvs();
  });

  it("uses JWT_SECRET when set in production, with a Secure cookie", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-real-production-secret");
    const fresh = await import("@/lib/auth");
    expect(fresh.verifyToken(fresh.signToken("user-2"))?.userId).toBe("user-2");
    expect(fresh.SESSION_COOKIE_OPTIONS.secure).toBe(true);
    vi.unstubAllEnvs();
  });
});
