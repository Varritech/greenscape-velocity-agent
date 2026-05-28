import { NextResponse, type NextRequest } from "next/server";
import { verifyGhlSignature } from "@/lib/ghl/verify";
import { GhlLeadPayloadSchema } from "@/lib/ghl/schema";
import { insertLead } from "@/lib/db/leads";
import { insertQualification } from "@/lib/db/qualifications";
import { recordAudit } from "@/lib/db/audit";
import { qualifyLead, QualifierError } from "@/lib/qualifier";

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

  try {
    const q = await qualifyLead(parsed.data);
    const row = await insertQualification({
      lead_id: lead.id,
      score: q.score,
      tier: q.tier,
      reasoning: q.reasoning,
      model: q.model,
      prompt_sha: q.prompt_sha,
    });
    await recordAudit({
      entity_type: "qualification",
      entity_id: row.id,
      action: "qualification.completed",
      actor: q.model,
      payload: { tier: q.tier, score: q.score },
    });

    // TODO(S8): SMS dispatcher reacts to tier === 'qualified'
    // TODO(S9): Slack notifier + GHL writeback

    return NextResponse.json(
      {
        accepted: true,
        lead_id: lead.id,
        contact_id: parsed.data.contact_id,
        qualification: { score: q.score, tier: q.tier },
      },
      { status: 202 },
    );
  } catch (err) {
    // Qualification failure must not lose the lead. Lead row is already
    // persisted; surface a 202 with a qualification_error tag so retries
    // can target the qualifier without re-creating the lead.
    await recordAudit({
      entity_type: "lead",
      entity_id: lead.id,
      action: "qualification.failed",
      actor: "ghl-webhook",
      payload: { reason: err instanceof QualifierError ? err.message : "unknown" },
    });
    return NextResponse.json(
      {
        accepted: true,
        lead_id: lead.id,
        contact_id: parsed.data.contact_id,
        qualification_error: true,
      },
      { status: 202 },
    );
  }
}
