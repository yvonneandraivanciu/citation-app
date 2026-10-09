/**
 * Route-level tests for POST /api/scrape (the generic-only citation
 * auto-fill endpoint). fetch() and the rate limiter are mocked so this runs
 * offline; the real regex extractors in the route file do the actual work.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/db", () => dbMocks);
vi.mock("dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/scrape/route";

function postRequest(url: string, ip = "1.2.3.4") {
  return new NextRequest("http://localhost:3000/api/scrape", {
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
});

describe("POST /api/scrape", () => {
  it("rejects a missing/invalid URL without calling fetch", async () => {
    const res = await POST(postRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns 429 when the per-IP rate limit is exceeded", async () => {
    dbMocks.checkRateLimit.mockResolvedValue({ allowed: false, minutesLeft: 7 });
    const res = await POST(postRequest("https://example.com/article"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("7");
  });

  it("extracts title/author/year/publisher from a generic article page", async () => {
    mockPageFetch(`<html><head>
      <meta property="og:site_name" content="Le Devoir" />
      <meta property="og:title" content="Un grand titre d'article - Le Devoir" />
      <meta name="author" content="Jean Tremblay" />
      <meta property="article:published_time" content="2023-05-12" />
    </head><body></body></html>`);

    const res = await POST(postRequest("https://ledevoir.com/some/article"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Un grand titre d'article");
    expect(body.author).toBe("Jean Tremblay");
    expect(body.year).toBe("2023");
    expect(body.publisher).toBe("Le Devoir");
  });

  it("falls back to the <title> tag and JSON-LD author when meta tags are missing", async () => {
    mockPageFetch(`<html><head>
      <title>A Bare Title</title>
      <script type="application/ld+json">{"author": {"name": "Jane Doe"}, "datePublished": "2021-01-01"}</script>
    </head><body></body></html>`);

    const res = await POST(postRequest("https://example.com/no-meta"));
    const body = await res.json();
    expect(body.title).toBe("A Bare Title");
    expect(body.author).toBe("Jane Doe");
    expect(body.year).toBe("2021");
  });

  it("returns 400 when the target page responds with an error status", async () => {
    mockPageFetch("", 404);
    const res = await POST(postRequest("https://example.com/missing"));
    expect(res.status).toBe(400);
  });

  it("refuses internal addresses (SSRF) without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const target of ["http://localhost/admin", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5/", "http://[::1]/"]) {
      const res = await POST(postRequest(target));
      expect(res.status).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 400 and reports to Sentry when the fetch itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const res = await POST(postRequest("https://example.com/unreachable"));
    expect(res.status).toBe(400);
  });
});
