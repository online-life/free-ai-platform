export interface QuotaReservation {
  tenantId: string;
  providerKey: string;
  requestId: string;
  units: number;
}

export interface QuotaRepository {
  reserve(input: QuotaReservation): Promise<boolean>;
  release(input: QuotaReservation): Promise<void>;
}

export class ProviderQuotaService {
  constructor(private readonly repository: QuotaRepository) {}

  async reserve(input: QuotaReservation) {
    if (!input.tenantId || !input.providerKey || !input.requestId) {
      throw new Error("QUOTA_RESERVATION_INVALID");
    }
    if (!Number.isSafeInteger(input.units) || input.units <= 0) {
      throw new Error("QUOTA_UNITS_INVALID");
    }

    const reserved = await this.repository.reserve(input);
    if (!reserved) throw new Error("PROVIDER_QUOTA_EXCEEDED");
    return { reserved: true };
  }

  async release(input: QuotaReservation) {
    await this.repository.release(input);
  }
}
