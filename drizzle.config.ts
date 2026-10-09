import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// drizzle-kit is a standalone CLI — unlike Next.js, it doesn't auto-load
// .env.local, so we do it explicitly here.
loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — add it to .env.local before running drizzle-kit.");
}

export default defineConfig({
  schema: "./src/lib/db-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
