export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED";

export interface AuditEvent {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  projectId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: AuditOutcome;
  occurredAt: string;
  correlationId: string;
}
