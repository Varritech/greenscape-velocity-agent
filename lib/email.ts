export class EmailError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "EmailError";
  }
}

export interface SendProposalEmailInput {
  to: string;
  subject: string;
  html: string;
  pdfBuffer: Buffer;
  pdfFileName: string;
}

let fetchImpl: typeof fetch = globalThis.fetch;
export function __setFetchForTests(f: typeof fetch | null): void {
  fetchImpl = f ?? globalThis.fetch;
}

export interface SendResult {
  id: string | null;
  stubbed: boolean;
}

// Resend HTTP API directly so we don't pull the SDK in. Same payload shape as
// resend-node would post.
export async function sendProposalEmail(input: SendProposalEmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Marcus <marcus@greenscapepro.example>";

  if (!apiKey) {
    // Stub mode: useful for local + take-home demo without burning a real
    // Resend account. The route still records an audit row.
    return { id: null, stubbed: true };
  }

  const body = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    attachments: [
      {
        filename: input.pdfFileName,
        content: input.pdfBuffer.toString("base64"),
      },
    ],
  };

  let res: Response;
  try {
    res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new EmailError("resend network error", err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new EmailError(`resend ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string };
  return { id: json.id ?? null, stubbed: false };
}
