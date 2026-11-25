import type { PlatformEvent } from "@free-ai/contracts";
import { createId } from "@free-ai/shared";

export function createEvent<T>(
  type: string,
  tenantId: string | null,
  projectId: string | null,
  payload: T,
  correlationId = createId()
): PlatformEvent<T> {
  return {
    id: createId(),
    type,
    tenantId,
    projectId,
    occurredAt: new Date().toISOString(),
    correlationId,
    payload
  };
}
