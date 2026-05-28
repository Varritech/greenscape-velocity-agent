import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildSlackBlocks,
  notifyQualification,
  __setFetchForTests,
} from "@/lib/slack";

const baseNotice = {
  leadId: "lead-1",
  leadName: "Daniel Reyes",
  source: "Google LSA",
  score: 85,
  tier: "qualified" as const,
  reasoning: "Budget + Scottsdale",
  suggestedNextAction: "offer three site-walk windows this week",
  smsSid: "SMabc",
  appUrl: "https://example.com",
};

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
  __setFetchForTests(null);
});

describe("buildSlackBlocks", () => {
  it("includes header, fields, reasoning, suggested next, and an action", () => {
    const out = buildSlackBlocks(baseNotice) as { blocks: { type: string }[] };
    const types = out.blocks.map((b) => b.type);
    expect(types).toContain("header");
    expect(types).toContain("section");
    expect(types).toContain("context");
    expect(types).toContain("actions");
  });

  it("uses the correct emoji per tier", () => {
    const q = buildSlackBlocks({ ...baseNotice, tier: "qualified" }) as {
      blocks: { text?: { text: string } }[];
    };
    const dq = buildSlackBlocks({ ...baseNotice, tier: "disqualified" }) as {
      blocks: { text?: { text: string } }[];
    };
    const nh = buildSlackBlocks({ ...baseNotice, tier: "needs_human" }) as {
      blocks: { text?: { text: string } }[];
    };
    expect(q.blocks[0].text?.text).toMatch(/white_check_mark/);
    expect(dq.blocks[0].text?.text).toMatch(/no_entry_sign/);
    expect(nh.blocks[0].text?.text).toMatch(/eyes/);
  });

  it("indicates no SMS when smsSid is null", () => {
    const out = buildSlackBlocks({ ...baseNotice, smsSid: null }) as {
      blocks: { elements?: { text: string }[] }[];
    };
    const context = out.blocks.find((b) => b.elements);
    expect(context?.elements?.[0].text).toMatch(/No SMS sent/);
  });
});

describe("notifyQualification", () => {
  it("POSTs the block payload to SLACK_WEBHOOK_URL and returns true on 200", async () => {
    let called: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      called = { url, init };
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    __setFetchForTests(fakeFetch);

    const ok = await notifyQualification(baseNotice);
    expect(ok).toBe(true);
    expect(called!.url).toBe("https://hooks.slack.com/test");
    const body = JSON.parse(called!.init.body as string);
    expect(body.blocks).toBeDefined();
  });

  it("returns false (does not throw) when SLACK_WEBHOOK_URL is missing", async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const ok = await notifyQualification(baseNotice);
    expect(ok).toBe(false);
  });

  it("returns false (does not throw) on non-2xx", async () => {
    __setFetchForTests((async () => new Response("nope", { status: 500 })) as unknown as typeof fetch);
    const ok = await notifyQualification(baseNotice);
    expect(ok).toBe(false);
  });

  it("returns false (does not throw) on fetch reject", async () => {
    __setFetchForTests((async () => {
      throw new Error("network");
    }) as unknown as typeof fetch);
    const ok = await notifyQualification(baseNotice);
    expect(ok).toBe(false);
  });
});
