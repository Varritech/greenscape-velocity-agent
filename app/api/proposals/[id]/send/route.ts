import { NextResponse, type NextRequest } from "next/server";
import { getProposalWithLead } from "@/lib/db/proposals";
import { getDbClient } from "@/lib/db/client";
import { recordAudit } from "@/lib/db/audit";
import { renderProposalPDF } from "@/lib/pdf";
import { sendProposalEmail, EmailError } from "@/lib/email";

export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;

  const joined = await getProposalWithLead(id);
  if (!joined) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { proposal, lead } = joined;
  if (proposal.status !== "approved") {
    return NextResponse.json(
      { error: "invalid_status", status: proposal.status },
      { status: 409 },
    );
  }

  const raw = (lead.raw_payload ?? {}) as {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  const leadName = `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim() || "Customer";
  const to = raw.email;
  if (!to) {
    return NextResponse.json({ error: "lead_missing_email" }, { status: 400 });
  }

  const pdf = renderProposalPDF(proposal.markdown, {
    leadName,
    totalCents: proposal.total_cents,
  });

  try {
    const result = await sendProposalEmail({
      to,
      subject: `Your Greenscape Pro proposal — ${leadName}`,
      html: `<p>Hi ${leadName.split(" ")[0]},</p><p>Attached is the proposal we discussed. Reply here with any edits.</p><p>Marcus</p>`,
      pdfBuffer: pdf,
      pdfFileName: `greenscape-proposal-${proposal.id.slice(0, 8)}.pdf`,
    });

    await getDbClient()
      .from("proposals")
      .update({ status: "sent" })
      .eq("id", proposal.id);

    await recordAudit({
      entity_type: "proposal",
      entity_id: proposal.id,
      action: result.stubbed ? "proposal.sent.stubbed" : "proposal.sent",
      actor: "marcus",
      payload: { to, email_id: result.id, stubbed: result.stubbed },
    });

    return NextResponse.json({ ok: true, email_id: result.id, stubbed: result.stubbed });
  } catch (err) {
    await recordAudit({
      entity_type: "proposal",
      entity_id: proposal.id,
      action: "proposal.send.failed",
      actor: "marcus",
      payload: { reason: err instanceof EmailError ? err.message : "unknown" },
    });
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
}
