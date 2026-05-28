// SMS copy in Marcus's voice. Hard cap at 140 chars so the message lands as a
// single SMS segment even on legacy carriers — costs less and avoids the
// "1 of 2" header that tells the lead this is automated.

const MAX_LEN = 140;

const GREETINGS = [
  "Hey",
  "Hi",
];

export interface OpenerInput {
  leadFirstName: string;
  source: string;
  suggestedNextAction: string;
}

export function composeOpener(input: OpenerInput): string {
  const name = (input.leadFirstName ?? "").trim();
  const greet = GREETINGS[0];
  const opener = name ? `${greet} ${name}` : greet;

  // Strip the "SMS within 60s with..." instruction prefix the qualifier
  // sometimes returns; the suggested_next_action describes WHAT to say, not
  // an instruction to send. Heuristic: drop the leading "SMS ..." clause.
  const cleaned = input.suggestedNextAction
    .replace(/^SMS\s+within\s+\d+\s*(?:s|sec|seconds?)\s*(?:with\s+)?/i, "")
    .replace(/^SMS\s+(?:now|asap)\s*(?:with\s+)?/i, "")
    .trim();

  const sourceTag = input.source.toLowerCase().includes("referral")
    ? "thanks for reaching out"
    : "Marcus from Greenscape Pro";

  let body = `${opener}, ${sourceTag}. ${cleaned}`.trim();
  body = body.replace(/\s+/g, " ");

  if (body.length > MAX_LEN) {
    body = body.slice(0, MAX_LEN - 1).trimEnd() + "…";
  }
  return body;
}

export const SMS_MAX_LEN = MAX_LEN;
