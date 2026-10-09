/**
 * Route-level tests for POST /api/scrape-qc, covering the source-specific
 * extractors (Assemblée nationale, SOQUIJ, légisQuébec, generic fallback)
 * and the CanLII branch. This is the safety net for the fragile
 * regex-over-HTML scrapers flagged in the reliability review — before any
 * of them get rewritten with a real HTML parser, these tests pin down what
 * they currently do so a rewrite can be checked against known-good output.
 *
 * fetch(), the rate limiter, and CanLII's fetchCanliiCase are mocked so this
 * runs offline; parseCanliiUrl/splitStyleOfCause run for real (pure
 * functions), as do all the HTML-parsing regexes under test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/db", () => dbMocks);
vi.mock("dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/canlii", async (importOriginal: () => Promise<typeof import("@/lib/canlii")>) => {
  const actual = await importOriginal();
  return { ...actual, fetchCanliiCase: vi.fn() };
});

import { NextRequest } from "next/server";
import { POST } from "@/app/api/scrape-qc/route";
import { fetchCanliiCase } from "@/lib/canlii";

function postRequest(url: string, ip = "1.2.3.4") {
  return new NextRequest("http://localhost:3000/api/scrape-qc", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ url }),
  });
}

function mockPageFetch(html: string, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () => new TextEncoder().encode(html).buffer,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.checkRateLimit.mockResolvedValue({ allowed: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/scrape-qc — validation & rate limiting", () => {
  it("rejects a missing/invalid URL", async () => {
    const res = await POST(postRequest("not-a-url"));
    expect(res.status).toBe(400);
  });

  it("returns 429 when the per-IP rate limit is exceeded", async () => {
    dbMocks.checkRateLimit.mockResolvedValue({ allowed: false, minutesLeft: 3 });
    const res = await POST(postRequest("https://www.assnat.qc.ca/fr/lois/lois.html"));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/scrape-qc — Assemblée nationale", () => {
  it("extracts a bill's title, number, and session from a projet-de-loi URL", async () => {
    mockPageFetch(
      `<html><head><title>Projet de loi n° 188, Loi sur la distribution de produits et services financiers - Assemblée nationale du Québec</title></head><body></body></html>`
    );
    const res = await POST(
      postRequest("https://www.assnat.qc.ca/fr/travaux-parlementaires/projets-loi/projet-loi-188-35-2.html")
    );
    const body = await res.json();
    expect(body.hint).toBe("assnat-bill");
    expect(body.title).toBe("Loi sur la distribution de produits et services financiers");
    expect(body.sequenceNumber).toBe("188");
    expect(body.volume).toBe("2e session, 35e législature");
    expect(body.needsReview).toBe(false);
  });

  it("extracts a consolidated statute's title from a plain law page", async () => {
    mockPageFetch(`<html><head><title>Loi sur l'Assemblée nationale - Assemblée nationale du Québec</title></head><body></body></html>`);
    const res = await POST(postRequest("https://www.assnat.qc.ca/fr/lois/lois.html"));
    const body = await res.json();
    expect(body.hint).toBe("assnat-law");
    expect(body.title).toBe("Loi sur l'Assemblée nationale");
    expect(body.sourceType).toBe("consolidated-statute");
  });
});

describe("POST /api/scrape-qc — SOQUIJ", () => {
  it("extracts parties, year, and the AZ number from a decision page", async () => {
    mockPageFetch(`<html><head><title>Tremblay c. Gagnon, 2023 AZ-51234567</title></head><body></body></html>`);
    const res = await POST(postRequest("https://www.soquij.qc.ca/some/decision"));
    const body = await res.json();
    expect(body.hint).toBe("soquij");
    expect(body.plaintiff).toBe("Tremblay");
    expect(body.defendant).toBe("Gagnon");
    expect(body.year).toBe("2023");
    expect(body.sequenceNumber).toBe("AZ-51234567");
    expect(body.needsReview).toBe(false);
  });

  it("flags missing fields for review when the title doesn't match the expected pattern", async () => {
    mockPageFetch(`<html><head><title>Décision sans style de cause reconnaissable</title></head><body></body></html>`);
    const res = await POST(postRequest("https://azimut.soquij.qc.ca/some/decision"));
    const body = await res.json();
    expect(body.needsReview).toBe(true);
    expect(body.missing.length).toBeGreaterThan(0);
  });
});

describe("POST /api/scrape-qc — légisQuébec", () => {
  it("extracts the statute title and chapter from an RLRQ page title", async () => {
    mockPageFetch(`<html><head><title>Code civil du Québec, RLRQ c. CCQ-1991</title></head><body></body></html>`);
    const res = await POST(postRequest("https://www.legisquebec.gouv.qc.ca/fr/document/lc/ccq-1991"));
    const body = await res.json();
    expect(body.hint).toBe("legisqc");
    expect(body.title).toBe("Code civil du Québec");
    expect(body.chapter).toBe("CCQ-1991");
    expect(body.needsReview).toBe(false);
  });

  it("falls back to the chapter number in the URL when the title has no RLRQ suffix", async () => {
    mockPageFetch(`<html><head><title>Loi sur la protection du consommateur - LégisQuébec</title></head><body></body></html>`);
    const res = await POST(
      postRequest("https://www.legisquebec.gouv.qc.ca/fr/document/lc/chapitre=P-40.1")
    );
    const body = await res.json();
    expect(body.chapter).toBe("P-40.1");
  });
});

describe("POST /api/scrape-qc — generic fallback", () => {
  it("always marks the result as needing review, even with every field present", async () => {
    mockPageFetch(`<html><head>
      <meta property="og:site_name" content="Radio-Canada" />
      <meta property="og:title" content="Un titre - Radio-Canada" />
      <meta name="author" content="Marie Roy" />
      <meta property="article:published_time" content="2022-09-01" />
    </head><body></body></html>`);
    const res = await POST(postRequest("https://ici.radio-canada.ca/some/article"));
    const body = await res.json();
    expect(body.hint).toBe("generic");
    expect(body.needsReview).toBe(true); // by design — never fully trusted
    expect(body.confidence).toBe(0.5);
    expect(body.title).toBe("Un titre");
    expect(body.author).toBe("Marie Roy");
    expect(body.year).toBe("2022");
  });
});

describe("POST /api/scrape-qc — CanLII", () => {
  it("uses the CanLII API result when available (canlii-api hint)", async () => {
    vi.mocked(fetchCanliiCase).mockResolvedValue({
      databaseId: "csc", caseId: "2008csc9", url: "https://example.com",
      title: "Dunsmuir c. Nouveau-Brunswick", citation: "2008 CSC 9", language: "fr",
      docketNumber: "31459", decisionDate: "2008-03-07", keywords: "", concatenatedId: "2008scc9",
    });

    const res = await POST(postRequest("https://www.canlii.org/fr/ca/csc/doc/2008/2008csc9/2008csc9.html"));
    const body = await res.json();

    expect(body.hint).toBe("canlii-api");
    expect(body.plaintiff).toBe("Dunsmuir");
    expect(body.defendant).toBe("Nouveau-Brunswick");
    expect(body.connector).toBe("c.");
    expect(body.courtCode).toBe("CSC");
    expect(body.sequenceNumber).toBe("9");
    expect(body.needsReview).toBe(false);
  });

  it("falls back to URL-only parsing when the API has no key configured", async () => {
    vi.stubEnv("CANLII_API_KEY", "");
    vi.mocked(fetchCanliiCase).mockResolvedValue(null);

    const res = await POST(postRequest("https://www.canlii.org/fr/ca/csc/doc/2008/2008csc9/2008csc9.html"));
    const body = await res.json();

    expect(body.hint).toBe("canlii");
    expect(body.year).toBe("2008");
    expect(body.courtCode).toBe("CSC");
    expect(body.sequenceNumber).toBe("9");
    expect(body.needsReview).toBe(true);
    expect(body.message).toContain("non configurée");
    vi.unstubAllEnvs();
  });

  it("falls back to URL-only parsing with a different message when CanLII just didn't return the case", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    vi.mocked(fetchCanliiCase).mockResolvedValue(null);

    const res = await POST(postRequest("https://www.canlii.org/fr/ca/csc/doc/2008/2008csc9/2008csc9.html"));
    const body = await res.json();

    expect(body.hint).toBe("canlii");
    expect(body.message).toContain("n'a pas retourné ce dossier");
    vi.unstubAllEnvs();
  });
});
