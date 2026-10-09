import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dnsMocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("dns/promises", () => dnsMocks);

import { isPrivateAddress, assertPublicUrl, safeFetchHtml, UnsafeUrlError } from "@/lib/safe-fetch";

beforeEach(() => {
  dnsMocks.lookup.mockReset();
  dnsMocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});
afterEach(() => vi.unstubAllGlobals());

describe("safe-fetch: isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "%s is private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true)
  );

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"])("%s is public", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false)
  );
});

describe("safe-fetch: assertPublicUrl", () => {
  it("accepts a normal public https URL", async () => {
    await expect(assertPublicUrl("https://www.legisquebec.gouv.qc.ca/fr/document/lc/ccq-1991")).resolves.toBeInstanceOf(URL);
  });

  it.each([
    "ftp://example.com/file",
    "file:///etc/passwd",
    "http://localhost:3000/",
    "http://foo.localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://example.com:6379/",
    "http://user:pass@example.com/",
    "not a url",
  ])("rejects %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects a public-looking hostname that resolves to a private IP (DNS rebinding style)", async () => {
    dnsMocks.lookup.mockResolvedValue([{ address: "10.0.0.8", family: 4 }]);
    await expect(assertPublicUrl("https://sneaky.example.com/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects hosts that don't resolve", async () => {
    dnsMocks.lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicUrl("https://does-not-exist.example/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

describe("safe-fetch: safeFetchHtml", () => {
  it("re-validates redirect targets and refuses to follow one into an internal address", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetchHtml("https://example.com/", { maxBytes: 1000, timeoutMs: 1000 })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a safe redirect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/new-place" } }))
      .mockResolvedValueOnce(new Response("<title>Moved</title>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetchHtml("https://example.com/old", { maxBytes: 1000, timeoutMs: 1000 });
    expect(result.ok).toBe(true);
    expect(result.html).toContain("Moved");
    expect(result.finalUrl).toBe("https://example.com/new-place");
  });

  it("stops after too many redirects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/loop" } })));
    await expect(safeFetchHtml("https://example.com/loop", { maxBytes: 1000, timeoutMs: 1000 })).rejects.toThrow(/redirects/);
  });

  it("caps how much of the body is read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(500_000), { status: 200 })));
    const result = await safeFetchHtml("https://example.com/huge", { maxBytes: 1000, timeoutMs: 1000 });
    expect(result.html.length).toBe(1000);
  });

  it("reports non-2xx responses without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    const result = await safeFetchHtml("https://example.com/missing", { maxBytes: 1000, timeoutMs: 1000 });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});
