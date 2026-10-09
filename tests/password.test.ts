import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password: hashPassword / verifyPassword", () => {
  it("hashes a password to something other than the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies the correct password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("is case-sensitive", async () => {
    const hash = await hashPassword("Password123");
    expect(await verifyPassword("password123", hash)).toBe(false);
  });

  it("salts each hash differently, but both still verify", async () => {
    const h1 = await hashPassword("same password");
    const h2 = await hashPassword("same password");
    expect(h1).not.toBe(h2);
    expect(await verifyPassword("same password", h1)).toBe(true);
    expect(await verifyPassword("same password", h2)).toBe(true);
  });
});
