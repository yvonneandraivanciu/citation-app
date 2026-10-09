// No route in this app currently opts into the Edge runtime (the Postgres
// driver requires Node.js), but this file is required by Sentry's Next.js
// integration and costs nothing to keep around for if that ever changes.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
