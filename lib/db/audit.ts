import { getDbClient } from "./client";
import type { AuditEntityType } from "./types";

export interface RecordAuditInput {
  entity_type: AuditEntityType;
  entity_id: string;
  action: string;
  actor: string;
  payload?: Record<string, unknown>;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const { error } = await getDbClient().from("audit_log").insert({
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: input.action,
    actor: input.actor,
    payload: input.payload ?? {},
  });
  if (error) throw error;
}
