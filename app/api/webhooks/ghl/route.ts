import { NextResponse, type NextRequest } from "next/server";
import { verifyGhlSignature } from "@/lib/ghl/verify";
import { GhlLeadPayloadSchema } from "@/lib/ghl/schema";
import { insertLead } from "@/lib/db/leads";
import { recordAudit } from "@/lib/db/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-ghl-signature");

  if (!verifyGhlSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = GhlLeadPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const lead = await insertLead({
    ghl_contact_id: parsed.data.contact_id,
    source: parsed.data.source,
    raw_payload: parsed.data,
  });

  await recordAudit({
    entity_type: "lead",
    entity_id: lead.id,
    action: "lead.received",
    actor: "ghl-webhook",
    payload: { source: parsed.data.source },
  });

  // TODO(S7): enqueue qualifier
  // TODO(S8): SMS dispatcher
  // TODO(S9): Slack notifier + GHL writeback

  return NextResponse.json(
    { accepted: true, lead_id: lead.id, contact_id: parsed.data.contact_id },
    { status: 202 },
  );
}
