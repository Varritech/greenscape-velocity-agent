import { describe, it, expect, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  draftProposal,
  ProposalDraftError,
  extractSubtotalCents,
  __setAnthropicClientForTests,
} from "@/lib/proposal-draft";
import { __setFetchForTests as __setWhisperFetchForTests } from "@/lib/whisper";
import { PRICING_LIBRARY } from "@/lib/pricing";

const sampleProposal = `# Greenscape Pro · Proposal for Daniel Reyes

## Overview
Stub overview.

## Scope of Work
- Travertine pavers, French pattern 16x24
- BBQ island, 8 ft, granite top

## Investment

| Line item | Qty / sf | Unit | Total |
|---|---|---|---|
| Travertine pavers, French pattern 16x24 | 600 sf | $24 | $14,400 |
| BBQ island, 8 ft, granite top | 1 | $7,800 | $7,800 |
| **Subtotal** |  |  | **$22,200** |
| **30% deposit due at contract signing** |  |  | **$6,660** |
| **Balance due at completion** |  |  | **$15,540** |

## Exclusions
- HOA fees.

## Timeline
August 2026.

## Photos referenced
- Stub.

## Acceptance
Signed: ________ Date: ________`;

const sampleInput = {
  leadName: "Daniel Reyes",
  siteAddress: "4821 E Cactus Ln, Scottsdale, AZ",
  voiceMemoUrl: "https://example.com/memo.m4a",
  photoDescriptions: ["bare-dirt yard", "existing slab"],
};

beforeEach(() => {
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.ANTHROPIC_API_KEY = "ak-test";
  // Whisper fetch: download + transcribe
  let callIndex = 0;
  const fakeFetch = (async () => {
    callIndex += 1;
    if (callIndex === 1) {
      // download voice memo
      return new Response(new Blob(["audio"]), { status: 200 });
    }
    // transcription
    return new Response("Wants pavers and a BBQ island.", { status: 200 });
  }) as unknown as typeof fetch;
  __setWhisperFetchForTests(fakeFetch);
});

describe("extractSubtotalCents", () => {
  it("parses the subtotal row from a well-formed proposal", () => {
    expect(extractSubtotalCents(sampleProposal)).toBe(2220000);
  });

  it("returns 0 when no subtotal row is present", () => {
    expect(extractSubtotalCents("no table here")).toBe(0);
  });
});

describe("draftProposal", () => {
  it("transcribes voice memo, calls Claude, returns markdown + totalCents + pinned SHA", async () => {
    let lastArgs: { system: { text: string }[]; messages: { content: string }[]; model: string } | null = null;
    const fake = {
      messages: {
        create: async (args: unknown) => {
          lastArgs = args as typeof lastArgs;
          return { content: [{ type: "text", text: sampleProposal }] };
        },
      },
    } as unknown as Anthropic;
    __setAnthropicClientForTests(fake);

    const out = await draftProposal(sampleInput);

    expect(out.markdown).toContain("Daniel Reyes");
    expect(out.totalCents).toBe(2220000);
    expect(out.prompt_sha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(lastArgs!.system[0].text).toMatch(/Greenscape Pro/);
    // User message must include the pricing library JSON keys
    expect(lastArgs!.messages[0].content).toContain("travertine_paver_french_16x24");
    expect(lastArgs!.messages[0].content).toContain("bare-dirt yard");
  });

  it("throws ProposalDraftError when model returns no text block", async () => {
    const fake = {
      messages: { create: async () => ({ content: [] }) },
    } as unknown as Anthropic;
    __setAnthropicClientForTests(fake);

    await expect(draftProposal(sampleInput)).rejects.toThrow(ProposalDraftError);
  });

  it("detects line items by label prefix", async () => {
    const fake = {
      messages: {
        create: async () => ({ content: [{ type: "text", text: sampleProposal }] }),
      },
    } as unknown as Anthropic;
    __setAnthropicClientForTests(fake);

    const out = await draftProposal(sampleInput);
    const keys = out.lineItems.map((l) => l.key);
    expect(keys).toContain("travertine_paver_french_16x24");
    expect(keys).toContain("bbq_island_8ft_granite");
  });
});

describe("PRICING_LIBRARY", () => {
  it("contains the 12 expected line-item keys", () => {
    expect(Object.keys(PRICING_LIBRARY).sort()).toEqual(
      [
        "bbq_island_8ft_granite",
        "bbq_task_light",
        "demo_concrete_slab",
        "demo_stamped_concrete",
        "gas_fire_pit_round",
        "low_voltage_path_light",
        "outdoor_kitchen_14ft_granite",
        "pergola_cedar_12x14_stained",
        "pergola_cedar_14x18_stained",
        "pizza_oven_wood_fired",
        "travertine_paver_french_16x24",
        "travertine_pool_coping_bullnose",
      ].sort(),
    );
  });
});
