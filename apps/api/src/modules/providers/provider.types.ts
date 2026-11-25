export interface ProviderCredential {
  providerKey: string;
  secretReference: string;
}

export interface ProviderRecord {
  id: string;
  key: string;
  name: string;
  baseUrl: string;
  status: "ACTIVE" | "DISABLED" | "DEGRADED" | "SUSPENDED";
  billingMode: "FREE" | "FREE_LIMITED" | "FREE_TRIAL" | "CREDITS" | "PAY_PER_TOKEN" | "PAY_PER_REQUEST" | "SUBSCRIPTION" | "SELF_HOSTED" | "UNKNOWN";
  freeTierStatus: "VERIFIED_FREE" | "VERIFIED_LIMITED" | "TRIAL" | "PAID" | "UNKNOWN";
  timeoutMs: number;
  secretReference: string;
  providerType: string;
  authenticationType: "BEARER" | "NONE";
  customHeaders: Record<string, string>;
  healthStatus: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
}

export interface ProviderModelRecord {
  modelId: string;
  capabilities: string[];
  enabled: boolean;
  privacyApproved: boolean;
  billingMode: ProviderRecord["billingMode"];
  freeTierStatus: ProviderRecord["freeTierStatus"];
  contextWindow: number | null;
  maxOutputTokens: number | null;
}

export interface ProviderRequestScope {
  tenantId: string;
  projectId: string;
  taskId?: string;
}

export interface ProviderAdapter {
  readonly providerKey: string;
  supports(operation: string): boolean;
  execute(
    request: ProviderExecutionRequest,
    credential: string,
  ): Promise<ProviderExecutionResult>;
  discoverModels?(credential: string, signal?: AbortSignal): Promise<string[]>;
}

export interface ProviderExecutionRequest {
  model: string;
  operation: string;
  messages?: Array<{ role: string; content: unknown }>;
  input?: unknown;
  parameters: Record<string, unknown>;
  requestId: string;
  signal?: AbortSignal;
}

export interface ProviderExecutionResult {
  output: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  providerRequestId?: string;
  finishReason?: string;
}

export interface ProviderRepository {
  findByKey(key: string, scope: ProviderRequestScope): Promise<ProviderRecord | null>;
  listActive(scope: ProviderRequestScope): Promise<ProviderRecord[]>;
  findModel(providerId: string, modelId: string, scope: ProviderRequestScope): Promise<ProviderModelRecord | null>;
}

export interface CredentialResolver {
  resolve(secretReference: string, scope: ProviderRequestScope): Promise<string>;
}
