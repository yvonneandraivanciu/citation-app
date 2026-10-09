/**
 * Environment variable validation — ensures all required config is present
 * before the app tries to use it. Call once at startup.
 */

export interface EnvConfig {
  jwtSecret: string;
  databaseUrl: string;
  databaseUrlUnpooled?: string;
  appUrl: string;
  canliiApiKey?: string;
  resendApiKey?: string;
  emailFrom?: string;
  sentryDsn?: string;
}

let cachedConfig: EnvConfig | null = null;

/**
 * Validates all required environment variables are set. Throws an error with
 * a clear message if any are missing, so deployment fails fast rather than
 * having the app silently degrade at runtime.
 */
export function validateEnv(): EnvConfig {
  // Return cached config if already validated
  if (cachedConfig) return cachedConfig;

  const required = {
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}.\n\n` +
      `Set them in .env.local (development) or your deployment provider's environment settings.`
    );
  }

  cachedConfig = {
    jwtSecret: required.jwtSecret!,
    databaseUrl: required.databaseUrl!,
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED,
    appUrl: required.appUrl!,
    canliiApiKey: process.env.CANLII_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };

  return cachedConfig;
}
