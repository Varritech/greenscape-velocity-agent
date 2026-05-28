import { getDbClient } from "./client";
import type { LeadRow } from "./types";

export interface InsertLeadInput {
  ghl_contact_id: string | null;
  source: string;
  raw_payload: unknown;
}

export async function insertLead(input: InsertLeadInput): Promise<LeadRow> {
  const { data, error } = await getDbClient()
    .from("leads")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as LeadRow;
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const { data, error } = await getDbClient()
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as LeadRow | null) ?? null;
}
