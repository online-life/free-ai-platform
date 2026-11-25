import { ModelSelectionRequestSchema } from "./model.schemas";
import type { ModelRecord, ModelRepository } from "./model.types";

export interface ModelSelectionResult {
  model: ModelRecord;
  score: number;
  reasons: string[];
}

export type RouteMode = "BEST_QUALITY" | "BEST_SPEED" | "LOWEST_COST";
export type RouteWeights = { quality: number; reliability: number; latency: number; cost: number };
export type ModelRoutingPolicies = Record<RouteMode, RouteWeights>;

export const DEFAULT_MODEL_ROUTING_POLICIES: ModelRoutingPolicies = {
  BEST_QUALITY: { quality: 0.7, reliability: 0.2, latency: 0.05, cost: 0.05 },
  BEST_SPEED: { quality: 0.15, reliability: 0.2, latency: 0.6, cost: 0.05 },
  LOWEST_COST: { quality: 0.1, reliability: 0.15, latency: 0.05, cost: 0.7 },
};

export class ModelSelectionService {
  constructor(
    private readonly repository: ModelRepository,
    private readonly policies: ModelRoutingPolicies = DEFAULT_MODEL_ROUTING_POLICIES,
  ) {}

  async select(raw: unknown, scope: { tenantId: string; projectId: string }): Promise<ModelSelectionResult> {
    const request = ModelSelectionRequestSchema.parse(raw);
    const models = await this.repository.listAvailable(scope);

    const eligible = models.filter((model) => {
      if (!model.enabled) return false;
      if (model.availability !== "AVAILABLE") return false;
      const verifiedFreeExecution = model.billingMode === "SELF_HOSTED" ||
        (model.billingMode === "FREE" && model.freeTierStatus === "VERIFIED_FREE");
      if (!verifiedFreeExecution) return false;
      if (request.requirePrivacyApproved && model.privacyApproved !== true) return false;
      if (request.requireFree && model.billingMode !== "SELF_HOSTED" && ![
        "VERIFIED_FREE",
      ].includes(model.freeTierStatus ?? "UNKNOWN")) return false;
      if (request.excludedModels.includes(model.key) ||
          (model.providerKey && request.excludedModels.includes(`${model.providerKey}:${model.key}`))) return false;
      if (request.providerKey && model.providerKey !== request.providerKey) return false;
      if (request.modelKey && model.key !== request.modelKey) return false;
      if (model.contextWindow < request.minimumContext) return false;
      if (model.maxOutputTokens < request.minimumOutputTokens) return false;

      return request.capabilities.every((capability) =>
        model.capabilities.includes(capability),
      );
    });

    const ranked = eligible.map((model) => {
      const weights = request.routeMode === "BALANCED"
        ? request.weights
        : this.policies[request.routeMode];
      const totalWeight = weights.quality + weights.reliability + weights.latency + weights.cost;
      const normalized = totalWeight > 0
        ? {
            quality: weights.quality / totalWeight,
            reliability: weights.reliability / totalWeight,
            latency: weights.latency / totalWeight,
            cost: weights.cost / totalWeight,
          }
        : { quality: 0.4, reliability: 0.3, latency: 0.2, cost: 0.1 };
      const reasoningAdjustment = request.preferReasoning ? 0.1 : 0;
      const qualityWeight = Math.min(1, normalized.quality + reasoningAdjustment);
      const reliabilityWeight = normalized.reliability;
      const latencyWeight = normalized.latency;
      const costWeight = normalized.cost;
      const knownPrice = model.inputPricePerMillion != null && model.outputPricePerMillion != null;
      const costScore = knownPrice
        ? 100 / (1 + model.inputPricePerMillion! + model.outputPricePerMillion!)
        : (model.billingMode === "SELF_HOSTED" || (request.requireFree && model.freeTierStatus) ? 100 : 0);

      const score =
        model.qualityScore * qualityWeight +
        model.reliabilityScore * reliabilityWeight +
        model.latencyScore * latencyWeight +
        costScore * costWeight;

      return {
        model,
        score,
        reasons: [
          "All required capabilities are supported",
          request.requireFree ? "Verified free-tier model required" : "Free tier not mandatory",
          model.providerKey ? `Provider: ${model.providerKey}` : "Provider metadata unavailable",
          `Routing mode: ${request.routeMode}`,
          `Context capacity: ${model.contextWindow}`,
          `Selection score: ${score.toFixed(2)}`,
        ],
      };
    }).sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) throw new Error("NO_COMPATIBLE_MODEL");

    return best;
  }
}
