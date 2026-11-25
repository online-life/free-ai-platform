import { randomUUID } from "node:crypto";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";
import { withTenantTransaction } from "../../infrastructure/database/transaction";

export interface AuditInput {
  tenantId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export class AuditService {
  async record(input: AuditInput) {
    if (!input.tenantId || !input.action || !input.resourceType) {
      throw new Error("Invalid audit event");
    }

    return withTenantTransaction({
      tenantId: input.tenantId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.actorUserId ? { userId: input.actorUserId } : {}),
    }, (tx) => tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        correlationId: input.correlationId ?? randomUUID(),
        ...(input.metadata !== undefined
          ? { metadata: toPrismaJson(input.metadata) }
          : {}),
      },
    }));
  }
}
