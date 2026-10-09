/**
 * CanLII REST API client.
 *
 * CanLII's own website (canlii.org) blocks automated requests with
 * Cloudflare, so decision pages can't be scraped. The API is the documented,
 * sanctioned way to get structured case metadata instead — it returns
 * metadata only (title/style of cause, citation, docket number, decision
 * date), never full-text documents.
 *
 * Docs: https://github.com/canlii/API_documentation/blob/master/EN.md
 *
 * Rate limits on the API key grant (per CanLII's approval email):
 *   - 5,000 requests / day
 *   - 2 requests / second
 *   - 1 request at a time (no concurrent calls)
 * The per-second/concurrency limits are enforced client-side via
 * `throttled()`, which queues calls one at a time with a minimum spacing.
 * The daily limit is enforced via a Postgres-backed counter (see
 * CANLII_DAILY_SAFETY_LIMIT below and incrementCanliiUsage in src/lib/db.ts)
 * so it survives process restarts and is shared across every server instance.
 */

import * as Sentry from "@sentry/nextjs";
import { getCanliiCacheEntry, setCanliiCacheEntry, setCanliiNotFoundEntry, getCanliiUsageToday, incrementCanliiUsage } from "./db";

const CANLII_API_BASE = "https://api.canlii.org/v1";
const MIN_REQUEST_INTERVAL_MS = 550; // > 500ms so two calls never land in the same second

export interface CanliiCaseMetadata {
  databaseId: string;
  caseId: string;
  url: string;
  title: string;
  citation: string;
  language: "en" | "fr";
  docketNumber: string;
  decisionDate: string; // YYYY-MM-DD
  keywords: string;
  concatenatedId: string;
}

export interface ParsedCanliiUrl {
  language: "en" | "fr";
  /** CanLII's own database slug, e.g. "qcca", "csc-scc" — usually (not always) the same as the neutral citation's court code, lowercased. */
  databaseId: string;
  /** e.g. "2023qcca1657". */
  caseId: string;
}

/** Extracts {language, databaseId, caseId} from a canlii.org case URL, or null if the URL isn't a recognizable CanLII case page. */
export function parseCanliiUrl(url: string): ParsedCanliiUrl | null {
  // e.g. https://www.canlii.org/fr/qc/qcca/doc/2023/2023qcca1657/2023qcca1657.html
  //                              ^lang ^province ^courtSlug   ^year  ^caseId
  const m = url.match(/canlii\.org\/(en|fr)\/[a-z]+\/([a-z0-9-]+)\/doc\/(\d{4})\/(\d{4}[a-z]+\d+)/i);
  if (!m) return null;
  const [, language, courtSlug, , neutralId] = m;
  return {
    language: language.toLowerCase() as "en" | "fr",
    databaseId: courtSlug.toLowerCase(),
    caseId: neutralId.toLowerCase(),
  };
}

// ── Serializing rate limiter ────────────────────────────────────────────────
// At most one in-flight request, each spaced >= MIN_REQUEST_INTERVAL_MS after
// the previous one starts. A module-level queue is enough for a single Next.js
// server process; it does NOT coordinate across multiple server instances —
// if this app is ever deployed with more than one instance (e.g. Vercel autoscaling
// or multi-region), move this to a shared store (e.g. Postgres advisory lock or
// a lock table row) to ensure the per-second rate limits are truly enforced
// globally. The daily usage counter in db.ts IS already shared/distributed.
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = Math.max(0, lastCallAt + MIN_REQUEST_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return fn();
  };
  const result = queue.then(run, run);
  // Keep the queue alive even if a call throws — one failure shouldn't wedge every later call.
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

// ── Two-tier cache ───────────────────────────────────────────────────────────
// Published CanLII decisions don't change, so a successful lookup is cached
// for good. Tier 1 is an in-memory Map — free, but private to this process
// and lost on restart. Tier 2 is the app's shared Postgres database (src/lib/db.ts) —
// persists across restarts/redeploys and, more importantly, is shared by
// every user: once ANY user's lookup puts a case in the DB cache, every other
// user who cites that same case (landmark decisions especially) reuses it
// instead of spending another call against the 5,000/day quota. Failures are
// never cached at either tier, so a transient network error doesn't get
// "stuck" as a permanent miss.
// null = confirmed "not found" (negative cache); absence = never looked up.
const memoryCache = new Map<string, CanliiCaseMetadata | null>();

// A soft daily ceiling comfortably under the 5,000/day grant, so a burst of
// traffic degrades to URL-only parsing instead of ever actually exhausting
// (or risking CanLII revoking) the key. Configurable since it's a judgment
// call, not a hard technical constant.
const CANLII_DAILY_SAFETY_LIMIT = Number(process.env.CANLII_DAILY_SAFETY_LIMIT) || 4500;

/**
 * Fetches case metadata from CanLII's API. Returns null — never throws — if
 * the API key isn't configured, the daily safety limit has been reached, the
 * case isn't found, or the request fails after a retry; callers should fall
 * back to URL-only parsing in that case.
 */
export async function fetchCanliiCase(parsed: ParsedCanliiUrl): Promise<CanliiCaseMetadata | null> {
  const cacheKey = `${parsed.language}/${parsed.databaseId}/${parsed.caseId}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) ?? null;
  }

  const persisted = await getCanliiCacheEntry(cacheKey);
  if (persisted) {
    const value = persisted.found ? persisted.metadata ?? null : null;
    memoryCache.set(cacheKey, value);
    return value;
  }

  const apiKey = process.env.CANLII_API_KEY;
  if (!apiKey) return null;

  // Global circuit breaker: protects the shared 5,000/day grant across every
  // user of the app, not just one IP. This is a soft cap with a ~500-request
  // safety margin, not an atomically-guaranteed one (see incrementCanliiUsage) —
  // fine given the margin, and far simpler than distributed locking.
  const usedToday = await getCanliiUsageToday();
  if (usedToday >= CANLII_DAILY_SAFETY_LIMIT) {
    // This is a real operational event worth knowing about promptly — not a
    // bug, but "the app is about to degrade for every user" is exactly the
    // kind of thing that shouldn't wait for someone to notice on their own.
    Sentry.captureMessage("CanLII daily safety limit reached — falling back to URL-only parsing", {
      level: "warning",
      tags: { component: "canlii" },
      extra: { usedToday, limit: CANLII_DAILY_SAFETY_LIMIT },
    });
    return null;
  }

  try {
    const result = await throttled(() => requestCanliiCase(parsed, apiKey));
    memoryCache.set(cacheKey, result);
    if (result) {
      await setCanliiCacheEntry(cacheKey, result);
    } else {
      // A clean "this case doesn't exist" answer — cache it so a bad or
      // malicious URL never costs a second API call.
      await setCanliiNotFoundEntry(cacheKey);
    }
    return result;
  } catch (err) {
    // Transient failure (network error, timeout, or a server error that
    // didn't clear on retry) — deliberately NOT cached, so the next lookup
    // gets a fresh attempt instead of being permanently stuck. Reported at
    // "warning" rather than as a full error: an occasional one is expected
    // network noise, but a cluster of them is worth Ur seeing.
    Sentry.captureException(err, { level: "warning", tags: { component: "canlii" }, extra: { cacheKey } });
    return null;
  }
}

/**
 * Makes the actual API call, retrying once on a transient failure (network
 * error, timeout, non-2xx/404 status). Every real attempt — success or
 * failure — counts against the daily usage counter, since CanLII's quota is
 * about request volume, not just successful ones.
 */
async function requestCanliiCase(parsed: ParsedCanliiUrl, apiKey: string): Promise<CanliiCaseMetadata | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await incrementCanliiUsage();
    try {
      const res = await fetch(
        `${CANLII_API_BASE}/caseBrowse/${parsed.language}/${parsed.databaseId}/${parsed.caseId}/?api_key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (res.status === 404) return null; // confirmed not found — negative-cacheable

      if (!res.ok) {
        throw new Error(`CanLII API responded ${res.status}`);
      }

      const data = await res.json();
      // Validate response has all required fields — type guard prevents casting errors
      if (!isCanliiCaseMetadata(data)) return null;
      return data;
    } catch (err) {
      lastError = err;
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
    }
  }
  throw lastError;
}

/**
 * Splits a CanLII case title into plaintiff/defendant + connector.
 * English-language databases return "X v. Y"; French-language (Quebec, most
 * federal) databases return "X c. Y" — the guide's own connector convention
 * (guide: style de cause uses "c." except "v." for English-language reports).
 */
export function splitStyleOfCause(title: string): { plaintiff: string; defendant: string; connector: "c." | "v." } | null {
  const m = title.match(/^(.+?)\s+(c\.|v\.)\s+(.+)$/i);
  if (!m) return null;
  const [, plaintiff, connectorRaw, defendant] = m;
  const connector: "c." | "v." = connectorRaw.toLowerCase() === "v." ? "v." : "c.";
  return { plaintiff: plaintiff.trim(), defendant: defendant.trim(), connector };
}

/** Type guard to verify a CanLII API response has all required fields. */
function isCanliiCaseMetadata(data: unknown): data is CanliiCaseMetadata {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.databaseId === "string" &&
    typeof obj.caseId === "string" &&
    typeof obj.url === "string" &&
    typeof obj.title === "string" &&
    typeof obj.citation === "string" &&
    (obj.language === "en" || obj.language === "fr") &&
    typeof obj.docketNumber === "string" &&
    typeof obj.decisionDate === "string" &&
    typeof obj.keywords === "string" &&
    typeof obj.concatenatedId === "string"
  );
}
