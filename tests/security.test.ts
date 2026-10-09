import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { generateVerifyCode, generateResetToken, generateId, getClientIp, escapeHtml } from "@/lib/security";

describe("security: random generators", () => {
  it("verify codes are always exactly 6 digits", () => {
    for (let i = 0; i < 500; i++) expect(generateVerifyCode()).toMatch(/^\d{6}$/);
  });

  it("reset tokens are long, URL-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateResetToken()));
    expect(tokens.size).toBe(200);
    for (const t of Array.from(tokens)) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
  });

  it("ids are unique", () => {
    expect(new Set(Array.from({ length: 500 }, () => generateId())).size).toBe(500);
  });
});

describe("security: getClientIp", () => {
  const req = (headers: Record<string, string>) => new NextRequest("http://localhost/api/x", { headers });

  it("uses the first address of an x-forwarded-for chain", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(getClientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(getClientIp(req({}))).toBe("unknown");
  });
});

describe("security: escapeHtml", () => {
  it("neutralises markup in user-supplied text", () => {
    expect(escapeHtml(`<a href="https://evil.example">Click</a> & 'more'`)).toBe(
      "&lt;a href=&quot;https://evil.example&quot;&gt;Click&lt;/a&gt; &amp; &#39;more&#39;"
    );
  });

  it("leaves ordinary names (including accents) untouched", () => {
    expect(escapeHtml("Élise Côté-Tremblay")).toBe("Élise Côté-Tremblay");
  });
});
