// Runs in the Node.js server runtime — this is where every API route
// (auth, citations, the scrapers, CanLII) actually executes.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
