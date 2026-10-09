/**
 * Integration-style tests for src/lib/db.ts, run against pg-mem (an
 * in-memory Postgres implementation) instead of a real Neon database — so
 * `npm test` works offline and doesn't touch production data. This exercises
 * the REAL compiled db.ts functions and their real Drizzle queries; only the
 * underlying Postgres connection is swapped out.
 *
 * Each describe block uses its own keys/emails so tests don't depend on
 * execution order.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

const { testDb, pool } = vi.hoisted(() => {
  // require() (not import) because this runs inside vi.hoisted's callback,
  // which is moved above this file's own import statements. No schema is
  // passed to drizzle() here — src/lib/db.ts's own queries import their
  // table objects directly from db-schema.ts, so this test instance only
  // needs a working query builder, not the relational `db.query.*` API
  // (which is the only thing the schema param is for).
  const { newDb } = require("pg-mem");
  const { drizzle } = require("drizzle-orm/node-postgres");

  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();

  // pg-mem doesn't support the `types`/`rowMode` query options that
  // drizzle-orm's node-postgres driver always passes — patch them out
  // before every query reaches pg-mem, converting rows to arrays by hand
  // for `rowMode: "array"` calls (pg-mem's result objects don't reliably
  // populate `.fields`, but row key order matches the SQL column list).
  const originalQuery = Pool.prototype.query;
  Pool.prototype.query = function (config: any, ...rest: any[]) {
    if (config && typeof config === "object" && !Array.isArray(config)) {
      const { types, rowMode, ...cleaned } = config;
      const result = originalQuery.call(this, cleaned, ...rest);
      if (rowMode === "array") {
        return result.then((res: any) => {
          res.rows = res.rows.map((row: any) => Object.values(row));
          return res;
        });
      }
      return result;
    }
    return originalQuery.call(this, config, ...rest);
  };

  const pool = new Pool();
  const testDb = drizzle(pool);
  return { testDb, pool };
});

vi.mock("@/lib/db-client", () => ({ getDb: () => testDb }));

import * as dbLib from "@/lib/db";

beforeAll(async () => {
  // Run the actual DDL through the underlying pg-mem pool, matching
  // src/lib/db-schema.ts exactly.
  await pool.query(`
    CREATE TABLE users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      name text NOT NULL,
      password_hash text NOT NULL,
      email_verified boolean NOT NULL DEFAULT false,
      verify_code text,
      verify_code_expiry timestamptz,
      reset_token text,
      reset_token_expiry timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE citations (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      style text NOT NULL,
      style_label text NOT NULL,
      source_type text NOT NULL,
      input_data jsonb NOT NULL,
      formatted text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE rate_limits (
      key text PRIMARY KEY,
      count integer NOT NULL DEFAULT 1,
      first_attempt timestamptz NOT NULL,
      blocked_until timestamptz
    );
    CREATE TABLE canlii_cache (
      key text PRIMARY KEY,
      found boolean NOT NULL DEFAULT true,
      metadata jsonb,
      cached_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE canlii_usage (
      date text PRIMARY KEY,
      count integer NOT NULL DEFAULT 0
    );
  `);
});

describe("db: users", () => {
  it("createUser / findUserByEmail / findUserById round-trip", async () => {
    const user = await dbLib.createUser("alice@example.com", "Alice", "hash123", "111111");
    expect(user.id).toBeTruthy();
    expect(user.email).toBe("alice@example.com");
    expect(user.emailVerified).toBe(false);

    expect((await dbLib.findUserByEmail("alice@example.com"))?.id).toBe(user.id);
    expect((await dbLib.findUserById(user.id))?.email).toBe("alice@example.com");
    expect(await dbLib.findUserByEmail("nobody@example.com")).toBeUndefined();
  });

  it("findUserByEmailAndVerifyCode requires both the email and the code to match", async () => {
    const user = await dbLib.createUser("bob@example.com", "Bob", "hash456", "222222");
    expect((await dbLib.findUserByEmailAndVerifyCode("bob@example.com", "222222"))?.id).toBe(user.id);
    expect(await dbLib.findUserByEmailAndVerifyCode("bob@example.com", "999999")).toBeUndefined();
    // Bob's code is useless for anyone else's email
    await dbLib.createUser("bob2@example.com", "Bob Two", "hash", "555555");
    expect(await dbLib.findUserByEmailAndVerifyCode("bob2@example.com", "222222")).toBeUndefined();
  });

  it("restartPendingSignup refreshes an unverified account but never touches a verified one", async () => {
    const pending = await dbLib.createUser("frank-pending@example.com", "Erin", "oldhash", "666666");
    const restarted = await dbLib.restartPendingSignup(pending.id, "Erin B", "newhash", "777777");
    expect(restarted?.id).toBe(pending.id);
    expect(restarted?.name).toBe("Erin B");
    expect(restarted?.passwordHash).toBe("newhash");
    expect(restarted?.verifyCode).toBe("777777");
    expect(new Date(restarted!.verifyCodeExpiry!).getTime()).toBeGreaterThan(Date.now());

    await dbLib.verifyUserEmail(pending.id);
    expect(await dbLib.restartPendingSignup(pending.id, "Hijacker", "evilhash", "000000")).toBeUndefined();
    expect((await dbLib.findUserById(pending.id))?.passwordHash).toBe("newhash");
  });

  it("verifyUserEmail marks verified and clears the code", async () => {
    const user = await dbLib.createUser("carol@example.com", "Carol", "hash789", "333333");
    await dbLib.verifyUserEmail(user.id);
    const verified = await dbLib.findUserById(user.id);
    expect(verified?.emailVerified).toBe(true);
    expect(verified?.verifyCode).toBeUndefined();
  });

  it("setResetToken / findUserByResetToken / updatePassword", async () => {
    const user = await dbLib.createUser("dave@example.com", "Dave", "oldhash", "444444");
    await dbLib.setResetToken(user.id, "reset-tok-dave");
    expect((await dbLib.findUserByResetToken("reset-tok-dave"))?.id).toBe(user.id);

    await dbLib.updatePassword(user.id, "newhash");
    const updated = await dbLib.findUserById(user.id);
    expect(updated?.passwordHash).toBe("newhash");
    expect(updated?.resetToken).toBeUndefined(); // password change invalidates any pending reset
  });
});

describe("db: citations", () => {
  it("saveCitation / getCitationsByUser / deleteCitation", async () => {
    const user = await dbLib.createUser("erin@example.com", "Erin", "hash", "555555");

    const c1 = await dbLib.saveCitation({
      userId: user.id, style: "apa", styleLabel: "APA", sourceType: "book",
      inputData: { title: "A" }, formatted: "Formatted A.",
    });
    await new Promise((r) => setTimeout(r, 5)); // ensure createdAt ordering is unambiguous
    const c2 = await dbLib.saveCitation({
      userId: user.id, style: "apa", styleLabel: "APA", sourceType: "book",
      inputData: { title: "B" }, formatted: "Formatted B.",
    });

    expect(c1.inputData.title).toBe("A");
    const list = await dbLib.getCitationsByUser(user.id);
    expect(list.map((c) => c.id)).toEqual([c2.id, c1.id]); // newest first

    expect(await dbLib.deleteCitation(c1.id, user.id)).toBe(true);
    expect((await dbLib.getCitationsByUser(user.id)).length).toBe(1);

    // Can't delete someone else's citation.
    expect(await dbLib.deleteCitation(c2.id, "someone-else")).toBe(false);
  });
});

describe("db: rate limiting", () => {
  it("allows attempts under the limit, then blocks, then respects resetRateLimit", async () => {
    const opts = { maxAttempts: 3, windowMs: 60_000, blockMs: 60_000 };

    expect((await dbLib.checkRateLimit("rl-a", opts)).allowed).toBe(true);
    expect((await dbLib.checkRateLimit("rl-a", opts)).allowed).toBe(true);
    expect((await dbLib.checkRateLimit("rl-a", opts)).allowed).toBe(true);
    const blocked = await dbLib.checkRateLimit("rl-a", opts);
    expect(blocked.allowed).toBe(false);
    expect(typeof blocked.minutesLeft).toBe("number");

    // Still blocked on a further attempt.
    expect((await dbLib.checkRateLimit("rl-a", opts)).allowed).toBe(false);

    await dbLib.resetRateLimit("rl-a");
    expect((await dbLib.checkRateLimit("rl-a", opts)).allowed).toBe(true);
  });

  it("pruneRateLimits removes stale rows but keeps active blocks and fresh windows", async () => {
    const day = 24 * 60 * 60 * 1000;
    await pool.query(`
      INSERT INTO rate_limits (key, count, first_attempt, blocked_until) VALUES
        ('prune-stale', 2, now() - interval '2 days', NULL),
        ('prune-stale-expired-block', 9, now() - interval '2 days', now() - interval '1 day'),
        ('prune-still-blocked', 9, now() - interval '2 days', now() + interval '1 hour'),
        ('prune-fresh', 1, now(), NULL);
    `);
    const removed = await dbLib.pruneRateLimits(day);
    expect(removed).toBeGreaterThanOrEqual(2);
    const { rows } = await pool.query(`SELECT key FROM rate_limits WHERE key LIKE 'prune-%' ORDER BY key`);
    expect(rows.map((r: { key: string }) => r.key)).toEqual(["prune-fresh", "prune-still-blocked"]);
  });

  it("tracks different keys independently", async () => {
    const opts = { maxAttempts: 1, windowMs: 60_000, blockMs: 60_000 };
    expect((await dbLib.checkRateLimit("rl-b", opts)).allowed).toBe(true);
    expect((await dbLib.checkRateLimit("rl-c", opts)).allowed).toBe(true); // unaffected by rl-b
  });
});

describe("db: CanLII cache", () => {
  const sampleMeta = {
    databaseId: "qcca", caseId: "2023qcca1657", url: "https://example.com",
    title: "X c. Y", citation: "2023 QCCA 1657", language: "fr" as const,
    docketNumber: "500-09-000000-000", decisionDate: "2023-01-01",
    keywords: "", concatenatedId: "2023qcca1657",
  };

  it("returns undefined on a true miss, then round-trips a positive entry", async () => {
    expect(await dbLib.getCanliiCacheEntry("fr/qcca/2023qcca1657")).toBeUndefined();

    await dbLib.setCanliiCacheEntry("fr/qcca/2023qcca1657", sampleMeta);
    const hit = await dbLib.getCanliiCacheEntry("fr/qcca/2023qcca1657");
    expect(hit?.found).toBe(true);
    expect(hit?.metadata?.title).toBe("X c. Y");
  });

  it("upsert overwrites metadata on conflict", async () => {
    await dbLib.setCanliiCacheEntry("fr/qcca/upsert-test", sampleMeta);
    await dbLib.setCanliiCacheEntry("fr/qcca/upsert-test", { ...sampleMeta, title: "Updated Title" });
    const updated = await dbLib.getCanliiCacheEntry("fr/qcca/upsert-test");
    expect(updated?.metadata?.title).toBe("Updated Title");
  });

  it("negative-caches a confirmed not-found result", async () => {
    await dbLib.setCanliiNotFoundEntry("fr/qcca/does-not-exist");
    const entry = await dbLib.getCanliiCacheEntry("fr/qcca/does-not-exist");
    expect(entry?.found).toBe(false);
    expect(entry?.metadata).toBeUndefined();
  });

  it("a later positive result overwrites a prior negative cache entry", async () => {
    await dbLib.setCanliiNotFoundEntry("fr/qcca/flip-flop");
    expect((await dbLib.getCanliiCacheEntry("fr/qcca/flip-flop"))?.found).toBe(false);

    await dbLib.setCanliiCacheEntry("fr/qcca/flip-flop", sampleMeta);
    expect((await dbLib.getCanliiCacheEntry("fr/qcca/flip-flop"))?.found).toBe(true);
  });
});

describe("db: CanLII daily usage counter", () => {
  it("starts at 0 for an untouched day and increments atomically", async () => {
    // getCanliiUsageToday/incrementCanliiUsage always key off *today's* UTC
    // date, so this exercises the real counter the app would use right now.
    const before = await dbLib.getCanliiUsageToday();
    const afterFirst = await dbLib.incrementCanliiUsage();
    expect(afterFirst).toBe(before + 1);

    const afterSecond = await dbLib.incrementCanliiUsage();
    expect(afterSecond).toBe(before + 2);

    expect(await dbLib.getCanliiUsageToday()).toBe(before + 2);
  });
});
