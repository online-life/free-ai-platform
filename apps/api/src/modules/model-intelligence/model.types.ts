import type { ModelCapability } from "@prisma/client";

export interface ModelRecord {
  id: string;
  key: string;
  displayName: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  freeTier: boolean;
  enabled: boolean;
  qualityScore: number;
  latencyScore: number;
  reliabilityScore: number;
  providerKey?: string;
  availability?: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
  freeTierStatus?: "VERIFIED_FREE" | "VERIFIED_LIMITED" | "TRIAL" | "PAID" | "UNKNOWN";
  billingMode?: "FREE" | "FREE_LIMITED" | "FREE_TRIAL" | "CREDITS" | "PAY_PER_TOKEN" | "PAY_PER_REQUEST" | "SUBSCRIPTION" | "SELF_HOSTED" | "UNKNOWN";
  inputPricePerMillion?: number | null;
  outputPricePerMillion?: number | null;
  privacyApproved?: boolean;
}

export interface ModelRepository {
  listAvailable(scope: { tenantId: string; projectId: string }): Promise<ModelRecord[]>;
  findByKey(key: string, scope: { tenantId: string; projectId: string }): Promise<ModelRecord | null>;
  saveEvaluation(
    modelId: string,
    metrics: Record<string, number>,
    scope: { tenantId: string; projectId: string },
    testVersion: string,
  ): Promise<void>;
}
