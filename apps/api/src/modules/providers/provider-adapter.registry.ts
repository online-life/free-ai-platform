import type { ProviderAdapter } from "./provider.types";
import type { ProviderRecord } from "./provider.types";
import { OpenAICompatibleAdapter } from "./openai-compatible.adapter";

export class ProviderAdapterRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();
  private readonly factories = new Map<string, (provider: ProviderRecord) => ProviderAdapter>();

  constructor() {
    const compatibleFactory = (provider: ProviderRecord) => new OpenAICompatibleAdapter(
      provider.key,
      provider.baseUrl,
      undefined,
      { authenticationType: provider.authenticationType, customHeaders: provider.customHeaders, allowLocal: provider.providerType === "LOCAL_OPENAI_COMPATIBLE" },
    );
    this.registerFactory("OPENAI_COMPATIBLE", compatibleFactory);
    this.registerFactory("LOCAL_OPENAI_COMPATIBLE", compatibleFactory);
  }

  register(adapter: ProviderAdapter) {
    if (this.adapters.has(adapter.providerKey)) {
      throw new Error("PROVIDER_ADAPTER_ALREADY_REGISTERED");
    }
    this.adapters.set(adapter.providerKey, adapter);
  }

  registerFactory(providerType: string, factory: (provider: ProviderRecord) => ProviderAdapter) {
    if (this.factories.has(providerType)) throw new Error("PROVIDER_FACTORY_ALREADY_REGISTERED");
    this.factories.set(providerType, factory);
  }

  get(provider: ProviderRecord) {
    const adapter = this.adapters.get(provider.key);
    if (adapter) return adapter;
    const factory = this.factories.get(provider.providerType);
    if (!factory) throw new Error("PROVIDER_ADAPTER_NOT_FOUND");
    return factory(provider);
  }

  list() {
    return [...this.adapters.keys()];
  }
}
