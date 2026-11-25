import { WorkflowRunRequestSchema } from "./workflow.schemas";
import type {
  WorkflowActor,
  WorkflowRepository,
} from "./workflow.types";

export interface WorkflowStepExecutor {
  execute(input: {
    tenantId: string;
    runId: string;
    stepId: string;
    projectId: string;
    requestedById: string;
    type: string;
    config: Record<string, unknown>;
    state: Record<string, unknown>;
    timeoutMs: number;
    signal: AbortSignal;
  }): Promise<{
    output?: unknown;
    waitingApproval?: boolean;
  }>;
}

export class WorkflowEngineService {
  private readonly inFlight = new Set<string>();
  constructor(
    private readonly repository: WorkflowRepository,
    private readonly executor: WorkflowStepExecutor,
  ) {}

  async start(actor: WorkflowActor, raw: unknown) {
    const input = WorkflowRunRequestSchema.parse(raw);
    const workflow = await this.repository.findWorkflow(
      actor.tenantId,
      input.workflowId,
      input.projectId,
    );

    if (!workflow || workflow.status !== "ACTIVE") {
      throw new Error("WORKFLOW_NOT_AVAILABLE");
    }

    return this.repository.createRun({
      tenantId: actor.tenantId,
      workflowId: workflow.id,
      projectId: input.projectId,
      requestedById: actor.userId,
      idempotencyKey: input.idempotencyKey,
      input: input.input,
    });
  }

  async resume(actor: WorkflowActor, runId: string, projectId: string) {
    if (this.inFlight.has(runId)) throw new Error("WORKFLOW_RUN_ALREADY_CLAIMED");
    this.inFlight.add(runId);
    try {
      const run = await this.repository.findRun(actor.tenantId, runId, projectId);
      if (!run) throw new Error("WORKFLOW_RUN_NOT_FOUND");
      if (!["PENDING", "RUNNING", "PAUSED"].includes(run.status)) throw new Error("WORKFLOW_RUN_NOT_RESUMABLE");
      const workflow = await this.repository.findWorkflow(actor.tenantId, run.workflowId, projectId);
      if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
      await this.repository.updateRun(actor.tenantId, runId, projectId, { status: "RUNNING" });

      const state: Record<string, unknown> = { ...run.state };
      const completed = new Set(Array.isArray(state.completedSteps) ? state.completedSteps.filter((item): item is string => typeof item === "string") : []);
      const attemptState = state.stepAttempts && typeof state.stepAttempts === "object" && !Array.isArray(state.stepAttempts)
        ? state.stepAttempts as Record<string, unknown>
        : {};

      for (const step of workflow.definition.steps) {
      if (completed.has(step.id)) continue;

      const dependenciesReady = step.dependsOn.every((id) =>
        completed.has(id),
      );
      if (!dependenciesReady) {
        await this.repository.updateRun(actor.tenantId, runId, projectId, {
          status: "FAILED",
          state: { ...state, failure: "DEPENDENCY_NOT_COMPLETED" },
        });
        throw new Error("WORKFLOW_DEPENDENCY_NOT_COMPLETED");
      }

      await this.repository.updateRun(actor.tenantId, runId, projectId, {
        currentStepId: step.id,
        state,
      });

      let result: Awaited<ReturnType<WorkflowStepExecutor["execute"]>> | undefined;
      let lastError: unknown;
      const previousAttempts = Number.isSafeInteger(attemptState[step.id]) ? Number(attemptState[step.id]) : 0;
      for (let attempt = 0; attempt <= step.retryLimit; attempt += 1) {
        const controller = new AbortController();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          attemptState[step.id] = previousAttempts + attempt + 1;
          state.stepAttempts = attemptState;
          await this.repository.updateRun(actor.tenantId, runId, projectId, { status: "RUNNING", currentStepId: step.id, state });
          result = await Promise.race([
            this.executor.execute({ tenantId: actor.tenantId, runId, stepId: step.id, projectId, requestedById: actor.userId, type: step.type, config: step.config, state, timeoutMs: step.timeoutMs, signal: controller.signal }),
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => { controller.abort(); reject(new Error("WORKFLOW_STEP_TIMEOUT")); }, step.timeoutMs);
              timeout.unref?.();
            }),
          ]);
          break;
        } catch (error) {
          lastError = error;
          if (attempt >= step.retryLimit || (error instanceof Error && error.message === "WORKFLOW_STEP_TIMEOUT")) break;
        } finally { if (timeout) clearTimeout(timeout); }
      }
      if (!result) {
        const failure = lastError instanceof Error && /^[A-Z0-9_]+$/.test(lastError.message) ? lastError.message : "WORKFLOW_STEP_FAILED";
        await this.repository.updateRun(actor.tenantId, runId, projectId, { status: "FAILED", currentStepId: step.id, state: { ...state, failure } });
        throw new Error(failure);
      }

      if (result.waitingApproval) {
        await this.repository.updateRun(actor.tenantId, runId, projectId, {
          status: "WAITING_APPROVAL",
          currentStepId: step.id,
          state,
        });
        return { runId, status: "WAITING_APPROVAL", stepId: step.id };
      }

      state[step.id] = result.output;
      completed.add(step.id);
      state.completedSteps = [...completed];

      await this.repository.updateRun(actor.tenantId, runId, projectId, {
        status: "RUNNING",
        state,
      });
    }

    await this.repository.updateRun(actor.tenantId, runId, projectId, {
      status: "SUCCEEDED",
      state,
      currentStepId: null,
    });

      return { runId, status: "SUCCEEDED", state };
    } finally { this.inFlight.delete(runId); }
  }

  async pause(actor: WorkflowActor, runId: string, projectId: string) {
    const run = await this.repository.findRun(actor.tenantId, runId, projectId);
    if (!run) throw new Error("WORKFLOW_RUN_NOT_FOUND");
    if (run.status !== "RUNNING") throw new Error("WORKFLOW_RUN_NOT_RUNNING");

    await this.repository.updateRun(actor.tenantId, runId, projectId, {
      status: "PAUSED",
    });

    return { runId, status: "PAUSED" as const };
  }

  async cancel(actor: WorkflowActor, runId: string, projectId: string) {
    const run = await this.repository.findRun(actor.tenantId, runId, projectId);
    if (!run) throw new Error("WORKFLOW_RUN_NOT_FOUND");

    if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      throw new Error("WORKFLOW_RUN_ALREADY_FINISHED");
    }

    await this.repository.updateRun(actor.tenantId, runId, projectId, {
      status: "CANCELLED",
    });

    return { runId, status: "CANCELLED" as const };
  }

  async get(actor: WorkflowActor, runId: string, projectId: string) {
    const run = await this.repository.findRun(actor.tenantId, runId, projectId);
    if (!run) throw new Error("WORKFLOW_RUN_NOT_FOUND");
    return run;
  }
}
