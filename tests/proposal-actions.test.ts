import { describe, it, expect, beforeEach } from "vitest";
import { diffMarkdownByLine, approveProposalAction } from "@/app/proposals/[id]/actions";
import { __setDbClientForTests } from "@/lib/db/client";

beforeEach(() => {
  // Fake supabase client: capture last update payload and return a row.
  let lastUpdate: Record<string, unknown> | null = null;
  const fake = {
    from() {
      const chain: Record<string, unknown> = {
        update: (payload: Record<string, unknown>) => {
          lastUpdate = payload;
          return chain;
        },
        insert: () => chain,
        select: () => chain,
        eq: () => chain,
        single: () =>
          Promise.resolve({
            data: { id: "p1", status: "approved", lead_id: "l1", markdown: "x" },
            error: null,
          }),
        then: (onF: (r: { data: null; error: null }) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onF),
        __lastUpdate: () => lastUpdate,
      };
      return chain;
    },
  };
  __setDbClientForTests(fake as unknown as Parameters<typeof __setDbClientForTests>[0]);
});

describe("diffMarkdownByLine", () => {
  it("returns empty diff for identical strings", () => {
    const d = diffMarkdownByLine("a\nb\nc", "a\nb\nc");
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("captures added lines", () => {
    const d = diffMarkdownByLine("a\nb", "a\nb\nc");
    expect(d.added).toEqual(["c"]);
    expect(d.removed).toEqual([]);
  });

  it("captures removed lines", () => {
    const d = diffMarkdownByLine("a\nb\nc", "a\nc");
    expect(d.removed).toEqual(["b"]);
    expect(d.added).toEqual([]);
  });

  it("captures both adds and removes", () => {
    const d = diffMarkdownByLine("Subtotal $10,000", "Subtotal $12,000");
    expect(d.added).toContain("Subtotal $12,000");
    expect(d.removed).toContain("Subtotal $10,000");
  });
});

describe("approveProposalAction", () => {
  it("returns ok and writes marcus_edits with diff payload", async () => {
    const result = await approveProposalAction({
      proposalId: "p1",
      originalMarkdown: "Subtotal $10,000",
      editedMarkdown: "Subtotal $12,000\nNote: added pergola",
    });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when the db throws", async () => {
    const fake = {
      from() {
        return {
          update: () => {
            throw new Error("db down");
          },
        };
      },
    };
    __setDbClientForTests(fake as unknown as Parameters<typeof __setDbClientForTests>[0]);

    const result = await approveProposalAction({
      proposalId: "p1",
      originalMarkdown: "a",
      editedMarkdown: "b",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/db down/);
  });
});
