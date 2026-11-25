import { ProviderDefinitionSchema } from "./provider.schemas";
import type { ProviderRepository } from "./provider.types";

export class ProviderRegistryService {
  constructor(private readonly repository: ProviderRepository) {}

  async get(key: string, scope: { tenantId: string; projectId: string }) {
    const provider = await this.repository.findByKey(key, scope);
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    return provider;
  }

  async listActive(scope: { tenantId: string; projectId: string }) {
    return this.repository.listActive(scope);
  }

  validateDefinition(raw: unknown) {
    return ProviderDefinitionSchema.parse(raw);
  }
}
