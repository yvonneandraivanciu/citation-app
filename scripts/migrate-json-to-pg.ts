/**
 * One-time migration: copies data/db.json (the old flat-file store) into
 * Postgres. Safe to run more than once — existing rows are left alone
 * (ON CONFLICT DO NOTHING), so re-running it after new signups won't
 * duplicate or overwrite anything.
 *
 * Usage (after DATABASE_URL is set in .env.local and `npm run db:push` has
 * created the tables):
 *   npx tsx scripts/migrate-json-to-pg.ts
 */
import fs from "fs";
import path from "path";
import { getDb } from "../src/lib/db-client";
import { users, citations } from "../src/lib/db-schema";

async function main() {
  const dbPath = path.join(process.cwd(), "data", "db.json");
  if (!fs.existsSync(dbPath)) {
    console.log("No data/db.json found — nothing to migrate.");
    return;
  }
  const raw = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  const db = getDb();

  const oldUsers = raw.users || [];
  const oldCitations = raw.citations || [];

  for (const u of oldUsers) {
    await db
      .insert(users)
      .values({
        id: u.id,
        email: u.email,
        name: u.name,
        passwordHash: u.passwordHash,
        emailVerified: !!u.emailVerified,
        verifyCode: u.verifyCode ?? null,
        verifyCodeExpiry: u.verifyCodeExpiry ? new Date(u.verifyCodeExpiry) : null,
        resetToken: u.resetToken ?? null,
        resetTokenExpiry: u.resetTokenExpiry ? new Date(u.resetTokenExpiry) : null,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
      })
      .onConflictDoNothing({ target: users.id });
  }
  console.log(`Migrated ${oldUsers.length} user(s).`);

  for (const c of oldCitations) {
    await db
      .insert(citations)
      .values({
        id: c.id,
        userId: c.userId,
        style: c.style,
        styleLabel: c.styleLabel,
        sourceType: c.sourceType,
        inputData: c.inputData || {},
        formatted: c.formatted,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      })
      .onConflictDoNothing({ target: citations.id });
  }
  console.log(`Migrated ${oldCitations.length} citation(s).`);

  // Rate limits and the CanLII cache are intentionally NOT migrated — both
  // are ephemeral/rebuildable, so starting empty in Postgres is fine.

  console.log("Done. data/db.json is no longer read by the app — you can keep it as a backup or delete it.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
