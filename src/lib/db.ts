import { eq, and, desc, sql, lt, or, isNull } from "drizzle-orm";
import { getDb } from "./db-client";
import { users, citations, rateLimits, canliiCache, canliiUsage } from "./db-schema";
import type { CanliiCaseMetadata } from "./canlii";
import { generateId } from "./security";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  emailVerified: boolean;
  verifyCode?: string;
  verifyCodeExpiry?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
  createdAt: string;
}

interface Citation {
  id: string;
  userId: string;
  style: string;
  styleLabel: string;
  sourceType: string;
  inputData: Record<string, string>;
  formatted: string;
  createdAt: string;
}

function rowToUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    emailVerified: row.emailVerified,
    verifyCode: row.verifyCode ?? undefined,
    verifyCodeExpiry: row.verifyCodeExpiry ? row.verifyCodeExpiry.toISOString() : undefined,
    resetToken: row.resetToken ?? undefined,
    resetTokenExpiry: row.resetTokenExpiry ? row.resetTokenExpiry.toISOString() : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function rowToCitation(row: typeof citations.$inferSelect): Citation {
  return {
    id: row.id,
    userId: row.userId,
    style: row.style,
    styleLabel: row.styleLabel,
    sourceType: row.sourceType,
    inputData: row.inputData,
    formatted: row.formatted,
    createdAt: row.createdAt.toISOString(),
  };
}


// Defaults tuned for auth endpoints (5 attempts/15min, 30min block). Callers
// with a different usage shape — e.g. the scraping endpoints, where a real
// research session can legitimately mean dozens of URL lookups — pass their
// own `opts` rather than reusing these.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;

export interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
  blockMs?: number;
}

export async function checkRateLimit(key: string, opts?: RateLimitOptions): Promise<{ allowed: boolean; minutesLeft?: number }> {
  const maxAttempts = opts?.maxAttempts ?? MAX_ATTEMPTS;
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const blockMs = opts?.blockMs ?? BLOCK_MS;
  const db = getDb();
  const now = Date.now();

  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  let entry = row;

  if (entry?.blockedUntil) {
    const blockedUntilMs = entry.blockedUntil.getTime();
    if (now < blockedUntilMs) {
      return { allowed: false, minutesLeft: Math.ceil((blockedUntilMs - now) / 60000) };
    }
    // Block period has passed — treat this as if the block were already cleared,
    // and let the window check below decide whether to start fresh.
    entry = { ...entry, blockedUntil: null };
  }

  if (!entry || now - entry.firstAttempt.getTime() > windowMs) {
    // Opportunistic housekeeping: ~1% of fresh windows sweep out stale rows,
    // so the table doesn't grow forever without needing a cron job.
    if (Math.random() < 0.01) await pruneRateLimits().catch(() => {});
    await db
      .insert(rateLimits)
      .values({ key, count: 1, firstAttempt: new Date(now), blockedUntil: null })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, firstAttempt: new Date(now), blockedUntil: null },
      });
    return { allowed: true };
  }

  const newCount = entry.count + 1;
  if (newCount > maxAttempts) {
    const blockedUntilDate = new Date(now + blockMs);
    await db.update(rateLimits).set({ count: newCount, blockedUntil: blockedUntilDate }).where(eq(rateLimits.key, key));
    return { allowed: false, minutesLeft: Math.ceil(blockMs / 60000) };
  }
  await db.update(rateLimits).set({ count: newCount }).where(eq(rateLimits.key, key));
  return { allowed: true };
}

export async function resetRateLimit(key: string): Promise<void> {
  await getDb().delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Deletes rate-limit rows whose window is long over and that aren't currently blocking anyone. Returns how many were removed. */
export async function pruneRateLimits(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - olderThanMs);
  const deleted = await getDb()
    .delete(rateLimits)
    .where(and(lt(rateLimits.firstAttempt, cutoff), or(isNull(rateLimits.blockedUntil), lt(rateLimits.blockedUntil, now))))
    .returning({ key: rateLimits.key });
  return deleted.length;
}

export async function createUser(email: string, name: string, passwordHash: string, verifyCode: string): Promise<User> {
  const db = getDb();
  const values = {
    id: generateId(),
    email,
    name,
    passwordHash,
    emailVerified: false,
    verifyCode,
    verifyCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };
  const [row] = await db.insert(users).values(values).returning();
  return rowToUser(row);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  return row ? rowToUser(row) : undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ? rowToUser(row) : undefined;
}

/**
 * Looks up a pending signup by email AND code together. Matching on the code
 * alone would let any 6-digit guess hit *some* user's pending account once
 * there are many signups in flight.
 */
export async function findUserByEmailAndVerifyCode(email: string, code: string): Promise<User | undefined> {
  const [row] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.verifyCode, code)))
    .limit(1);
  return row ? rowToUser(row) : undefined;
}

/**
 * Re-registration of an email that never finished verification (e.g. the
 * code expired): replaces the stale pending signup with the new details and a
 * fresh code instead of rejecting it as "email already in use" forever.
 * Only touches unverified accounts.
 */
export async function restartPendingSignup(userId: string, name: string, passwordHash: string, verifyCode: string): Promise<User | undefined> {
  const [row] = await getDb()
    .update(users)
    .set({
      name,
      passwordHash,
      verifyCode,
      verifyCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      resetToken: null,
      resetTokenExpiry: null,
    })
    .where(and(eq(users.id, userId), eq(users.emailVerified, false)))
    .returning();
  return row ? rowToUser(row) : undefined;
}

export async function findUserByResetToken(token: string): Promise<User | undefined> {
  const [row] = await getDb().select().from(users).where(eq(users.resetToken, token)).limit(1);
  return row ? rowToUser(row) : undefined;
}

export async function verifyUserEmail(userId: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ emailVerified: true, verifyCode: null, verifyCodeExpiry: null })
    .where(eq(users.id, userId));
}

export async function setResetToken(userId: string, token: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ resetToken: token, resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) })
    .where(eq(users.id, userId));
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, userId));
}

export async function saveCitation(data: Omit<Citation, "id" | "createdAt">): Promise<Citation> {
  const values = { ...data, id: generateId(), createdAt: new Date() };
  const [row] = await getDb().insert(citations).values(values).returning();
  return rowToCitation(row);
}

export async function getCitationsByUser(userId: string): Promise<Citation[]> {
  const rows = await getDb()
    .select()
    .from(citations)
    .where(eq(citations.userId, userId))
    .orderBy(desc(citations.createdAt));
  return rows.map(rowToCitation);
}

export async function deleteCitation(id: string, userId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(citations)
    .where(and(eq(citations.id, id), eq(citations.userId, userId)))
    .returning({ id: citations.id });
  return deleted.length > 0;
}

// ── CanLII cache ──────────────────────────────────────────────────────────────
// Shared across every user of the app, so the same case (landmark decisions
// especially) is only ever fetched from CanLII's API once, however many
// different people cite it — this is what keeps real usage well under the
// API key's 5,000-request/day quota as the user base grows.

export interface CanliiCacheLookup {
  /** false means "we already checked — this case genuinely doesn't exist". */
  found: boolean;
  metadata?: CanliiCaseMetadata;
}

/** undefined = never looked up before (true cache miss); otherwise a positive or negative cache hit. */
export async function getCanliiCacheEntry(key: string): Promise<CanliiCacheLookup | undefined> {
  const [row] = await getDb().select().from(canliiCache).where(eq(canliiCache.key, key)).limit(1);
  if (!row) return undefined;
  return row.found ? { found: true, metadata: row.metadata ?? undefined } : { found: false };
}

export async function setCanliiCacheEntry(key: string, metadata: CanliiCaseMetadata): Promise<void> {
  await getDb()
    .insert(canliiCache)
    .values({ key, found: true, metadata, cachedAt: new Date() })
    .onConflictDoUpdate({ target: canliiCache.key, set: { found: true, metadata, cachedAt: new Date() } });
}

/** Negative-caches a confirmed "this case doesn't exist" result, so repeated (or malicious) lookups of the same bad URL never cost another API call. */
export async function setCanliiNotFoundEntry(key: string): Promise<void> {
  await getDb()
    .insert(canliiCache)
    .values({ key, found: false, metadata: null, cachedAt: new Date() })
    .onConflictDoUpdate({ target: canliiCache.key, set: { found: false, metadata: null, cachedAt: new Date() } });
}

// ── CanLII daily usage / circuit breaker ────────────────────────────────────
// A shared, app-wide counter of real requests sent to CanLII's API today
// (UTC), independent of which user or IP made them — the per-IP rate limit
// on /api/scrape-qc doesn't protect this shared 5,000/day grant on its own.

export async function getCanliiUsageToday(): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const [row] = await getDb().select().from(canliiUsage).where(eq(canliiUsage.date, date)).limit(1);
  return row?.count ?? 0;
}

/** Atomically increments today's counter and returns the new total. Call once per real request actually sent to CanLII. */
export async function incrementCanliiUsage(): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const [row] = await getDb()
    .insert(canliiUsage)
    .values({ date, count: 1 })
    .onConflictDoUpdate({ target: canliiUsage.date, set: { count: sql`${canliiUsage.count} + 1` } })
    .returning({ count: canliiUsage.count });
  return row.count;
}
