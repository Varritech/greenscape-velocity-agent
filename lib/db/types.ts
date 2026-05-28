// Mirrors greenscape-velocity-infra/supabase/migrations/0001_init.sql
// Keep in sync with that file; consider codegen via supabase gen types later.

export type QualificationTier = "qualified" | "disqualified" | "needs_human";
export type ProposalStatus = "draft" | "approved" | "sent";

export interface LeadRow {
  id: string;
  ghl_contact_id: string | null;
  source: string;
  raw_payload: unknown;
  created_at: string;
}

export interface QualificationRow {
  id: string;
  lead_id: string;
  score: number;
  tier: QualificationTier;
  reasoning: string;
  model: string;
  prompt_sha: string;
  created_at: string;
}

export interface ProposalRow {
  id: string;
  lead_id: string;
  status: ProposalStatus;
  markdown: string;
  line_items: unknown;
  total_cents: number;
  marcus_edits: Record<string, unknown>;
  created_at: string;
  approved_at: string | null;
}

export type AuditEntityType = "lead" | "qualification" | "proposal";

export interface AuditLogRow {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: string;
  actor: string;
  payload: Record<string, unknown>;
  created_at: string;
}
