import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { loadQualifierPrompt, fillTemplate } from "./prompts";
import type { GhlLeadPayload } from "./ghl/schema";

export class QualifierError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "QualifierError";
  }
}

const SubscoresSchema = z.object({
  budget: z.number().int().min(0).max(20),
  lot: z.number().int().min(0).max(20),
  hoa: z.number().int().min(0).max(20),
  timeline: z.number().int().min(0).max(20),
  location: z.number().int().min(0).max(20),
});

export const QualificationOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  tier: z.enum(["qualified", "disqualified", "needs_human"]),
  reasoning: z.string().min(1),
  subscores: SubscoresSchema,
  modifiers_applied: z.array(z.string()),
  suggested_next_action: z.string().min(1),
});

export type QualificationOutput = z.infer<typeof QualificationOutputSchema>;

export interface QualifyLeadResult extends QualificationOutput {
  model: string;
  prompt_sha: string;
}

// Anthropic client is held in a module-level so tests can override via
// __setAnthropicClientForTests; the production constructor only fires when
// the env var is present at first call.
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new QualifierError("ANTHROPIC_API_KEY missing");
  client = new Anthropic({ apiKey });
  return client;
}

export function __setAnthropicClientForTests(c: Anthropic | null): void {
  client = c;
}

export async function qualifyLead(payload: GhlLeadPayload): Promise<QualifyLeadResult> {
  const prompt = loadQualifierPrompt();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const phoneAreaCode =
    payload.phone?.replace(/\D/g, "").replace(/^1/, "").slice(0, 3) ?? "";
  const formFieldsJson = JSON.stringify(
    Object.fromEntries((payload.custom_fields ?? []).map((f) => [f.id, f.value])),
    null,
    2,
  );
  const userText = fillTemplate(prompt.user_template, {
    name: `${payload.first_name ?? ""} ${payload.last_name ?? ""}`.trim(),
    source: payload.source,
    phone_area_code: phoneAreaCode,
    message: payload.message ?? "",
    form_fields: formFieldsJson,
  });

  const resp = await getClient().messages.create({
    model,
    max_tokens: 600,
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
    throw new QualifierError("model returned no text block");
  }
  const raw = textBlock.text.trim();

  let parsed: unknown;
  try {
    // Defensive: strip ```json fences if the model returns them anyway.
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new QualifierError("model output is not valid JSON", err);
  }

  const result = QualificationOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new QualifierError("model output failed schema validation", result.error);
  }

  return { ...result.data, model, prompt_sha: prompt.sha };
}
