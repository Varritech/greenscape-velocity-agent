import { describe, it, expect, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { qualifyLead, QualifierError, __setAnthropicClientForTests } from "@/lib/qualifier";
import type { GhlLeadPayload } from "@/lib/ghl/schema";

const validLead: GhlLeadPayload = {
  contact_id: "abc",
  location_id: "loc1",
  first_name: "Daniel",
  last_name: "Reyes",
  email: "daniel@example.com",
  phone: "+14805550101",
  source: "Google LSA",
  message: "Full backyard remodel in Scottsdale, $60K, no HOA",
  custom_fields: [{ id: "prior_contractor", value: "yes" }],
};

const validModelOutput = JSON.stringify({
  score: 95,
  tier: "qualified",
  reasoning: "Explicit budget, scope, Phoenix metro, no HOA, summer urgency.",
  subscores: { budget: 20, lot: 20, hoa: 20, timeline: 15, location: 20 },
  modifiers_applied: ["prior_contractor_bonus"],
  suggested_next_action: "SMS within 60s with three site-walk windows this week.",
});

function fakeClient(textResponse: string) {
  let lastArgs: unknown = null;
  const client = {
    messages: {
      create: async (args: unknown) => {
        lastArgs = args;
        return { content: [{ type: "text", text: textResponse }] };
      },
    },
  } as unknown as Anthropic;
  return {
    client,
    lastArgs: () => lastArgs as { system: { text: string }[]; messages: { content: string }[]; model: string },
  };
}

beforeEach(() => {
  __setAnthropicClientForTests(null);
});

describe("qualifyLead", () => {
  it("populates the system prompt and the filled user template", async () => {
    const fc = fakeClient(validModelOutput);
    __setAnthropicClientForTests(fc.client);

    const out = await qualifyLead(validLead);

    expect(out.tier).toBe("qualified");
    expect(out.score).toBe(95);
    expect(out.prompt_sha).toMatch(/^[0-9a-f]{7,40}$/);

    const args = fc.lastArgs();
    expect(args.system[0].text).toMatch(/Greenscape Pro/);
    const userMsg = args.messages[0].content;
    expect(userMsg).toContain("Daniel Reyes");
    expect(userMsg).toContain("Google LSA");
    expect(userMsg).toContain("480");
    expect(userMsg).toContain("Full backyard remodel");
  });

  it("strips ```json fences before parsing", async () => {
    const fenced = "```json\n" + validModelOutput + "\n```";
    const fc = fakeClient(fenced);
    __setAnthropicClientForTests(fc.client);

    const out = await qualifyLead(validLead);
    expect(out.tier).toBe("qualified");
  });

  it("throws QualifierError when the model returns invalid JSON", async () => {
    __setAnthropicClientForTests(fakeClient("not json at all").client);
    await expect(qualifyLead(validLead)).rejects.toThrow(QualifierError);
  });

  it("throws QualifierError when score is out of range", async () => {
    const bad = JSON.stringify({
      ...JSON.parse(validModelOutput),
      score: 150,
    });
    __setAnthropicClientForTests(fakeClient(bad).client);
    await expect(qualifyLead(validLead)).rejects.toThrow(QualifierError);
  });

  it("throws QualifierError when tier is unknown", async () => {
    const bad = JSON.stringify({
      ...JSON.parse(validModelOutput),
      tier: "maybe",
    });
    __setAnthropicClientForTests(fakeClient(bad).client);
    await expect(qualifyLead(validLead)).rejects.toThrow(QualifierError);
  });

  it("throws QualifierError when response has no text block", async () => {
    const empty = {
      messages: {
        create: async () => ({ content: [] }),
      },
    } as unknown as Anthropic;
    __setAnthropicClientForTests(empty);
    await expect(qualifyLead(validLead)).rejects.toThrow(QualifierError);
  });

  it("returns model and prompt_sha alongside the parsed output", async () => {
    __setAnthropicClientForTests(fakeClient(validModelOutput).client);
    process.env.ANTHROPIC_MODEL = "claude-sonnet-4-6";
    const out = await qualifyLead(validLead);
    expect(out.model).toBe("claude-sonnet-4-6");
    expect(out.prompt_sha.length).toBeGreaterThan(0);
  });
});
