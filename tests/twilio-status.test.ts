import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import twilio from "twilio";
import { POST } from "@/app/api/webhooks/twilio/status/route";
import { __setDbClientForTests } from "@/lib/db/client";

const AUTH_TOKEN = "token_test";
const BASE = "https://example.com";

beforeAll(() => {
  process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
  process.env.NEXT_PUBLIC_APP_URL = BASE;
});

beforeEach(() => {
  vi.restoreAllMocks();
  const fake = {
    from() {
      const chain: Record<string, unknown> = {
        insert: () => chain,
        select: () => chain,
        single: () => Promise.resolve({ data: { id: "x" }, error: null }),
        then: (onF: (r: { data: null; error: null }) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onF),
      };
      return chain;
    },
  };
  __setDbClientForTests(fake as unknown as Parameters<typeof __setDbClientForTests>[0]);
});

function makeRequest(bodyParams: Record<string, string>, sig: string | null) {
  const body = new URLSearchParams(bodyParams).toString();
  const headers = new Headers();
  if (sig !== null) headers.set("x-twilio-signature", sig);
  headers.set("content-type", "application/x-www-form-urlencoded");
  return new Request(`${BASE}/api/webhooks/twilio/status`, {
    method: "POST",
    headers,
    body,
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/webhooks/twilio/status", () => {
  const validBody = {
    MessageSid: "SM123",
    MessageStatus: "delivered",
    To: "+14805550101",
  };

  it("returns 200 on a Twilio-signed payload", async () => {
    vi.spyOn(twilio, "validateRequest").mockReturnValue(true);
    const res = await POST(makeRequest(validBody, "anysig"));
    expect(res.status).toBe(200);
  });

  it("returns 401 on bad signature", async () => {
    vi.spyOn(twilio, "validateRequest").mockReturnValue(false);
    const res = await POST(makeRequest(validBody, "badsig"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature header is missing", async () => {
    const res = await POST(makeRequest(validBody, null));
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    vi.spyOn(twilio, "validateRequest").mockReturnValue(true);
    const res = await POST(makeRequest({ MessageSid: "SM1" }, "anysig"));
    expect(res.status).toBe(400);
  });
});
