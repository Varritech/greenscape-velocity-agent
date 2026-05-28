import { createHmac } from "node:crypto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { POST } from "@/app/api/webhooks/ghl/route";
import { __setDbClientForTests } from "@/lib/db/client";
import { __setAnthropicClientForTests } from "@/lib/qualifier";

const SECRET = "test_secret_do_not_use_in_prod";

const stubModelOutput = JSON.stringify({
  score: 80,
  tier: "qualified",
  reasoning: "stub",
  subscores: { budget: 15, lot: 20, hoa: 15, timeline: 15, location: 15 },
  modifiers_applied: [],
  suggested_next_action: "SMS now",
});

beforeAll(() => {
  process.env.GHL_WEBHOOK_SECRET = SECRET;
});

beforeEach(() => {
  const fake = {
    from() {
      const chain: Record<string, unknown> = {
        insert: () => chain,
        select: () => chain,
        single: () => Promise.resolve({ data: { id: "lead-fake", source: "Google LSA" }, error: null }),
        then: (onF: (r: { data: null; error: null }) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onF),
      };
      return chain;
    },
  };
  __setDbClientForTests(fake as unknown as Parameters<typeof __setDbClientForTests>[0]);

  const fakeAnthropic = {
    messages: {
      create: async () => ({ content: [{ type: "text", text: stubModelOutput }] }),
    },
  } as unknown as Anthropic;
  __setAnthropicClientForTests(fakeAnthropic);
});

const sign = (body: string) =>
  createHmac("sha256", SECRET).update(body).digest("hex");

const validPayload = {
  contact_id: "abc123",
  location_id: "loc1",
  first_name: "Daniel",
  last_name: "Reyes",
  email: "daniel@example.com",
  phone: "+14805550101",
  source: "Google LSA",
  message: "Want a full backyard remodel",
  custom_fields: [],
};

function makeRequest(body: string, sig: string | null) {
  const headers = new Headers();
  if (sig !== null) headers.set("x-ghl-signature", sig);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/webhooks/ghl", {
    method: "POST",
    headers,
    body,
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/webhooks/ghl", () => {
  it("returns 202 for a valid signed payload", async () => {
    const body = JSON.stringify(validPayload);
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json).toMatchObject({
      accepted: true,
      contact_id: "abc123",
      lead_id: "lead-fake",
      qualification: { score: 80, tier: "qualified" },
    });
  });

  it("returns 401 on bad signature", async () => {
    const body = JSON.stringify(validPayload);
    const res = await POST(makeRequest(body, "deadbeef"));
    expect(res.status).toBe(401);
  });

  it("returns 401 on missing signature header", async () => {
    const body = JSON.stringify(validPayload);
    const res = await POST(makeRequest(body, null));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON", async () => {
    const body = "{not json";
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it("returns 400 on schema mismatch", async () => {
    const body = JSON.stringify({ contact_id: "x" }); // missing location_id + source
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_payload");
  });
});
