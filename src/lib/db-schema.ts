import { pgTable, text, boolean, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import type { CanliiCaseMetadata } from "./canlii";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  verifyCode: text("verify_code"),
  verifyCodeExpiry: timestamp("verify_code_expiry", { withTimezone: true }),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("users_reset_token_idx").on(t.resetToken),
]);

export const citations = pgTable("citations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  style: text("style").notNull(),
  styleLabel: text("style_label").notNull(),
  sourceType: text("source_type").notNull(),
  inputData: jsonb("input_data").notNull().$type<Record<string, string>>(),
  formatted: text("formatted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // The dashboard query is "this user's citations, newest first".
  index("citations_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
]);

// Keyed by the same rate-limit key the app already uses (e.g. "login:1.2.3.4:user@example.com").
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  firstAttempt: timestamp("first_attempt", { withTimezone: true }).notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});

// Shared across every user: keyed by "language/databaseId/caseId" (see src/lib/canlii.ts).
// `found: false` is a negative-cache entry (confirmed non-existent case) —
// `metadata` is null in that case, since there's nothing to store.
export const canliiCache = pgTable("canlii_cache", {
  key: text("key").primaryKey(),
  found: boolean("found").notNull().default(true),
  metadata: jsonb("metadata").$type<CanliiCaseMetadata>(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per UTC day, counting every real request made to CanLII's API
// (success or failure) — lets us stay under the 5,000/day grant regardless
// of how traffic is distributed across users/IPs. See fetchCanliiCase in
// src/lib/canlii.ts.
export const canliiUsage = pgTable("canlii_usage", {
  date: text("date").primaryKey(), // "YYYY-MM-DD", UTC
  count: integer("count").notNull().default(0),
});
