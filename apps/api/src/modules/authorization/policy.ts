import type {
  AuthorizationContext,
  AuthorizationDecision
} from "@free-ai/contracts";

export function authorize(
  context: AuthorizationContext,
  resource: string,
  action: string,
  tenantId: string,
  projectId?: string
): AuthorizationDecision {
  if (context.tenantId !== tenantId) {
    return { allowed: false, reason: "TENANT_SCOPE_MISMATCH" };
  }

  if (
    projectId !== undefined &&
    context.projectId !== projectId
  ) {
    return { allowed: false, reason: "PROJECT_SCOPE_MISMATCH" };
  }

  const matching = context.permissions.filter(
    (permission) =>
      permission.resource === resource &&
      permission.action === action
  );

  if (matching.some((permission) => permission.effect === "DENY")) {
    return { allowed: false, reason: "EXPLICIT_DENY" };
  }

  if (matching.some((permission) => permission.effect === "ALLOW")) {
    return { allowed: true, reason: "EXPLICIT_ALLOW" };
  }

  return { allowed: false, reason: "NO_PERMISSION" };
}
