import { ExecutionRequestSchema } from "./execution.schemas";
import type {
  ExecutionActor,
  ExecutionAuthorizer,
  ExecutionRepository,
  ExecutionSandbox,
} from "./execution.types";

export class ExecutionService {
  constructor(
    private readonly repository: ExecutionRepository,
    private readonly authorizer: ExecutionAuthorizer,
    private readonly sandbox: ExecutionSandbox,
  ) {}

  async submit(actor: ExecutionActor, raw: unknown) {
    const request = ExecutionRequestSchema.parse(raw);

    await this.authorizer.assertCanExecute(
      actor.tenantId,
      actor.userId,
      request.projectId,
    );

    const record = await this.repository.create({
      tenantId: actor.tenantId,
      projectId: request.projectId,
      ...(request.taskId ? { taskId: request.taskId } : {}),
      requestedById: actor.userId,
      request,
    });

    await this.repository.updateStatus(
      actor.tenantId,
      record.id,
      "PREPARING",
    );

    return {
      executionId: record.id,
      status: "PREPARING",
    };
  }

  async run(actor: ExecutionActor, executionId: string) {
    const record = await this.repository.find(actor.tenantId, executionId);
    if (!record) throw new Error("EXECUTION_NOT_FOUND");

    await this.repository.updateStatus(
      actor.tenantId,
      executionId,
      "RUNNING",
    );

    try {
      const result = await this.sandbox.run({
        executionId,
        request: record as never,
        tenantId: actor.tenantId,
      });

      await this.repository.updateStatus(
        actor.tenantId,
        executionId,
        result.status,
        result,
      );

      return result;
    } catch (error) {
      await this.repository.updateStatus(
        actor.tenantId,
        executionId,
        "FAILED",
        {
          errorCode: error instanceof Error ? error.message : "EXECUTION_FAILED",
        },
      );
      throw error;
    }
  }

  async cancel(actor: ExecutionActor, executionId: string) {
    const record = await this.repository.find(actor.tenantId, executionId);
    if (!record) throw new Error("EXECUTION_NOT_FOUND");

    await this.sandbox.terminate(executionId);
    await this.repository.updateStatus(
      actor.tenantId,
      executionId,
      "CANCELLED",
    );

    return { executionId, status: "CANCELLED" as const };
  }

  async get(actor: ExecutionActor, executionId: string) {
    const record = await this.repository.find(actor.tenantId, executionId);
    if (!record) throw new Error("EXECUTION_NOT_FOUND");
    return record;
  }
}
