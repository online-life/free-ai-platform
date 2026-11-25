import type { AuditEvent } from "@free-ai/contracts";
import { createId } from "@free-ai/shared";

export function createAuditEvent(
  input: Omit<AuditEvent, "id" | "occurredAt">
): AuditEvent {
  return {
    ...input,
    id: createId(),
    occurredAt: new Date().toISOString()
  };
}
