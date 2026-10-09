import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── mocks ────────────────────────────────────────────────────────────────────
// canlii.ts imports these from "./db" (== "@/lib/db", same resolved module),
// so mocking "@/lib/db" here intercepts them there too.
const dbMocks = vi.hoisted(() => ({
  getCanliiCacheEntry: vi.fn(),
  setCanliiCacheEntry: vi.fn(),
  setCanliiNotFoundEntry: vi.fn(),
  getCanliiUsageToday: vi.fn(),
  incrementCanliiUsage: vi.fn(),
}));
vi.mock("@/lib/db", () => dbMocks);
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { parseCanliiUrl, splitStyleOfCause, fetchCanliiCase, type CanliiCaseMetadata } from "@/lib/canlii";

function meta(overrides: Partial<CanliiCaseMetadata> = {}): CanliiCaseMetadata {
  return {
    databaseId: "qcca",
    caseId: "2023qcca1657",
    url: "https://www.canlii.org/fr/qc/qcca/doc/2023/2023qcca1657/2023qcca1657.html",
    title: "X c. Y",
    citation: "2023 QCCA 1657",
    language: "fr",
    docketNumber: "500-09-000000-000",
    decisionDate: "2023-01-01",
    keywords: "",
    concatenatedId: "2023qcca1657",
    ...overrides,
  };
}

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  fetchMock.mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

function mockFetchRejectOnce(err: unknown) {
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  fetchMock.mockRejectedValueOnce(err);
}

// ── pure functions ───────────────────────────────────────────────────────────

describe("canlii: parseCanliiUrl", () => {
  it("parses a French QCCA URL", () => {
    expect(parseCanliiUrl("https://www.canlii.org/fr/qc/qcca/doc/2023/2023qcca1657/2023qcca1657.html")).toEqual({
      language: "fr",
      databaseId: "qcca",
      caseId: "2023qcca1657",
    });
  });

  it("parses an English CSC URL", () => {
    expect(parseCanliiUrl("https://www.canlii.org/en/ca/scc/doc/2008/2008scc9/2008scc9.html")).toEqual({
      language: "en",
      databaseId: "scc",
      caseId: "2008scc9",
    });
  });

  it("returns null for a non-CanLII URL", () => {
    expect(parseCanliiUrl("https://www.legisquebec.gouv.qc.ca/fr/document/lc/ccq-1991")).toBeNull();
  });

  it("returns null for a CanLII URL that isn't a case page", () => {
    expect(parseCanliiUrl("https://www.canlii.org/fr/qc/qcca/")).toBeNull();
  });
});

describe("canlii: splitStyleOfCause", () => {
  it("splits a French-connector style of cause", () => {
    expect(splitStyleOfCause("Dunsmuir c. Nouveau-Brunswick")).toEqual({
      plaintiff: "Dunsmuir",
      defendant: "Nouveau-Brunswick",
      connector: "c.",
    });
  });

  it("splits an English-connector style of cause", () => {
    expect(splitStyleOfCause("Dunsmuir v. New Brunswick")).toEqual({
      plaintiff: "Dunsmuir",
      defendant: "New Brunswick",
      connector: "v.",
    });
  });

  it("returns null when there's no recognizable connector", () => {
    expect(splitStyleOfCause("Re Companies Act")).toBeNull();
  });
});

// ── fetchCanliiCase ───────────────────────────────────────────────────────────
// Each test uses a distinct databaseId/caseId so the module-level in-memory
// cache inside canlii.ts (intentionally not reset between tests, since it's
// private) never leaks a result from one test into another.

describe("canlii: fetchCanliiCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    dbMocks.getCanliiUsageToday.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null and never calls fetch when CANLII_API_KEY isn't configured", async () => {
    vi.stubEnv("CANLII_API_KEY", "");
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0001" });

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns a positive DB cache hit without calling fetch", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    const cached = meta({ caseId: "2001qcca0002" });
    dbMocks.getCanliiCacheEntry.mockResolvedValue({ found: true, metadata: cached });

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0002" });

    expect(result).toEqual(cached);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null for a negative DB cache hit without calling fetch", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    dbMocks.getCanliiCacheEntry.mockResolvedValue({ found: false });

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0003" });

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("caches a positive API result in memory, so a second lookup skips the DB and fetch entirely", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);
    const parsed = { language: "fr" as const, databaseId: "qcca", caseId: "2001qcca0004" };
    mockFetchOnce(200, meta({ caseId: "2001qcca0004" }));

    const first = await fetchCanliiCase(parsed);
    expect(first?.caseId).toBe("2001qcca0004");
    expect(dbMocks.setCanliiCacheEntry).toHaveBeenCalledTimes(1);

    const second = await fetchCanliiCase(parsed);
    expect(second).toEqual(first);
    // Still only the one fetch/DB-write from the first call.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(dbMocks.getCanliiCacheEntry).toHaveBeenCalledTimes(1);
  });

  it("falls back to URL-only parsing (returns null) once the daily safety limit is reached, without calling fetch", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    // CANLII_DAILY_SAFETY_LIMIT is read once at module load time, so it can't
    // be stubbed per-test here — relying on its documented default (4500).
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);
    dbMocks.getCanliiUsageToday.mockResolvedValue(4500);

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0005" });

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("daily safety limit"),
      expect.objectContaining({ level: "warning" })
    );
  });

  it("caches a confirmed 404 as a negative entry", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);
    mockFetchOnce(404, null);

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0006" });

    expect(result).toBeNull();
    expect(dbMocks.setCanliiNotFoundEntry).toHaveBeenCalledWith("fr/qcca/2001qcca0006");
    expect(dbMocks.setCanliiCacheEntry).not.toHaveBeenCalled();
  });

  it("treats a 200 response with no title as a confirmed miss (negative-cached)", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);
    mockFetchOnce(200, { someOtherField: true });

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0007" });

    expect(result).toBeNull();
    expect(dbMocks.setCanliiNotFoundEntry).toHaveBeenCalledWith("fr/qcca/2001qcca0007");
  });

  it("retries once on a transient failure and succeeds, counting both attempts against usage", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);
    mockFetchRejectOnce(new Error("network hiccup"));
    mockFetchOnce(200, meta({ caseId: "2001qcca0008" }));

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0008" });

    expect(result?.caseId).toBe("2001qcca0008");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(dbMocks.incrementCanliiUsage).toHaveBeenCalledTimes(2);
    expect(dbMocks.setCanliiCacheEntry).toHaveBeenCalledTimes(1);
  }, 10000);

  it("returns null (uncached) and reports to Sentry when both attempts fail", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);
    mockFetchRejectOnce(new Error("first failure"));
    mockFetchRejectOnce(new Error("second failure"));

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0009" });

    expect(result).toBeNull();
    expect(dbMocks.setCanliiCacheEntry).not.toHaveBeenCalled();
    expect(dbMocks.setCanliiNotFoundEntry).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  }, 10000);

  it("does not cache a 5xx response, so the next lookup gets a fresh attempt", async () => {
    vi.stubEnv("CANLII_API_KEY", "test-key");
    dbMocks.getCanliiCacheEntry.mockResolvedValue(undefined);
    mockFetchOnce(500, null);
    mockFetchOnce(500, null);

    const result = await fetchCanliiCase({ language: "fr", databaseId: "qcca", caseId: "2001qcca0010" });

    expect(result).toBeNull();
    expect(dbMocks.setCanliiCacheEntry).not.toHaveBeenCalled();
    expect(dbMocks.setCanliiNotFoundEntry).not.toHaveBeenCalled();
  }, 10000);
});
