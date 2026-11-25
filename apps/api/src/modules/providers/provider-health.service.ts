export interface ProviderHealth {
  providerKey: string;
  available: boolean;
  latencyMs: number;
  checkedAt: Date;
  reason?: string;
}

export interface ProviderHealthRepository {
  save(record: ProviderHealth): Promise<void>;
  latest(providerKey: string): Promise<ProviderHealth | null>;
}

export class ProviderHealthService {
  constructor(private readonly repository: ProviderHealthRepository) {}

  async record(input: ProviderHealth) {
    if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0) {
      throw new Error("INVALID_PROVIDER_LATENCY");
    }
    await this.repository.save(input);
  }

  async isHealthy(providerKey: string) {
    const record = await this.repository.latest(providerKey);
    return record?.available === true;
  }
}
