export type ProjectStatus = "ACTIVE" | "ARCHIVED" | "SUSPENDED";

export interface ProjectScope {
  tenantId: string;
  projectId: string;
}

export interface ProjectRecord {
  id: string;
  tenantId: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
}
