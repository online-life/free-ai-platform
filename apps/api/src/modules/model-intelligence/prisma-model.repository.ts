import type { ModelCapability, Prisma } from "@prisma/client";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";
import type { ModelRecord, ModelRepository } from "./model.types";

const capabilitySet = new Set<string>([
  "TEXT_GENERATION", "REASONING", "CODE_GENERATION", "EMBEDDINGS", "VISION",
  "IMAGE_GENERATION", "AUDIO", "AUDIO_INPUT", "AUDIO_OUTPUT", "VIDEO_INPUT",
  "LONG_CONTEXT", "SPEECH_TO_TEXT", "TEXT_TO_SPEECH", "TOOL_CALLING", "STRUCTURED_OUTPUT",
]);

export class PrismaModelRepository implements ModelRepository {
  async listAvailable(scope: { tenantId: string; projectId: string }): Promise<ModelRecord[]> {
    const result = await withTenantTransaction(scope, async (tx) => {
      const setting = await tx.setting.findFirst({
        where: { tenantId: scope.tenantId, projectId: null, key: "ai.modelAvailabilityPolicy" },
        select: { value: true },
      });
      const value = setting?.value;
      const policy = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
      const platform = await tx.globalModelPolicy.findUnique({ where: { id: 1 } });
      const rows = await tx.providerModel.findMany({
      where: {
        enabled: true,
        visible: true,
        provider: {
          enabled: true,
          status: "ACTIVE",
          OR: [
            { tenantId: scope.tenantId, projectId: scope.projectId },
            { tenantId: scope.tenantId, projectId: null },
          ],
        },
      },
      include: {
        provider: { include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 } } },
        evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      });
      return {
        models: rows.map(mapModel),
        freeModelsEnabled: policy.freeModelsEnabled === true,
        paidModelsEnabled: policy.paidModelsEnabled === true,
        localModelsEnabled: platform?.localModelsEnabled === true,
        platformFreeModelsEnabled: platform?.freeModelsEnabled === true,
        platformPaidModelsEnabled: platform?.paidModelsEnabled === true,
      };
    });
    return result.models.filter((model) => isModelVisibleUnderPolicy(model, result));
  }

  async findByKey(key: string, scope: { tenantId: string; projectId: string }): Promise<ModelRecord | null> {
    const models = await this.listAvailable(scope);
    return models.find((model) => model.key === key) ?? null;
  }

  async saveEvaluation(
    modelId: string,
    metrics: Record<string, number>,
    scope: { tenantId: string; projectId: string },
    testVersion: string,
  ) {
    const model = await withTenantTransaction(scope, (tx) => tx.providerModel.findFirst({
      where: {
        id: modelId,
        provider: {
          OR: [
            { tenantId: scope.tenantId, projectId: scope.projectId },
            { tenantId: scope.tenantId, projectId: null },
          ],
        },
      },
      select: { id: true },
    }));
    if (!model) throw new Error("MODEL_NOT_FOUND_IN_SCOPE");
    if (!testVersion.trim() || testVersion.length > 80) throw new Error("MODEL_EVALUATION_VERSION_INVALID");
    await withTenantTransaction(scope, (tx) => tx.modelEvaluation.create({
      data: { providerModelId: modelId, testVersion, metrics: toPrismaJson(metrics) },
    }));
  }
}

export function isModelVisibleUnderPolicy(
  model: Pick<ModelRecord, "billingMode" | "freeTierStatus">,
  policy: {
    freeModelsEnabled: boolean;
    paidModelsEnabled: boolean;
    localModelsEnabled?: boolean;
    platformFreeModelsEnabled?: boolean;
    platformPaidModelsEnabled?: boolean;
  },
): boolean {
  if (model.billingMode === "SELF_HOSTED") return policy.localModelsEnabled === true;
  const free = model.billingMode === "FREE" && model.freeTierStatus === "VERIFIED_FREE";
  const paid = ["PAID", "PAY_PER_TOKEN", "PAY_PER_REQUEST", "SUBSCRIPTION"].includes(model.billingMode ?? "") || model.freeTierStatus === "PAID";
  // Unknown and limited pricing is never promoted into normal selectors.
  return free
    ? policy.freeModelsEnabled && policy.platformFreeModelsEnabled === true
    : paid && policy.paidModelsEnabled && policy.platformPaidModelsEnabled === true;
}

function mapModel(row: Prisma.ProviderModelGetPayload<{
  include: {
    provider: { include: { healthChecks: { orderBy: { checkedAt: "desc" }; take: 1 } } };
    evaluations: { orderBy: { createdAt: "desc" }; take: 1 };
  };
}>): ModelRecord {
  const rawCapabilities = Array.isArray(row.capabilities) ? row.capabilities : [];
  const capabilities = rawCapabilities.filter(
    (item): item is ModelCapability => typeof item === "string" && capabilitySet.has(item),
  );
  const latestHealth = row.provider.healthChecks[0];
  const latestEvaluation = row.evaluations[0];
  const metrics = latestEvaluation?.metrics && typeof latestEvaluation.metrics === "object" && !Array.isArray(latestEvaluation.metrics)
    ? latestEvaluation.metrics as Prisma.JsonObject
    : {};
  const score = (key: string) => typeof metrics[key] === "number" ? metrics[key] as number : 0;
  const lastHealthAt = latestHealth?.checkedAt.getTime() ?? 0;
  const healthFresh = Date.now() - lastHealthAt <= 5 * 60_000;
  return {
    id: row.id,
    key: row.modelId,
    displayName: row.displayName,
    capabilities,
    contextWindow: row.contextWindow ?? 0,
    maxOutputTokens: row.maxOutputTokens ?? 0,
    freeTier: row.freeTierStatus === "VERIFIED_FREE" || row.freeTierStatus === "VERIFIED_LIMITED",
    freeTierStatus: row.freeTierStatus as NonNullable<ModelRecord["freeTierStatus"]>,
    billingMode: row.billingMode as NonNullable<ModelRecord["billingMode"]>,
    enabled: row.enabled,
    availability: latestHealth?.available && healthFresh
      ? "AVAILABLE"
      : latestHealth && healthFresh
        ? "UNAVAILABLE"
        : "UNKNOWN",
    providerKey: row.provider.key,
    privacyApproved: row.privacyApproved,
    inputPricePerMillion: row.inputPricePerMillion == null ? null : Number(row.inputPricePerMillion),
    outputPricePerMillion: row.outputPricePerMillion == null ? null : Number(row.outputPricePerMillion),
    qualityScore: score("quality"),
    latencyScore: score("latency"),
    reliabilityScore: score("reliability"),
  };
}
