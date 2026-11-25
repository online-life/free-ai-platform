export type PermissionEffect = "ALLOW" | "DENY";

export interface Permission {
  id: string;
  resource: string;
  action: string;
  effect: PermissionEffect;
}

export interface AuthorizationContext {
  userId: string;
  tenantId: string;
  projectId?: string;
  permissions: Permission[];
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
}
