import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { checkRateLimit } from "@/lib/db";
import { getClientIp } from "@/lib/security";
import { safeFetchHtml, UnsafeUrlError } from "@/lib/safe-fetch";

// Unauthenticated on purpose (letting people try auto-fill before signing up
// matters for conversion), but that means it also has to defend itself:
// without this, one scripted client could burn through the whole app's
// shared CanLII daily quota, or get the server IP blocked by légisQuébec/
// SOQUIJ for scraping abuse. 40 lookups/15min is generous for a real research
// session (building a bibliography) while bounding worst-case abuse per IP.
const SCRAPE_RATE_LIMIT = { maxAttempts: 40, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 };


function extractMeta(html: string, property: string): string {
  // The content capture uses a backreference to whichever quote character
  // opened it ((["'])...\1), instead of excluding both quote characters —
  // a blanket [^"']+ would truncate any content containing an apostrophe
  // (e.g. a French title like "L'affaire Dunsmuir"), which is common
  // enough in French-language pages that the old pattern silently mangled
  // real titles.
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1`, "i"),
    new RegExp(`<meta[^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1[^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1`, "i"),
    new RegExp(`<meta[^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1[^>]+name=["']${property}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[2]) return m[2].trim();
  }
  return "";
}

function extractTitle(html: string): string {
  const og = extractMeta(html, "og:title");
  if (og) return og;
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return t?.[1]?.trim() || "";
}

function extractAuthor(html: string): string {
  return (
    extractMeta(html, "author") ||
    extractMeta(html, "article:author") ||
    extractMeta(html, "twitter:creator") ||
    extractMeta(html, "parsely-author") ||
    (() => {
      const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (!ld) return "";
      for (const block of ld) {
        try {
          const inner = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
          const json = JSON.parse(inner);
          return json?.author?.name || json?.author?.[0]?.name || "";
        } catch { }
      }
      return "";
    })()
  );
}

function extractDate(html: string): string {
  const raw =
    extractMeta(html, "article:published_time") ||
    extractMeta(html, "date") ||
    extractMeta(html, "datePublished") ||
    (() => {
      const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (!ld) return "";
      for (const block of ld) {
        try {
          const inner = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
          const json = JSON.parse(inner);
          return json?.datePublished || json?.dateCreated || "";
        } catch { }
      }
      return "";
    })();
  if (!raw) return "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw.slice(0, 4) : String(d.getUTCFullYear());
}

function extractPublisher(html: string): string {
  return extractMeta(html, "og:site_name") || extractMeta(html, "application-name") || "";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(`scrape:${ip}`, SCRAPE_RATE_LIMIT);
  if (!rate.allowed)
    return NextResponse.json({ error: `Too many requests. Try again in ${rate.minutesLeft} minute(s).` }, { status: 429 });

  const { url } = await req.json();
  if (typeof url !== "string" || !url.startsWith("http"))
    return NextResponse.json({ error: "Please enter a valid URL starting with http." }, { status: 400 });

  try {
    const response = await safeFetchHtml(url, { maxBytes: 100_000, timeoutMs: 8000 });
    if (!response.ok)
      return NextResponse.json({ error: `Could not fetch the page (status ${response.status}).` }, { status: 400 });

    const html = response.html;

    const publisher = extractPublisher(html);
    const rawTitle = extractTitle(html);
    const title = rawTitle.replace(new RegExp(`\\s*[|\\-–—]\\s*${publisher}\\s*$`, "i"), "").trim();
    const author = extractAuthor(html);
    const year = extractDate(html);
    const accessDate = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

    return NextResponse.json({ title, author, year, publisher, url, accessDate });
  } catch (err: unknown) {
    if (err instanceof UnsafeUrlError)
      return NextResponse.json({ error: "That URL can't be fetched. Please use a public web address." }, { status: 400 });
    Sentry.captureException(err, { extra: { url } });
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("timeout") || msg.includes("abort"))
      return NextResponse.json({ error: "The page took too long to load." }, { status: 400 });
    return NextResponse.json({ error: "Could not reach that URL. The site may block automated requests." }, { status: 400 });
  }
}
