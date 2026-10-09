/**
 * Route-level tests for the signup / verification / password-reset flows.
 * The DB layer and email sending are mocked; the route logic is real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  restartPendingSignup: vi.fn(),
  findUserByEmailAndVerifyCode: vi.fn(),
  verifyUserEmail: vi.fn(),
  findUserByResetToken: vi.fn(),
  updatePassword: vi.fn(),
  setResetToken: vi.fn(),
}));
const emailMocks = vi.hoisted(() => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));
vi.mock("@/lib/db", () => dbMocks);
vi.mock("@/lib/email", () => emailMocks);
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { NextRequest } from "next/server";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as verifyCode } from "@/app/api/auth/verify-code/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });
}

const pendingUser = { id: "u1", email: "ana@example.com", name: "Ana", passwordHash: "h", emailVerified: false, createdAt: "" };

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.checkRateLimit.mockResolvedValue({ allowed: true });
});

describe("POST /api/auth/register", () => {
  it("creates a new pending user and emails a 6-digit code", async () => {
    dbMocks.findUserByEmail.mockResolvedValue(undefined);
    dbMocks.createUser.mockResolvedValue(pendingUser);
    const res = await register(post("/api/auth/register", { email: "Ana@Example.com", name: "Ana", password: "password123" }));
    expect(res.status).toBe(200);
    const [email, , , code] = dbMocks.createUser.mock.calls[0];
    expect(email).toBe("ana@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(emailMocks.sendVerificationEmail).toHaveBeenCalledWith("ana@example.com", "Ana", code);
  });

  it("lets someone whose code expired sign up again instead of locking them out", async () => {
    dbMocks.findUserByEmail.mockResolvedValue(pendingUser);
    dbMocks.restartPendingSignup.mockResolvedValue(pendingUser);
    const res = await register(post("/api/auth/register", { email: "ana@example.com", name: "Ana", password: "password123" }));
    expect(res.status).toBe(200);
    expect(dbMocks.restartPendingSignup).toHaveBeenCalledWith("u1", "Ana", expect.any(String), expect.stringMatching(/^\d{6}$/));
    expect(dbMocks.createUser).not.toHaveBeenCalled();
    expect(emailMocks.sendVerificationEmail).toHaveBeenCalled();
  });

  it("still rejects an email that belongs to a verified account", async () => {
    dbMocks.findUserByEmail.mockResolvedValue({ ...pendingUser, emailVerified: true });
    const res = await register(post("/api/auth/register", { email: "ana@example.com", name: "Ana", password: "password123" }));
    expect(res.status).toBe(409);
    expect(dbMocks.restartPendingSignup).not.toHaveBeenCalled();
  });

  it("rejects non-string / oversized input", async () => {
    expect((await register(post("/api/auth/register", { email: ["x"], name: "Ana", password: "password123" }))).status).toBe(400);
    expect((await register(post("/api/auth/register", { email: "a@b.co", name: "A".repeat(101), password: "password123" }))).status).toBe(400);
  });
});

describe("POST /api/auth/verify-code", () => {
  it("requires the email alongside the code", async () => {
    const res = await verifyCode(post("/api/auth/verify-code", { code: "123456" }));
    expect(res.status).toBe(400);
    expect(dbMocks.findUserByEmailAndVerifyCode).not.toHaveBeenCalled();
  });

  it("looks the user up by email + code and sets a session cookie on success", async () => {
    dbMocks.findUserByEmailAndVerifyCode.mockResolvedValue({ ...pendingUser, verifyCodeExpiry: new Date(Date.now() + 60_000).toISOString() });
    const res = await verifyCode(post("/api/auth/verify-code", { email: "ANA@example.com", code: " 123456 " }));
    expect(res.status).toBe(200);
    expect(dbMocks.findUserByEmailAndVerifyCode).toHaveBeenCalledWith("ana@example.com", "123456");
    expect(dbMocks.verifyUserEmail).toHaveBeenCalledWith("u1");
    expect(res.headers.get("set-cookie")).toMatch(/token=.+HttpOnly/i);
  });

  it("rate-limits per account as well as per IP", async () => {
    dbMocks.checkRateLimit.mockImplementation(async (key: string) =>
      key.startsWith("verify-email:") ? { allowed: false, minutesLeft: 12 } : { allowed: true }
    );
    const res = await verifyCode(post("/api/auth/verify-code", { email: "ana@example.com", code: "123456" }));
    expect(res.status).toBe(429);
    expect(dbMocks.findUserByEmailAndVerifyCode).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("issues a long random reset token for a known user", async () => {
    dbMocks.findUserByEmail.mockResolvedValue({ ...pendingUser, emailVerified: true });
    const res = await forgotPassword(post("/api/auth/forgot-password", { email: "ana@example.com" }));
    expect(res.status).toBe(200);
    const token = dbMocks.setResetToken.mock.calls[0][1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("is rate-limited", async () => {
    dbMocks.checkRateLimit.mockResolvedValue({ allowed: false, minutesLeft: 5 });
    const res = await resetPassword(post("/api/auth/reset-password", { token: "t", password: "password123" }));
    expect(res.status).toBe(429);
    expect(dbMocks.findUserByResetToken).not.toHaveBeenCalled();
  });
});
