import type { RequestScope } from "../infrastructure/database/tenant-context";

export function requireTenantScope(
  scope: Partial<RequestScope> | undefined,
): RequestScope {
  if (!scope?.tenantId) {
    throw new Error("TENANT_SCOPE_REQUIRED");
  }

  return {
    tenantId: scope.tenantId,
    projectId: scope.projectId ?? null,
    userId: scope.userId ?? null,
  };
}
