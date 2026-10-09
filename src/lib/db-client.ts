import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./db-schema";

// Cache the pool/db instance on `globalThis` so Next.js dev-mode hot reloads
// (which re-execute this module) reuse the same pool instead of leaking a new
// TCP connection pool to Neon on every edit.
declare global {
  // eslint-disable-next-line no-var
  var __citationAppPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __citationAppDb: NodePgDatabase<typeof schema> | undefined;
}

/**
 * Lazily creates (and memoizes) the Postgres connection pool + Drizzle
 * instance. Lazy on purpose: importing this module must not crash the app
 * before DATABASE_URL is configured — the error only surfaces once a route
 * actually tries to read/write data.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!global.__citationAppDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add your Neon Postgres connection string to .env.local, then run `npm run db:push` to create the tables."
      );
    }
    global.__citationAppPgPool =
      global.__citationAppPgPool ??
      new Pool({
        connectionString,
        // Conservative pool size for serverless (Vercel): each function
        // instance gets its own Pool, so a high `max` here multiplies across
        // concurrent invocations. We're already on Neon's pooled ("-pooler")
        // endpoint, which does the real connection multiplexing — this just
        // keeps each instance's own footprint small and short-lived.
        max: 5,
        idleTimeoutMillis: 10_000,
      });
    global.__citationAppDb = drizzle(global.__citationAppPgPool, { schema });
  }
  return global.__citationAppDb;
}

export { schema };
