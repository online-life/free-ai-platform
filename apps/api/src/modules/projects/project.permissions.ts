import type { ProjectRole } from "@prisma/client";

export type ProjectAction =
  | "project.read"
  | "project.update"
  | "project.delete"
  | "project.manage_members"
  | "project.manage_settings"
  | "intake.create"
  | "intake.review"
  | "requirement.manage"
  | "task.create"
  | "task.update"
  | "task.assign"
  | "task.delete"
  | "context.manage"
  | "file.manage"
  | "activity.create";

const permissions: Record<ProjectRole, ReadonlySet<ProjectAction>> = {
  OWNER: new Set([
    "project.read", "project.update", "project.delete",
    "project.manage_members", "project.manage_settings",
    "intake.create", "intake.review", "requirement.manage",
    "task.create", "task.update", "task.assign", "task.delete",
    "context.manage", "file.manage", "activity.create",
  ]),
  MANAGER: new Set([
    "project.read", "project.update", "project.manage_members",
    "intake.create", "intake.review", "requirement.manage",
    "task.create", "task.update", "task.assign", "task.delete",
    "context.manage", "file.manage", "activity.create",
  ]),
  MEMBER: new Set([
    "project.read", "intake.create", "task.create",
    "task.update", "activity.create",
  ]),
  VIEWER: new Set(["project.read"]),
};

export function assertProjectPermission(
  role: ProjectRole,
  action: ProjectAction,
): void {
  if (!permissions[role]?.has(action)) {
    throw new Error(`FORBIDDEN: Missing project permission: ${action}`);
  }
}
