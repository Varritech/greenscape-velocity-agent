export class SlackError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "SlackError";
  }
}

export interface QualificationNotice {
  leadId: string;
  leadName: string;
  source: string;
  score: number;
  tier: "qualified" | "disqualified" | "needs_human";
  reasoning: string;
  suggestedNextAction: string;
  smsSid: string | null;
  appUrl: string;
}

function tierEmoji(tier: QualificationNotice["tier"]): string {
  switch (tier) {
    case "qualified":
      return ":white_check_mark:";
    case "needs_human":
      return ":eyes:";
    case "disqualified":
      return ":no_entry_sign:";
  }
}

export function buildSlackBlocks(n: QualificationNotice): unknown {
  const emoji = tierEmoji(n.tier);
  const smsLine = n.smsSid
    ? `SMS queued (sid \`${n.smsSid}\`)`
    : "No SMS sent";
  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} ${n.tier.toUpperCase()} · ${n.leadName || "Unnamed lead"}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Score*\n${n.score}/100` },
          { type: "mrkdwn", text: `*Source*\n${n.source}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: `*Why*\n${n.reasoning}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Suggested next*\n${n.suggestedNextAction}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: smsLine }] },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in app" },
            url: `${n.appUrl}/leads/${n.leadId}`,
          },
        ],
      },
    ],
  };
}

let fetchImpl: typeof fetch = globalThis.fetch;

export function __setFetchForTests(f: typeof fetch | null): void {
  fetchImpl = f ?? globalThis.fetch;
}

export async function notifyQualification(n: QualificationNotice): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSlackBlocks(n)),
    });
    if (!res.ok) {
      // Don't throw — caller cannot recover. Swallow so the pipeline never
      // fails on Slack outage, but signal so the route can audit-log it.
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
