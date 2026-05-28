import { getDbClient } from "./client";
import type { ProposalRow } from "./types";

export interface InsertProposalDraftInput {
  lead_id: string;
  markdown: string;
  line_items: unknown[];
  total_cents: number;
}

export async function insertProposalDraft(
  input: InsertProposalDraftInput,
): Promise<ProposalRow> {
  const payload = {
    lead_id: input.lead_id,
    markdown: input.markdown,
    line_items: input.line_items,
    total_cents: input.total_cents,
    status: "draft" as const,
    marcus_edits: {},
  };
  const { data, error } = await getDbClient()
    .from("proposals")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProposalRow;
}

export interface ApproveProposalInput {
  id: string;
  marcus_edits: Record<string, unknown>;
}

export async function approveProposal(input: ApproveProposalInput): Promise<ProposalRow> {
  const { data, error } = await getDbClient()
    .from("proposals")
    .update({
      status: "approved" as const,
      marcus_edits: input.marcus_edits,
      approved_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProposalRow;
}
