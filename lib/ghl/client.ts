export class GhlError extends Error {
  constructor(message: string, public status?: number, public cause?: unknown) {
    super(message);
    this.name = "GhlError";
  }
}

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

// Simple in-process token bucket. GHL documents 100 requests / 10 seconds per
// app per location. We cap at 80 to leave headroom for retries and other
// callers in the same process; tighten if multi-location later.
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private capacity: number, private refillIntervalMs: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async take(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefill >= this.refillIntervalMs) {
      this.tokens = this.capacity;
      this.lastRefill = now;
    }
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    const wait = this.refillIntervalMs - (now - this.lastRefill);
    await new Promise((r) => setTimeout(r, wait));
    this.tokens = this.capacity - 1;
    this.lastRefill = Date.now();
  }
}

const bucket = new TokenBucket(80, 10_000);

let fetchImpl: typeof fetch = globalThis.fetch;
export function __setFetchForTests(f: typeof fetch | null): void {
  fetchImpl = f ?? globalThis.fetch;
}

// Tests bypass the bucket so they don't hang.
let useBucket = true;
export function __setRateLimitForTests(enabled: boolean): void {
  useBucket = enabled;
}

export interface GhlFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  body?: unknown;
}

export async function ghlFetch<T>(opts: GhlFetchOptions): Promise<T> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new GhlError("GHL_API_KEY missing");

  if (useBucket) await bucket.take();

  const url = `${GHL_BASE}${opts.path}`;
  const res = await fetchImpl(url, {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${apiKey}`,
      version: GHL_API_VERSION,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GhlError(`GHL ${res.status} on ${opts.path}: ${text.slice(0, 200)}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
