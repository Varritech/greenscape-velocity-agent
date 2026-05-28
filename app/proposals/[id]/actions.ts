"use server";

import { revalidatePath } from "next/cache";
import { approveProposal } from "@/lib/db/proposals";
import { recordAudit } from "@/lib/db/audit";

export interface ApproveInput {
  proposalId: string;
  originalMarkdown: string;
  editedMarkdown: string;
}

export type ApproveResult = { ok: true } | { ok: false; error: string };

// Line-granular diff so the audit trail captures Marcus's edits without
// storing two full markdown blobs every time. Future: feed back into prompt
// tuning by tagging which sections he most often rewrites.
export function diffMarkdownByLine(
  original: string,
  edited: string,
): { added: string[]; removed: string[] } {
  const a = new Set(original.split("\n"));
  const b = new Set(edited.split("\n"));
  const added = [...b].filter((line) => !a.has(line));
  const removed = [...a].filter((line) => !b.has(line));
  return { added, removed };
}

export async function approveProposalAction(input: ApproveInput): Promise<ApproveResult> {
  try {
    const diff = diffMarkdownByLine(input.originalMarkdown, input.editedMarkdown);
    const row = await approveProposal({
      id: input.proposalId,
      marcus_edits: {
        edited_markdown: input.editedMarkdown,
        added_lines: diff.added,
        removed_lines: diff.removed,
        diff_size: diff.added.length + diff.removed.length,
      },
    });
    await recordAudit({
      entity_type: "proposal",
      entity_id: row.id,
      action: "proposal.approved",
      actor: "marcus",
      payload: {
        diff_size: diff.added.length + diff.removed.length,
      },
    });
    revalidatePath(`/proposals/${input.proposalId}`);
    revalidatePath("/proposals");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
