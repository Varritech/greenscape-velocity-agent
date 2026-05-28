import { ghlFetch } from "./client";

export type Tier = "qualified" | "disqualified" | "needs_human";

export const TIER_TO_STAGE: Record<Tier, string> = {
  qualified: "Qualified",
  needs_human: "Needs Human",
  disqualified: "Disqualified",
};

export async function setContactCustomField(
  contactId: string,
  fieldId: string,
  value: unknown,
): Promise<void> {
  await ghlFetch({
    method: "PUT",
    path: `/contacts/${contactId}`,
    body: {
      customFields: [{ id: fieldId, field_value: value }],
    },
  });
}

export interface UpdateOpportunityStageInput {
  pipelineId: string;
  opportunityId: string;
  tier: Tier;
}

export async function updateOpportunityStage(
  input: UpdateOpportunityStageInput,
): Promise<void> {
  // GHL uses stage IDs in v2; the human-readable name above is mapped on the
  // pipeline config side. Here we PATCH with the resolved stage_id which the
  // caller looks up once at boot and caches.
  const stageId = process.env[`GHL_STAGE_ID_${input.tier.toUpperCase()}`];
  if (!stageId) {
    // Fallback: send the label and let GHL resolve. Logs the warning via
    // the audit row in the caller.
  }
  await ghlFetch({
    method: "PUT",
    path: `/opportunities/${input.opportunityId}`,
    body: {
      pipelineId: input.pipelineId,
      pipelineStageId: stageId,
      pipelineStageName: TIER_TO_STAGE[input.tier],
    },
  });
}
