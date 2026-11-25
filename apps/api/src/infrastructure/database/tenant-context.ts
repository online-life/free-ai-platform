import type { Prisma } from "@prisma/client";

export interface RequestScope {
  tenantId: string;
  projectId?: string | null;
  userId?: string | null;
}

function validateUuid(value: string, field: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
}

export async function applyDatabaseScope(
  tx: Prisma.TransactionClient,
  scope: RequestScope,
): Promise<void> {
  validateUuid(scope.tenantId, "tenantId");

  if (scope.projectId !== undefined && scope.projectId !== null && scope.projectId !== "" &&
      (scope.projectId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(scope.projectId))) {
    throw new Error("Invalid projectId");
  }
  if (scope.userId) validateUuid(scope.userId, "userId");

  await tx.$queryRaw`
    SELECT
      set_config('app.tenant_id', ${scope.tenantId}, true),
      set_config('app.project_id', ${scope.projectId ?? ""}, true),
      set_config('app.user_id', ${scope.userId ?? ""}, true)
  `;
}
