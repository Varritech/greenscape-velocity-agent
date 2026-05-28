import Anthropic from "@anthropic-ai/sdk";
import { loadProposalPrompt, fillTemplate } from "./prompts";
import { pricingLibraryJson, PRICING_LIBRARY } from "./pricing";
import { transcribeVoiceMemo } from "./whisper";

export class ProposalDraftError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "ProposalDraftError";
  }
}

let client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ProposalDraftError("ANTHROPIC_API_KEY missing");
  client = new Anthropic({ apiKey });
  return client;
}
export function __setAnthropicClientForTests(c: Anthropic | null): void {
  client = c;
}

export interface DraftProposalInput {
  leadName: string;
  siteAddress: string;
  voiceMemoUrl: string;
  // Already-resolved photo descriptions. The CompanyCam adapter is wired in
  // the route; this function stays unit-testable without network.
  photoDescriptions: string[];
}

export interface DraftProposalResult {
  markdown: string;
  totalCents: number;
  lineItems: Array<{ key: string; qty: number; total_cents: number }>;
  model: string;
  prompt_sha: string;
}

// Total-cents estimator: parse the "Investment" markdown table the prompt
// produces. We only trust the **Subtotal** row — never sum the lines
// independently, so an LLM math error appears as the table failing parse.
export function extractSubtotalCents(markdown: string): number {
  const m = markdown.match(/\*\*Subtotal\*\*[^|\n]*\|\s*\|\s*\|\s*\*\*\$?([\d,]+)\*\*/);
  if (!m) return 0;
  return Math.round(Number(m[1].replace(/,/g, "")) * 100);
}

export async function draftProposal(
  input: DraftProposalInput,
): Promise<DraftProposalResult> {
  const transcript = await transcribeVoiceMemo(input.voiceMemoUrl);
  const prompt = loadProposalPrompt();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const userText = fillTemplate(prompt.user_template, {
    lead_name: input.leadName,
    site_address: input.siteAddress,
    voice_memo_transcript: transcript,
    photo_descriptions: input.photoDescriptions.map((d) => `- ${d}`).join("\n"),
    pricing_library_json: pricingLibraryJson(),
  });

  const resp = await getClient().messages.create({
    model,
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: prompt.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userText }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ProposalDraftError("model returned no text block");
  }
  const markdown = textBlock.text.trim();

  const totalCents = extractSubtotalCents(markdown);

  // Best-effort line-item extraction so downstream UI can highlight diffs.
  // Falls back to empty array; the markdown is the source of truth.
  const lineItems: DraftProposalResult["lineItems"] = [];
  for (const key of Object.keys(PRICING_LIBRARY)) {
    const label = PRICING_LIBRARY[key].label.toLowerCase();
    if (markdown.toLowerCase().includes(label.slice(0, 18))) {
      lineItems.push({ key, qty: 1, total_cents: 0 });
    }
  }

  return { markdown, totalCents, lineItems, model, prompt_sha: prompt.sha };
}
