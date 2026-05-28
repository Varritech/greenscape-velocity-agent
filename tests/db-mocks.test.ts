import { describe, it, expect, beforeEach, vi } from "vitest";
import { __setDbClientForTests } from "@/lib/db/client";
import { insertLead, getLead } from "@/lib/db/leads";
import { insertQualification } from "@/lib/db/qualifications";
import { insertProposalDraft, approveProposal } from "@/lib/db/proposals";
import { recordAudit } from "@/lib/db/audit";

type FromCall = {
  table: string;
  op: "insert" | "select" | "update";
  payload?: unknown;
  filters?: { col: string; val: unknown }[];
};

function makeFakeClient(returnRow: Record<string, unknown>) {
  const calls: FromCall[] = [];
  const fake = {
    from(table: string) {
      const ctx: FromCall = { table, op: "select" };
      const chain = {
        insert(payload: unknown) {
          ctx.op = "insert";
          ctx.payload = payload;
          return chain;
        },
        update(payload: unknown) {
          ctx.op = "update";
          ctx.payload = payload;
          return chain;
        },
        select() {
          return chain;
        },
        eq(col: string, val: unknown) {
          ctx.filters = [...(ctx.filters ?? []), { col, val }];
          return chain;
        },
        single() {
          calls.push(ctx);
          return Promise.resolve({ data: returnRow, error: null });
        },
        maybeSingle() {
          calls.push(ctx);
          return Promise.resolve({ data: returnRow, error: null });
        },
        then(onF: (r: { data: null; error: null }) => unknown) {
          calls.push(ctx);
          return Promise.resolve({ data: null, error: null }).then(onF);
        },
      };
      return chain;
    },
  };
  return { fake: fake as unknown as Parameters<typeof __setDbClientForTests>[0], calls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("data layer", () => {
  it("insertLead writes to leads with the expected columns", async () => {
    const row = {
      id: "lead-uuid",
      ghl_contact_id: "abc",
      source: "Google LSA",
      raw_payload: { x: 1 },
      created_at: "2026-05-28T00:00:00Z",
    };
    const { fake, calls } = makeFakeClient(row);
    __setDbClientForTests(fake);

    const out = await insertLead({
      ghl_contact_id: "abc",
      source: "Google LSA",
      raw_payload: { x: 1 },
    });

    expect(out.id).toBe("lead-uuid");
    expect(calls[0].table).toBe("leads");
    expect(calls[0].op).toBe("insert");
    expect(calls[0].payload).toEqual({
      ghl_contact_id: "abc",
      source: "Google LSA",
      raw_payload: { x: 1 },
    });
  });

  it("getLead filters by id", async () => {
    const { fake, calls } = makeFakeClient({ id: "x" });
    __setDbClientForTests(fake);
    await getLead("the-id");
    expect(calls[0].table).toBe("leads");
    expect(calls[0].filters).toEqual([{ col: "id", val: "the-id" }]);
  });

  it("insertQualification stores prompt_sha and model", async () => {
    const { fake, calls } = makeFakeClient({ id: "q1" });
    __setDbClientForTests(fake);

    await insertQualification({
      lead_id: "lead-1",
      score: 85,
      tier: "qualified",
      reasoning: "high budget",
      model: "claude-sonnet-4-6",
      prompt_sha: "abc1234",
    });

    expect(calls[0].table).toBe("qualifications");
    expect(calls[0].payload).toMatchObject({
      lead_id: "lead-1",
      score: 85,
      tier: "qualified",
      model: "claude-sonnet-4-6",
      prompt_sha: "abc1234",
    });
  });

  it("insertProposalDraft forces status=draft and empty marcus_edits", async () => {
    const { fake, calls } = makeFakeClient({ id: "p1" });
    __setDbClientForTests(fake);

    await insertProposalDraft({
      lead_id: "lead-2",
      markdown: "# proposal",
      line_items: [{ name: "patio", cents: 1500000 }],
      total_cents: 1500000,
    });

    const p = calls[0].payload as Record<string, unknown>;
    expect(p.status).toBe("draft");
    expect(p.marcus_edits).toEqual({});
    expect(p.total_cents).toBe(1500000);
  });

  it("approveProposal updates status to approved and stamps approved_at", async () => {
    const { fake, calls } = makeFakeClient({ id: "p1", status: "approved" });
    __setDbClientForTests(fake);

    await approveProposal({ id: "p1", marcus_edits: { price_delta: 200 } });

    const u = calls[0].payload as Record<string, unknown>;
    expect(calls[0].op).toBe("update");
    expect(calls[0].filters).toEqual([{ col: "id", val: "p1" }]);
    expect(u.status).toBe("approved");
    expect(u.marcus_edits).toEqual({ price_delta: 200 });
    expect(typeof u.approved_at).toBe("string");
  });

  it("recordAudit defaults payload to {} when omitted", async () => {
    const { fake, calls } = makeFakeClient({});
    __setDbClientForTests(fake);

    await recordAudit({
      entity_type: "lead",
      entity_id: "lead-3",
      action: "lead.received",
      actor: "ghl-webhook",
    });

    expect(calls[0].table).toBe("audit_log");
    expect(calls[0].payload).toMatchObject({
      entity_type: "lead",
      entity_id: "lead-3",
      action: "lead.received",
      actor: "ghl-webhook",
      payload: {},
    });
  });
});
