import { getDbClient } from "./client";
import type { QualificationRow, QualificationTier } from "./types";

export interface InsertQualificationInput {
  lead_id: string;
  score: number;
  tier: QualificationTier;
  reasoning: string;
  model: string;
  prompt_sha: string;
}

export async function insertQualification(
  input: InsertQualificationInput,
): Promise<QualificationRow> {
  const { data, error } = await getDbClient()
    .from("qualifications")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as QualificationRow;
}
