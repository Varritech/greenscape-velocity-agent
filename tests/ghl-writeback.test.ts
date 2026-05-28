import { describe, it, expect, beforeEach } from "vitest";
import {
  __setFetchForTests,
  __setRateLimitForTests,
  GhlError,
} from "@/lib/ghl/client";
import {
  setContactCustomField,
  updateOpportunityStage,
  TIER_TO_STAGE,
} from "@/lib/ghl/writeback";

beforeEach(() => {
  process.env.GHL_API_KEY = "key_test";
  __setRateLimitForTests(false);
  __setFetchForTests(null);
});

describe("setContactCustomField", () => {
  it("PUTs to /contacts/<id> with bearer auth, version header, and customFields body", async () => {
    let called: { url: string; init: RequestInit } | null = null;
    __setFetchForTests((async (url: string, init: RequestInit) => {
      called = { url, init };
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch);

    await setContactCustomField("contact-1", "field-1", 87);

    expect(called!.url).toMatch(/\/contacts\/contact-1$/);
    expect(called!.init.method).toBe("PUT");
    const headers = called!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer key_test");
    expect(headers.version).toBe("2021-07-28");
    const body = JSON.parse(called!.init.body as string);
    expect(body.customFields).toEqual([{ id: "field-1", field_value: 87 }]);
  });

  it("throws GhlError on non-2xx", async () => {
    __setFetchForTests((async () =>
      new Response("nope", { status: 429 })) as unknown as typeof fetch);

    await expect(setContactCustomField("x", "y", 1)).rejects.toThrow(GhlError);
  });
});

describe("updateOpportunityStage", () => {
  beforeEach(() => {
    process.env.GHL_STAGE_ID_QUALIFIED = "stage_q";
    process.env.GHL_STAGE_ID_NEEDS_HUMAN = "stage_nh";
    process.env.GHL_STAGE_ID_DISQUALIFIED = "stage_dq";
  });

  it("PUTs to /opportunities/<id> with mapped pipelineStageId + label", async () => {
    let called: { url: string; init: RequestInit } | null = null;
    __setFetchForTests((async (url: string, init: RequestInit) => {
      called = { url, init };
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch);

    await updateOpportunityStage({
      pipelineId: "pipe-1",
      opportunityId: "opp-1",
      tier: "qualified",
    });

    expect(called!.url).toMatch(/\/opportunities\/opp-1$/);
    expect(called!.init.method).toBe("PUT");
    const body = JSON.parse(called!.init.body as string);
    expect(body.pipelineId).toBe("pipe-1");
    expect(body.pipelineStageId).toBe("stage_q");
    expect(body.pipelineStageName).toBe(TIER_TO_STAGE.qualified);
  });

  it("maps all three tiers to the expected stage names", () => {
    expect(TIER_TO_STAGE.qualified).toBe("Qualified");
    expect(TIER_TO_STAGE.needs_human).toBe("Needs Human");
    expect(TIER_TO_STAGE.disqualified).toBe("Disqualified");
  });
});
