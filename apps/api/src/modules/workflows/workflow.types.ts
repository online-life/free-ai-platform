import type { WorkflowDefinition } from "./workflow.schemas";

export interface WorkflowActor {
  tenantId: string;
  userId: string;
}

export interface WorkflowRecord {
  id: string;
  tenantId: string;
  key: string;
  version: string;
  status: string;
  definition: WorkflowDefinition;
  projectId?: string | null;
}

export interface WorkflowRunRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  projectId: string;
  status: string;
  currentStepId?: string | null;
  state: Record<string, unknown>;
}

export interface WorkflowRepository {
  findWorkflow(tenantId: string, workflowId: string, projectId?: string): Promise<WorkflowRecord | null>;
  createWorkflow(
    tenantId: string,
    actorId: string,
    definition: WorkflowDefinition,
    projectId?: string,
  ): Promise<WorkflowRecord>;
  createVersion(tenantId: string, actorId: string, workflowId: string, definition: WorkflowDefinition, projectId?: string): Promise<WorkflowRecord>;
  setStatus(tenantId: string, actorId: string, workflowId: string, status: "ACTIVE" | "DISABLED" | "ARCHIVED", projectId?: string): Promise<void>;
  createRun(input: {
    tenantId: string;
    workflowId: string;
    projectId: string;
    requestedById: string;
    idempotencyKey: string;
    input: unknown;
  }): Promise<WorkflowRunRecord>;
  findRun(tenantId: string, runId: string, projectId: string): Promise<WorkflowRunRecord | null>;
  updateRun(
    tenantId: string,
    runId: string,
    projectId: string,
    update: Partial<WorkflowRunRecord>,
  ): Promise<void>;
}
