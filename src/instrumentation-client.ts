// Runs in the browser. Loads verification-code/reset-password pages, etc.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Cheap in dev, deliberately low in prod so a free-tier Sentry quota isn't
  // burned by tracing every page view — this is an early-stage app, errors
  // matter far more right now than performance tracing.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
