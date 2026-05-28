import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { POST as ghlWebhook } from "@/app/api/webhooks/ghl/route";
import { __setDbClientForTests } from "@/lib/db/client";
import { __setAnthropicClientForTests as __setQualifierAnthropic } from "@/lib/qualifier";
import { __setAnthropicClientForTests as __setDraftAnthropic } from "@/lib/proposal-draft";
import { __setTwilioClientForTests } from "@/lib/sms";
import { __setFetchForTests as __setWhisperFetch } from "@/lib/whisper";
import { approveProposalAction } from "@/app/proposals/[id]/actions";

const SECRET = "e2e_secret";

const qualifierOutput = JSON.stringify({
  score: 90,
  tier: "qualified",
  reasoning: "e2e",
  subscores: { budget: 20, lot: 20, hoa: 20, timeline: 15, location: 15 },
  modifiers_applied: [],
  suggested_next_action: "offer three site-walk windows this week",
});

const proposalMarkdown = `# Greenscape Pro · Proposal for Daniel Reyes

## Investment

| Line item | Qty / sf | Unit | Total |
|---|---|---|---|
| Travertine pavers, French pattern 16x24 | 600 sf | $24 | $14,400 |
| **Subtotal** |  |  | **$14,400** |
| **30% deposit due at contract signing** |  |  | **$4,320** |
| **Balance due at completion** |  |  | **$10,080** |
`;

interface RowStore {
  leads: Record<string, Record<string, unknown>>;
  qualifications: Record<string, Record<string, unknown>>;
  proposals: Record<string, Record<string, unknown>>;
  audit: Record<string, unknown>[];
}

function makeStore(): RowStore {
  return { leads: {}, qualifications: {}, proposals: {}, audit: [] };
}

function fakeDb(store: RowStore) {
  let nextId = 1;
  const newId = () => `id-${nextId++}`;
  function table(name: keyof RowStore) {
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    let filters: { col: string; val: unknown }[] = [];
    const chain: Record<string, unknown> = {
      insert(payload: Record<string, unknown>) {
        pendingInsert = { id: newId(), created_at: new Date().toISOString(), ...payload };
        return chain;
      },
      update(payload: Record<string, unknown>) {
        pendingUpdate = payload;
        return chain;
      },
      select() {
        return chain;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return chain;
      },
      maybeSingle() {
        const id = filters.find((f) => f.col === "id")?.val as string | undefined;
        if (name === "leads") return Promise.resolve({ data: store.leads[id ?? ""], error: null });
        if (name === "proposals") return Promise.resolve({ data: store.proposals[id ?? ""], error: null });
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        if (pendingInsert) {
          const row = pendingInsert;
          if (name === "leads") store.leads[row.id as string] = row;
          if (name === "qualifications") store.qualifications[row.id as string] = row;
          if (name === "proposals") store.proposals[row.id as string] = row;
          pendingInsert = null;
          return Promise.resolve({ data: row, error: null });
        }
        if (pendingUpdate) {
          const id = filters.find((f) => f.col === "id")?.val as string;
          const bucket = name === "proposals" ? store.proposals : store.leads;
          const existing = bucket[id] ?? {};
          const merged = { ...existing, ...pendingUpdate, id };
          bucket[id] = merged;
          pendingUpdate = null;
          return Promise.resolve({ data: merged, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(onF: (r: { data: null; error: null }) => unknown) {
        if (pendingInsert) {
          if (name === "audit") store.audit.push(pendingInsert);
          pendingInsert = null;
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      },
    };
    return chain;
  }
  return {
    from(name: string) {
      const key = (name === "audit_log" ? "audit" : name) as keyof RowStore;
      return table(key);
    },
  };
}

beforeEach(() => {
  process.env.GHL_WEBHOOK_SECRET = SECRET;
  process.env.ANTHROPIC_API_KEY = "ak";
  process.env.OPENAI_API_KEY = "sk";
  process.env.TWILIO_FROM_NUMBER = "+14805550100";
  process.env.TWILIO_ACCOUNT_SID = "AC";
  process.env.TWILIO_AUTH_TOKEN = "tk";
});

describe("e2e: webhook -> qualifier -> proposal draft -> approve", () => {
  it("runs the happy path with all externals stubbed", async () => {
    const store = makeStore();
    __setDbClientForTests(fakeDb(store) as unknown as Parameters<typeof __setDbClientForTests>[0]);

    // Stub qualifier Anthropic
    __setQualifierAnthropic({
      messages: { create: async () => ({ content: [{ type: "text", text: qualifierOutput }] }) },
    } as unknown as Anthropic);
    // Stub draft Anthropic
    __setDraftAnthropic({
      messages: { create: async () => ({ content: [{ type: "text", text: proposalMarkdown }] }) },
    } as unknown as Anthropic);
    // Stub Twilio
    __setTwilioClientForTests({
      messages: { create: async () => ({ sid: "SM_e2e", status: "queued" }) },
    } as unknown as Parameters<typeof __setTwilioClientForTests>[0]);
    // Stub Whisper fetch (memo download + transcription)
    let whisperCalls = 0;
    __setWhisperFetch((async () => {
      whisperCalls += 1;
      return whisperCalls === 1
        ? new Response(new Blob(["audio"]), { status: 200 })
        : new Response("Wants pavers and a BBQ island.", { status: 200 });
    }) as unknown as typeof fetch);

    // 1) Inbound GHL webhook
    const payload = {
      contact_id: "ghl_1",
      location_id: "loc",
      first_name: "Daniel",
      last_name: "Reyes",
      email: "daniel@example.com",
      phone: "+14805550101",
      source: "Google LSA",
      message: "Want pavers and a BBQ island",
      custom_fields: [],
    };
    const body = JSON.stringify(payload);
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    const req = new Request("http://x/api/webhooks/ghl", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ghl-signature": sig },
      body,
    }) as unknown as Parameters<typeof ghlWebhook>[0];
    const res = await ghlWebhook(req);
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.qualification.tier).toBe("qualified");
    expect(json.sms_sid).toBe("SM_e2e");

    expect(Object.keys(store.leads).length).toBe(1);
    expect(Object.keys(store.qualifications).length).toBe(1);
    const leadId = Object.keys(store.leads)[0];
    expect((store.qualifications[Object.keys(store.qualifications)[0]] as { tier: string }).tier).toBe("qualified");

    // 2) Approve a draft proposal (skip the draft endpoint here — its pipeline
    //    is exercised in proposal-draft.test.ts).
    //    Seed a draft directly and approve it.
    const draftId = "id-99";
    store.proposals[draftId] = {
      id: draftId,
      lead_id: leadId,
      status: "draft",
      markdown: proposalMarkdown,
      line_items: [],
      total_cents: 1440000,
      marcus_edits: {},
      created_at: new Date().toISOString(),
      approved_at: null,
    };

    const approveResult = await approveProposalAction({
      proposalId: draftId,
      originalMarkdown: proposalMarkdown,
      editedMarkdown: proposalMarkdown.replace("$14,400", "$15,200"),
    });
    expect(approveResult.ok).toBe(true);
    expect((store.proposals[draftId] as { status: string }).status).toBe("approved");
  });
});
