import { ForbiddenError } from "@free-ai/shared";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import type { Prisma } from "@prisma/client";

export function assertProjectScope(
  requestedTenantId: string,
  requestedProjectId: string,
  activeTenantId: string,
  allowedProjectIds: ReadonlySet<string>
): void {
  if (requestedTenantId !== activeTenantId) {
    throw new ForbiddenError("Tenant isolation violation");
  }

  if (!allowedProjectIds.has(requestedProjectId)) {
    throw new ForbiddenError("Project isolation violation");
  }
}

export function withProjectTransaction<T>(
  actor: { tenantId: string; userId: string },
  projectId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId, projectId }, operation);
}
