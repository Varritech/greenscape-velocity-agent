import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { draftProposal, ProposalDraftError } from "@/lib/proposal-draft";
import { insertProposalDraft } from "@/lib/db/proposals";
import { recordAudit } from "@/lib/db/audit";

export const runtime = "nodejs";

const BodySchema = z.object({
  lead_id: z.string().uuid(),
  lead_name: z.string().min(1),
  site_address: z.string().min(1),
  voice_memo_url: z.string().url(),
  photo_descriptions: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const draft = await draftProposal({
      leadName: parsed.data.lead_name,
      siteAddress: parsed.data.site_address,
      voiceMemoUrl: parsed.data.voice_memo_url,
      photoDescriptions: parsed.data.photo_descriptions,
    });

    const row = await insertProposalDraft({
      lead_id: parsed.data.lead_id,
      markdown: draft.markdown,
      line_items: draft.lineItems,
      total_cents: draft.totalCents,
    });

    await recordAudit({
      entity_type: "proposal",
      entity_id: row.id,
      action: "proposal.drafted",
      actor: draft.model,
      payload: { prompt_sha: draft.prompt_sha, total_cents: draft.totalCents },
    });

    return NextResponse.json(
      { id: row.id, total_cents: draft.totalCents, model: draft.model },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof ProposalDraftError ? err.message : "draft_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
