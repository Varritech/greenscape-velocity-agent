import { NextResponse, type NextRequest } from "next/server";
import twilio from "twilio";
import { recordAudit } from "@/lib/db/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // Twilio sends application/x-www-form-urlencoded. Build the params object
  // before validating because validateRequest needs the parsed body.
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = req.headers.get("x-twilio-signature");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fullUrl = `${baseUrl}/api/webhooks/twilio/status`;

  const valid = signature
    ? twilio.validateRequest(authToken, signature, fullUrl, params)
    : false;
  if (!valid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const messageSid = params["MessageSid"];
  const messageStatus = params["MessageStatus"];
  const to = params["To"];
  if (!messageSid || !messageStatus || !to) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // Audit only — we don't reverse-link to a lead row here; the join is done
  // in the Marcus review UI from the message sid recorded on send.
  await recordAudit({
    entity_type: "lead",
    entity_id: messageSid,
    action: `sms.${messageStatus}`,
    actor: "twilio",
    payload: { to, status: messageStatus },
  });

  return NextResponse.json({ ok: true });
}
