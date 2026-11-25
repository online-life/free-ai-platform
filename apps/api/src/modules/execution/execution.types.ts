import type { ExecutionRequest } from "./execution.schemas";

export interface ExecutionActor {
  tenantId: string;
  userId: string;
}

export interface ExecutionResult {
  executionId: string;
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
  output?: unknown;
  errorCode?: string;
  startedAt: Date;
  finishedAt: Date;
}

export interface ExecutionSandbox {
  run(input: {
    executionId: string;
    request: ExecutionRequest;
    tenantId: string;
  }): Promise<ExecutionResult>;
  terminate(executionId: string): Promise<void>;
}

export interface ExecutionRepository {
  create(input: {
    tenantId: string;
    projectId: string;
    taskId?: string;
    requestedById: string;
    request: ExecutionRequest;
  }): Promise<{ id: string; status: string }>;
  updateStatus(
    tenantId: string,
    executionId: string,
    status: string,
    result?: unknown,
  ): Promise<void>;
  find(tenantId: string, executionId: string): Promise<unknown | null>;
}

export interface ExecutionAuthorizer {
  assertCanExecute(
    tenantId: string,
    userId: string,
    projectId: string,
  ): Promise<void>;
}
