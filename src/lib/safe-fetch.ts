import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Server-side fetch of a user-supplied URL, hardened against SSRF:
 *  - only http(s), default ports
 *  - refuses localhost / private / link-local / cloud-metadata addresses,
 *    both as literal IPs and after DNS resolution
 *  - follows redirects manually (max 3), re-validating every hop, so a public
 *    URL can't bounce the server into an internal address
 *  - stops reading after `maxBytes`, so a huge response can't exhaust memory
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const BLOCKED_HOSTNAMES = /(^localhost$)|(\.localhost$)|(\.local$)|(\.internal$)|(^metadata\.google\.internal$)/i;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return PRIVATE_V4.some(([base, bits]) => inCidr(ip, base, bits));
  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") || // unique local
      /^fe[89ab]/.test(lower) || // link-local
      lower.startsWith("ff") // multicast
    );
  }
  return true; // not an IP at all — treat as unsafe
}

/** Throws UnsafeUrlError unless `raw` is an http(s) URL pointing at a public host. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http(s) URLs are allowed.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Non-standard ports are not allowed.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.test(host)) throw new UnsafeUrlError("That host is not allowed.");

  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("That host is not allowed.");
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("Could not resolve that host.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError("That host is not allowed.");
  }
  return url;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  html: string;
  finalUrl: string;
}

const MAX_REDIRECTS = 3;

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body || typeof body.getReader !== "function") {
    // Fallback for minimal Response-like objects (e.g. test doubles).
    const buffer = await response.arrayBuffer();
    return new TextDecoder().decode(buffer.slice(0, maxBytes));
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    received += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const merged = new Uint8Array(Math.min(received, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.length;
    if (offset >= merged.length) break;
  }
  return new TextDecoder().decode(merged);
}

export async function safeFetchHtml(rawUrl: string, opts: { maxBytes: number; timeoutMs: number }): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let current = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CitationBot/1.0)", Accept: "text/html" },
      redirect: "manual",
      signal,
    });

    const location = response.headers?.get?.("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) return { ok: false, status: response.status, html: "", finalUrl: current.toString() };
    return { ok: true, status: response.status, html: await readCapped(response, opts.maxBytes), finalUrl: current.toString() };
  }
  throw new UnsafeUrlError("Too many redirects.");
}
