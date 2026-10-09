import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { checkRateLimit } from "@/lib/db";
import { getClientIp } from "@/lib/security";
import { safeFetchHtml, UnsafeUrlError } from "@/lib/safe-fetch";
import { parseCanliiUrl, fetchCanliiCase, splitStyleOfCause } from "@/lib/canlii";

// Unauthenticated on purpose (letting people try auto-fill before signing up
// matters for conversion), but that means it also has to defend itself:
// without this, one scripted client could burn through the whole app's
// shared CanLII daily quota, or get the server IP blocked by légisQuébec/
// SOQUIJ for scraping abuse. 40 lookups/15min is generous for a real research
// session (building a bibliography) while bounding worst-case abuse per IP.
const SCRAPE_RATE_LIMIT = { maxAttempts: 40, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 };


function getMeta(html: string, ...names: string[]): string {
  // The content capture uses a backreference to whichever quote character
  // opened it ((["'])...\1), instead of excluding both quote characters —
  // a blanket [^"']+ would truncate any content containing an apostrophe
  // (e.g. "L'Assemblée nationale"), which is common enough in French-
  // language pages that the old pattern silently mangled real titles.
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1`, "i"),
      new RegExp(`<meta[^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1[^>]+property=["']${name}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1`, "i"),
      new RegExp(`<meta[^>]+content=(["'])((?:(?!\\1)[\\s\\S])*?)\\1[^>]+name=["']${name}["']`, "i"),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[2]?.trim()) return m[2].trim();
    }
  }
  return "";
}

function getJsonLd(html: string, key: string): string {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    try {
      const inner = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
      const json = JSON.parse(inner);
      const val = json?.[key] || json?.mainEntity?.[key];
      if (val) return typeof val === "string" ? val : val?.name || "";
    } catch { /* skip */ }
  }
  return "";
}

function getTitle(html: string): string {
  return getMeta(html, "og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
}

function cleanTitle(title: string, siteName: string): string {
  if (!siteName) return title;
  return title.replace(new RegExp(`\\s*[|\\-–—]\\s*${siteName}\\s*$`, "i"), "").trim();
}

// ── CanLII ────────────────────────────────────────────────────────────────────
const CANLII_COURT_MAP: Record<string, string> = {
  "QCCA":   "QC C.A.",
  "QCCS":   "QC C.S.",
  "QCCQ":   "QC C.Q.",
  "QCTAQ":  "QC T.A.Q.",
  "QCCDP":  "QC C.D.P.",
  "CSC":    "CSC",
  "CAF":    "CAF",
  "CF":     "CF",
  "QCTAT":  "QC T.A.T.",
  "QCCLP":  "QC C.L.P.",
  "QCTDP":  "QC T.D.P.",
  "QCCAI":  "QC C.A.I.",
  "ONCA":   "ON C.A.",
  "ONSC":   "ON C.S.",
  "BCCA":   "BC C.A.",
  "ABCA":   "AB C.A.",
};

async function parseCanLII(url: string) {
  // CanLII URL format:
  // /fr/qc/qcca/doc/2023/2023qcca1657/2023qcca1657.html
  const urlMatch = url.match(
    /canlii\.org\/(?:en|fr)\/([a-z]+)\/([a-z0-9-]+)\/doc\/(\d{4})\/(\d{4}[a-z]+\d+)/i
  );

  const courtSlug = urlMatch?.[2] || "";
  const year      = urlMatch?.[3] || "";
  const neutralId = urlMatch?.[4] || ""; // e.g. "2023qcca1657"

  // Extract court code and sequence from neutral citation ID
  const neutralMatch = neutralId.match(/^\d{4}([a-z]+)(\d+)$/i);
  const courtCode    = neutralMatch?.[1]?.toUpperCase() || "";
  const seqNo        = neutralMatch?.[2] || "";
  const court        = CANLII_COURT_MAP[courtCode] || courtCode;

  // Try the real CanLII API first — it returns the style of cause the URL
  // alone can't give us. Falls through to the URL-only guess below if the
  // API key isn't configured yet, the case isn't in the API, or the call fails.
  const parsedUrl = parseCanliiUrl(url);
  if (parsedUrl) {
    const metadata = await fetchCanliiCase(parsedUrl);
    const parties  = metadata?.title ? splitStyleOfCause(metadata.title) : null;
    if (parties) {
      return {
        sourceType: "neutral",
        plaintiff: parties.plaintiff,
        defendant: parties.defendant,
        year: year || metadata!.decisionDate?.slice(0, 4) || "",
        courtCode,
        sequenceNumber: seqNo,
        court,
        connector: parties.connector,
        url,
        confidence: 0.95,
        needsReview: false,
        missing: [],
        hint: "canlii-api",
      };
    }
  }

  const missing: string[] = ["plaintiff", "defendant"];
  if (!year)      missing.push("year");
  if (!courtCode) missing.push("courtCode");
  if (!seqNo)     missing.push("sequenceNumber");

  return {
    sourceType: "neutral",
    plaintiff: "",
    defendant: "",
    year,
    courtCode,
    sequenceNumber: seqNo,
    court,
    connector: "c.",
    url,
    confidence: year && courtCode && seqNo ? 0.75 : 0.40,
    needsReview: true,
    missing,
    message: process.env.CANLII_API_KEY
      ? "CanLII n'a pas retourné ce dossier. L'année, le tribunal et le numéro ont été extraits de l'URL — veuillez ajouter les parties (demandeur c. défendeur) manuellement."
      : "Clé API CanLII non configurée. L'année, le tribunal et le numéro ont été extraits de l'URL — veuillez ajouter les parties (demandeur c. défendeur) manuellement.",
    hint: "canlii",
  };
}

// ── Assemblée nationale ───────────────────────────────────────────────────────
function parseAssNat(html: string, url: string) {
  const rawTitle  = getTitle(html);
  const pageTitle = cleanTitle(rawTitle, "Assemblée nationale du Québec");

  if (url.includes("/projets-loi/") || url.includes("/projet-loi-")) {
    const urlMatch   = url.match(/projet-loi-(\d+)(?:-(\d+))?(?:-(\d+))?\.html/);
    const billNo     = urlMatch?.[1] || "";
    const legNo      = urlMatch?.[2] || "";
    const sessionNo  = urlMatch?.[3] || "";

    const sessionLabel = [
      sessionNo ? `${sessionNo}e session` : "",
      legNo     ? `${legNo}e législature` : "",
    ].filter(Boolean).join(", ");

    // Try multiple title extraction strategies
    let lawTitle = "";

    // Strategy 1: "Projet de loi n° X, Titre de la loi"
    const titleMatch1 = pageTitle.match(/Projet\s+de\s+loi\s+n[o°°]?\s*\d+[,\s\-–]+(.+)/i);
    if (titleMatch1) lawTitle = titleMatch1[1].trim();

    // Strategy 2: Look for it in the HTML body
    if (!lawTitle) {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        const h1 = h1Match[1].trim();
        const h1TitleMatch = h1.match(/Projet\s+de\s+loi\s+n[o°°]?\s*\d+[,\s\-–]+(.+)/i);
        lawTitle = h1TitleMatch ? h1TitleMatch[1].trim() : h1;
      }
    }

    // Strategy 3: Look for the law title in a specific div
    if (!lawTitle) {
      const divMatch = html.match(/<div[^>]+class="[^"]*titre[^"]*"[^>]*>([^<]+)<\/div>/i);
      if (divMatch) lawTitle = divMatch[1].trim();
    }

    // Strategy 4: Use meta description
    if (!lawTitle) {
      const desc = getMeta(html, "description", "og:description");
      const descMatch = desc.match(/Projet\s+de\s+loi\s+n[o°°]?\s*\d+[,\s\-–]+(.+)/i);
      if (descMatch) lawTitle = descMatch[1].trim();
    }

    // Fallback: use page title cleaned up
    if (!lawTitle) lawTitle = pageTitle;

    const missing: string[] = [];
    if (!lawTitle)     missing.push("title");
    if (!billNo)       missing.push("sequenceNumber");
    if (!sessionLabel) missing.push("volume");

    return {
      sourceType: "bill",
      title: lawTitle,
      sequenceNumber: billNo,
      volume: sessionLabel,
      court: "Qc",
      url,
      confidence: lawTitle && billNo ? 0.88 : 0.55,
      needsReview: missing.length > 0,
      missing,
      hint: "assnat-bill",
    };
  }

  // Consolidated statute — try multiple strategies
  let title = "";
  const lawMatch = pageTitle.match(/^(Loi\s+.+?)(?:\s*[-–|]|$)/i);
  if (lawMatch) title = lawMatch[1].trim();
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) title = h1Match[1].trim();
  }
  if (!title) title = pageTitle;

  return {
    sourceType: "consolidated-statute",
    title,
    recueil: "RLRQ",
    url,
    confidence: title ? 0.80 : 0.40,
    needsReview: !title,
    missing: title ? [] : ["title"],
    hint: "assnat-law",
  };
}


// ── SOQUIJ ────────────────────────────────────────────────────────────────────
function parseSoquij(html: string, url: string) {
  const rawTitle   = getTitle(html);
  const styleMatch = rawTitle.match(/^(.+?)\s+[cv]\.\s+(.+?)(?:\s*[,|–]|$)/i);
  const azMatch    = rawTitle.match(/AZ-(\d+)/i) || url.match(/AZ-(\d+)/i);
  const yearMatch  = rawTitle.match(/\b(19|20)\d{2}\b/);

  const plaintiff = styleMatch?.[1]?.trim() || "";
  const defendant = styleMatch?.[2]?.trim() || "";
  const year      = yearMatch?.[0] || "";
  const docNo     = azMatch ? `AZ-${azMatch[1]}` : "";

  const missing: string[] = [];
  if (!plaintiff) missing.push("plaintiff");
  if (!defendant) missing.push("defendant");
  if (!year)      missing.push("year");
  if (!docNo)     missing.push("sequenceNumber");

  return {
    sourceType: "database-case",
    plaintiff, defendant, year,
    reportAbbreviation: "AZ",
    sequenceNumber: docNo,
    url,
    confidence: missing.length === 0 ? 0.88 : 0.55,
    needsReview: missing.length > 0,
    missing,
    hint: "soquij",
  };
}

// ── légisQuébec ───────────────────────────────────────────────────────────────
function parseLegisQc(html: string, url: string) {
  const rawTitle    = getTitle(html);
  const rlrqMatch   = rawTitle.match(/^(.+?),\s*RLRQ\s+c\.\s+(.+)/i);
  const chapterMatch = url.match(/chapitre[=/]([A-Z0-9.\-]+)/i);

  const title   = rlrqMatch?.[1]?.trim() || cleanTitle(rawTitle, "LégisQuébec");
  const chapter = rlrqMatch?.[2]?.trim() || chapterMatch?.[1] || "";

  const missing: string[] = [];
  if (!title)   missing.push("title");
  if (!chapter) missing.push("chapter");

  return {
    sourceType: "consolidated-statute",
    title,
    recueil: "RLRQ",
    chapter,
    url,
    confidence: missing.length === 0 ? 0.95 : 0.70,
    needsReview: missing.length > 0,
    missing,
    hint: "legisqc",
  };
}

// ── Generic fallback ──────────────────────────────────────────────────────────
function parseGeneric(html: string, url: string) {
  const siteName = getMeta(html, "og:site_name", "application-name");
  const title    = cleanTitle(getTitle(html), siteName);
  const author   = getMeta(html, "author", "article:author", "parsely-author") || getJsonLd(html, "author");
  const rawDate  = getMeta(html, "article:published_time", "date", "datePublished") || getJsonLd(html, "datePublished");
  const year     = rawDate ? (() => { const d = new Date(rawDate); return isNaN(d.getTime()) ? rawDate.slice(0, 4) : String(d.getUTCFullYear()); })() : "";

  const missing: string[] = [];
  if (!author) missing.push("author");
  if (!year)   missing.push("year");

  return {
    sourceType: "monograph",
    title, author, year,
    publisher: siteName,
    url,
    confidence: 0.50,
    needsReview: true,
    missing,
    hint: "generic",
  };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(`scrape-qc:${ip}`, SCRAPE_RATE_LIMIT);
  if (!rate.allowed)
    return NextResponse.json({ error: `Trop de requêtes. Réessayez dans ${rate.minutesLeft} minute(s).` }, { status: 429 });

  const { url } = await req.json();
  if (typeof url !== "string" || !url.startsWith("http"))
    return NextResponse.json({ error: "Veuillez entrer une URL valide commençant par http." }, { status: 400 });

  // CanLII's own pages are behind Cloudflare bot protection, so this never
  // fetches canlii.org — it goes straight to the API (or the URL-only
  // fallback) instead of depending on a page fetch that would often 403/503.
  if (url.includes("canlii.org")) {
    return NextResponse.json(await parseCanLII(url));
  }

  try {
    const response = await safeFetchHtml(url, { maxBytes: 150_000, timeoutMs: 8000 });
    if (!response.ok)
      return NextResponse.json({ error: `Impossible d'accéder à la page (erreur ${response.status}).` }, { status: 400 });

    const html = response.html;

    let result;
    if (url.includes("assnat.qc.ca"))
      result = parseAssNat(html, url);
    else if (url.includes("soquij.qc.ca") || url.includes("azimut.soquij"))
      result = parseSoquij(html, url);
    else if (url.includes("legisquebec.gouv.qc.ca") || url.includes("legisquebec.quebec.ca"))
      result = parseLegisQc(html, url);
    else
      result = parseGeneric(html, url);

    // These regex-based extractors degrade *silently* — a low-confidence
    // result is shown to the user as "please review this field", which
    // protects any one citation, but nobody at Cite. would otherwise notice
    // if e.g. légisQuébec changed their markup and confidence quietly
    // dropped on every request from then on. Surface it as a low-severity
    // Sentry event (not an error — a messy page is sometimes genuinely just
    // messy) so a *pattern* of degradation on one source is visible.
    if (result.hint !== "canlii-api" && result.hint !== "canlii" && result.confidence < 0.7) {
      Sentry.captureMessage(`Low-confidence scrape-qc extraction (${result.hint})`, {
        level: "warning",
        tags: { hint: result.hint, sourceType: result.sourceType },
        extra: { url, confidence: result.confidence, missing: result.missing },
      });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof UnsafeUrlError)
      return NextResponse.json({ error: "Cette URL ne peut pas être consultée. Veuillez utiliser une adresse Web publique." }, { status: 400 });
    // Previously swallowed entirely — no log, no report, nothing. If
    // légisQuébec/SOQUIJ/Assemblée nationale change their markup or start
    // blocking requests, this is how we'd actually find out instead of
    // waiting for a user to complain.
    Sentry.captureException(err, { extra: { url } });
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("timeout") || msg.includes("abort"))
      return NextResponse.json({ error: "La page a mis trop de temps à répondre." }, { status: 400 });
    return NextResponse.json({ error: "Impossible d'accéder à cette URL. Le site bloque peut-être les requêtes automatiques." }, { status: 400 });
  }
}
