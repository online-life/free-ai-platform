import { ModelDefinitionSchema } from "./model.schemas";
import type { ModelRepository } from "./model.types";

export class ModelRegistryService {
  constructor(private readonly repository: ModelRepository) {}

  async list(scope: { tenantId: string; projectId: string }) {
    return this.repository.listAvailable(scope);
  }

  async get(key: string, scope: { tenantId: string; projectId: string }) {
    const model = await this.repository.findByKey(key, scope);
    if (!model) throw new Error("MODEL_NOT_FOUND");
    return model;
  }

  async evaluate(
    modelId: string,
    metrics: Record<string, number>,
    scope: { tenantId: string; projectId: string },
    testVersion: string,
  ) {
    for (const [key, value] of Object.entries(metrics)) {
      if (!Number.isFinite(value)) {
        throw new Error(`INVALID_MODEL_METRIC:${key}`);
      }
    }
    await this.repository.saveEvaluation(modelId, metrics, scope, testVersion);
  }

  validateDefinition(raw: unknown) {
    return ModelDefinitionSchema.parse(raw);
  }
}
