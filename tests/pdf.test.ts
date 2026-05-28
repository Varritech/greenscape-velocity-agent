import { describe, it, expect } from "vitest";
import { renderProposalPDF } from "@/lib/pdf";

describe("renderProposalPDF", () => {
  it("returns a non-empty Buffer that starts with %PDF and ends with %%EOF", () => {
    const buf = renderProposalPDF("# Stub proposal\n\nLine one.\nLine two.", {
      leadName: "Daniel Reyes",
      totalCents: 2220000,
    });
    expect(buf.length).toBeGreaterThan(200);
    const head = buf.slice(0, 8).toString("binary");
    expect(head.startsWith("%PDF-")).toBe(true);
    const tail = buf.slice(-8).toString("binary");
    expect(tail.includes("%%EOF")).toBe(true);
  });

  it("includes the lead name and a $-formatted total in the rendered text stream", () => {
    const buf = renderProposalPDF("body", { leadName: "Daniel Reyes", totalCents: 2220000 });
    const text = buf.toString("binary");
    expect(text).toContain("Daniel Reyes");
    expect(text).toContain("$22,200");
  });

  it("escapes parentheses in lead name (PDF string literal hazard)", () => {
    const buf = renderProposalPDF("body", {
      leadName: "Daniel (Dan) Reyes",
      totalCents: 100,
    });
    const text = buf.toString("binary");
    expect(text).toContain("Daniel \\(Dan\\) Reyes");
  });

  it("wraps long lines without crashing", () => {
    const longLine = "x".repeat(500);
    expect(() =>
      renderProposalPDF(longLine, { leadName: "X", totalCents: 0 }),
    ).not.toThrow();
  });

  it("contains a valid xref table marker", () => {
    const buf = renderProposalPDF("body", { leadName: "X", totalCents: 0 });
    const text = buf.toString("binary");
    expect(text).toContain("xref");
    expect(text).toContain("startxref");
  });
});
