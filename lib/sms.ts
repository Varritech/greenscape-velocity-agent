import twilio from "twilio";
import { composeOpener } from "./sms-copy";

export class SmsError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "SmsError";
  }
}

export interface SendQualifiedLeadSmsInput {
  phone: string;
  leadFirstName: string;
  source: string;
  suggestedNextAction: string;
}

export interface SendResult {
  sid: string;
  status: string;
  body: string;
}

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new SmsError("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  }
  twilioClient = twilio(sid, token);
  return twilioClient;
}

export function __setTwilioClientForTests(c: ReturnType<typeof twilio> | null): void {
  twilioClient = c;
}

// E.164 only: + followed by 8–15 digits.
function assertE164(phone: string): void {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new SmsError(`phone is not E.164: ${phone}`);
  }
}

export async function sendQualifiedLeadSMS(
  input: SendQualifiedLeadSmsInput,
): Promise<SendResult> {
  assertE164(input.phone);
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new SmsError("TWILIO_FROM_NUMBER missing");
  assertE164(from);

  const body = composeOpener({
    leadFirstName: input.leadFirstName,
    source: input.source,
    suggestedNextAction: input.suggestedNextAction,
  });

  try {
    const msg = await getClient().messages.create({ to: input.phone, from, body });
    return { sid: msg.sid, status: msg.status, body };
  } catch (err) {
    throw new SmsError("twilio send failed", err);
  }
}
