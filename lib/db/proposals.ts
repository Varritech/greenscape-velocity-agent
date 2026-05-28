import { getDbClient } from "./client";
import type { ProposalRow, LeadRow } from "./types";

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

export async function listProposalDrafts(): Promise<ProposalRow[]> {
  const { data, error } = await getDbClient()
    .from("proposals")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProposalRow[];
}

export interface ProposalWithLead {
  proposal: ProposalRow;
  lead: LeadRow;
}

export async function getProposalWithLead(id: string): Promise<ProposalWithLead | null> {
  const { data: p, error: pErr } = await getDbClient()
    .from("proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!p) return null;
  const { data: l, error: lErr } = await getDbClient()
    .from("leads")
    .select("*")
    .eq("id", (p as ProposalRow).lead_id)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!l) return null;
  return { proposal: p as ProposalRow, lead: l as LeadRow };
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
