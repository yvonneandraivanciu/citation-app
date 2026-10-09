import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Catches anything that escapes as an unhandled exception from a route
// handler or Server Component. Most of this app's API routes catch their
// own errors and return a graceful JSON response instead of throwing, which
// is good API design but means this alone won't see those — that's why
// specific Sentry.captureException calls were added at those catch blocks
// too (scrape-qc, scrape, canlii.ts, the email-send call sites).
export const onRequestError = Sentry.captureRequestError;
