import { NextResponse, type NextRequest } from "next/server";
import { verifyGhlSignature } from "@/lib/ghl/verify";
import { GhlLeadPayloadSchema } from "@/lib/ghl/schema";

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

  // TODO(S6): persist lead via Supabase data layer
  // TODO(S7): enqueue qualifier
  // TODO(S8): SMS dispatcher
  // TODO(S9): Slack notifier + GHL writeback

  return NextResponse.json({ accepted: true, contact_id: parsed.data.contact_id }, { status: 202 });
}
