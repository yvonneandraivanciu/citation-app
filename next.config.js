const { withSentryConfig } = require("@sentry/nextjs/config");

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Quiet locally; verbose in CI where build logs are actually useful.
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
