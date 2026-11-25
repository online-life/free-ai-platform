export interface ModelHealthRecord {
  modelKey: string;
  available: boolean;
  checkedAt: Date;
  latencyMs?: number;
  errorCode?: string;
}

export interface ModelHealthRepository {
  save(record: ModelHealthRecord): Promise<void>;
  latest(modelKey: string): Promise<ModelHealthRecord | null>;
}

export class ModelHealthService {
  constructor(private readonly repository: ModelHealthRepository) {}

  async record(record: ModelHealthRecord) {
    if (record.latencyMs !== undefined &&
        (!Number.isFinite(record.latencyMs) || record.latencyMs < 0)) {
      throw new Error("INVALID_LATENCY");
    }

    await this.repository.save(record);
  }

  async isAvailable(modelKey: string) {
    const latest = await this.repository.latest(modelKey);
    return latest?.available === true;
  }
}
