import { describe, it, expect, beforeEach } from "vitest";
import { sendProposalEmail, EmailError, __setFetchForTests } from "@/lib/email";

const sampleInput = {
  to: "daniel@example.com",
  subject: "Greenscape Proposal",
  html: "<p>hi</p>",
  pdfBuffer: Buffer.from("%PDF-1.4\n stub %%EOF"),
  pdfFileName: "proposal.pdf",
};

beforeEach(() => {
  __setFetchForTests(null);
});

describe("sendProposalEmail", () => {
  it("returns stubbed:true when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const out = await sendProposalEmail(sampleInput);
    expect(out.stubbed).toBe(true);
    expect(out.id).toBeNull();
  });

  it("POSTs to api.resend.com with the right payload", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "Marcus <marcus@greenscapepro.example>";

    let captured: { url: string; init: RequestInit } | null = null;
    __setFetchForTests((async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "em_123" }), { status: 200 });
    }) as unknown as typeof fetch);

    const out = await sendProposalEmail(sampleInput);

    expect(out.stubbed).toBe(false);
    expect(out.id).toBe("em_123");
    expect(captured!.url).toBe("https://api.resend.com/emails");
    expect(captured!.init.method).toBe("POST");
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer re_test");
    const body = JSON.parse(captured!.init.body as string);
    expect(body.to).toEqual(["daniel@example.com"]);
    expect(body.attachments[0].filename).toBe("proposal.pdf");
    expect(typeof body.attachments[0].content).toBe("string");
  });

  it("wraps Resend non-2xx as EmailError", async () => {
    process.env.RESEND_API_KEY = "re_test";
    __setFetchForTests((async () =>
      new Response("nope", { status: 422 })) as unknown as typeof fetch);

    await expect(sendProposalEmail(sampleInput)).rejects.toThrow(EmailError);
  });

  it("wraps fetch reject as EmailError", async () => {
    process.env.RESEND_API_KEY = "re_test";
    __setFetchForTests((async () => {
      throw new Error("network");
    }) as unknown as typeof fetch);

    await expect(sendProposalEmail(sampleInput)).rejects.toThrow(EmailError);
  });
});
