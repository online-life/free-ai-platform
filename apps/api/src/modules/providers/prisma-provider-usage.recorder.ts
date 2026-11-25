import { withTenantTransaction } from "../../infrastructure/database/transaction";
import type { GatewayUsageRecorder } from "./unified-gateway.service";

export class PrismaProviderUsageRecorder implements GatewayUsageRecorder {
  async record(input: Parameters<GatewayUsageRecorder["record"]>[0]) {
    await withTenantTransaction(input.scope, async (tx) => {
      const model = await tx.providerModel.findUnique({
        where: { providerId_modelId: { providerId: input.providerId, modelId: input.modelKey } },
        select: { id: true },
      });
      await tx.providerUsage.create({
      data: {
        tenantId: input.scope.tenantId,
        projectId: input.scope.projectId,
        providerId: input.providerId,
        ...(model ? { providerModelId: model.id } : {}),
        requestId: input.requestId,
        ...(input.taskId ? { taskId: input.taskId } : {}),
        operation: input.operation,
        status: input.success ? "SUCCEEDED" : "FAILED",
        ...(input.usage?.inputTokens !== undefined ? { inputTokens: input.usage.inputTokens } : {}),
        ...(input.usage?.outputTokens !== undefined ? { outputTokens: input.usage.outputTokens } : {}),
        durationMs: Math.max(0, Math.round(input.durationMs)),
        ...(input.errorCode ? { errorCode: input.errorCode.slice(0, 100) } : {}),
      },
      select: { id: true },
      });
    });
  }
}
